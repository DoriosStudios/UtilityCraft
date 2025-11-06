import { world, system, ItemStack } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'
import { FluidManager } from '../managers.js'

const offsets = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

const blockFaceOffsets = {
    down: [0, 1, 0],
    up: [0, -1, 0],
    south: [0, 0, -1],
    north: [0, 0, 1],
    east: [-1, 0, 0],
    west: [1, 0, 0],
}

const types = {
    energy: startRescanEnergy,
    item: startRescanItem,
    fluid: startRescanFluid
}


//#region Utils
/**
 * Updates the block geometry states to visually connect with valid neighbors.
 *
 * Rules:
 * - Connects to any block sharing the same tag.
 * - If this block has 'dorios:item', also connects to vanilla containers or drawers.
 *
 * @param {Block} block The block to update.
 * @param {string} tag The connection tag (e.g. "dorios:energy").
 */
export function updateGeometry(block, tag) {
    if (!block?.permutation || !block?.dimension) return;

    const dim = block.dimension;
    const { x, y, z } = block.location;

    // Precompute the neighbor offsets
    const offsets = {
        up: { x, y: y + 1, z },
        down: { x, y: y - 1, z },
        north: { x, y, z: z - 1 },
        south: { x, y, z: z + 1 },
        east: { x: x + 1, y, z },
        west: { x: x - 1, y, z }
    };

    // Cache tag and container info for faster checks
    const isItemConduit = block.hasTag("dorios:item");

    for (const [dir, loc] of Object.entries(offsets)) {
        const neighbor = dim.getBlock(loc);
        if (!neighbor) {
            block.setState(`utilitycraft:${dir}`, false);
            continue;
        }

        // Connection logic
        const sameNetwork = neighbor.hasTag(tag);
        const validContainer = isItemConduit && (
            DoriosAPI.constants.vanillaContainers.includes(neighbor.typeId) ||
            neighbor.typeId.includes("dustveyn:storage_drawers")
        );

        const shouldConnect = sameNetwork || validContainer;

        // Apply state only if changed (avoid redundant permutations)
        if (block.getState(`utilitycraft:${dir}`) !== shouldConnect) {
            block.setState(`utilitycraft:${dir}`, shouldConnect);
        }
    }
}

/**
 * Updates the visual connection geometry of an Exporter-type block.
 *
 * This function determines which faces of the block should visually connect
 * to nearby blocks based on orientation and network tags.
 *
 * ## Behavior:
 * - The `directionMap` ensures that visual states are rotated correctly
 *   according to the block's facing direction (`minecraft:block_face`).
 * - Connections are established with neighboring blocks that share the same tag.
 * - If the block has the `dorios:item` tag, it also connects to vanilla containers
 *   and compatible drawers (e.g., Dustveyn Storage Drawers).
 *
 * @param {import("@minecraft/server").Block} block The exporter block whose geometry should update.
 * @param {string} tag The tag identifying compatible network blocks.
 */
export function updateGeometryExporter(block, tag) {
    if (!block?.permutation || !block?.dimension) return;

    const permutation = block.permutation;
    const dim = block.dimension;
    const facing = permutation.getState("minecraft:block_face");

    // Do NOT modify this map — it defines visual rotation logic
    const directionMap = {
        north: { north: "south", south: "north", east: "west", west: "east", up: "up", down: "down" },
        south: { north: "north", south: "south", east: "east", west: "west", up: "up", down: "down" },
        east: { north: "east", south: "west", east: "south", west: "north", up: "up", down: "down" },
        west: { north: "west", south: "east", east: "north", west: "south", up: "up", down: "down" },
        up: { north: "up", south: "down", east: "east", west: "west", up: "south", down: "north" },
        down: { north: "down", south: "up", east: "east", west: "west", up: "north", down: "south" }
    };

    // Coordinate offsets instead of repeated .above/.below() calls (slightly faster)
    const { x, y, z } = block.location;
    const neighbors = {
        up: dim.getBlock({ x, y: y + 1, z }),
        down: dim.getBlock({ x, y: y - 1, z }),
        north: dim.getBlock({ x, y, z: z - 1 }),
        south: dim.getBlock({ x, y, z: z + 1 }),
        east: dim.getBlock({ x: x + 1, y, z }),
        west: dim.getBlock({ x: x - 1, y, z })
    };

    const map = directionMap[facing] || directionMap.north;
    const isItemConduit = block.hasTag("dorios:item");

    let newPerm = permutation;

    for (const [dir, visualDir] of Object.entries(map)) {
        const neighbor = neighbors[dir];
        if (!neighbor) {
            newPerm = newPerm.withState(`utilitycraft:${visualDir}`, false);
            continue;
        }

        const connectsSameTag = neighbor.hasTag(tag);
        const connectsContainer =
            isItemConduit &&
            (DoriosAPI.constants.vanillaContainers.includes(neighbor.typeId) ||
                neighbor.typeId.includes("dustveyn:storage_drawers"));

        const shouldConnect = connectsSameTag || connectsContainer;
        newPerm = newPerm.withState(`utilitycraft:${visualDir}`, shouldConnect);
    }

    block.setPermutation(newPerm);
}

/**
 * Updates a pipe or conduit network around a given block.
 *
 * This function scans the six adjacent blocks (and itself) to determine whether
 * they belong to the same network (identified by `tag`). If a valid connection is found,
 * the provided `rescanFunction` is called to rebuild or validate the network data.
 *
 * Then, based on the neighbor's role:
 * - If it has `dorios:isExporter`, its geometry is updated using {@link updateGeometryExporter}.
 * - If it has `dorios:isTube`, its geometry is updated using {@link updateGeometry}.
 *
 * @param {import("@minecraft/server").Block} block The central block to check around.
 * @param {string} tag The tag that identifies all connected network blocks.
 *        The function used to rebuild or retrieve the network map when a connection is detected.
 */
export function updatePipes(block, tag) {
    const dim = block.dimension;
    const rescanFunction = types[tag]
    tag = 'dorios:' + tag
    const { x, y, z } = block.location;
    // Collect center + 6 direct neighbors
    const neighbors = [
        block,
        dim.getBlock({ x, y: y + 1, z }),
        dim.getBlock({ x, y: y - 1, z }),
        dim.getBlock({ x, y, z: z - 1 }),
        dim.getBlock({ x, y, z: z + 1 }),
        dim.getBlock({ x: x - 1, y, z }),
        dim.getBlock({ x: x + 1, y, z })
    ];

    let network = undefined;

    for (const neighbor of neighbors) {
        if (!neighbor?.hasTag(tag)) continue;

        const key = `${neighbor.location.x},${neighbor.location.y},${neighbor.location.z}`;

        // Initialize or rescan network only when not already known
        if (!network?.has?.(key)) {
            network = rescanFunction(neighbor.location, dim);
        }

        // Update geometry according to role
        if (neighbor.hasTag("dorios:isExporter")) {
            updateGeometryExporter(neighbor, tag);
        } else if (neighbor.hasTag("dorios:isTube")) {
            updateGeometry(neighbor, tag);
        }
    }
}
//#endregion

//#region Energy
/**
 * Performs a full rescan of the energy network starting from a given position.
 *
 * This function performs a breadth-first search (BFS) through all adjacent blocks
 * tagged with `dorios:energy`. It explores connected cables, ports, and energy sources,
 * and for each detected source or port, it delegates to {@link searchEnergyContainers}
 * to locate all connected energy containers.
 *
 * ## Behavior:
 * - Stops scanning when a block lacks the `dorios:energy` tag.
 * - Detects cables (`utilitycraft:energy_cable`) and follows all six directions recursively.
 * - Detects generator or port entities (`dorios:energy_source`, `dorios:port`) and
 *   triggers `searchEnergyContainers` for each one.
 * - Automatically adds connected blocks or entities to the appropriate generator’s tag list.
 *
 * This function should be called when a cable, machine, or generator
 * is placed or removed to ensure network synchronization.
 *
 * @param {import("@minecraft/server").Vector3} startPos The position where the rescan starts.
 * @param {import("@minecraft/server").Dimension} dimension The dimension in which to perform the scan.
 *
 * @example
 * // Called when an energy cable is placed
 * startRescanEnergy(block.location, block.dimension);
 */
export function startRescanEnergy(startPos, dimension) {
    const queue = [startPos];
    const visited = new Set();

    while (queue.length > 0) {
        const pos = queue.shift();
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const block = dimension.getBlock(pos);
        if (!block.hasTag('dorios:energy')) continue

        if (block?.typeId === "utilitycraft:energy_cable") {
            for (const offset of offsets) {
                queue.push({
                    x: pos.x + offset.x,
                    y: pos.y + offset.y,
                    z: pos.z + offset.z,
                });
            }
            continue;
        }
        // Get the entity at this position (should only be one if it's a machine/gen)
        let entity = dimension.getEntitiesAtBlockLocation(pos)[0];
        if (block.hasTag('dorios:port')) {
            entity = dimension.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0]
            let queue = []
            if (!entity) continue
            entity.getTags()
                .filter(tag => tag.startsWith("input:["))
                .map(tag => {
                    const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
                    queue.push(dimension.getBlock({ x, y, z })?.location);
                });
            searchEnergyContainers(queue, entity)
            continue
        }
        if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_source")) {
            let queue = []
            queue.push(pos)
            searchEnergyContainers(queue, entity)
        }
    }
}

/**
 * Searches for all connected energy containers from a given generator entity.
 *
 * This function performs a localized BFS traversal starting from a queue of positions
 * (usually collected by {@link startRescanEnergy}) and finds every connected block
 * or entity that can receive energy from the provided generator.
 *
 * ## Behavior:
 * - Scans all cables (`utilitycraft:energy_cable`) connected to the generator.
 * - Follows the `dorios:energy` tag to discover all machines or ports linked to the network.
 * - When a connected machine or port is found:
 *   - Adds its coordinates as a `net:[x,y,z]` tag on the generator entity.
 * - Removes old `net:` tags from the generator before applying the updated set.
 *
 * The BFS is self-contained per generator. It does not modify unrelated networks,
 * and it can safely be called multiple times for revalidation.
 *
 * @param {import("@minecraft/server").Vector3[]} startQueue Array of block positions to begin the localized search from.
 * @param {import("@minecraft/server").Entity} gen The generator or energy source entity initiating the search.
 *
 * @example
 * // Called internally by startRescanEnergy
 * searchEnergyContainers([{x:10, y:65, z:20}], generatorEntity);
 */
function searchEnergyContainers(startQueue, gen) {

    const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ];
    const dimension = gen.dimension
    let queue = []
    const visited = new Set();
    startQueue.forEach(startPos => {
        const key = `${startPos.x},${startPos.y},${startPos.z}`;
        if (!visited.has(key)) visited.add(key);
        for (const offset of offsets) {
            queue.push({
                x: startPos.x + offset.x,
                y: startPos.y + offset.y,
                z: startPos.z + offset.z,
            });
        }
    })
    const machines = [];
    while (queue.length > 0) {
        const pos = queue.shift();
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const block = dimension.getBlock(pos);
        if (!block.hasTag('dorios:energy')) continue

        if (block?.typeId === "utilitycraft:energy_cable") {
            for (const offset of offsets) {
                queue.push({
                    x: pos.x + offset.x,
                    y: pos.y + offset.y,
                    z: pos.z + offset.z,
                });
            }
            continue;
        }
        let entity = dimension.getEntitiesAtBlockLocation(pos)[0];

        if (block?.hasTag('dorios:energy') && block?.hasTag('dorios:port')) {
            entity = dimension.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0]
            if (entity) machines.push(entity.location);
            continue
        }
        if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_container")) machines.push(pos)

    }
    // Remove old tags starting with net:[
    gen.getTags().forEach(tag => {
        if (tag.startsWith("net:")) gen.removeTag(tag)
    })

    // Add the machines' positions as tags to the generator
    for (const pos of machines) {
        gen.addTag(`net:[${pos.x},${pos.y},${pos.z}]`);
    }
    gen.addTag('updateNetwork')
}
//#endregion

//#region Items


/**
 * Opens the Exporter configuration menu.
 * Includes:
 *  - Power toggle (on/off)
 *  - Transfer mode selection ("nearest" | "farthest" | "round")
 *  - Whitelist/Blacklist filter options
 *  - Item filter list (add/remove)
 *
 * @param {Block} block The Exporter block.
 * @param {Player} player The interacting player.
 */
function openExporterMenu(block, player) {
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return;

    const isOff = entity.getDynamicProperty('isOff') ?? false;
    const mode = entity.getDynamicProperty('transferMode') ?? 'nearest';
    const whitelist = entity.getDynamicProperty('utilitycraft:whitelistOn') ?? true;
    const acceptedItems = entity.getTags()
        .filter(tag => !tag.startsWith('ent:') && !tag.startsWith('van:') && !tag.startsWith('dra:') && !tag.startsWith('update'));

    // ──────────────────────────────────────────────
    // 1️⃣ Base menu
    // ──────────────────────────────────────────────
    const menu = new ActionFormData()
        .title('Item Exporter Settings')
        .body(`§7Manage item export settings.\n\n§rCurrent mode: §e${DoriosAPI.utils.capitalizeFirst(mode)}\n§rPower: §a${isOff ? 'OFF' : 'ON'}`);

    // Buttons
    menu.button(`${isOff ? 'Turn ON' : 'Turn OFF'}\n§8Toggle exporter activity`, `textures/ui/toggle_${isOff ? 'on' : 'off'}`);
    menu.button(`Transfer Mode\n§8(${DoriosAPI.utils.capitalizeFirst(mode)})`, 'textures/items/compass_item.png');
    menu.button(`${whitelist ? 'Whitelist' : 'Blacklist'} Mode\n§8Click to toggle`, whitelist
        ? 'textures/items/misc/whitelist.png'
        : 'textures/items/misc/blacklist.png');
    menu.button('Add Item\n§8(Add item from Mainhand)', 'textures/ui/icon_import.png');
    menu.button('Remove Item\n§8(Select to remove)', 'textures/ui/trash_default.png');

    // ──────────────────────────────────────────────
    // 2️⃣ Handle menu actions
    // ──────────────────────────────────────────────
    menu.show(player).then(result => {
        const selection = result.selection;
        if (selection === undefined) return;

        switch (selection) {
            case 0: // Toggle ON/OFF
                entity.setDynamicProperty('isOff', !isOff);
                player.onScreenDisplay.setActionBar(`§7Exporter ${isOff ? '§aEnabled' : '§cDisabled'}`);
                return;

            case 1: // Transfer Mode
                openTransferModeMenu(entity, player);
                return;

            case 2: // Toggle whitelist/blacklist
                entity.setDynamicProperty('utilitycraft:whitelistOn', !whitelist);
                player.onScreenDisplay.setActionBar(`§7Filter mode set to: §e${!whitelist ? 'Whitelist' : 'Blacklist'}`);
                return;

            case 3: { // Add item
                const hasFilter = block.permutation.getState('utilitycraft:filter')
                if (!hasFilter) {
                    player.onScreenDisplay.setActionBar(`§cMissing filter upgrade.`);
                    return
                }
                const mainHand = player.getComponent('equippable')?.getEquipment('Mainhand');
                if (mainHand) {
                    entity.addTag(`${mainHand.typeId}`);
                    player.onScreenDisplay.setActionBar(`§aAdded: §r${mainHand.typeId}`);
                } else {
                    player.onScreenDisplay.setActionBar(`§cYou must hold an item in your main hand.`);
                }
                return;
            }

            case 4: // Remove item
                openRemoveItemMenu(block, player, entity, acceptedItems);
                return;
        }
    });
}

/**
 * Opens a modal form for selecting transfer mode.
 *
 * Modes:
 *  - nearest → send to closest entity first.
 *  - farthest → send to farthest entity first.
 *  - round → rotate between all entities sequentially.
 *
 * @param {Entity} entity Exporter entity.
 * @param {Player} player Player using the menu.
 */
function openTransferModeMenu(entity, player) {
    const mode = entity.getDynamicProperty('transferMode') ?? 'nearest';
    const modes = ['Nearest', 'Farthest', 'Round'];
    const current = modes.indexOf(mode);
    const defaultIndex = current >= 0 ? current : 0;

    const modal = new ModalFormData()
        .title('Transfer Mode')
        .dropdown('Select item transfer behavior:', modes, { defaultValueIndex: defaultIndex });

    modal.show(player).then(result => {
        const [selection] = result.formValues;
        const newMode = modes[selection] ?? 'Nearest';
        entity.setDynamicProperty('transferMode', newMode.toLowerCase());
        player.onScreenDisplay.setActionBar(`§7Transfer mode set to: §e${newMode}`);
    });
}

/**
 * Opens a submenu to remove items from the Exporter filter.
 *
 * @param {Block} block The exporter block.
 * @param {Player} player The player.
 * @param {Entity} entity The exporter entity.
 * @param {string[]} items List of filterable tags.
 */
function openRemoveItemMenu(block, player, entity, items) {
    if (!items || items.length === 0) {
        player.onScreenDisplay.setActionBar('§cNo items to remove.');
        return;
    }

    const menu = new ActionFormData()
        .title('Remove Item')
        .body('§7Select an item to remove from the filter.');

    for (const tag of items) {
        menu.button(DoriosAPI.utils.formatIdToText(tag));
    }

    menu.show(player).then(result => {
        const selection = result.selection;
        if (selection === undefined) {
            openExporterMenu(block, player);
            return;
        }

        const tagToRemove = items[selection];
        entity.removeTag(tagToRemove);
        player.onScreenDisplay.setActionBar(`§cRemoved: §r${tagToRemove}`);

        openExporterMenu(block, player);
    });
}

/**
 * UtilityCraft - Item Exporter
 * Pulls items from the attached container and exports them to its cached item network.
 * Network cache key: dorios:item_nodes (JSON array of {x,y,z})
 * Mode key: transferMode → "nearest" | "farthest" | "round"
 * Round index key: dorios:item_round_idx (number)
 */
DoriosAPI.register.blockComponent('exporter', {
    // ─────────────────────────────────────────────────────────────
    // Keep your original entity spawn / cleanup
    // ─────────────────────────────────────────────────────────────
    beforeOnPlayerPlace(e) {
        const { block } = e
        let { x, y, z } = block.location
        y += 0.375; x += 0.5; z += 0.5
        system.run(() => {
            const entity = block.dimension.spawnEntity('utilitycraft:pipe', { x, y, z })
            entity.setDynamicProperty('utilitycraft:whitelistOn', true)
            // defaults for mode & round
            entity.setDynamicProperty('transferMode', 'nearest')
            entity.setDynamicProperty('dorios:item_round_idx', 0)
        })
    },

    onPlayerBreak(e) {
        const ent = e.block.dimension.getEntitiesAtBlockLocation(e.block.center())[0]
        if (ent) ent.remove()
    },

    onPlayerInteract(e) {
        const { block, player } = e
        if (player.isSneaking) return
        // const hasFilter = block.permutation.getState('utilitycraft:filter')
        // if (!hasFilter) return

        // const mainHand = player.getComponent('equippable')?.getEquipment('Mainhand')
        // if (!mainHand?.typeId?.includes('wrench')) return

        openExporterMenu(block, player) // tu menú existente si lo deseas reutilizar
    },

    /**
     * Main tick: export items to item-network
     */
    onTick({ block, dimension }) {
        if (!globalThis.worldLoaded) return

        // ─────────────────────────────────────────────────────────
        // 1) Get exporter entity & basic flags
        // ─────────────────────────────────────────────────────────
        const exporter = dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!exporter) return

        // Optional off toggle
        if (exporter.getDynamicProperty('isOff')) return

        const hasFilter = block.permutation.getState('utilitycraft:filter') == 1
        const whiteList = exporter.getDynamicProperty('utilitycraft:whitelistOn') ?? true
        // ─────────────────────────────────────────────────────────
        // 2) Determine source container (adjacent to block_face)
        // ─────────────────────────────────────────────────────────
        const face = block.permutation.getState('minecraft:block_face')
        const off = blockFaceOffsets[face] || [0, -1, 0]
        const sourceLoc = {
            x: block.location.x + off[0],
            y: block.location.y + off[1],
            z: block.location.z + off[2],
        }

        const sourceInv = DoriosAPI.containers.getContainerAt(sourceLoc, dimension)
        if (!sourceInv) return

        const [startSlot, endSlot] = DoriosAPI.containers.getAllowedSlotRange(
            dimension.getEntitiesAtBlockLocation(sourceLoc)[0] ?? sourceInv
        )

        // Early out if source empty
        if (sourceInv.emptySlotsCount == sourceInv.size) return

        // ─────────────────────────────────────────────────────────
        // 3) Load or rebuild cached network nodes (like Energy/Fluid)
        //    Cache key: dorios:item_nodes
        // ─────────────────────────────────────────────────────────
        let cached = exporter.getDynamicProperty('dorios:item_nodes')
        const needsUpdate = exporter.hasTag('updateNetwork')

        if (!cached || needsUpdate) {
            const pos = exporter.location
            // Build from tags: pos:[x,y,z] or van:[x,y,z]
            const positions = exporter.getTags()
                .filter(t => t.startsWith('ent:[') || t.startsWith('van:[') || t.startsWith('dra:['))
                .map(tag => {
                    const [x, y, z] = tag.slice(5, -1).split(',').map(Number)
                    return { x, y, z }
                })
                .sort((a, b) =>
                    DoriosAPI.math.distanceBetween(pos, a) - DoriosAPI.math.distanceBetween(pos, b)
                )
            exporter.setDynamicProperty('dorios:item_nodes', JSON.stringify(positions))
            exporter.removeTag('updateNetwork')
            cached = JSON.stringify(positions)
        }

        /** @type {{x:number,y:number,z:number}[]} */
        const targets = JSON.parse(cached || '[]')
        if (targets.length === 0) return

        // ─────────────────────────────────────────────────────────
        // 4) Select distribution mode and order targets
        //    Mode key: transferMode → "nearest" | "farthest" | "round"
        //    Round index: dorios:item_round_idx
        // ─────────────────────────────────────────────────────────
        const mode = exporter.getDynamicProperty('transferMode') || 'nearest'
        let orderedTargets = [...targets]
        if (mode === 'farthest') {
            orderedTargets.reverse()
        } else if (mode === 'round') {
            const idx = Number(exporter.getDynamicProperty('dorios:item_round_idx') || 0) % orderedTargets.length
            orderedTargets = orderedTargets.slice(idx).concat(orderedTargets.slice(0, idx))
        }

        // ─────────────────────────────────────────────────────────
        // 5) Attempt a single transfer per tick (like hoppers)
        //    - Respects filter
        //    - Stops on first successful move
        // ─────────────────────────────────────────────────────────
        const moved = { total: 0 }
        const LIMIT = 64

        for (let i = startSlot; i <= endSlot; i++) {
            if (moved.total >= LIMIT) break

            const it = sourceInv.getItem(i)
            if (!it) continue

            if (hasFilter && (exporter.hasTag(`${it.typeId}`) !== whiteList)) continue

            const didMove = tryPushSlotToTargets(sourceLoc, i, orderedTargets, dimension, exporter, moved, LIMIT)
            if (didMove && mode === 'round') {
                let idx = Number(exporter.getDynamicProperty('dorios:item_round_idx') || 0)
                exporter.setDynamicProperty('dorios:item_round_idx', (idx + 1) % targets.length)
            }
        }
    },
})

/**
 * Tries to push a source slot to the first valid target in list.
 *
 * @param {{x:number,y:number,z:number}} sourceLoc
 * @param {number} slotIndex
 * @param {{x:number,y:number,z:number}[]} targets
 * @param {Dimension} dim
 * @param {Entity} exporter
 * @returns {boolean} true if a transfer occurred
 */
function tryPushSlotToTargets(sourceLoc, slotIndex, targets, dim, exporter, moved, LIMIT) {
    for (const loc of targets) {
        const targetBlock = dim.getBlock(loc)
        const targetEntity = dim.getEntitiesAtBlockLocation(loc)[0]
        const targetHasFilter = targetBlock?.permutation?.getState?.('utilitycraft:filter') == 1

        if (targetHasFilter && targetEntity) {
            const inv = DoriosAPI.containers.getContainerAt(sourceLoc, dim)
            const item = inv?.getItem(slotIndex)
            if (!item) return false
            const targetWhite = targetEntity.getDynamicProperty('utilitycraft:whitelistOn') ?? true
            if ((targetEntity.hasTag(`${item.typeId}`) !== targetWhite)) continue
        }

        const movedCount = DoriosAPI.containers.transferItemsBetween(sourceLoc, loc, dim, slotIndex)
        if (typeof movedCount === 'number' && movedCount > 0) {
            moved.total += movedCount
            if (moved.total >= LIMIT) return true
        }
    }
    return false
}




/**
 * Scans connected item conduits and containers to build an item transfer network.
 *
 * This function performs a breadth-first search (BFS) starting from the provided position,
 * traversing through all connected **item conduits** (`utilitycraft:item_conduit`)
 * and **exporters** (`utilitycraft:item_exporter`), collecting all reachable containers.
 *
 * ## Behavior
 * - Identifies all connected conduits and exporter entities.
 * - Detects valid container targets:
 *   - Vanilla containers (chests, barrels, hoppers, etc.).
 *   - Storage Drawers (`dustveyn:storage_drawers`).
 *   - Dorios container entities (tagged as `dorios:container`).
 * - Automatically excludes containers facing extractors to avoid loops.
 * - Adds container position tags (`van:[x,y,z]`, `ent:[x,y,z]`, `dra:[x,y,z]`)
 *   to each extractor for item transfer logic.
 *
 * @param {{x:number, y:number, z:number}} startPos The starting block position of the scan.
 * @param {import('@minecraft/server').Dimension} dimension The dimension where the scan takes place.
 * @returns {void}
 *
 * @example
 * // Rebuilds the item conduit network when a block is placed or removed
 * startRescanItem(block.location, block.dimension);
 */
function startRescanItem(startPos, dimension) {
    const queue = [startPos];
    const visited = new Set();
    const inputs = [];
    const extractors = [];
    let cablesUsed = 0


    const globalBlockedTags = new Set();

    while (queue.length > 0) {
        const pos = queue.shift();
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const block = dimension.getBlock(pos);

        if (block?.typeId === "utilitycraft:item_conduit" || block?.typeId === "utilitycraft:item_exporter") {
            cablesUsed += 1
            for (const offset of offsets) {
                queue.push({
                    x: pos.x + offset.x,
                    y: pos.y + offset.y,
                    z: pos.z + offset.z,
                });
            }
        }

        if (DoriosAPI.constants.vanillaContainers.includes(block?.typeId)) {
            inputs.push(`van:[${pos.x},${pos.y},${pos.z}]`);
            continue;
        }

        if (block?.typeId.includes('dustveyn:storage_drawers')) {
            inputs.push(`dra:[${pos.x},${pos.y},${pos.z}]`);
            continue;
        }

        let entity = dimension.getEntitiesAtBlockLocation(pos)[0];
        if (block.hasTag('dorios:port') && block.hasTag('dorios:item')) {
            entity = dimension.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0]
            if (!entity) continue
            const loc = entity.location
            inputs.push(`ent:[${loc.x},${loc.y},${loc.z}]`);
            continue
        }
        if (entity) {
            if (entity.typeId === "utilitycraft:pipe") {
                extractors.push(entity);
                continue;
            }

            const tf = entity.getComponent("minecraft:type_family");
            if (tf?.hasTypeFamily("dorios:container")) {
                inputs.push(`ent:[${pos.x},${pos.y},${pos.z}]`);
            }
        }
    }

    if (cablesUsed <= 0) return
    for (const ext of extractors) {
        const extLoc = ext.location;
        const extPos = {
            x: Math.floor(extLoc.x),
            y: Math.floor(extLoc.y),
            z: Math.floor(extLoc.z)
        };

        const block = dimension.getBlock(extPos);
        const face = block.permutation.getState("minecraft:block_face");
        const faceOffset = blockFaceOffsets[face];

        if (faceOffset) {
            const bx = extPos.x + faceOffset[0];
            const by = extPos.y + faceOffset[1];
            const bz = extPos.z + faceOffset[2];
            globalBlockedTags.add(`van:[${bx},${by},${bz}]`);
            globalBlockedTags.add(`ent:[${bx},${by},${bz}]`);
            globalBlockedTags.add(`dra:[${bx},${by},${bz}]`);
        }
    }

    for (const ext of extractors) {
        const oldTags = ext.getTags().filter(tag => tag.startsWith("van:") || tag.startsWith("ent:") || tag.startsWith("dra:"));
        for (const tag of oldTags) ext.removeTag(tag);

        for (const tag of inputs) {
            if (globalBlockedTags.has(tag)) continue;
            ext.addTag(tag);
        }
        ext.addTag('updateNetwork')
    }
    // Log network creation
    // const isNetwork = cablesUsed > 0 && extractors.length > 0
    // if (isNetwork) console.warn(`[Item Network] Created a network with ${extractors.length} Exporter(s) and ${inputs.length} Container(s).`);
    // return visited
}



//#endregion

//#region Fluids

/**
 * Opens the Fluid Extractor configuration menu.
 * Includes:
 *  - Power toggle (on/off)
 *  - Transfer mode selection ("nearest" | "farthest" | "round")
 *
 * @param {Block} block The Fluid Extractor block.
 * @param {Player} player The interacting player.
 */
function openFluidExtractorMenu(block, player) {
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return;

    const isOff = entity.getDynamicProperty('isOff') ?? false;
    const mode = entity.getDynamicProperty('transferMode') ?? 'nearest';

    // ──────────────────────────────────────────────
    // 1️⃣ Base menu
    // ──────────────────────────────────────────────
    const menu = new ActionFormData()
        .title('Fluid Extractor Settings')
        .body(`§7Manage fluid extraction behavior.\n\n§rCurrent mode: §e${DoriosAPI.utils.capitalizeFirst(mode)}\n§rPower: §a${isOff ? 'OFF' : 'ON'}`);

    // Buttons
    menu.button(`${isOff ? 'Turn ON' : 'Turn OFF'}\n§8Toggle extractor activity`, `textures/ui/toggle_${isOff ? 'on' : 'off'}`);
    menu.button(`Transfer Mode\n§8(${DoriosAPI.utils.capitalizeFirst(mode)})`, 'textures/items/compass_item.png');

    // ──────────────────────────────────────────────
    // 2️⃣ Handle menu actions
    // ──────────────────────────────────────────────
    menu.show(player).then(result => {
        const selection = result.selection;
        if (selection === undefined) return;

        switch (selection) {
            case 0: { // Toggle ON/OFF
                entity.setDynamicProperty('isOff', !isOff);
                player.onScreenDisplay.setActionBar(`§7Extractor ${isOff ? '§aEnabled' : '§cDisabled'}`);
                break;
            }

            case 1: // Transfer Mode
                openTransferModeMenu(entity, player);
                break;
        }
    });
}


/**
 * UtilityCraft - Fluid Extractor
 * Pulls fluid from the attached container or block (including vanilla fluids and UtilityCraft sources)
 * and exports it to its cached fluid network.
 * 
 * Supported sources:
 * - Dorios/UtilityCraft fluid containers (entities)
 * - Vanilla fluids (minecraft:water, minecraft:lava)
 * - UtilityCraft:crucible (lava)
 * - UtilityCraft:sink (infinite water)
 *
 * Network cache key: dorios:fluid_nodes (JSON array of {x,y,z})
 * Mode key: transferMode → "nearest" | "farthest" | "round"
 * Round index key: dorios:fluid_round_idx (number)
 */
DoriosAPI.register.blockComponent('fluid_extractor', {
    beforeOnPlayerPlace(e) {
        const { block } = e;
        let { x, y, z } = block.location;
        y += 0.375; x += 0.5; z += 0.5;
        system.run(() => {
            const entity = block.dimension.spawnEntity('utilitycraft:pipe', { x, y, z });
            entity.setDynamicProperty('transferMode', 'nearest');
            entity.setDynamicProperty('dorios:fluid_round_idx', 0);
        });
    },

    onPlayerBreak(e) {
        const ent = e.block.dimension.getEntitiesAtBlockLocation(e.block.location)[0];
        if (ent) ent.remove();
    },

    onPlayerInteract(e) {
        const { block, player } = e
        if (player.isSneaking) return
        // const hasFilter = block.permutation.getState('utilitycraft:filter')
        // if (!hasFilter) return

        const mainHand = player.getComponent('equippable')?.getEquipment('Mainhand')
        if (!mainHand?.typeId?.includes('wrench')) return

        openFluidExtractorMenu(block, player) // tu menú existente si lo deseas reutilizar
    },

    onTick({ block, dimension }) {
        if (!globalThis.worldLoaded) return;

        // ─────────────────────────────
        // 1. Get main extractor entity
        // ─────────────────────────────
        const extractor = dimension.getEntitiesAtBlockLocation(block.location)[0];
        if (!extractor) return;
        if (extractor.getDynamicProperty('isOff')) return;

        // ─────────────────────────────
        // 2. Locate source block
        // ─────────────────────────────
        const face = block.permutation.getState('minecraft:block_face');
        const off = blockFaceOffsets[face] || [0, -1, 0];
        const sourceLoc = {
            x: block.location.x + off[0],
            y: block.location.y + off[1],
            z: block.location.z + off[2],
        };

        const sourceBlock = dimension.getBlock(sourceLoc);
        if (!sourceBlock) return;

        let sourceEntity = dimension
            .getEntitiesAtBlockLocation(sourceLoc)
            .find(e => e.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:fluid_container"));

        let fluidSource = null;
        let liquidType = null;
        let amount = 0;
        let infinite = false;

        // ─────────────────────────────
        // 3. Detect fluid source type
        // ─────────────────────────────
        const liquids = {
            'minecraft:water': 'water',
            'minecraft:lava': 'lava',
        };

        if (sourceEntity) {
            // Dorios/UtilityCraft entity fluid container
            fluidSource = new FluidManager(sourceEntity, 0);
            liquidType = fluidSource.getType();
            amount = fluidSource.get();
        } else if (liquids[sourceBlock.typeId]) {
            // Vanilla fluids (water/lava)
            if (sourceBlock.permutation.getState('liquid_depth') !== 0) return; // only full blocks
            liquidType = liquids[sourceBlock.typeId];
            amount = 1000;
        } else if (sourceBlock.typeId === 'utilitycraft:crucible') {
            // Crucible lava
            const lavaLevel = sourceBlock.permutation.getState('utilitycraft:lava');
            if (lavaLevel < 1) return;
            liquidType = 'lava';
            amount = 250 * lavaLevel;
        } else if (sourceBlock.typeId === 'utilitycraft:sink') {
            // Sink (infinite water)
            liquidType = 'water';
            amount = Infinity;
            infinite = true;
        } else if (sourceBlock.hasTag('dorios:fluid')) {
            // Dorios fluid block (tank, machine, or generator)
            // If there's no entity → it's empty or inactive
            return;
        } else {
            return; // Not a valid fluid source
        }

        if (!liquidType || amount <= 0) return;

        // ─────────────────────────────
        // 4. Load cached fluid network
        // ─────────────────────────────
        let cached = extractor.getDynamicProperty('dorios:fluid_nodes');
        const needsUpdate = extractor.hasTag('updateNetwork');

        if (!cached || needsUpdate) {
            const pos = extractor.location;
            const positions = extractor.getTags()
                .filter(t => t.startsWith('ent:['))
                .map(tag => {
                    const [x, y, z] = tag.slice(5, -1).split(',').map(Number);
                    return { x, y, z };
                })
                .sort((a, b) =>
                    DoriosAPI.math.distanceBetween(pos, a) -
                    DoriosAPI.math.distanceBetween(pos, b)
                );
            extractor.setDynamicProperty('dorios:fluid_nodes', JSON.stringify(positions));
            extractor.removeTag('updateNetwork');
            cached = JSON.stringify(positions);
        }

        /** @type {{x:number,y:number,z:number}[]} */
        const nodes = JSON.parse(cached || '[]');
        if (nodes.length === 0) return;

        // ─────────────────────────────
        // 5. Select mode
        // ─────────────────────────────
        const mode = extractor.getDynamicProperty('transferMode') || 'nearest';

        let orderedTargets = [...nodes];
        if (mode === 'farthest') {
            orderedTargets.reverse();
        } else if (mode === 'round') {
            const idx = Number(extractor.getDynamicProperty('dorios:fluid_round_idx') || 0) % orderedTargets.length;
            orderedTargets = orderedTargets.slice(idx).concat(orderedTargets.slice(0, idx));
        }

        // ─────────────────────────────
        // 6. Perform fluid transfer
        // ─────────────────────────────
        let speed = 4000
        let transferred = 0;

        if (fluidSource) {
            transferred = fluidSource.transferToNetwork(speed, mode, orderedTargets);
        } else {
            // For non-entity sources (vanilla/crucible/sink)
            for (const loc of orderedTargets) {
                const targetBlock = dimension.getBlock(loc);
                if (!targetBlock?.hasTag('dorios:fluid')) continue;

                // Create tank entity if block is an empty tank
                let targetEntity = dimension.getEntitiesAtBlockLocation(loc)[0];
                if (!targetEntity && targetBlock.typeId.includes('fluid_tank')) {
                    FluidManager.addfluidToTank(targetBlock, liquidType, 0);
                    targetEntity = dimension.getEntitiesAtBlockLocation(loc)[0];
                }
                if (!targetEntity) continue;

                const targetFluid = new FluidManager(targetEntity, 0);
                const targetType = targetFluid.getType();

                // Skip incompatible fluids
                if (targetType !== 'empty' && targetType !== liquidType) continue;

                const space = targetFluid.getFreeSpace();
                if (space <= 0) continue;

                // Assign fluid type if empty
                if (targetType === 'empty') targetFluid.setType(liquidType);

                const move = Math.min(space, speed, amount);
                const added = targetFluid.add(move);
                if (added > 0) {
                    transferred += added;
                    amount -= added;
                    speed -= added;

                    // End if source is fully drained or transfer cap reached
                    if (amount <= 0 || speed <= 0) break;
                }
            }
        }


        // ─────────────────────────────
        // 7. Update source if finite
        // ─────────────────────────────
        if (transferred > 0 && !infinite) {
            if (fluidSource) {
            } else if (liquids[sourceBlock.typeId]) {
                // remove vanilla fluid
                sourceBlock.setType('minecraft:air');
            } else if (sourceBlock.typeId === 'utilitycraft:crucible') {
                // drain crucible
                sourceBlock.setPermutation(sourceBlock.permutation.withState('utilitycraft:lava', 0));
            }
        }

        // ─────────────────────────────
        // 8. Update round mode index
        // ─────────────────────────────
        if (transferred > 0 && mode === 'round') {
            let idx = Number(extractor.getDynamicProperty('dorios:fluid_round_idx') || 0);
            extractor.setDynamicProperty('dorios:fluid_round_idx', (idx + 1) % nodes.length);
        }
    },
});

function startRescanFluid(startPos, dimension) {
    const queue = [startPos];
    const visited = new Set();
    const inputs = [];
    const extractors = [];
    let cablesUsed = 0

    const globalBlockedTags = new Set();

    while (queue.length > 0) {
        const pos = queue.shift();
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const block = dimension.getBlock(pos);

        if (block?.typeId === "utilitycraft:fluid_pipe" || block?.typeId === "utilitycraft:fluid_extractor") {
            cablesUsed += 1
            for (const offset of offsets) {
                queue.push({
                    x: pos.x + offset.x,
                    y: pos.y + offset.y,
                    z: pos.z + offset.z,
                });
            }
        }

        if (block?.typeId.includes('fluid_tank')) {
            inputs.push(`ent:[${pos.x},${pos.y},${pos.z}]`);
            continue;
        }

        let entity = dimension.getEntitiesAtBlockLocation(pos)[0];
        if (block.hasTag('dorios:port') && block.hasTag('dorios:fluid')) {
            entity = dimension.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0]
            if (!entity) continue
            const loc = entity.location
            inputs.push(`ent:[${loc.x},${loc.y},${loc.z}]`);
            continue
        }
        if (entity) {
            if (entity.typeId === "utilitycraft:pipe") {
                extractors.push(entity);
                continue;
            }

            const tf = entity.getComponent("minecraft:type_family");
            if (tf?.hasTypeFamily("dorios:fluid_container")) {
                inputs.push(`ent:[${pos.x},${pos.y},${pos.z}]`);
            }
        }
    }

    if (cablesUsed <= 0) return
    // Taggear inputs válidos a cada extractor, excluyendo la cara hacia la que está orientado
    for (const ext of extractors) {
        const extLoc = ext.location;
        const extPos = {
            x: Math.floor(extLoc.x),
            y: Math.floor(extLoc.y),
            z: Math.floor(extLoc.z)
        };

        const block = dimension.getBlock(extPos);
        const face = block.permutation.getState("minecraft:block_face");
        const faceOffset = blockFaceOffsets[face];

        if (faceOffset) {
            const bx = extPos.x + faceOffset[0];
            const by = extPos.y + faceOffset[1];
            const bz = extPos.z + faceOffset[2];
            globalBlockedTags.add(`tan:[${bx},${by},${bz}]`);
            globalBlockedTags.add(`ent:[${bx},${by},${bz}]`);
        }
    }

    for (const ext of extractors) {
        const oldTags = ext.getTags().filter(tag => tag.startsWith("tan:") || tag.startsWith("ent:"));
        for (const tag of oldTags) ext.removeTag(tag);

        for (const tag of inputs) {
            if (globalBlockedTags.has(tag)) continue;
            ext.addTag(tag);
        }
        ext.addTag('updateNetwork')
    }
    // Log network creation
    // const isNetwork = cablesUsed > 0 && extractors.length > 0
    // if (isNetwork) console.warn(`[Fluid Network] Created a network with ${extractors.length} Extractor(s) and ${inputs.length} Fluid Container(s).`);
    // return visited
}

//#endregion



system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id == 'dorios:updatePipes') {
        const type = message.split('|')[0]
        const [x, y, z] = message.split('|')[1].slice(1, -1).split(",").map(Number);
        const block = sourceEntity.dimension.getBlock({ x, y, z })

        if (type == 'energy') updatePipes(block, 'energy');

        if (type == 'item') updatePipes(block, 'item');

        if (type == 'fluid') updatePipes(block, 'fluid');
    }
})

world.afterEvents.playerBreakBlock.subscribe(e => {
    const { block, brokenBlockPermutation } = e;
    system.run(() => {
        if (brokenBlockPermutation.hasTag('dorios:energy')) {
            updatePipes(block, 'energy');
        }

        if (brokenBlockPermutation.hasTag('dorios:item') ||
            DoriosAPI.constants.vanillaContainers.includes(brokenBlockPermutation.type.id) /*Borrar*/ ||
            brokenBlockPermutation.type.id.includes('dustveyn:storage_drawers')/*Borrar*/) {
            updatePipes(block, 'item');
        }

        if (brokenBlockPermutation.hasTag('dorios:fluid')) {
            updatePipes(block, 'fluid');
        }
    })
});

world.afterEvents.playerPlaceBlock.subscribe(e => {
    const { block } = e;
    if (block.hasTag('dorios:energy')) {
        updatePipes(block, 'energy');
    }

    if (block.hasTag('dorios:item') || DoriosAPI.constants.vanillaContainers.includes(block.typeId)) {
        updatePipes(block, 'item');
    }

    if (block.hasTag('dorios:fluid')) {
        updatePipes(block, 'fluid');
    }
});
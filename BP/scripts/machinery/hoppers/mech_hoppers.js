import { world, ItemStack, system } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'

DoriosAPI.register.blockComponent('mechanic_hopper', {
    onTick({ block, dimension }, { params }) {
        if (!worldLoaded) return;
        if (!block.isValid || block.isAir) return;

        const dir = block.permutation.getState("minecraft:block_face");
        const { x, y, z } = block.location;

        const isEnder = params.type === "ender_hopper";
        const isHopper = params.type === "hopper";
        const isUpper = params.type === "upper";
        const isDropper = params.type === "dropper";

        /** @type {Entity} */
        const entity = block.getEntity();
        if (!entity) return;
        if (entity.getDynamicProperty('isOff')) return

        const inv = entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const hasFilter = block.getState("utilitycraft:filter") == 1;
        const whiteList = entity.getDynamicProperty("utilitycraft:whitelistOn");

        // Define source and target positions depending on block type and direction
        let sourceLoc = { x, y, z };
        let targetLoc = { x, y, z };

        if (isDropper) {
            // Dropper only works vertically
            sourceLoc = dir === "down" ? { x, y: y - 1, z } : { x, y: y + 1, z };
        } else if (isHopper || isUpper) {
            // Hopper and Upper logic
            sourceLoc = isHopper ? { x, y: y + 1, z } : { x, y: y - 1, z };

            if (dir === "up" || dir === "down") {
                // Vertical output
                targetLoc = isHopper
                    ? { x, y: y - 1, z }
                    : { x, y: y + 1, z };
            } else {
                // Horizontal output
                switch (dir) {
                    case "south": targetLoc = { x, y, z: z - 1 }; break;
                    case "north": targetLoc = { x, y, z: z + 1 }; break;
                    case "west": targetLoc = { x: x + 1, y, z }; break;
                    case "east": targetLoc = { x: x - 1, y, z }; break;
                }
            }
        } else if (isEnder) {
            targetLoc = { x, y: y - 1, z };
        }
        if (!isEnder) {
            // Pull items from the source container into the block
            const sourceInv = DoriosAPI.containers.getContainerAt(sourceLoc, dimension);
            let pulled = false;

            if (sourceInv) {
                const sourceEntity = dimension.getEntitiesAtBlockLocation(sourceLoc)[0];
                const [start, end] = DoriosAPI.containers.getAllowedOutputRange(sourceEntity ?? sourceInv);

                for (let i = start; i <= end; i++) {
                    const item = sourceInv.getItem(i);
                    if (!item) continue;

                    // Apply filter rules if enabled
                    if (hasFilter && whiteList != entity.hasTag(`${item.typeId}`)) continue;

                    DoriosAPI.containers.transferItemsBetween(sourceLoc, block.location, dimension, i);
                    pulled = true;
                    break;
                }
            }

            if (!pulled) {
                const items = dimension.getEntities({
                    type: "item",
                    location: sourceLoc,
                    maxDistance: 0.8 // fixed radius for normal hopper suction
                });

                for (const drop of items) {
                    const itemComp = drop.getComponent("minecraft:item");
                    if (!itemComp) continue;

                    const stack = itemComp.itemStack;

                    // Check filter again before collecting
                    if (inv.emptySlotsCount == 0) break;
                    if (hasFilter && whiteList != entity.hasTag(`${stack.typeId}`)) continue;

                    inv.addItem(stack);
                    drop.remove();
                    break;
                }
            }
        }
        else {
            // Ender Hopper: picks up dropped items within a radius
            const range = entity.getDynamicProperty('range_selected') ?? 3;
            const items = dimension.getEntities({
                type: "item",
                location: block.location,
                maxDistance: range
            });

            for (const drop of items) {
                const itemComp = drop.getComponent("minecraft:item");
                if (!itemComp) continue;

                const stack = itemComp.itemStack;

                // Apply filter before collecting
                if (inv.emptySlotsCount == 0) break
                if (hasFilter && whiteList != entity.hasTag(`${stack.typeId}`)) continue;

                inv.addItem(stack);
                drop.remove();
                break;
            }
        }

        // Handle output: transfer to container or drop into the world
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item) continue;

            // Apply filter rules again before output
            if (hasFilter && whiteList != entity.hasTag(`${item.typeId}`)) continue;

            if (isDropper) {
                // Dropper releases the item into the world
                const spawnY = dir === "down" ? y + 1.2 : y - 0.8;
                const pos = { x: x + 0.5, y: spawnY, z: z + 0.5 };

                dimension.spawnItem(item, pos);
                inv.setItem(i, undefined);
            } else {
                // Hopper and Upper push items into the target container
                DoriosAPI.containers.transferItemsAt(inv, targetLoc, dimension, i);
            }

            // Limit to one transfer per tick
            break;
        }
    },

    beforeOnPlayerPlace(e) {
        const { block } = e
        let { x, y, z } = block.location
        x += 0.5, z += 0.5, y += 0.375

        system.run(() => {
            const entity = block.dimension.spawnEntity('utilitycraft:hopper', { x, y, z })
            entity.setDynamicProperty('utilitycraft:whitelistOn', true)
            entity.nameTag = "Hopper"
        })
    },
    onPlayerBreak(e) {
        const { block } = e
        let { x, y, z } = block.location
        x += 0.5, z += 0.5, y += 0.375
        const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!entity) return
        const inv = entity.getComponent('minecraft:inventory').container
        for (let j = 0; j < inv.size; j++) {
            if (inv.getItem(j) != undefined) {
                let item = inv.getItem(j)
                block.dimension.spawnItem(item, { x, y, z })
            }
        }
        entity.remove()
    },
    onPlayerInteract(e) {
        const { block, player } = e
        let { x, y, z } = block.location
        x += 0.5, z += 0.5, y += 0.375
        const hasFilter = block.permutation.getState('utilitycraft:filter')

        const mainHand = player.getComponent('equippable').getEquipment('Mainhand')
        if (mainHand?.typeId.includes('wrench')) return
        if (player.isSneaking && block.typeId.includes('ender')) {
            openEnderHopperMenu(block, player)
            return
        }
        if (hasFilter) {
            openMenu(block, player)
        }
    }
})

function openMenu(block, player) {
    let menu = new ActionFormData()
    const hopper = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
    let state = hopper.getDynamicProperty('utilitycraft:whitelistOn')
    menu.title('Filter')

    if (state) {
        menu.button(`Whitelist Mode \n(Click to Change)`, 'textures/items/misc/whitelist.png')
    } else {
        menu.button(`Blacklist Mode \n(Click to Change)`, 'textures/items/misc/blacklist.png')

    }

    menu.button(`Add item \n(Adds the item in your Mainhand)`)

    const acceptedItems = hopper.getTags()

    if (acceptedItems) {
        for (let item of acceptedItems) {
            menu.button(`${DoriosAPI.utils.formatIdToText(item)}`)
        }
    }

    menu.show(player)
        .then(result => {
            let selection = result.selection
            if (selection == undefined) return;

            if (selection == 0) {
                hopper.setDynamicProperty('utilitycraft:whitelistOn', !state)
                return
            }

            if (selection == 1) {
                const mainHand = player.getComponent('equippable').getEquipment('Mainhand')
                if (mainHand) {
                    hopper.addTag(`${mainHand.typeId}`)
                }
                return
            }
            hopper.removeTag(`${acceptedItems[selection - 2]}`)
            openMenu(block, player)
        })
}

/**
 * Opens the Ender Hopper configuration menu.
 * Allows the player to toggle the hopper on/off and adjust its pickup radius.
 *
 * @param {Block} block The Ender Hopper block.
 * @param {Player} player The player interacting with it.
 */
function openEnderHopperMenu(block, player) {
    const hopperEntity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!hopperEntity) return;

    const equipment = player.getComponent("equippable");
    const mainHand = equipment.getEquipment("Mainhand");
    const range = block.getState("utilitycraft:range") ?? 0

    // Read stored dynamic properties
    const isOff = hopperEntity.getDynamicProperty("isOff") ?? false;
    const rangeSelected = hopperEntity.getDynamicProperty("range_selected") ?? 0;

    // Create modal form
    const modal = new ModalFormData()
        .title("Ender Hopper Settings")
        .toggle("Enabled", { defaultValue: !isOff })
        .slider("Pickup Radius", 0, 3 + 2 * range, { defaultValue: rangeSelected });

    // Show form only when player is not sneaking and has empty mainhand
    modal.show(player).then(result => {
        const values = result.formValues;
        if (!values) return;

        const [enabled, newRange] = values;

        // Update dynamic properties
        hopperEntity.setDynamicProperty("isOff", !enabled);
        hopperEntity.setDynamicProperty("range_selected", newRange);
    });
}
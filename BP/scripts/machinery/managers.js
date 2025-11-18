import { system, world, ItemStack, BlockPermutation } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'

import {
    getFluidContainerDefinition,
    getFluidContainerRegistry,
    getFluidOutputDefinition,
    getFluidOutputRegistry,
    registerFluidContainer as registerFluidContainerDefinition,
    registerFluidOutput as registerFluidOutputDefinition
} from '../config/fluids/containers.js'
import { updatePipes } from './transfer_system/system.js'
const COLORS = DoriosAPI.constants.textColors

globalThis.worldLoaded = false;
globalThis.tickCount = 0;

system.runInterval(() => {
    globalThis.tickCount += 2
    if (globalThis.tickCount == 1000) globalThis.tickCount = 0
}, 2)

//#region Rotation

const FACING = ["up", "down", "north", "south", "east", "west"];
const CARDINAL = ["north", "south", "east", "west"];
const rotationMap = {
    up: {
        north: {
            0: { axis: "west", rotation: 0 },
            1: { axis: "west", rotation: 1 },
            2: { axis: "west", rotation: 2 },
            3: { axis: "west", rotation: 3 },
        },
        west: {
            0: { axis: "south", rotation: 0 },
            1: { axis: "south", rotation: 1 },
            2: { axis: "south", rotation: 2 },
            3: { axis: "south", rotation: 3 },
        },
        south: {
            0: { axis: "east", rotation: 0 },
            1: { axis: "east", rotation: 1 },
            2: { axis: "east", rotation: 2 },
            3: { axis: "east", rotation: 3 },
        },
        east: {
            0: { axis: "north", rotation: 0 },
            1: { axis: "north", rotation: 1 },
            2: { axis: "north", rotation: 2 },
            3: { axis: "north", rotation: 3 },
        },
    },
    down: {
        north: {
            0: { axis: "east", rotation: 0 },
            1: { axis: "east", rotation: 1 },
            2: { axis: "east", rotation: 2 },
            3: { axis: "east", rotation: 3 },
        },
        east: {
            0: { axis: "south", rotation: 0 },
            1: { axis: "south", rotation: 1 },
            2: { axis: "south", rotation: 2 },
            3: { axis: "south", rotation: 3 },
        },
        south: {
            0: { axis: "west", rotation: 0 },
            1: { axis: "west", rotation: 1 },
            2: { axis: "west", rotation: 2 },
            3: { axis: "west", rotation: 3 },
        },
        west: {
            0: { axis: "north", rotation: 0 },
            1: { axis: "north", rotation: 1 },
            2: { axis: "north", rotation: 2 },
            3: { axis: "north", rotation: 3 },
        },
    },
    south: {
        up: {
            0: { axis: "west", rotation: 1 },
            1: { axis: "east", rotation: 0 },///
            2: { axis: "west", rotation: 3 },////
            3: { axis: "east", rotation: 2 },//
        },
        east: {
            0: { axis: "down", rotation: 1 },///
            1: { axis: "up", rotation: 2 },////
            2: { axis: "down", rotation: 3 },//
            3: { axis: "up", rotation: 0 },
        },
        down: {
            0: { axis: "east", rotation: 1 },////
            1: { axis: "west", rotation: 2 },///
            2: { axis: "east", rotation: 3 },
            3: { axis: "west", rotation: 0 },//
        },
        west: {
            0: { axis: "up", rotation: 3 },//
            1: { axis: "down", rotation: 2 },
            2: { axis: "up", rotation: 1 },///
            3: { axis: "down", rotation: 0 },////
        },
    },
    north: {
        up: {
            0: { axis: "east", rotation: 3 },
            1: { axis: "west", rotation: 2 },////
            2: { axis: "east", rotation: 1 },///
            3: { axis: "west", rotation: 0 },//
        },
        east: {
            0: { axis: "up", rotation: 1 },////
            1: { axis: "down", rotation: 0 },///
            2: { axis: "up", rotation: 3 },//
            3: { axis: "down", rotation: 2 },
        },
        down: {
            0: { axis: "west", rotation: 3 }, ///
            1: { axis: "east", rotation: 0 },////
            2: { axis: "west", rotation: 1 },
            3: { axis: "east", rotation: 2 }, //
        },
        west: {
            0: { axis: "down", rotation: 3 }, //
            1: { axis: "up", rotation: 0 },
            2: { axis: "down", rotation: 1 },////
            3: { axis: "up", rotation: 2 }, ///
        },
    },
    east: {
        up: {
            0: { axis: "south", rotation: 0 },///
            1: { axis: "south", rotation: 1 },////start
            2: { axis: "south", rotation: 2 }, //
            3: { axis: "south", rotation: 3 },
        },
        south: {
            0: { axis: "down", rotation: 0 },///start
            1: { axis: "down", rotation: 3 },//// 
            2: { axis: "down", rotation: 2 }, //
            3: { axis: "up", rotation: 1 },
        },
        down: {
            0: { axis: "north", rotation: 2 },///
            1: { axis: "north", rotation: 1 },
            2: { axis: "north", rotation: 0 },//
            3: { axis: "north", rotation: 3 },////
        },
        north: {
            0: { axis: "up", rotation: 2 }, //start
            1: { axis: "up", rotation: 3 },
            2: { axis: "up", rotation: 0 },///
            3: { axis: "up", rotation: 1 },////
        },
    },

    west: {
        down: {
            0: { axis: "north", rotation: 2 },
            1: { axis: "north", rotation: 3 },
            2: { axis: "north", rotation: 0 },
            3: { axis: "north", rotation: 1 },
        },
        north: {
            0: { axis: "up", rotation: 2 },
            1: { axis: "up", rotation: 1 },
            2: { axis: "up", rotation: 0 },
            3: { axis: "up", rotation: 3 },
        },
        up: {
            0: { axis: "south", rotation: 2 },
            1: { axis: "south", rotation: 3 },
            2: { axis: "south", rotation: 0 },
            3: { axis: "south", rotation: 1 },
        },
        south: {
            0: { axis: "down", rotation: 2 },
            1: { axis: "down", rotation: 3 },
            2: { axis: "down", rotation: 0 },
            3: { axis: "down", rotation: 1 },
        },
    }
};


/**
 * ==================================================
 * UtilityCraft - Rotation Utility
 * ==================================================
 * Handles manual block placement with facing logic.
 * Supports axis-based orientation (6 directions),
 * ready to be extended to full 24-rotation control.
 * 
 * Example:
 *   Rotation.facing(player, block, "utilitycraft:crusher");
 * ==================================================
 */
export class Rotation {
    /**
     * Places a block manually with its `utilitycraft:axis` state,
     * oriented to the player’s look direction.
     * 
     * Equivalent to:
     *   /setblock ~~~ <typeId> ["utilitycraft:axis"="north"]
     *
     * @param {Player} player The player placing the block.
     * @param {Block} block The block reference (for position).
     * @param {BlockPermutation} perm The block perm to place.
     */
    static facing(player, block, perm) {
        const { x, y, z } = block.location;
        const dim = block.dimension;

        // ───── Determine axis (6 possible directions)
        const view = player.getViewDirection();
        let axis = "north";

        if (Math.abs(view.y) > Math.abs(view.x) && Math.abs(view.y) > Math.abs(view.z)) {
            axis = view.y > 0 ? "up" : "down";
        } else if (Math.abs(view.z) > Math.abs(view.x)) {
            axis = view.z > 0 ? "south" : "north";
        } else {
            axis = view.x > 0 ? "east" : "west";
        }
        // ───── Place the block manually with the axis applied
        system.run(() => {
            player.playSound('place.iron')
            dim.runCommand(`setblock ${x} ${y} ${z} ${perm.type.id} ["utilitycraft:axis"="${axis}"]`);
            system.run(() => {
                if (perm.hasTag('dorios:energy')) {
                    updatePipes(block, 'energy');
                }

                if (perm.hasTag('dorios:item') || DoriosAPI.constants.vanillaContainers.includes(block.typeId)) {
                    updatePipes(block, 'item');
                }

                if (perm.hasTag('dorios:fluid')) {
                    updatePipes(block, 'fluid');
                }
            })
        })
    }

    /**
       * Rotates a block when the wrench is used on it.
       *
       * - Supports both vanilla and UtilityCraft’s 24-axis rotation.
       * - Plays a click sound after successful rotation.
       *
       * @param {Block} block The block being interacted with.
       * @param {string} blockFace The face of the block that was clicked.
       */
    static handleRotation(block, blockFace) {
        // --- Handle UtilityCraft 24-axis rotation ---
        if (block.getState("utilitycraft:axis") != undefined && block.getState("utilitycraft:rotation") != undefined) {
            Rotation.rotate_24(block, blockFace);
            return;
        }

        // --- Handle vanilla facing_direction rotation ---
        try {
            const facingDir = block.permutation.getState("minecraft:facing_direction");
            if (facingDir !== undefined) {
                const index = FACING.indexOf(facingDir);
                const next = (index + 1) % FACING.length;
                block.setPermutation(block.permutation.withState("minecraft:facing_direction", FACING[next]));
                return;
            }
        } catch { }

        // --- Handle cardinal_direction rotation ---
        try {
            const cardDir = block.permutation.getState("minecraft:cardinal_direction");
            if (cardDir !== undefined) {
                const index = CARDINAL.indexOf(cardDir);
                const next = (index + 1) % CARDINAL.length;
                block.setPermutation(block.permutation.withState("minecraft:cardinal_direction", CARDINAL[next]));
                return;
            }
        } catch { }
    }


    /**
     * Handles full 24-direction rotation logic for blocks using `axis` and `rotation` states.
     *
     * ## Rules
     * 1. Clicking the same axis line (front/back) → rotates `rotation` (0–3).
     * 2. Clicking any other face → changes only `axis`, cycling clockwise
     *    through the 4 lateral directions relative to the clicked face,
     *    and resets rotation to 0 for a clean orientation.
     *
     * @param {Block} block The block being rotated.
     * @param {string} blockFace The clicked face (e.g. "north", "up").
     */
    static rotate_24(block, blockFace) {
        const perm = block.permutation;
        const axis = perm.getState("utilitycraft:axis");
        const rotation = perm.getState("utilitycraft:rotation") ?? 0;
        const face = blockFace.toLowerCase();

        // Same-axis rotation (works fine)
        const opposite = {
            up: "down", down: "up",
            north: "south", south: "north",
            east: "west", west: "east"
        };

        if (face === axis || face === opposite[axis]) {
            const nextRot = (rotation + 1) % 4;
            block.setPermutation(perm.withState("utilitycraft:rotation", nextRot));
            return;
        }

        // Axis change using precomputed mapping table
        const nextData = rotationMap[face]?.[axis]?.[rotation];
        if (!nextData) return;

        const { axis: nextAxis, rotation: nextRotation } = nextData;

        block.setPermutation(
            perm.withState("utilitycraft:axis", nextAxis)
                .withState("utilitycraft:rotation", nextRotation)
        );
    }
}

//endregion

//#region Scoreboards

/**
 * Retrieves a scoreboard objective by id, or creates it if it does not exist.
 *
 * @param {string} id The unique identifier of the scoreboard objective.
 * @param {string} [display=id] The display name shown in the scoreboard. Defaults to the id.
 * @returns {ScoreboardObjective} The existing or newly created scoreboard objective.
 */
const getOrCreateObjective = (id, display = id) =>
    world.scoreboard.getObjective(id) ?? world.scoreboard.addObjective(id, display);

/**
 * Ensures a set of scoreboard objectives exist and returns them as an object.
 *
 * Each entry in the `definitions` array must be a tuple of `[id, displayName]`.
 * If the display name is omitted, the objective id will be used as its display name.
 *
 * @param {Array.<[string, string?]>} definitions Array of objectives to load, each with an id and optional display name.
 * @returns {Record<string, ScoreboardObjective>} An object containing the objectives, keyed by their ids.
 *
 * @example
 * const objectives = loadObjectives([
 *   ["energy", "Energy"],
 *   ["energyExp", "EnergyExp"],
 *   ["energyCap", "Energy Max Capacity"],
 *   ["energyCapExp", "Energy Max Capacity Exp"],
 * ]);
 *
 * // Access example
 * const objectives.energy = objectives.energy;
 */
function loadObjectives(definitions) {
    const result = {};
    for (const [id, display] of definitions) {
        result[id] = getOrCreateObjective(id, display);
    }
    return result;
}

/**
 * Scoreboard objectives used for the energy system.
 * Will be initialized after the world has finished loading.
 *
 * @type {{
 *   energy: ScoreboardObjective,
 *   energyExp: ScoreboardObjective,
 *   energyCap: ScoreboardObjective,
 *   energyCapExp: ScoreboardObjective
 * } | null}
 */
let objectives = null;

// --- Al cargar el mundo ---
world.afterEvents.worldLoad.subscribe(() => {
    objectives = loadObjectives([
        ["energy", "Energy"],
        ["energyExp", "EnergyExp"],
        ["energyCap", "Energy Max Capacity"],
        ["energyCapExp", "Energy Max Capacity Exp"],
    ]);

    // Inicializar la propiedad si no existe
    if (world.getDynamicProperty("loaded") === undefined) {
        world.setDynamicProperty("loaded", false);
    }

    worldLoaded = world.getDynamicProperty("loaded");

    if (world.getDimension('overworld').getEntities()[0]) {
        world.setDynamicProperty("loaded", true);
        worldLoaded = true;
    }
});

// --- Al primer spawn del jugador ---
world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
        world.setDynamicProperty("loaded", true);
        worldLoaded = true;
    }, 50)
});

// --- Al apagar el mundo ---
system.beforeEvents.shutdown.subscribe(() => {
    try {
        world.setDynamicProperty("loaded", false);
    } catch { }
});

//#endregion

export class Generator {
    /**
     * Creates a new Generator instance.
     * 
     * @param {Block} block The block representing the generator.
     * @param {GeneratorSettings} settings generator's settings.
     */
    constructor(block, settings, ignoreTick = false) {
        this.valid = true

        // world.sendMessage(`${globalThis.tickCount} y ${globalThis.tickSpeed}`)
        if (globalThis.tickCount % globalThis.tickSpeed != 0 && !ignoreTick) {
            this.valid = false
            return
        }
        this.settings = settings
        this.dim = block.dimension
        this.block = block
        this.entity = this.dim.getEntitiesAtBlockLocation(block.location)[0]
        if (!this.entity) return null
        this.inv = this.entity?.getComponent('inventory')?.container
        this.energy = new Energy(this.entity)
        this.baseRate = settings.generator.rate_speed_base
        this.rate = this.baseRate * tickSpeed
    }

    /**
     * Spawns a UtilityCraft generator entity at the given block location,
     * triggers the correct type and inventory events, and assigns its name.
     *
     * @param {Block} block The block where the generator will be placed.
     * @param {Object} data Generator configuration.
     * @param {Object} data.entity Entity config object.
     * @param {string} data.entity.name Generator name (e.g. "crusher").
     * @param {number} data.entity.inventory_size Number of slots in inventory.
     * @returns {Entity} The spawned generator entity.
     */
    static spawn(block, data) {
        const dim = block.dimension;
        const { entity } = data;

        let { x, y, z } = block.center(); y -= 0.25
        const generatorEntity = dim.spawnEntity("utilitycraft:machine", { x, y, z });

        let generatorEvent;
        let inventorySize = 2

        if (entity.type == 'simple') {
            generatorEvent = "utilitycraft:simple_generator";
            inventorySize = 4
        } else if (entity.type == 'fluid') {
            generatorEvent = "utilitycraft:fluid_generator";
            inventorySize = 3
        } else if (entity.type == 'passive') {
            generatorEvent = "utilitycraft:passive_generator";
            inventorySize = 2
        } if (entity.type == 'battery') {
            generatorEvent = "utilitycraft:battery_generator";
            inventorySize = 2
        }

        if (entity.inventory_size) inventorySize = entity.inventory_size

        const inventoryEvent = `utilitycraft:inventory_${inventorySize}`;

        // 3. Trigger generator type and inventory slot events
        generatorEntity.triggerEvent(generatorEvent);
        generatorEntity.triggerEvent(inventoryEvent);

        // 4. Assign name tag
        const name = entity.name ?? block.typeId.split(':')[1]
        generatorEntity.nameTag = `entity.utilitycraft:${name}.name`;

        return generatorEntity;
    }

    /**
     * Handles generator destruction:
     * - Drops inventory (excluding UI items).
     * - Drops the generator block item with stored energy and liquid info in lore.
     * - Removes the generator entity.
     * - Skips drop if the player is in Creative mode.
     *
     * @param {{ block: Block, brokenBlockPermutation: BlockPermutationplayer: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
     */
    static onDestroy(e) {
        const { block, brokenBlockPermutation, player, dimension: dim } = e;
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (!entity) return false;

        const energy = new Energy(entity);
        const fluid = new FluidManager(entity)
        const blockItemId = brokenBlockPermutation.type.id
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        // Energy lore
        if (energy.get() > 0) {
            lore.push(`§r§7  Energy: ${Energy.formatEnergyToText(energy.get())}/${Energy.formatEnergyToText(energy.cap)}`);
        }

        if (fluid.type != 'empty') {
            const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type)
            lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        // Drop item and cleanup
        system.run(() => {
            if (player?.isInSurvival()) {
                const oldItemEntity = dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId);
                oldItemEntity?.remove()
            };
            Machine.dropAllItems(entity);
            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
        return true
    }

    /**
     * Spawns a generator entity at the given block location with a name tag and energy settings.
     *
     * @param {{ block: Block, player: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
     * @param {GeneratorSettings} settings Custom settings to apply to the generator entity.
     * @param {Function} [callback] A function to execute after the entity is spawned (optional).
     */
    static spawnGeneratorEntity(e, settings, callback) {
        const { block, player, permutationToPlace: perm } = e
        system.runTimeout(() => {
            if (perm.hasTag('dorios:energy')) {
                updatePipes(block, 'energy');
            }

            if (perm.hasTag('dorios:item')) {
                updatePipes(block, 'item');
            }

            if (perm.hasTag('dorios:fluid')) {
                updatePipes(block, 'fluid');
            }
        }, 2)

        const itemInfo = player.getComponent('equippable').getEquipment('Mainhand').getLore();
        let energy = 0;
        if (itemInfo[0] && itemInfo[0].includes('Energy')) {
            energy = Energy.getEnergyFromText(itemInfo[0]);
        }

        let fluid = undefined
        const nextLine = (energy > 0) ? itemInfo[1] : itemInfo[0]
        if (nextLine) {
            fluid = FluidManager.getFluidFromText(nextLine)
        }
        system.run(() => {
            const entity = Generator.spawn(block, settings)
            Energy.initialize(entity)
            const energyManager = new Energy(entity)
            energyManager.set(energy)
            energyManager.setCap(settings.generator.energy_cap)
            energyManager.display()
            if (settings.generator.fluid_cap) {
                const fluidManager = new FluidManager(entity, 0)
                fluidManager.setCap(settings.generator.fluid_cap)
                fluidManager.display()

                if (fluid && fluid.amount > 0) {
                    fluidManager.setType(fluid.type)
                    fluidManager.set(fluid.amount)
                }
            }
            this.addNearbyMachines(entity)
            system.run(() => { if (callback) callback(entity) })
        });
    }

    /**
     * Adds tags to the entity for all adjacent blocks (6 directions) around it.
     * 
     * - Each tag follows the format: `pos:[x,y,z]`
     * - This is used by energy transfer functions to identify nearby machines.
     * - Adds positions in all cardinal directions: North, South, East, West, Up, Down.
     * 
     * @param {Entity} entity The entity (usually a generator or battery) to tag with nearby positions.
     */
    static addNearbyMachines(entity) {
        let { x, y, z } = entity.location
        const directions = [
            [1, 0, 0], // East
            [-1, 0, 0], // West
            [0, 1, 0], // Up
            [0, -1, 0], // Down
            [0, 0, 1], // South
            [0, 0, -1]  // North
        ];

        for (const [dx, dy, dz] of directions) {
            const xf = x + dx;
            const yf = y + dy;
            const zf = z + dz;
            entity.addTag(`pos:[${xf},${yf},${zf}]`);
        }
    }
    /**
     * Opens a modal form for selecting transfer mode.
     *
     * Modes:
     *  - nearest → send energy/fluid to closest target first.
     *  - farthest → send to farthest target first.
     *  - round → distribute evenly across all connected targets.
     *
     * @param {Entity} entity The generator entity.
     * @param {Player} player The interacting player.
     */
    static openGeneratorTransferModeMenu(entity, player) {
        if (!entity || !player) return;

        const mode = entity.getDynamicProperty('transferMode') ?? 'nearest';
        const modes = ['Nearest', 'Farthest', 'Round'];
        const currentIndex = modes.findIndex(m => m.toLowerCase() === mode);
        const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

        const modal = new ModalFormData()
            .title('Generator Transfer Mode')
            .dropdown('Select how this generator distributes its output:', modes, { defaultValueIndex: defaultIndex });

        modal.show(player).then(result => {
            if (result.canceled) return;

            const [selection] = result.formValues;
            const newMode = modes[selection]?.toLowerCase() ?? 'nearest';

            entity.setDynamicProperty('transferMode', newMode);
            player.onScreenDisplay.setActionBar(`§7Transfer mode set to: §e${DoriosAPI.utils.capitalizeFirst(newMode)}`);
        });
    }

    /**
     * Sets a label in the generator inventory using a fixed item as placeholder.
     *
     * The label is displayed by overriding the item's `nameTag` with custom text.
     *
     * @param {string} text The text to display in the label. Supports Minecraft formatting codes (§).
     * @param {number} [slot=1] The inventory slot where the label will be placed.
     */
    setLabel(text, slot = 1) {
        // Always use the same placeholder item
        const baseItem = this.inv.getItem(slot) ?? new ItemStack("utilitycraft:arrow_indicator_90");

        // Apply the custom label text
        baseItem.nameTag = text;

        // Update the slot in the inventory
        this.inv.setItem(slot, baseItem);
    }

    /**
     * Changes the texture of the block to the on version.
     */
    on() {
        this.block.setState('utilitycraft:on', true)
    }

    /**
     * Changes the texture of the block to the off version.
     */
    off() {
        this.block.setState('utilitycraft:on', false)
    }

    /**
     * Displays the current energy of the generator in the specified inventory slot.
     *
     * Delegates the call to the internal {@link Energy.display} method.
     *
     * @param {number} [slot=0] The inventory slot index where the energy bar will be displayed.
     */
    displayEnergy(slot = 0) {
        this.energy.display(slot);
    }
}

//#region Machine

export class Machine {
    /**
     * Creates a new Machine instance.
     * 
     * @param {Block} block The block representing the machine.
     * @param {MachineSettings} settings Machine's settings.
     */
    constructor(block, settings, ignoreTick = false) {
        this.valid = true
        if (globalThis.tickCount % globalThis.tickSpeed != 0 && !ignoreTick) {
            this.valid = false
            return
        }
        this.settings = settings
        this.dim = block.dimension
        this.block = block
        this.entity = this.dim.getEntitiesAtBlockLocation(block.location)[0]
        if (!this.entity) return null
        this.inv = this.entity?.getComponent('inventory')?.container
        this.energy = new Energy(this.entity)
        this.upgrades = this.getUpgradeLevels(settings.machine.upgrades)
        this.boosts = this.calculateBoosts(this.upgrades)
        this.baseRate = settings.machine.rate_speed_base * this.boosts.speed * this.boosts.consumption
        this.rate = this.baseRate * tickSpeed
    }

    getTransferCooldown() {
        return Math.max(0, this.entity.getDynamicProperty("dorios:transfer_cooldown") ?? 0);
    }

    setTransferCooldown(ticks) {
        this.entity.setDynamicProperty("dorios:transfer_cooldown", Math.max(0, Math.floor(ticks ?? 0)));
    }

    holdTransfers(ticks = 1) {
        if (!ticks || ticks <= 0) return;
        const current = this.getTransferCooldown();
        const desired = Math.max(current, Math.floor(ticks));
        this.setTransferCooldown(desired);
    }

    shouldDelayTransfers() {
        const cooldown = this.getTransferCooldown();
        if (cooldown <= 0) return false;
        this.setTransferCooldown(cooldown - 1);
        return true;
    }

    /**
     * Spawns a UtilityCraft machine entity at the given block location,
     * triggers the correct type and inventory events, and assigns its name.
     *
     * @param {Block} block The block where the machine will be placed.
     * @param {Object} data Machine configuration.
     * @param {Object} data.entity Entity config object.
     * @param {string} data.entity.name Machine name (e.g. "crusher").
     * @param {"simple"|"complex"|null} data.entity.input_type Input type.
     * @param {"simple"|"complex"|null} data.entity.output_type Output type.
     * @param {number} data.entity.inventory_size Number of slots in inventory.
     * @param {boolean} [data.entity.fluid=false] Whether this is a fluid machine.
     * @returns {Entity} The spawned machine entity.
     */
    static spawn(block, data, blockToPlace) {
        const dim = block.dimension;
        const { entity } = data;

        let { x, y, z } = block.center(); y -= 0.25
        const machineEntity = dim.spawnEntity("utilitycraft:machine", { x, y, z });

        let machineEvent;
        let inventorySize = 2
        if (!entity.fluid) {
            if (entity.input_type === "simple" && entity.output_type === "simple") {
                machineEvent = "utilitycraft:simple_machine";
                inventorySize = 7
            } else if (entity.input_type === "complex" && entity.output_type === "simple") {
                machineEvent = "utilitycraft:complex_in_machine";
                inventorySize = 17
            } else if (entity.input_type === "simple" && entity.output_type === "complex") {
                machineEvent = "utilitycraft:complex_out_machine";
                inventorySize = 17
            } else if (entity.input_type === "complex" && entity.output_type === "complex") {
                machineEvent = "utilitycraft:complex_machine";
                inventorySize = 25
            } else if (entity.input_type === "simple") {
                machineEvent = "utilitycraft:simple_input_machine";
                inventorySize = 6
            } else {
                machineEvent = "utilitycraft:basic_machine";
            }
        } else {
            if (entity.input_type === "simple") {
                machineEvent = "utilitycraft:simple_machine_fluid";
            } else if (entity.input_type === "complex") {
                machineEvent = "utilitycraft:complex_machine_fluid";
            }
        }

        if (entity.inventory_size) inventorySize = entity.inventory_size

        const inventoryEvent = `utilitycraft:inventory_${inventorySize}`;

        // 3. Trigger machine type and inventory slot events
        machineEntity.triggerEvent(machineEvent);
        machineEntity.triggerEvent(inventoryEvent);

        // 4. Assign name tag
        const name = blockToPlace.type.id.split(':')[1] ?? entity.name
        machineEntity.nameTag = `entity.utilitycraft:${name}.name`;

        return machineEntity;
    }

    /**
     * Handles machine destruction:
     * - Drops inventory (excluding UI items).
     * - Drops the machine block item with stored energy and liquid info in lore.
     * - Removes the machine entity.
     * - Skips drop if the player is in Creative mode.
     *
     * @param {{ block: Block, brokenBlockPermutation: BlockPermutationplayer: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
     */
    static onDestroy(e) {
        const { block, brokenBlockPermutation, player, dimension: dim } = e;
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (!entity) return false;

        const energy = new Energy(entity);
        const fluid = new FluidManager(entity)
        const blockItemId = brokenBlockPermutation.type.id
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        // Energy lore
        if (energy.get() > 0) {
            lore.push(`§r§7  Energy: ${Energy.formatEnergyToText(energy.get())}/${Energy.formatEnergyToText(energy.cap)}`);
        }

        if (fluid.type != 'empty') {
            const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type)
            lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        // Drop item and cleanup
        system.run(() => {
            if (player?.isInSurvival()) {
                const oldItemEntity = dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId);
                oldItemEntity?.remove()
            };
            Machine.dropAllItems(entity);
            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
        return true
    }

    /**
     * Spawns a machine entity at the given block location with a name tag and energy settings.
     *
     * @param {{ block: Block, player: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
     * @param {MachineSettings} settings Custom settings to apply to the machine entity.
     * @param {Function} [callback] A function to execute after the entity is spawned (optional).
     */
    static spawnMachineEntity(e, settings, callback) {
        const { block, player, permutationToPlace } = e
        const maindHand = player.getComponent('equippable').getEquipment('Mainhand')

        if (settings.rotation) {
            if (player.isInSurvival()) system.run(() => {
                player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`)
            })
            e.cancel = true
            Rotation.facing(player, block, permutationToPlace)

        }

        const itemInfo = maindHand.getLore();
        let energy = 0;
        if (itemInfo[0] && itemInfo[0].includes('Energy')) {
            energy = Energy.getEnergyFromText(itemInfo[0]);
        }

        let fluid = undefined
        const nextLine = (energy > 0) ? itemInfo[1] : itemInfo[0]
        if (nextLine) {
            fluid = FluidManager.getFluidFromText(nextLine)
        }
        system.run(() => {
            const entity = Machine.spawn(block, settings, permutationToPlace)

            Energy.initialize(entity)
            const energyManager = new Energy(entity)
            energyManager.set(energy)
            energyManager.setCap(settings.machine.energy_cap)
            energyManager.display()

            if (settings.machine.fluid_cap) {
                const fluidManager = new FluidManager(entity, 0)
                fluidManager.setCap(settings.machine.fluid_cap)
                fluidManager.display()

                if (fluid && fluid.amount > 0) {
                    fluidManager.setType(fluid.type)
                    fluidManager.set(fluid.amount)
                }
            }
            system.run(() => { if (callback) callback(entity) })
        });
    }

    /**
     * Transfers items from this machine toward the opposite direction
     * of its current facing axis (`utilitycraft:axis`).
     *
     * ## Behavior
     * - Reads `utilitycraft:axis` from the block permutation.
     * - Determines the **opposite direction vector** (e.g. east → west).
     * - Finds the block located in that opposite direction.
     * - Calls {@link DoriosAPI.containers.transferItemsAt} to move items to the target container.
     *
     * Compatible with:
     * - Vanilla containers (chests, barrels, hoppers, etc.)
     * - Dorios containers and machines with inventories
     *
     * @param {"simple" | "complex"} [type="simple"]
     * Determines which slots to transfer:
     * - `"simple"` → transfers only the **last slot** (output).
     * - `"complex"` → transfers the **last 9 slots** (outputs).
     *
     * @returns {boolean} True if the transfer was attempted, false otherwise.
     */
    transferItems(type = this.settings.entity.output_type ?? "simple") {
        if (this.shouldDelayTransfers()) return false;
        const facing = this.block.getState("utilitycraft:axis");
        if (!facing) return false;

        // Opposite direction vectors
        const opposites = {
            east: [-1, 0, 0],
            west: [1, 0, 0],
            north: [0, 0, 1],
            south: [0, 0, -1],
            up: [0, -1, 0],
            down: [0, 1, 0]
        };

        const offset = opposites[facing];
        if (!offset) return false;

        const { x, y, z } = this.block.location;
        const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };

        // Determine slot range based on type
        let range;
        if (type === "complex") {
            const end = this.inv.size - 1;
            const start = Math.max(0, end - 8);
            range = [start, end];
        } else {
            range = this.inv.size - 1; // last slot only
        }

        // Execute transfer using DoriosAPI
        DoriosAPI.containers.transferItemsAt(this.inv, targetLoc, this.dim, range);
        return true;
    }

    /**
     * Pulls items from the vanilla container block above the machine
     * into a specific slot in its internal inventory.
     *
     * - Only works if the block above is a vanilla container (checked via DoriosAPI.constants.vanillaContainers).
     * - If the target slot is empty, moves the first available item.
     * - If it already contains an item, merges stacks until full.
     *
     * @param {number} targetSlot The slot index where items should be inserted.
     * @returns {boolean} True if at least one item was transferred.
     */
    pullItemsFromAbove(targetSlot) {
        const inv = this.inv
        const block = this.block

        const aboveBlock = block.above(1);
        if (!aboveBlock) return false;

        // Solo contenedores vanilla
        if (!DoriosAPI.constants.vanillaContainers.includes(aboveBlock.typeId)) return false;

        const inputContainer = aboveBlock.getComponent("minecraft:inventory")?.container;
        if (!inputContainer) return false;

        const targetItem = inv.getItem(targetSlot);
        let transferred = false;
        for (let i = 0; i < inputContainer.size; i++) {
            const inputItem = inputContainer.getItem(i);
            if (!inputItem) continue;

            // Si hay item distinto en el slot → saltar
            if (targetItem && inputItem.typeId !== targetItem.typeId) continue;

            // Si el slot está vacío → mover toda la pila al slot específico
            if (!targetItem) {
                inv.setItem(targetSlot, inputItem)
                inputContainer.setItem(i,);
                return true
            }

            const space = targetItem.maxAmount - targetItem.amount;
            const amount = Math.min(space, inputItem.amount)

            // Intentar combinar stacks
            if (amount <= 0) continue;

            targetItem.amount += amount;
            inv.setItem(targetSlot, targetItem);
            if (inputItem.amount - amount <= 0) {
                inputContainer.setItem(i,);
            } else {
                inputItem.amount -= amount
                inputContainer.setItem(i, inputItem);
            }

            return transferred;
        }
    }

    /**
     * Sets a label in the machine inventory using a fixed item as placeholder.
     *
     * The label is displayed by overriding the item's `nameTag` with custom text.
     *
     * @param {string} text The text to display in the label. Supports Minecraft formatting codes (§).
     * @param {number} [slot=1] The inventory slot where the label will be placed.
     */
    setLabel(text, slot = 1) {
        // Always use the same placeholder item
        const baseItem = this.inv.getItem(slot) ?? new ItemStack("utilitycraft:arrow_indicator_90");

        // Apply the custom label text
        baseItem.nameTag = text;

        // Update the slot in the inventory
        this.inv.setItem(slot, baseItem);
    }

    /**
     * Changes the texture of the block to the on version.
     */
    on() {
        this.block.setState('utilitycraft:on', true)
    }

    /**
     * Changes the texture of the block to the off version.
     */
    off() {
        this.block.setState('utilitycraft:on', false)
    }

    //#region Progress
    /**
     * Adds progress to the machine.
     * 
     * @param {number} amount Value to add to the current progress.
     */
    addProgress(amount) {
        const key = "dorios:progress";
        let current = this.entity.getDynamicProperty(key) ?? 0;
        this.entity.setDynamicProperty(key, current + amount);
    }

    /**
     * Sets the machine progress directly.
     * 
     * @param {number} value New progress value.
     * @param {number} [slot=2] Inventory slot to place the progress item.
     * @param {string} [type='arrow_right_'] Item type suffix. 
     * @param {boolean} [display=true] Display the progress. 
     */
    setProgress(value, slot = 2, type = "arrow_right", display = true) {
        this.entity.setDynamicProperty("dorios:progress", Math.max(0, value));
        if (display) this.displayProgress(slot, type)
    }

    /**
     * Gets the current progress of the machine.
     * 
     * @returns {number} Current progress value.
     */
    getProgress() {
        return this.entity.getDynamicProperty("dorios:progress") ?? 0;
    }

    /**
     * Sets the machine's energy cost (maximum progress).
     * 
     * @param {number} value Energy cost representing 100% progress.
     */
    setEnergyCost(value) {
        this.entity.setDynamicProperty("dorios:energy_cost", Math.max(1, value));
    }

    /**
     * Gets the energy cost (maximum progress).
     * 
     * @returns {number} Energy cost value.
     */
    getEnergyCost() {
        return this.entity.getDynamicProperty("dorios:energy_cost") ?? 800;
    }

    /**
     * Displays the current progress in the machine's inventory as a progress bar item.
     * Progress is scaled between 0–16, where 16 = 100% (energy_cost).
     * 
     * @param {number} [slot=2] Inventory slot to place the progress item.
     * @param {string} [type='arrow_right_'] Item type suffix. 
     * Always assumes the `utilitycraft:` namespace, so pass only the suffix.
     */
    displayProgress(slot = 2, type = "arrow_right") {
        const inv = this.entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const progress = this.getProgress();
        const max = this.getEnergyCost();
        const normalized = Math.min(16, Math.floor((progress / max) * 16));

        const itemId = `utilitycraft:${type}_${normalized}`;
        inv.setItem(slot, new ItemStack(itemId, 1));
    }
    //#endregion

    /**
     * Displays the current energy of the machine in the specified inventory slot.
     *
     * Delegates the call to the internal {@link Energy.display} method.
     *
     * @param {number} [slot=0] The inventory slot index where the energy bar will be displayed.
     */
    displayEnergy(slot = 0) {
        this.energy.display(slot);
    }

    /**
     * Displays a warning label in the machine.
     *
     * Optionally resets the machine progress to 0 and turns off the machine.
     *
     * @param {string} message The warning text to display.
     * @param {boolean} [resetProgress=true] Whether to reset the machine progress to 0.
     */
    showWarning(message, resetProgress = true) {
        if (resetProgress) {
            this.setProgress(0);
        }

        this.displayEnergy();
        this.off()
        this.setLabel(`
§r${COLORS.yellow}${message}!

§r${COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${COLORS.green}Efficiency ${((1 / this.boosts.consumption) * 100).toFixed(0)}%%
§r${COLORS.green}Cost ---

§r${COLORS.red}Rate ${Energy.formatEnergyToText(Math.floor(this.baseRate))}/t
    `);
    }

    /**
     * Displays a normal status label in the machine (green).
     *
     * Does not reset the machine progress.
     *
     * @param {string} message The status text to display.
     */
    showStatus(message) {
        this.displayEnergy();

        this.setLabel(`
§r${COLORS.darkGreen}${message}!

§r${COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${COLORS.green}Efficiency ${((1 / this.boosts.consumption) * 100).toFixed(0)}%%
§r${COLORS.green}Cost ${Energy.formatEnergyToText(this.getEnergyCost() * this.boosts.consumption)}

§r${COLORS.red}Rate ${Energy.formatEnergyToText(Math.floor(this.baseRate))}/t
    `);
    }

    /**
     * Scans upgrade slots and returns upgrade levels by type.
     *
     * @param {Array<number>} [slots=[4,5,6]] The inventory slots reserved for upgrades.
     * @returns {UpgradeLevels}
     */
    getUpgradeLevels(slots = [4, 5]) {
        /** @type {UpgradeLevels} */
        const levels = {
            energy: 0,
            range: 0,
            speed: 0,
            ultimate: 0
        };

        for (const slot of slots) {
            const item = this.inv.getItem(slot);
            if (!item) continue;

            if (!item.hasTag("utilitycraft:is_upgrade")) continue;

            // Parse type (e.g. "utilitycraft:energy_upgrade" → "energy")
            const [, raw] = item.typeId.split(":");
            const type = raw.split("_")[0];

            if (levels[type] !== undefined) {
                levels[type] += item.amount;
            }
        }

        return levels;
    }

    /**
     * Calculates the speed multiplier based on upgrade amounts.
     *
     * Formula:
     * speed = 1 + 0.125 * n * (n + 1)
     *
     * @param {number} speedAmount
     * @returns {number} Speed multiplier
     */
    calculateSpeed(speedAmount) {
        const speedLevel = Math.min(8, speedAmount)
        return 1 + 0.125 * speedLevel * (speedLevel + 1);
    }

    /**
     * Calculates the consumption multiplier (lower = better).
     *
     * Formula (depends on energy upgrade level):
     * If level < 4:
     *   consumption = (1 - 0.2 * level) * speed
     * Else:
     *   consumption = (1 - (0.95 - 0.05 * (8 - level))) * speed
     *
     * @param {number} energyAmount
     * @param {number} speed
     * @returns {number} Consumption multiplier (0–1)
     */
    calculateConsumption(energyAmount, speed) {
        const energyLevel = Math.min(8, energyAmount)
        if (energyLevel < 4) {
            return (1 - 0.2 * energyLevel) * speed;
        }
        return (1 - (0.95 - 0.05 * (8 - energyLevel))) * speed;
    }

    /**
     * Aggregates all boosts (speed + consumption).
     *
     * @param {Object} levels Upgrade levels { speed, energy, ... }
     * @returns {{ speed: number, consumption: number }}
     */
    calculateBoosts(levels) {
        const speedLevel = levels.speed ?? 0;
        const energyLevel = levels.energy ?? 0;

        const speed = this.calculateSpeed(speedLevel);
        const consumption = this.calculateConsumption(energyLevel, speed);

        return { speed, consumption };
    }

    /**
     * Block specific slots in this machine by filling them with a blocker item.
     * Only applies to empty slots.
     *
     * @param {number[]} slots Array of slot indices to block.
     */
    blockSlots(slots) {
        for (const index of slots) {
            if (!this.inv.getItem(index)) {
                this.inv.setItem(index, new ItemStack("utilitycraft:arrow_right_0", 1));
            }
        }
    }

    /**
     * Unblock specific slots in this machine by clearing the blocker item.
     *
     * @param {number[]} slots Array of slot indices to unblock.
     */
    unblockSlots(slots) {
        for (const index of slots) {
            const item = this.inv.getItem(index);
            if (item && item.typeId === "utilitycraft:arrow_right_0") {
                this.inv.setItem(index, undefined);
            }
        }
    }

    /**
     * Drops all items from a machine entity's inventory except UI elements.
     *
     * @param {Entity} entity The machine entity whose items will be dropped.
     */
    static dropAllItems(entity) {
        const inv = entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const dim = entity.dimension;
        const center = entity.location;

        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item) continue;

            // Skip UI placeholder items
            if (item.hasTag("utilitycraft:ui_element")) continue;

            // Drop item into the world
            dim.spawnItem(item, center);

            // Clear the slot
            inv.setItem(i, undefined);
        }
    }
}

//#endregion


//#region Energy
/**
 * Utility class to manage scoreboard-based energy values for entities.
 */
export class Energy {
    /**
     * Creates a new Energy instance linked to the given entity.
     *
     * @param {Entity} entity The entity this manager is attached to.
     */
    constructor(entity) {
        this.entity = entity;
        this.scoreId = entity?.scoreboardIdentity;
        this.cap = this.getCap()
    }

    //#region Statics

    /**
     * Ensures that the given entity has a valid scoreboard identity.
     *
     * If an entity does not yet have one, its `scoreboardIdentity` will be `undefined`.
     * Running this method forces the entity to be registered in the scoreboard system
     * by setting its `energy` objective to `0`.
     *
     * @param {Entity} entity The entity representing the machine.
     * @returns {void}
     */
    static initialize(entity) {
        entity.runCommand(`scoreboard players set @s energy 0`);
    }

    /**
     * Normalizes a raw number into a scoreboard-safe mantissa and exponent.
     * Ensures that the mantissa does not exceed 1e9 by shifting into the exponent.
     *
     * @param {number} amount The raw number to normalize.
     * @returns {{ value: number, exp: number }} The normalized mantissa (value) and exponent.
     *
     * @example
     * Energy.normalizeValue(25_600_000);
     * // → { value: 25_600, exp: 3 }
     */
    static normalizeValue(amount) {
        let exp = 0;
        let value = amount;

        while (value > 1e9) {
            value /= 1000;
            exp += 3;
        }

        return { value: Math.floor(value), exp };
    }

    /**
     * Combines a mantissa and exponent back into the full number.
     *
     * @param {number} value The mantissa part of the number.
     * @param {number} exp The exponent part of the number.
     * @returns {number} The reconstructed full number.
     *
     * @example
     * Energy.combineValue(25_600, 3);
     * // → 25_600_000
     */
    static combineValue(value, exp) {
        return value * (10 ** exp);
    }

    /**
     * Formats a numerical Dorios Energy (DE) value into a human-readable string with appropriate unit suffix.
     * 
     * @param {number} value The energy value in DE (Dorios Energy).
     * @returns {string} A formatted string representing the value with the appropriate unit (DE, kDE, MDE, GDE, TDE).
     *
     * @example
     * formatEnergyToText(15300); // "15.3 kDE"
     * formatEnergyToText(1048576); // "1.05 MDE"
     */
    static formatEnergyToText(value) {
        let unit = 'DE';

        if (value >= 1e12) {
            unit = 'TDE';
            value /= 1e12;
        } else if (value >= 1e9) {
            unit = 'GDE';
            value /= 1e9;
        } else if (value >= 1e6) {
            unit = 'MDE';
            value /= 1e6;
        } else if (value >= 1e3) {
            unit = 'kDE';
            value /= 1e3;
        }

        return `${parseFloat(value.toFixed(2))} ${unit}`;
    }

    /**
     * Parses a formatted energy string (with Minecraft color codes) and returns the numeric value in DE.
     * 
     * @param {string} input The string with formatted energy (e.g., "§r§7  Energy: 12.5 kDE / 256 kDE").
     * @param {number} index Which value to extract: 0 = current, 1 = max.
     * @returns {number} The numeric value in base DE.
     *
     * @example
     * parseFormattedEnergy("§r§7  Energy: 12.5 kDE / 256 kDE", 0); // 12500
     * parseFormattedEnergy("§r§7  Energy: 12.5 kDE / 256 kDE", 1); // 256000
     */
    static getEnergyFromText(input, index = 0) {
        // Remove Minecraft formatting codes
        const cleanedInput = input.replace(/§[0-9a-frklmnor]/gi, '');

        // Find all matches like "12.5 kDE"
        const matches = cleanedInput.match(/([\d.]+)\s*(kDE|MDE|GDE|TDE|DE)/g);

        if (!matches || index >= matches.length) {
            throw new Error("Invalid input or index: couldn't parse energy values.");
        }

        const [valueStr, unit] = matches[index].split(' ');
        let multiplier = 1;

        switch (unit) {
            case 'kDE': multiplier = 1e3; break;
            case 'MDE': multiplier = 1e6; break;
            case 'GDE': multiplier = 1e9; break;
            case 'TDE': multiplier = 1e12; break;
            case 'DE': multiplier = 1; break;
        }

        return parseFloat(valueStr) * multiplier;
    }
    //#endregion

    //#region Caps
    /**
     * Sets the maximum energy capacity of the entity.
     * The value is automatically normalized into a mantissa and an exponent,
     * then stored in the corresponding scoreboard objectives.
     *
     * @param {number} amount The raw capacity value to set.
     * @returns {void}
     *
     * @example
     * energy.setCap(25_600_000);
     */
    setCap(amount) {
        const { value, exp } = Energy.normalizeValue(amount);
        objectives.energyCap.setScore(this.scoreId, value);
        objectives.energyCapExp.setScore(this.scoreId, exp);
    }

    /**
     * Gets the maximum energy capacity of the entity.
     * Reads the mantissa and exponent from the scoreboards,
     * then reconstructs the full number.
     *
     * The result is also stored in `this.cap` for later checks.
     *
     * @returns {number} The maximum energy capacity.
     *
     * @example
     * const cap = energy.getCap();
     * console.log(cap); // → 25600000
     */
    getCap() {
        const value = objectives.energyCap.getScore(this.scoreId) || 0;
        const exp = objectives.energyCapExp.getScore(this.scoreId) || 0;

        this.cap = Energy.combineValue(value, exp);
        return this.cap;
    }

    /**
     * Gets the maximum energy capacity of the entity as separate
     * mantissa and exponent values without combining them.
     *
     * The result is also stored in `this.cap` as the full combined number.
     *
     * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
     *
     * @example
     * const { value, exp } = energy.getCapNormalized();
     * console.log(value, exp); // → 25600 , 3
     */
    getCapNormalized() {
        const value = objectives.energyCap.getScore(this.scoreId) || 0;
        const exp = objectives.energyCapExp.getScore(this.scoreId) || 0;

        this.cap = Energy.combineValue(value, exp);
        return { value, exp };
    }
    //#endregion

    /**
     * Sets the current energy of the entity.
     * The value is automatically normalized into a mantissa and an exponent,
     * then stored in the corresponding scoreboard objectives.
     *
     * @param {number} amount The raw energy value to set.
     * @returns {void}
     *
     * @example
     * energy.set(1_250_000);
     */
    set(amount) {
        const { value, exp } = Energy.normalizeValue(amount);

        objectives.energy.setScore(this.scoreId, value);
        objectives.energyExp.setScore(this.scoreId, exp);
    }

    /**
     * Gets the current energy stored in the entity.
     * Reads the mantissa and exponent from the scoreboards,
     * then reconstructs the full number.
     *
     * @returns {number} The current energy value.
     *
     * @example
     * const current = energy.get();
     * console.log(current); // → 1250000
     */
    get() {
        const value = objectives.energy.getScore(this.scoreId) || 0;
        const exp = objectives.energyExp.getScore(this.scoreId) || 0;
        return Energy.combineValue(value, exp);
    }

    /**
     * Gets the current energy stored in the entity as separate
     * mantissa and exponent values without combining them.
     *
     * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
     *
     * @example
     * const { value, exp } = energy.getNormalized();
     * console.log(value, exp); // → 125000 , 1
     */
    getNormalized() {
        return {
            value: objectives.energy.getScore(this.scoreId) || 0,
            exp: objectives.energyExp.getScore(this.scoreId) || 0,
        };
    }

    /**
     * Gets the free energy capacity available in the entity.
     *
     * This is the difference between the maximum capacity (`this.cap`)
     * and the current stored energy.
     *
     * @returns {number} The free capacity (0 if already full).
     *
     * @example
     * const free = energy.getFreeSpace();
     * console.log(free); // → 10240
     */
    getFreeSpace() {
        if (this.cap === undefined) {
            this.getCap();
        }
        const current = this.get();
        return Math.max(0, this.cap - current);
    }

    /**
     * Adds energy to the entity, respecting the maximum capacity.
     * Converts the amount into the current exponent scale.
     *
     * @param {number} amount The amount of energy to add.
     * @returns {number} The actual amount of energy added.
     *
     * @example
     * const added = energy.add(5000);
     * console.log(added); // → 5000 or less if near cap
     */
    add(amount) {
        // Clamp amount to remaining capacity
        const free = this.getFreeSpace();
        if (amount > 0 && free <= 0) return 0;

        if (amount > free) {
            amount = free;
        }

        // Current normalized values
        let { value, exp } = this.getNormalized();
        const multi = 10 ** exp;

        // Convert to current exponent scale
        const normalizedAdd = Math.floor(amount / multi);

        // Add directly if safe
        let newValue = value + normalizedAdd;
        if (newValue <= 1e9) {
            objectives.energy.addScore(this.scoreId, normalizedAdd);

            if (exp > 0 && value < 1e6) {
                this.set(this.get() + amount);
            }
        } else {
            this.set(this.get() + amount);
        }

        return amount;
    }

    /**
     * Displays the current energy as a 48-frame bar item inside the entity's inventory.
     *
     * @param {number} [slot=0] The slot index to place the item in (default is 0).
     * @returns {void}
     *
     * @example
     * energy.display();     // shows bar in slot 0
     * energy.display(5);    // shows bar in slot 5
     */
    display(slot = 0) {
        const container = this.entity.getComponent("minecraft:inventory")?.container;
        if (!container) return;

        const energy = this.get();
        const energyCap = this.getCap();

        const energyP = Math.floor((energy / energyCap) * 48);
        const frame = Math.max(0, Math.min(48, energyP));
        const frameName = frame.toString().padStart(2, "0");

        const item = new ItemStack(`utilitycraft:energy_${frameName}`, 1);
        item.nameTag = `§rEnergy
§r§7  Stored: ${Energy.formatEnergyToText(this.get())} / ${Energy.formatEnergyToText(this.cap)}
§r§7  Percentage: ${this.getPercent().toFixed(2)}%%`;

        container.setItem(slot, item);
    }

    //#region Utils
    /**
     * Consumes energy from the entity if available.
     * Internally this is just an add with a negative amount.
     *
     * @param {number} amount The amount of energy to consume.
     * @returns {number} The actual amount of energy consumed.
     *
     * @example
     * const used = energy.consume(1000);
     * if (used > 0) console.log(`Consumed ${used} energy`);
     */
    consume(amount) {
        if (amount <= 0) return 0;

        const current = this.get();
        if (current < amount) return 0;

        // Delegate to add with negative value
        this.add(-amount);
        return amount;
    }

    /**
     * Checks if the entity has at least the given amount of energy.
     *
     * @param {number} amount The required amount.
     * @returns {boolean} True if the entity has enough energy.
     *
     * @example
     * if (energy.has(500)) {
     *   // Do operation
     * }
     */
    has(amount) {
        return this.get() >= amount;
    }

    /**
     * Checks if the entity is at maximum capacity.
     *
     * @returns {boolean} True if energy is at or above the capacity.
     *
     * @example
     * if (energy.isFull()) {
     *   console.log("Battery is full!");
     * }
     */
    isFull() {
        return this.getFreeSpace() === 0;
    }

    /**
     * Rebalances the energy value to ensure the mantissa and exponent
     * are in the optimal range.
     *
     * This is useful after large consumes, to avoid cases where
     * the exponent is high but the mantissa is very small.
     *
     * @returns {void}
     *
     * @example
     * energy.rebalance();
     */
    rebalance() {
        this.set(this.get());
    }

    /**
     * Gets the current energy as a percentage of capacity.
     *
     * @returns {number} The percentage [0-100].
     *
     * @example
     * const percent = energy.getPercent();
     * console.log(`${percent.toFixed(1)}% full`);
     */
    getPercent() {
        if (this.cap === undefined) {
            this.getCap();
        }
        if (this.cap <= 0) return 0;
        return Math.min(100, (this.get() / this.cap) * 100);
    }

    /**
     * Transfers energy from this entity to another Energy manager.
     *
     * @param {Energy} other The target Energy instance.
     * @param {number} amount The maximum amount to transfer.
     * @returns {number} The actual amount transferred.
     *
     * @example
     * const transferred = source.transferTo(target, 1000);
     * console.log(`Transferred ${transferred} energy`);
     */
    transferTo(other, amount) {
        const consumed = this.consume(amount);
        if (consumed <= 0) return 0;

        const added = other.add(consumed);
        return added;
    }

    /**
     * Transfers energy from this entity to another entity directly.
     * Creates a temporary Energy manager for the target entity.
     *
     * @param {Entity} entity The target entity.
     * @param {number} amount The maximum amount to transfer.
     * @returns {number} The actual amount transferred.
     *
     * @example
     * const transferred = battery.transferToEntity(machineEntity, 2000);
     * console.log(`Transferred ${transferred} energy`);
     */
    transferToEntity(entity, amount) {
        const other = new Energy(entity);
        return this.transferTo(other, amount);
    }

    /**
     * Receives energy from another Energy manager.
     *
     * @param {Energy} other The source Energy instance.
     * @param {number} amount The maximum amount to receive.
     * @returns {number} The actual amount received.
     *
     * @example
     * const received = machine.receiveFrom(generator, 1500);
     * console.log(`Received ${received} energy`);
     */
    receiveFrom(other, amount) {
        const consumed = other.consume(amount);
        if (consumed <= 0) return 0;

        const added = this.add(consumed);
        return added;
    }

    /**
     * Receives energy directly from another entity.
     * Creates a temporary Energy manager for the source entity.
     *
     * @param {Entity} entity The source entity.
     * @param {number} amount The maximum amount to receive.
     * @returns {number} The actual amount received.
     *
     * @example
     * const received = machine.receiveFromEntity(generatorEntity, 3000);
     * console.log(`Received ${received} energy`);
     */
    receiveFromEntity(entity, amount) {
        const other = new Energy(entity);
        return this.receiveFrom(other, amount);
    }
    //#endregion

    /**
     * Transfers energy from this entity to connected energy containers in its network.
     *
     * ## Behavior
     * - Reads network nodes from a cached dynamic property (`dorios:energy_nodes`).
     * - If the property doesn't exist or the entity has the `updateNetwork` tag,
     *   rebuilds the node list from its `pos:[x,y,z]` or `net:[x,y,z]` tags.
     * - Caches the list sorted by distance for performance.
     *
     * ## Transfer Modes
     * - `"nearest"` → Transfers to the closest valid target first.
     * - `"farthest"` → Transfers starting from the farthest target first.
     * - `"round"` → Checks 10 targets per tick, giving energy evenly to all valid ones.
     *
     * @param {number} speed Total transfer speed limit (DE/tick).
     * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
     * @returns {number} Total amount of energy transferred (in DE).
     */
    transferToNetwork(speed, mode) {
        mode = mode ?? this.entity.getDynamicProperty('transferMode');
        let available = this.get();
        speed = Math.min(available, speed)
        if (available <= 0 || speed <= 0) return 0;

        const dim = this.entity.dimension;
        const pos = this.entity.location;
        const isBattery = this.entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:battery");
        let transferred = 0;

        // ──────────────────────────────────────────────
        // Retrieve or rebuild cached network nodes
        // ──────────────────────────────────────────────
        let nodes = this.entity.getDynamicProperty("dorios:energy_nodes");
        const needsUpdate = this.entity.hasTag("updateNetwork");

        if (!nodes || needsUpdate) {
            const positions = this.entity.getTags()
                .filter(tag => tag.startsWith("pos:[") || tag.startsWith("net:["))
                .map(tag => {
                    const [x, y, z] = tag.slice(5, -1).split(",").map(Number);
                    return { x, y, z };
                })
                .sort((a, b) =>
                    DoriosAPI.math.distanceBetween(pos, a) -
                    DoriosAPI.math.distanceBetween(pos, b)
                );

            this.entity.setDynamicProperty("dorios:energy_nodes", JSON.stringify(positions));
            this.entity.removeTag("updateNetwork");
            nodes = JSON.stringify(positions);
        }

        /** @type {{x:number,y:number,z:number}[]} */
        const targets = JSON.parse(nodes);
        if (targets.length === 0) return 0;

        // ──────────────────────────────────────────────
        // Select order based on transfer mode
        // ──────────────────────────────────────────────
        let orderedTargets = [...targets];
        if (mode === "farthest") orderedTargets.reverse();

        // ──────────────────────────────────────────────
        // ROUND MODE: check 10 nodes per tick
        // ──────────────────────────────────────────────
        if (mode === "round") {
            // let idx = Number(this.entity.getDynamicProperty("dorios:energy_round_idx") || 0);

            // // Selecciona un grupo de 10 posiciones
            // const batch = orderedTargets.slice(idx, idx + 10);
            // if (batch.length === 0) {
            //     // si llegó al final, reinicia
            //     idx = 0;
            //     this.entity.setDynamicProperty("dorios:energy_round_idx", 0);
            //     return 0;
            // }

            // Filtrar entidades válidas
            const validEntities = [];
            for (const loc of orderedTargets) {
                const [target] = dim.getEntitiesAtBlockLocation(loc);
                if (!target) continue;

                const tf = target.getComponent("minecraft:type_family");
                if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
                if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

                const energy = new Energy(target);
                if (energy.getFreeSpace() > 0) validEntities.push(energy);
            }

            if (validEntities.length === 0) {
                // avanzar igual aunque no haya válidos
                // this.entity.setDynamicProperty("dorios:energy_round_idx", (idx + 10) % orderedTargets.length);
                return 0;
            }

            // Dividir la energía entre los válidos del grupo actual
            const share = Math.floor(Math.min(speed, available) / validEntities.length);
            // world.sendMessage(`${share}, ${validEntities.length}`)
            for (const energy of validEntities) {
                if (available <= 0 || speed <= 0) break;

                const space = energy.getFreeSpace();
                if (space <= 0) continue;

                const amount = Math.min(share, space);
                const added = energy.add(amount);
                if (added > 0) {
                    available -= added;
                    speed -= added;
                    transferred += added;
                }
            }

            // // Avanza al siguiente grupo (10 por tick)
            // this.entity.setDynamicProperty(
            //     "dorios:energy_round_idx",
            //     (idx + 10) % orderedTargets.length
            // );
        }

        // ──────────────────────────────────────────────
        // NEAREST / FARTHEST modes (Sequential)
        // ──────────────────────────────────────────────
        else {
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;

                const [target] = dim.getEntitiesAtBlockLocation(loc);
                if (!target) continue;

                const tf = target.getComponent("minecraft:type_family");
                if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
                if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

                const energy = new Energy(target);
                const space = energy.getFreeSpace();
                if (space <= 0) continue;

                const amount = Math.min(space, available, speed);
                const added = energy.add(amount);
                if (added > 0) {
                    available -= added;
                    speed -= added;
                    transferred += added;
                }
            }
        }

        // ──────────────────────────────────────────────
        // Apply total energy consumption
        // ──────────────────────────────────────────────
        if (transferred > 0) this.consume(transferred);

        return transferred;
    }

}
//#endregion



/**
 * Global map storing loaded fluid-related scoreboard objectives per index.
 * Each index represents an independent tank slot (e.g., 0, 1, 2).
 */
const fluidObjectives = new Map();

/**
 * Ensures that the required scoreboard objectives exist for a given tank index.
 *
 * Creates or retrieves four objectives per index:
 * - `fluid_{index}` → fluid amount (mantissa)
 * - `fluidExp_{index}` → fluid exponent
 * - `fluidCap_{index}` → Capacity (mantissa)
 * - `fluidCapExp_{index}` → Capacity exponent
 *
 * @param {number} [index=0] The fluid tank index to initialize (default 0).
 * @returns {void}
 */
function initFluidObjectives(index = 0) {
    const definitions = [
        [`fluid_${index}`, `fluid ${index}`],
        [`fluidExp_${index}`, `fluid Exp ${index}`],
        [`fluidCap_${index}`, `fluid Cap ${index}`],
        [`fluidCapExp_${index}`, `fluid Cap Exp ${index}`]
    ];

    for (const [id, display] of definitions) {
        if (!fluidObjectives.has(id)) {
            let obj = world.scoreboard.getObjective(id);
            if (!obj) obj = world.scoreboard.addObjective(id, display);
            fluidObjectives.set(id, obj);
        }
    }
}


/**
 * Manages scoreboard-based fluid values for entities or machines.
 * 
 * Provides a unified API to store, retrieve, normalize, and display fluid values.
 * Each instance can manage a specific tank index (0, 1, ...).
 *
 * The system uses the same mantissa–exponent structure as the Energy system
 * to support large numbers efficiently while maintaining scoreboard safety.
 */
export class FluidManager {
    /**
     * Creates a new FluidManager instance for a specific entity and tank index.
     *
     * @param {Entity} entity The entity representing the fluid container.
     * @param {number} [index=0] The index of the fluid tank managed by this instance.
     */
    constructor(entity, index = 0) {
        this.entity = entity;
        this.index = index;
        this.scoreId = entity?.scoreboardIdentity;

        // Ensure fluid objectives exist for this tank index
        initFluidObjectives(index);

        this.scores = {
            fluid: fluidObjectives.get(`fluid_${index}`),
            fluidExp: fluidObjectives.get(`fluidExp_${index}`),
            fluidCap: fluidObjectives.get(`fluidCap_${index}`),
            fluidCapExp: fluidObjectives.get(`fluidCapExp_${index}`)
        };

        this.type = this.getType();
        this.cap = this.getCap();
        if (this.get() == 0) this.setType('empty')
    }

    /**
     * Initializes a single fluid tank (index 0) for a machine entity.
     *
     * This should be used for machines that only store one type of fluid.
     * It ensures the scoreboard objectives for index 0 exist and
     * returns a ready-to-use FluidManager instance.
     *
     * @param {Entity} entity The machine entity to initialize.
     * @returns {FluidManager} A FluidManager instance managing index 0.
     */
    static initializeSingle(entity) {
        initFluidObjectives(0);
        return new FluidManager(entity, 0);
    }

    /**
     * Initializes multiple fluid tanks for a machine entity.
     *
     * This should be used for machines capable of storing more than one fluid.
     * It ensures all scoreboard objectives up to the specified maximum index exist
     * and returns an array of FluidManager instances (one per index).
     *
     * @param {Entity} entity The machine entity to initialize.
     * @param {number} maxIndex The maximum tank index (exclusive upper bound).
     * @returns {FluidManager[]} An array of FluidManager instances from index 0 to maxIndex - 1.
     */
    static initializeMultiple(entity, maxIndex) {
        const tanks = [];
        for (let i = 0; i < maxIndex; i++) {
            initFluidObjectives(i);
            tanks.push(new FluidManager(entity, i));
        }
        return tanks;
    }

    /**
     * Returns the current map of fluid container definitions.
     *
     * The registry is populated inside `config/fluids/containers.js`
     * and can be extended either in code or via the
     * `utilitycraft:register_fluid_container` ScriptEvent.
     */
    static get itemFluidContainers() {
        return getFluidContainerRegistry();
    }

    /**
     * Registers or overrides a fluid container definition at runtime.
     *
     * @param {string} id Item identifier.
     * @param {{ amount: number, type: string, output?: string }} definition Container data.
     * @returns {boolean} True when the definition was stored.
     */
    static registerFluidContainer(id, definition) {
        return registerFluidContainerDefinition(id, definition);
    }

    /**
     * Returns the registry of fluid output containers (empty → filled mappings).
     */
    static get fluidOutputContainers() {
        return getFluidOutputRegistry();
    }

    /**
     * Retrieves output definition for an empty container identifier.
     *
     * @param {string} id Item identifier for the empty container.
     * @returns {{ amount: number, fills: Record<string, string> } | null}
     */
    static getFluidFillDefinition(id) {
        if (!id) return null;
        return getFluidOutputDefinition(id);
    }

    /**
     * Registers or overrides a fluid output definition at runtime.
     *
     * @param {string} id Item identifier.
     * @param {{ amount: number, fills: Record<string, string> }} definition Data describing how the container is filled.
     * @returns {boolean}
     */
    static registerFluidOutput(id, definition) {
        return registerFluidOutputDefinition(id, definition);
    }


    // --------------------------------------------------------------------------
    // Normalization utilities
    // --------------------------------------------------------------------------

    /**
     * Normalizes a raw fluid amount into a mantissa–exponent pair.
     *
     * This ensures the mantissa never exceeds 1e9 to remain scoreboard-safe.
     *
     * @param {number} amount The raw fluid amount.
     * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
     */
    static normalizeValue(amount) {
        let exp = 0;
        let value = amount;
        while (value > 1e9) {
            value /= 1000;
            exp += 3;
        }
        return { value: Math.floor(value), exp };
    }

    /**
     * Combines a mantissa and exponent into a full numeric value.
     *
     * @param {number} value Mantissa value.
     * @param {number} exp Exponent multiplier (power of 10).
     * @returns {number} The reconstructed numeric value.
     */
    static combineValue(value, exp) {
        return (value || 0) * (10 ** (exp || 0));
    }

    /**
     * Formats a fluid amount into a human-readable string with units.
     *
     * @param {number} value The fluid amount in millibuckets (mB).
     * @returns {string} A formatted string with unit suffix (mB, kB, MB).
     */
    static formatFluid(value) {
        let unit = "mB";
        if (value >= 1e9) {
            unit = "MB";
            value /= 1e6;
        } else if (value >= 1e6) {
            unit = "kB";
            value /= 1e3;
        }
        return `${value.toFixed(1)} ${unit}`;
    }

    /**
     * Extracts the fluid type and amount from a formatted text like:
     * "§r§7  Lava: 52809 kB/ 64000 kB"
     * or "§r§7  Water: 5000.0 mB/32000.0 mB"
     *
     * @param {string} input The lore line.
     * @returns {{ type: string, amount: number }} The fluid type and its parsed numeric value.
     */
    static getFluidFromText(input) {
        const cleaned = input.replace(/§./g, "").trim();

        // Match without "Stored"
        const match = cleaned.match(/(\w+):\s*([\d.]+)\s*(mB|kB|MB|B)/);
        if (!match) return { type: "empty", amount: 0 };

        const [, rawType, rawValue, unit] = match;

        const multipliers = {
            mB: 1,
            B: 1000,
            kB: 1000,
            MB: 1_000_000
        };

        const amount = parseFloat(rawValue) * (multipliers[unit] ?? 1);
        const type = rawType.toLowerCase();

        return { type, amount };
    }

    /**
     * Returns fluid container data for a given item identifier.
     *
     * Looks up the internal fluid container map and returns
     * the corresponding data if the item can store or provide fluid.
     *
     * @param {string} id Item identifier (e.g. "minecraft:lava_bucket").
     * @returns {{ amount: number, type: string, output?: string }|null} Fluid data if found, otherwise null.
     */
    static getContainerData(id) {
        if (!id) return null;
        return getFluidContainerDefinition(id);
    }

    // --------------------------------------------------------------------------
    // Core operations
    // --------------------------------------------------------------------------

    /**
     * Initializes scoreboard values for a new fluid entity.
     *
     * @param {Entity} entity The entity to initialize.
     * @returns {void}
     */
    static initialize(entity) {
        entity.runCommand(`scoreboard players set @s fluid_0 0`);
    }

    /**
     * Transfers fluid between two world locations.
     *
     * ## Behavior
     * - Both source and target blocks must have the tag `"dorios:fluid"`.
     * - If the target is a fluid tank without an entity, one is spawned empty first.
     * - Fluid is transferred between entities using {@link FluidManager.transferTo}.
     * - The {@link FluidManager.add} method automatically handles visual updates.
     *
     * Works with:
     * - Fluid tanks (auto-spawns empty entity if missing)
     * - Machines with internal fluid storage
     *
     * @param {Dimension} dim The dimension where both positions exist.
     * @param {{x:number, y:number, z:number}} sourceLoc Source block coordinates.
     * @param {{x:number, y:number, z:number}} targetLoc Target block coordinates.
     * @param {number} [amount=100] Maximum amount to transfer (in mB).
     * @returns {boolean} True if a valid transfer occurred, false otherwise.
     */
    static transferBetween(dim, sourceLoc, targetLoc, amount = 100) {
        if (!dim || !sourceLoc || !targetLoc) return false;

        const sourceBlock = dim.getBlock(sourceLoc);
        const targetBlock = dim.getBlock(targetLoc);

        // Validate both endpoints
        if (!sourceBlock?.hasTag("dorios:fluid")) return false;
        if (!targetBlock?.hasTag("dorios:fluid")) return false;

        // ─── Source entity check ───────────────────────────────
        const sourceEntity = dim.getEntitiesAtBlockLocation(sourceLoc)[0];
        if (!sourceEntity) return false;

        const sourceFluid = new FluidManager(sourceEntity, 0);
        if (!sourceFluid || sourceFluid.get() <= 0) return false;

        // ─── Target entity handling ───────────────────────────────
        let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

        // If target is a tank and has no entity → spawn an empty one
        if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
            const type = sourceFluid.getType();
            if (type == 'empty') return false
            targetEntity = FluidManager.addfluidToTank(targetBlock, type, 0);
        }

        // If still no entity (non-tank machine), stop
        if (!targetEntity) return false;

        // ─── Perform fluid transfer ───────────────────────────────
        const targetFluid = new FluidManager(targetEntity, 0);
        if (!targetFluid || targetFluid.getCap() <= 0) return false;

        const transferred = sourceFluid.transferTo(targetFluid, amount);
        return transferred > 0;
    }

    /**
     * Attempts to insert a given liquid type and amount into the tank.
     *
     * The insertion will only succeed if:
     * - The tank is empty or already contains the same liquid type.
     * - There is enough free space to hold the specified amount.
     *
     * If the tank is empty, its type will automatically be set to the inserted liquid.
     *
     * @param {string} type The liquid type to insert (e.g., "lava", "water").
     * @param {number} amount The amount of liquid to insert.
     * @returns {boolean} True if the liquid was successfully inserted, false otherwise.
     */
    tryInsert(type, amount) {
        if (amount <= 0) return false;
        const currentType = this.getType();
        if (currentType === "empty" || currentType === type) {
            if (amount <= this.getFreeSpace()) {
                if (currentType === "empty") this.setType(type);
                this.add(amount);
                return true;
            }
        }
        return false;
    }

    /**
     * Handles item-to-fluid interactions for machines or fluid tanks.
     *
     * Supports:
     * - Inserting fluid from known container items (defined in `itemFluidContainers`)
     * - Filling empty buckets with available fluid (lava, water, milk)
     *
     * @param {string} typeId The item identifier being used (e.g., "minecraft:water_bucket" or "minecraft:bucket").
     * @returns {string|false} Returns the output item ID (e.g., empty bucket) if successful, or false if the action failed.
     */
    fluidItem(typeId) {
        // 1. Handle known container items (e.g., water bucket, lava bucket)
        const insertData = FluidManager.getContainerData(typeId);
        if (insertData) {
            const { type, output } = insertData;
            const insertAmount = insertData.amountRange?.max ?? insertData.amount;

            // Ensure the tank can accept this fluid
            const inserted = this.tryInsert(type, insertAmount);
            if (!inserted) return false;

            return output; // Return resulting item (e.g., empty bucket)
        }

        // 2. Handle empty containers that should be filled with the stored fluid
        const fillDefinition = FluidManager.getFluidFillDefinition(typeId);
        if (fillDefinition) {
            const storedType = this.getType();
            if (!storedType || storedType === 'empty') return false;

            const filledItemId = fillDefinition.fills?.[storedType];
            if (!filledItemId) return false;
            const drainAmount = fillDefinition.amountRange?.max ?? fillDefinition.amount;
            if (this.get() < drainAmount) return false;

            this.add(-drainAmount);
            if (this.get() <= 0) this.setType('empty');
            return filledItemId;
        }

        // 3. Not a recognized container item
        return false;
    }


    /**
     * Sets the fluid capacity of this tank.
     *
     * @param {number} amount Maximum fluid capacity in mB.
     * @returns {void}
     */
    setCap(amount) {
        const { value, exp } = FluidManager.normalizeValue(amount);
        this.scores.fluidCap.setScore(this.scoreId, value);
        this.scores.fluidCapExp.setScore(this.scoreId, exp);
    }

    /**
     * Retrieves the full capacity of this tank.
     *
     * @returns {number} The maximum capacity in mB.
     */
    getCap() {
        const v = this.scores.fluidCap.getScore(this.scoreId) || 0;
        const e = this.scores.fluidCapExp.getScore(this.scoreId) || 0;
        this.cap = FluidManager.combineValue(v, e);
        return this.cap;
    }

    /**
     * Sets the current amount of fluid in this tank.
     *
     * Automatically clamps to the tank capacity and normalizes for scoreboard storage.
     *
     * @param {number} amount Amount to set in mB.
     * @returns {void}
     */
    set(amount) {
        const { value, exp } = FluidManager.normalizeValue(amount);
        this.scores.fluid.setScore(this.scoreId, value);
        this.scores.fluidExp.setScore(this.scoreId, exp);
        if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
            this.entity.setHealth(amount);
        }
    }

    /**
     * Gets the current amount of fluid stored in this tank.
     *
     * @returns {number} The current fluid amount in mB.
     */
    get() {
        const v = this.scores.fluid.getScore(this.scoreId) || 0;
        const e = this.scores.fluidExp.getScore(this.scoreId) || 0;
        return FluidManager.combineValue(v, e);
    }

    /**
     * Adds or subtracts a specific amount of fluid.
     *
     * Uses scoreboard-safe addition logic.
     * Automatically clamps to tank capacity and updates visible
     * health if the entity is a UtilityCraft fluid tank.
     *
     * @param {number} amount Amount to add (negative values subtract).
     * @returns {number} Actual amount added or removed.
     */
    add(amount) {
        if (amount === 0) return 0;

        // Clamp amount to valid range
        const free = this.getFreeSpace();
        if (amount > 0 && free <= 0) return 0;
        if (amount > free) amount = free;

        // Get current mantissa & exponent
        let value = this.scores.fluid.getScore(this.scoreId) || 0;
        let exp = this.scores.fluidExp.getScore(this.scoreId) || 0;
        const multi = 10 ** exp;

        // Convert to current exponent scale
        const normalizedAdd = Math.floor(amount / multi);

        // Apply add directly if safe
        let newValue = value + normalizedAdd;
        if (Math.abs(newValue) <= 1e9) {
            this.scores.fluid.addScore(this.scoreId, normalizedAdd);

            if (exp > 0 && value < 1e6) {
                this.set(this.get() + amount);
            }
        } else {
            this.set(this.get() + amount);
        }

        if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
            const amountCurrent = this.get()
            if (amountCurrent > 0) {
                system.run(() => {
                    this.entity.setHealth(amountCurrent);
                })
            } else { this.entity.remove() }
        }

        return amount;
    }


    /**
     * Consumes a specific amount of fluid if available.
     *
     * @param {number} amount The amount to consume.
     * @returns {number} The amount actually consumed (0 if insufficient).
     */
    consume(amount) {
        const current = this.get();
        if (current < amount) return 0;
        this.add(-amount);
        return amount;
    }

    /**
     * Returns the remaining space available in this tank.
     *
     * @returns {number} Remaining free capacity in mB.
     */
    getFreeSpace() {
        return Math.max(0, this.getCap() - this.get());
    }

    /**
     * Checks whether the tank has at least a certain amount of fluid.
     *
     * @param {number} amount Amount to check for.
     * @returns {boolean} True if there is enough fluid.
     */
    has(amount) {
        return this.get() >= amount;
    }

    /**
     * Checks whether the tank is full.
     *
     * @returns {boolean} True if the tank has no free space remaining.
     */
    isFull() {
        return this.get() >= this.getCap();
    }

    // --------------------------------------------------------------------------
    // Type tag management
    // --------------------------------------------------------------------------

    /**
     * Gets the fluid type currently stored in this tank.
     *
     * The type is stored in the entity's tags as `fluid{index}Type:{type}`.
     *
     * @returns {string} The stored fluid type, or "empty" if none.
     */
    getType() {
        const tag = this.entity.getTags().find(t => t.startsWith(`fluid${this.index}Type:`));
        return tag ? tag.split(":")[1] : "empty";
    }

    /**
     * Sets the fluid type for this tank.
     *
     * Removes any previous type tag before adding the new one.
     *
     * @param {string} type The new fluid type (e.g. "lava", "water").
     * @returns {void}
     */
    setType(type) {
        const old = this.entity.getTags().find(t => t.startsWith(`fluid${this.index}Type:`));
        if (old) this.entity.removeTag(old);
        this.entity.addTag(`fluid${this.index}Type:${type}`);
        this.type = type;
    }

    // --------------------------------------------------------------------------
    // Transfer operations
    // --------------------------------------------------------------------------

    /**
   * Transfers fluid from this entity to connected fluid containers in its network.
   *
   * ## Behavior
   * - Uses the provided `nodes` array to determine valid transfer targets.
   * - Automatically creates entities for target fluid tanks if they are empty (no entity).
   * - If no `nodes` are provided, the method immediately returns 0.
   *
   * ## Transfer Modes
   * - `"nearest"` → Starts from the closest node that accepts fluid.
   * - `"farthest"` → Starts from the farthest node first.
   * - `"round"` → Distributes fluid evenly across all valid targets.
   *
   * @param {number} speed Total transfer speed limit (mB/tick).
   * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
   * @param {Array<{x:number, y:number, z:number}>} nodes Precomputed network node positions.
   * @returns {number} Total amount of fluid transferred (in mB).
   */
    transferToNetwork(speed, mode = "nearest", nodes) {
        if (!Array.isArray(nodes) || nodes.length === 0) return 0;

        const dim = this.entity.dimension;
        const pos = this.entity.location;
        let available = this.get();
        if (available <= 0 || speed <= 0) return 0;

        let transferred = 0;
        const type = this.getType();
        if (!type || type === "empty") return 0;

        // Select order based on mode
        let orderedTargets = [...nodes];

        // ──────────────────────────────────────────────
        // Process transfers
        // ──────────────────────────────────────────────
        const processTarget = (loc, share = null) => {
            const targetBlock = dim.getBlock(loc);
            if (!targetBlock?.hasTag("dorios:fluid")) return 0;

            // If the target is a tank with no entity, create one to store the fluid
            let targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
            if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
                FluidManager.addfluidToTank(targetBlock, type, 0);
                targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
            }
            if (!targetEntity) return 0;

            const target = new FluidManager(targetEntity, 0);
            const targetType = target.getType();
            const space = target.getFreeSpace();

            // Skip incompatible fluids
            if (targetType !== "empty" && targetType !== type) return 0;
            if (space <= 0) return 0;

            // Assign fluid type if empty
            if (targetType === "empty") target.setType(type);

            const amount = share ? Math.min(share, space, available, speed) : Math.min(space, available, speed);
            const added = target.add(amount);

            if (added > 0) {
                available -= added;
                speed -= added;
                transferred += added;
            }

            return added;
        };

        if (mode === "round") {
            const share = Math.floor(speed / orderedTargets.length);
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;
                processTarget(loc, share);
            }
        } else {
            // Sequential transfer (nearest/farthest)
            for (const loc of orderedTargets) {
                if (available <= 0 || speed <= 0) break;
                const added = processTarget(loc);
            }
        }

        // Subtract total transferred
        if (transferred > 0) this.add(-transferred);

        return transferred;
    }


    /**
     * Transfers fluid from this tank or machine toward the opposite
     * direction of its facing axis (`utilitycraft:axis`).
     *
     * ## Behavior
     * - Reads `utilitycraft:axis` from the source block.
     * - Determines the **opposite direction vector** (e.g. east → west).
     * - Locates the target block in that opposite direction.
     * - If the target has the tag `"dorios:fluid"`, tries to transfer fluid to it.
     * - If the target is a fluid tank with no entity, one is spawned empty first.
     * - Uses {@link FluidManager.transferTo} to handle transfer and visual updates.
     *
     * @param {Block} block The source block associated with this fluid entity.
     * @param {number} [amount=100] Maximum amount to transfer (in mB).
     * @returns {boolean} True if a valid transfer occurred, false otherwise.
     */
    transferFluids(block, amount = 100) {
        if (!block || !this.entity?.isValid) return false;

        const facing = block.getState("utilitycraft:axis");
        if (!facing) return false;

        // Opposite direction vectors
        const opposites = {
            east: [-1, 0, 0],
            west: [1, 0, 0],
            north: [0, 0, 1],
            south: [0, 0, -1],
            up: [0, -1, 0],
            down: [0, 1, 0]
        };

        const offset = opposites[facing];
        if (!offset) return false;

        const { x, y, z } = block.location;
        const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };
        const dim = block.dimension;
        const targetBlock = dim.getBlock(targetLoc);
        if (!targetBlock) return false;

        // Only proceed if the target block supports fluids
        if (!targetBlock.hasTag("dorios:fluid")) return false;

        let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

        // If target is a tank and has no entity, spawn an empty one
        if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
            const type = this.getType();
            if (type == 'empty') return
            FluidManager.addfluidToTank(targetBlock, type, 0);
            targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];
        }

        if (!targetEntity) return false;

        const targetFluid = new FluidManager(targetEntity, 0);
        if (!targetFluid || targetFluid.getCap() <= 0) return false;

        const transferred = this.transferTo(targetFluid, amount);
        return transferred > 0;
    }

    /**
     * Transfers a specific amount of fluid from this tank to another.
     *
     * @param {FluidManager} other The target tank to receive the fluid.
     * @param {number} amount The amount to transfer in mB.
     * @returns {number} The actual amount transferred.
     */
    transferTo(other, amount) {
        if (this.getType() !== other.getType() && other.getType() !== "empty") return 0;

        const transferable = Math.min(amount, this.get(), other.getFreeSpace());
        if (transferable <= 0) return 0;

        this.add(-transferable);
        other.add(transferable);
        if (other.getType() === "empty") other.setType(this.getType());
        return transferable;
    }

    /**
     * Receives fluid from another FluidManager.
     *
     * @param {FluidManager} other The source tank to pull from.
     * @param {number} amount The maximum amount to receive.
     * @returns {number} The actual amount received.
     */
    receiveFrom(other, amount) {
        return other.transferTo(this, amount);
    }

    // --------------------------------------------------------------------------
    // Display logic
    // --------------------------------------------------------------------------

    /**
     * Displays the current fluid level in the entity's inventory.
     *
     * Renders a 48-frame progress bar representing how full the tank is.
     * The item used depends on the current fluid type.
     *
     * @param {number} [slot=4] Inventory slot index for the display item.
     * @returns {void}
     */
    display(slot = 4) {
        const inv = this.entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        const fluid = this.get();
        const cap = this.getCap();
        const type = this.getType();

        if (type === "empty") {
            let emptyBar = new ItemStack("utilitycraft:empty_fluid_bar")
            emptyBar.nameTag = '§rEmpty'
            inv.setItem(slot, emptyBar)
            return;
        }

        const frame = Math.max(0, Math.min(48, Math.floor((fluid / cap) * 48)));
        const frameName = frame.toString().padStart(2, "0");

        const item = new ItemStack(`utilitycraft:${type}_${frameName}`, 1);
        item.nameTag = `§r${DoriosAPI.utils.capitalizeFirst(type)}
§r§7  Stored: ${FluidManager.formatFluid(fluid)} / ${FluidManager.formatFluid(cap)}
§r§7  Percentage: ${(fluid / cap * 100).toFixed(2)}%`;

        inv.setItem(slot, item);
    }

    // --------------------------------------------------------------------------
    // Utility for blocks
    // --------------------------------------------------------------------------

    /**
     * Adds a specified fluid to a tank block at a given location.
     *
     * Spawns a fluid tank entity if missing and initializes its scoreboards.
     *
     * @param {Block} block The block representing the tank.
     * @param {string} type The type of fluid to insert.
     * @param {number} amount Amount of fluid to insert in mB.
     * @returns {Entity} entity if insertion was successful.
     */
    static addfluidToTank(block, type, amount) {
        const dim = block.dimension;
        const pos = block.location;
        let entity = dim.getEntitiesAtBlockLocation(pos)[0];

        if (!entity) {
            const { x, y, z } = block.location;
            entity = dim.spawnEntity(`utilitycraft:fluid_tank_${type}`, { x: x + 0.5, y, z: z + 0.5 });
            if (!entity) return false;
            FluidManager.initialize(entity);
            entity.triggerEvent(`${block.typeId.split('_')[0]}`)
        }

        const tank = new FluidManager(entity, 0);
        tank.setCap(FluidManager.getTankCapacity(block.typeId));
        tank.setType(type);
        tank.add(amount);
        return entity;
    }

    /**
     * Returns the default capacity for a given tank block.
     *
     * @param {string} typeId The block type identifier.
     * @returns {number} The tank's base capacity in mB.
     */
    static getTankCapacity(typeId) {
        const caps = {
            "utilitycraft:basic_fluid_tank": 8000,
            "utilitycraft:advanced_fluid_tank": 32000,
            "utilitycraft:expert_fluid_tank": 128000,
            "utilitycraft:ultimate_fluid_tank": 512000
        };
        return caps[typeId] ?? 8000;
    }
}


/**
 * ScriptEvent handler to destroy a machine at given coordinates.
 * Removes the machine entity, drops stored items, and replaces the block with air.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id === 'dorios:destroyMachine') {
        try {
            const [x, y, z] = message.split(',').map(Number)
            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim
            }

            const broken = Machine.onDestroy(fakeEvent)

            // Remove block after destruction
            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, 'minecraft:air')
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                }
            }, 1)

        } catch (err) {
            console.warn(`[destroyMachine] Error: ${err}`)
        }
    }
})

/**
 * ScriptEvent handler to destroy a generator at given coordinates.
 * Removes the generator entity, drops stored items, and replaces the block with air.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id === 'dorios:destroyGenerator') {
        try {
            const [x, y, z] = message.split(',').map(Number)
            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim
            }

            const broken = Generator.onDestroy(fakeEvent)

            // Remove block after destruction
            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, 'minecraft:air')
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                }
            }, 1)

        } catch (err) {
            console.warn(`[destroyGenerator] Error: ${err}`)
        }
    }
})

/**
 * ScriptEvent handler to destroy a fluid tank at given coordinates.
 * Builds the tank item with fluid lore, removes the entity, sets the block to air, and drops the item.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id === 'dorios:destroyTank') {
        try {
            const [x, y, z] = message.split(',').map(Number)
            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const entity = dim.getEntitiesAtBlockLocation(block.location)
                .find(e => e.typeId.includes("tank"));
            if (!entity) {
                dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                return
            };


            const fluid = new FluidManager(entity)
            const blockItemId = block.typeId
            const blockItem = new ItemStack(blockItemId)
            const lore = []

            // Fluid lore
            if (fluid.type !== 'empty' && fluid.get() > 0) {
                const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type)
                lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`)
            }
            if (lore.length > 0) blockItem.setLore(lore)

            const dropPos = block.center()

            // Remove entity, clear block, then drop the item
            system.run(() => {
                entity.remove()
                dim.setBlockType(block.location, 'minecraft:air')
                dim.spawnItem(blockItem, dropPos)
            })
        } catch (err) {
            console.warn(`[destroyTank] Error: ${err}`)
        }
    }
})

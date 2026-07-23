import * as DoriosLib from "DoriosLib/index.js";

/**
 * Registers the default item-to-fluid insertion mappings for UtilityCraft.
 *
 * Queues all predefined fluid container items through
 * `DoriosLib.registry.registerFluidItem()` during module evaluation.
 *
 * These mappings are delivered to the listener associated with
 * "utilitycraft:register_fluid_item", which then populates
 * `FluidStorage.itemFluidStorages`.
 *
 * Purpose:
 * - Initializes the addon’s built-in fluid containers.
 * - Ensures compatibility with external addons that may register later.
 * - Provides a single centralized source of truth for insertable fluid items.
 *
 * Behavior:
 * - DoriosLib snapshots the complete definition object.
 * - The shared queue dispatches it after world load.
 * - The receiver handles adding or replacing entries.
 *
 * External addons can call the same helper without creating a world-load
 * subscription or serializing the payload themselves.
 */
const defaultFluids = {
        'minecraft:lava_bucket': { amount: 1000, type: 'lava', output: 'minecraft:bucket' },
        'utilitycraft:lava_ball': { amount: 1000, type: 'lava' },
        'minecraft:water_bucket': { amount: 1000, type: 'water', output: 'minecraft:bucket' },
        'utilitycraft:water_ball': { amount: 1000, type: 'water' },
        'minecraft:experience_bottle': { amount: 8, type: 'xp', output: 'minecraft:glass_bottle' },
        'minecraft:milk_bucket': { amount: 1000, type: 'milk', output: 'minecraft:bucket' },

        // Cloud's Fluid Cells
        'fluidcells:water_cell': { amount: 4000, type: 'water', output: 'fluidcells:empty_cell' },
        'fluidcells:water_cell_2': { amount: 3000, type: 'water', output: 'fluidcells:empty_cell' },
        'fluidcells:water_cell_3': { amount: 2000, type: 'water', output: 'fluidcells:empty_cell' },
        'fluidcells:water_cell_4': { amount: 1000, type: 'water', output: 'fluidcells:empty_cell' },

        'fluidcells:lava_cell': { amount: 4000, type: 'lava', output: 'fluidcells:empty_cell' },
        'fluidcells:lava_cell_2': { amount: 3000, type: 'lava', output: 'fluidcells:empty_cell' },
        'fluidcells:lava_cell_3': { amount: 2000, type: 'lava', output: 'fluidcells:empty_cell' },
        'fluidcells:lava_cell_4': { amount: 1000, type: 'lava', output: 'fluidcells:empty_cell' }
};

DoriosLib.registry.registerFluidItem(defaultFluids);


/**
 * Registers the default fluid-extraction holders for UtilityCraft.
 *
 * Queues every item capable of extracting fluid from tanks through
 * `DoriosLib.registry.registerFluidHolder()`.
 *
 * The payload is consumed by the listener for
 * "utilitycraft:register_fluid_holder", which updates
 * `FluidStorage.itemFluidHolders`.
 *
 * Purpose:
 * - Defines all default items that can draw fluid from machines or tanks.
 * - Adds support for upgrade chains (e.g., water_cell → water_cell_2).
 * - Allows external addons to extend or override behavior cleanly.
 *
 * Behavior:
 * - Queues a structured object of extraction rules.
 * - The receiver creates or replaces holder definitions as needed.
 *
 * DoriosLib dispatches it after world load, one queue entry per tick.
 */

const holders = {

        // Vanilla buckets
        "minecraft:bucket": {
            types: {
                water: "minecraft:water_bucket",
                lava: "minecraft:lava_bucket",
                milk: "minecraft:milk_bucket"
            },
            required: 1000
        },

        // Empty Cell → first tier
        "fluidcells:empty_cell": {
            types: {
                water: "fluidcells:water_cell",
                lava: "fluidcells:lava_cell"
            },
            required: 1000
        },

        // Bottle
        "minecraft:glass_bottle": {
            types: {
                xp: "minecraft:experience_bottle"
            },
            required: 8
        },

        // Water cells chain
        "fluidcells:water_cell": { types: { water: "fluidcells:water_cell_2" }, required: 3000 },
        "fluidcells:water_cell_2": { types: { water: "fluidcells:water_cell_3" }, required: 2000 },
        "fluidcells:water_cell_3": { types: { water: "fluidcells:water_cell_4" }, required: 1000 },

        // Lava cells chain
        "fluidcells:lava_cell": { types: { lava: "fluidcells:lava_cell_2" }, required: 3000 },
        "fluidcells:lava_cell_2": { types: { lava: "fluidcells:lava_cell_3" }, required: 2000 },
        "fluidcells:lava_cell_3": { types: { lava: "fluidcells:lava_cell_4" }, required: 1000 }
};

DoriosLib.registry.registerFluidHolder(holders);

import { bountifulPlantsData, cropData } from "./bountifulCrops.generated.js"

/** Crop metadata derived from the canonical Bountiful Crops catalog. */
export const data = cropData

/**
 * Plant registry for UtilityCraft and Bountiful Crops.
 *
 * Each key is the input item type ID consumed by plant machinery.
 * `cost` and `drops` remain the shared plant-machinery contract.
 * Entries with `bonsai` are indexed by plantRegistry.js for O(1)
 * planting/entity lookups without changing that shared contract.
 *
 * @constant
 * @type {Record<string, {
 *   cost: number,
 *   drops: Array<{item: string, amount: number|number[], chance: number}>,
 *   bonsai?: {
 *     entityTypeId: string,
 *     allowedSoils: string[],
 *     durationTicks: number,
 *     speedMultiplier?: number,
 *     yieldMultiplier?: number,
 *     modifiers?: {
 *       soilSpeed?: boolean,
 *       soilYield?: boolean,
 *       tillingSpeed?: boolean
 *     }
 *   }
 * }>}
 */
export const plantsData = {
    'minecraft:acacia_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:acacia_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:acacia_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:acacia_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [6, 10], chance: 1 },
            { item: 'minecraft:acacia_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:azalea': {

        bonsai: {
            entityTypeId: 'utilitycraft:azalea_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:oak_log', amount: [4, 9], chance: 1 },
            { item: 'minecraft:azalea_leaves', amount: [2, 5], chance: 1 },
            { item: 'minecraft:stick', amount: [6, 8], chance: 1 },
            { item: 'minecraft:azalea', amount: [1, 2], chance: 0.1 },
            { item: 'minecraft:flowering_azalea', amount: 1, chance: 0.02 }
        ]
    },
    'minecraft:flowering_azalea': {

        bonsai: {
            entityTypeId: 'utilitycraft:azalea_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:oak_log', amount: [4, 9], chance: 1 },
            { item: 'minecraft:flowering_azalea_leaves', amount: [2, 5], chance: 1 },
            { item: 'minecraft:stick', amount: [6, 8], chance: 1 },
            { item: 'minecraft:flowering_azalea', amount: [1, 2], chance: 0.2 },
            { item: 'minecraft:spore_flower', amount: 1, chance: 0.05 }
        ]
    },

    'utilitycraft:apple_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:apple_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [6, 10], chance: 1 },
            { item: 'utilitycraft:apple_sapling', amount: 1, chance: 0.05 },
            { item: 'minecraft:apple', amount: [1, 4], chance: 1 },
            { item: 'minecraft:enchanted_golden_apple', amount: 1, chance: 0.0001 },
            { item: 'minecraft:golden_apple', amount: 1, chance: 0.1 }
        ]
    },
    'minecraft:bamboo': {

        bonsai: {
            entityTypeId: 'utilitycraft:bamboo',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:bamboo', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:beetroot_seeds': {

        bonsai: {
            entityTypeId: 'utilitycraft:beetroot',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:beetroot', amount: [2, 4], chance: 1 },
            { item: 'minecraft:beetroot_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:birch_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:birch_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:birch_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:birch_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:birch_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:cactus': {

        bonsai: {
            entityTypeId: 'utilitycraft:cactus',
            allowedSoils: ["minecraft:sand","minecraft:red_sand"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:cactus', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:carrot': {

        bonsai: {
            entityTypeId: 'utilitycraft:carrot',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:carrot', amount: [2, 4], chance: 1 },
            { item: 'minecraft:golden_carrot', amount: 1, chance: 0.1 }
        ]
    },
    'minecraft:cherry_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:cherry_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:cherry_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:cherry_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:cherry_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:chorus_fruit': {
        bonsai: {
            entityTypeId: 'utilitycraft:chorus_fruit',
            allowedSoils: ["minecraft:end_stone"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:chorus_fruit', amount: [1, 2], chance: 1 },
            { item: 'minecraft:chorus_flower', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:chorus_flower': {
        cost: 8000,
        drops: [
            { item: 'minecraft:chorus_fruit', amount: [1, 2], chance: 1 },
            { item: 'minecraft:chorus_flower', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:crimson_fungus': {

        bonsai: {
            entityTypeId: 'utilitycraft:crimson_tree',
            allowedSoils: ["minecraft:crimson_nylium"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:crimson_stem', amount: [6, 10], chance: 1 },
            { item: 'minecraft:nether_wart_block', amount: [0, 4], chance: 1 },
            { item: 'minecraft:shroomlight', amount: [1, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:crimson_fungus', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:dark_oak_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:darkoak_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:dark_oak_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:dark_oak_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:dark_oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:jungle_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:jungle_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:jungle_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:jungle_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:cocoa_beans', amount: [1, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:jungle_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:kelp': {

        bonsai: {
            entityTypeId: 'utilitycraft:kelp',
            allowedSoils: ["minecraft:sand","minecraft:red_sand","minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:kelp', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:mangrove_propagule': {

        bonsai: {
            entityTypeId: 'utilitycraft:mangrove_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:mangrove_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:mangrove_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:mangrove_propagule', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:melon_seeds': {

        bonsai: {
            entityTypeId: 'utilitycraft:melon',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:melon_slice', amount: [2, 4], chance: 1 },
            { item: 'minecraft:melon_block', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:red_mushroom': {

        bonsai: {
            entityTypeId: 'utilitycraft:mushroom',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:red_mushroom', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:brown_mushroom': {

        bonsai: {
            entityTypeId: 'utilitycraft:mushroom',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:brown_mushroom', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:nether_wart': {

        bonsai: {
            entityTypeId: 'utilitycraft:nether_wart',
            allowedSoils: ["minecraft:soul_sand"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:nether_wart', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:oak_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:oak_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:pale_oak_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:pale_oak_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:pale_oak_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:pale_oak_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:resin_clump', amount: [1, 2], chance: 0.03 },
            { item: 'minecraft:pale_oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:potato': {

        bonsai: {
            entityTypeId: 'utilitycraft:potato',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:potato', amount: [2, 4], chance: 1 },
            { item: 'minecraft:poisonous_potato', amount: 1, chance: 0.10 }
        ]
    },
    'minecraft:pumpkin_seeds': {

        bonsai: {
            entityTypeId: 'utilitycraft:pumpkin',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:pumpkin', amount: [2, 4], chance: 1 },
            { item: 'minecraft:pumpkin_pie', amount: 1, chance: 0.1 }
        ]
    },
    'minecraft:spruce_sapling': {

        bonsai: {
            entityTypeId: 'utilitycraft:spruce_tree',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:spruce_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:spruce_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:spruce_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:sugar_cane': {

        bonsai: {
            entityTypeId: 'utilitycraft:sugarcane',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:sugar_cane', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:sweet_berries': {

        bonsai: {
            entityTypeId: 'utilitycraft:sweet_berries',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:sweet_berries', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:warped_fungus': {

        bonsai: {
            entityTypeId: 'utilitycraft:warped_tree',
            allowedSoils: ["minecraft:warped_nylium"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:warped_stem', amount: [6, 10], chance: 1 },
            { item: 'minecraft:warped_wart_block', amount: [0, 4], chance: 1 },
            { item: 'minecraft:shroomlight', amount: [1, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:warped_fungus', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:wheat_seeds': {

        bonsai: {
            entityTypeId: 'utilitycraft:wheat',
            allowedSoils: ["minecraft:dirt","minecraft:grass_block"],
            durationTicks: 1200,
            yieldMultiplier: 1
        },
        cost: 8000,
        drops: [
            { item: 'minecraft:wheat', amount: [2, 4], chance: 1 },
            { item: 'minecraft:wheat_seeds', amount: 1, chance: 0.05 },
            { item: 'minecraft:bread', amount: 1, chance: 0.1 }
        ]
    },
    ...bountifulPlantsData,
    'minecraft:poppy': {
        cost: 64000,
        drops: [
            { item: 'minecraft:dandelion', amount: 1, chance: 0.05 },
            { item: 'minecraft:poppy', amount: 1, chance: 0.05 },
            { item: 'minecraft:blue_orchid', amount: 1, chance: 0.05 },
            { item: 'minecraft:allium', amount: 1, chance: 0.05 },
            { item: 'minecraft:azure_bluet', amount: 1, chance: 0.05 },
            { item: 'minecraft:red_tulip', amount: 1, chance: 0.05 },
            { item: 'minecraft:orange_tulip', amount: 1, chance: 0.05 },
            { item: 'minecraft:white_tulip', amount: 1, chance: 0.05 },
            { item: 'minecraft:pink_tulip', amount: 1, chance: 0.05 },
            { item: 'minecraft:oxeye_daisy', amount: 1, chance: 0.05 },
            { item: 'minecraft:cornflower', amount: 1, chance: 0.05 },
            { item: 'minecraft:lily_of_the_valley', amount: 1, chance: 0.05 },
            { item: 'minecraft:sunflower', amount: 1, chance: 0.05 },
            { item: 'minecraft:lilac', amount: 1, chance: 0.05 },
            { item: 'minecraft:rose_bush', amount: 1, chance: 0.05 },
            { item: 'minecraft:peony', amount: 1, chance: 0.05 },
            { item: 'minecraft:pitcher_plant', amount: 1, chance: 0.05 },
            { item: 'minecraft:torchflower', amount: 1, chance: 0.05 },
            { item: 'minecraft:cactus_flower', amount: 1, chance: 0.05 }
        ]
    },
    "minecraft:glow_berries": {
        cost: 8000,
        drops: [
            { item: 'minecraft:glow_berries', amount: [1, 16], chance: 1 }
        ]
    }
}

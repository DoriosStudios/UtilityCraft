import { system } from "@minecraft/server"

/**
* Crop data: defines seed item and loot table for each custom crop.
*/
export const data = {
    'utilitycraft:coal_crop': { seed: 'utilitycraft:coal_seeds', loot: 'bountiful_crops/coalLoot/coal_crop' },
    'utilitycraft:copper_crop': { seed: 'utilitycraft:copper_seeds', loot: 'bountiful_crops/copperLoot/copper_crop' },
    'utilitycraft:dyes_crop': { seed: 'utilitycraft:dyes_seeds', loot: 'bountiful_crops/dyesLoot/dyes_crop' },
    'utilitycraft:glass_crop': { seed: 'utilitycraft:glass_seeds', loot: 'bountiful_crops/glassLoot/glass_crop' },
    'utilitycraft:gunpowder_crop': { seed: 'utilitycraft:gunpowder_seeds', loot: 'bountiful_crops/gunpowderLoot/gunpowder_crop' },
    'utilitycraft:iron_crop': { seed: 'utilitycraft:iron_seeds', loot: 'bountiful_crops/ironLoot/iron_crop' },
    'utilitycraft:leather_crop': { seed: 'utilitycraft:leather_seeds', loot: 'bountiful_crops/leatherLoot/leather_crop' },
    'utilitycraft:prismarine_crystal_crop': { seed: 'utilitycraft:prismarine_crystals_seeds', loot: 'bountiful_crops/prismarineCRLoot/prismarine_crystals_crop' },
    'utilitycraft:prismarine_shards_crop': { seed: 'utilitycraft:prismarine_shards_seeds', loot: 'bountiful_crops/prismarineSHLoot/prismarine_shards_crop' },
    'utilitycraft:water_crop': { seed: 'utilitycraft:water_seeds', loot: 'bountiful_crops/waterLoot/water_crop' },
    'utilitycraft:wool_crop': { seed: 'utilitycraft:wool_seeds', loot: 'bountiful_crops/woolLoot/wool_crop' },
    'utilitycraft:ghast_crop': { seed: 'utilitycraft:ghast_seeds', loot: 'bountiful_crops/ghastLoot/ghast_tear_crop' },
    'utilitycraft:glowstone_crop': { seed: 'utilitycraft:glowstone_seeds', loot: 'bountiful_crops/glowstoneLoot/glowstone_crop' },
    'utilitycraft:gold_crop': { seed: 'utilitycraft:gold_seeds', loot: 'bountiful_crops/goldLoot/gold_crop' },
    'utilitycraft:honey_crop': { seed: 'utilitycraft:honey_seeds', loot: 'bountiful_crops/honeyLoot/honey_crop' },
    'utilitycraft:lapis_crop': { seed: 'utilitycraft:lapis_seeds', loot: 'bountiful_crops/lapisLoot/lapis_crop' },
    'utilitycraft:lava_crop': { seed: 'utilitycraft:lava_seeds', loot: 'bountiful_crops/lavaLoot/lava_crop' },
    'utilitycraft:quartz_crop': { seed: 'utilitycraft:quartz_seeds', loot: 'bountiful_crops/quartzLoot/quartz_crop' },
    'utilitycraft:redstone_crop': { seed: 'utilitycraft:redstone_seeds', loot: 'bountiful_crops/redstoneLoot/redstone_crop' },
    'utilitycraft:slime_crop': { seed: 'utilitycraft:slime_seeds', loot: 'bountiful_crops/slimeLoot/slime_crop' },
    'utilitycraft:amethyst_crop': { seed: 'utilitycraft:amethyst_seeds', loot: 'bountiful_crops/amethystLoot/amethyst_crop' },
    'utilitycraft:blaze_crop': { seed: 'utilitycraft:blaze_seeds', loot: 'bountiful_crops/blazeLoot/blaze_crop' },
    'utilitycraft:diamond_crop': { seed: 'utilitycraft:diamond_seeds', loot: 'bountiful_crops/diamondLoot/diamond_crop' },
    'utilitycraft:emerald_crop': { seed: 'utilitycraft:emerald_seeds', loot: 'bountiful_crops/emeraldLoot/emerald_crop' },
    'utilitycraft:enderpearl_crop': { seed: 'utilitycraft:enderpearl_seeds', loot: 'bountiful_crops/enderpearlLoot/enderpearl_crop' },
    'utilitycraft:obsidian_crop': { seed: 'utilitycraft:obsidian_seeds', loot: 'bountiful_crops/obsidianLoot/obsidian_crop' },
    'utilitycraft:netherite_crop': { seed: 'utilitycraft:netherite_seeds', loot: 'bountiful_crops/netheriteLoot/netherite_crop' },
    'utilitycraft:netherstar_crop': { seed: 'utilitycraft:nether_star_seeds', loot: 'bountiful_crops/netherstarLoot/netherstar_crop' },
    'utilitycraft:shulker_crop': { seed: 'utilitycraft:shulker_seeds', loot: 'bountiful_crops/shulkerLoot/shulker_crop' },
    'utilitycraft:totem_crop': { seed: 'utilitycraft:totem_seeds', loot: 'bountiful_crops/totemLoot/totem_crop' },
    'utilitycraft:wither_crop': { seed: 'utilitycraft:wither_seeds', loot: 'bountiful_crops/witherLoot/wither_crop' }
}

/**
 * Bonsai definitions registry.
 * Each entry defines sapling behavior and crop drop data.
 *
 * @constant
 * @type {{
 *   bonsaiItems: Array<{ sapling: string, allowed: string[], entity: string }>,
 *   plantsData: Record<string, { cost: number, drops: Array<{ item: string, amount: number|number[], chance: number }> }>
 * }}
 */
export const bonsaiItems = [
    { sapling: 'minecraft:acacia_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:acacia_tree' },
    { sapling: 'utilitycraft:apple_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:apple_tree' },
    { sapling: 'minecraft:bamboo', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:bamboo' },
    { sapling: 'minecraft:beetroot_seeds', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:beetroot' },
    { sapling: 'minecraft:birch_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:birch_tree' },
    { sapling: 'minecraft:cactus', allowed: ['sand', 'red_sand'], entity: 'utilitycraft:cactus' },
    { sapling: 'minecraft:carrot', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:carrot' },
    { sapling: 'minecraft:cherry_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:cherry_tree' },
    { sapling: 'minecraft:chorus_fruit', allowed: ['end_stone'], entity: 'utilitycraft:chorus_fruit' },
    { sapling: 'minecraft:crimson_fungus', allowed: ['crimson_nylium'], entity: 'utilitycraft:crimson_tree' },
    { sapling: 'minecraft:dark_oak_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:darkoak_tree' },
    { sapling: 'minecraft:jungle_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:jungle_tree' },
    { sapling: 'minecraft:kelp', allowed: ['sand', 'red_sand', 'dirt', 'grass_block'], entity: 'utilitycraft:kelp' },
    { sapling: 'minecraft:mangrove_propagule', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:mangrove_tree' },
    { sapling: 'minecraft:melon_seeds', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:melon' },
    { sapling: 'minecraft:red_mushroom', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:mushroom' },
    { sapling: 'minecraft:brown_mushroom', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:mushroom' },
    { sapling: 'minecraft:nether_wart', allowed: ['soul_sand'], entity: 'utilitycraft:nether_wart' },
    { sapling: 'minecraft:oak_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:oak_tree' },
    { sapling: 'minecraft:pale_oak_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:pale_oak_tree' },
    { sapling: 'minecraft:potato', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:potato' },
    { sapling: 'minecraft:pumpkin_seeds', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:pumpkin' },
    { sapling: 'minecraft:spruce_sapling', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:spruce_tree' },
    { sapling: 'minecraft:sugar_cane', allowed: ['dirt', 'grass_block', 'sand', 'red_sand'], entity: 'utilitycraft:sugarcane' },
    { sapling: 'minecraft:sweet_berries', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:sweet_berries' },
    { sapling: 'minecraft:warped_fungus', allowed: ['warped_nylium'], entity: 'utilitycraft:warped_tree' },
    { sapling: 'minecraft:wheat_seeds', allowed: ['dirt', 'grass_block'], entity: 'utilitycraft:wheat' }
]


/**
 * Plant registry for UtilityCraft and Bountiful Crops.
 *
 * Each key represents a plant identifier, and its value specifies
 * the seed item, loot table, and other properties.
 *
 * @constant
 * @type {Record<string, { seed: string, loot: string }>}
 */
export const plantsData = {
    'minecraft:acacia_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:acacia_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:acacia_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [6, 10], chance: 1 },
            { item: 'minecraft:acacia_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:apple_sapling': {
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
        cost: 8000,
        drops: [
            { item: 'minecraft:bamboo', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:beetroot_seeds': {
        cost: 8000,
        drops: [
            { item: 'minecraft:beetroot', amount: [2, 4], chance: 1 },
            { item: 'minecraft:beetroot_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:birch_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:birch_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:birch_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:birch_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:cactus': {
        cost: 8000,
        drops: [
            { item: 'minecraft:cactus', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:carrot': {
        cost: 8000,
        drops: [
            { item: 'minecraft:carrot', amount: [2, 4], chance: 1 },
            { item: 'minecraft:golden_carrot', amount: 1, chance: 0.1 }
        ]
    },
    'minecraft:cherry_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:cherry_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:cherry_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:cherry_sapling', amount: 1, chance: 0.05 }
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
        cost: 8000,
        drops: [
            { item: 'minecraft:dark_oak_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:dark_oak_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:dark_oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:jungle_sapling': {
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
        cost: 8000,
        drops: [
            { item: 'minecraft:kelp', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:mangrove_propagule': {
        cost: 8000,
        drops: [
            { item: 'minecraft:mangrove_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:mangrove_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:mangrove_propagule', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:melon_seeds': {
        cost: 8000,
        drops: [
            { item: 'minecraft:melon_slice', amount: [2, 4], chance: 1 },
            { item: 'minecraft:melon_block', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:red_mushroom': {
        cost: 8000,
        drops: [
            { item: 'minecraft:red_mushroom', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:brown_mushroom': {
        cost: 8000,
        drops: [
            { item: 'minecraft:brown_mushroom', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:nether_wart': {
        cost: 8000,
        drops: [
            { item: 'minecraft:nether_wart', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:oak_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:pale_oak_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:pale_oak_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:pale_oak_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:pale_oak_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:potato': {
        cost: 8000,
        drops: [
            { item: 'minecraft:potato', amount: [2, 4], chance: 1 },
            { item: 'minecraft:poisonous_potato', amount: 1, chance: 0.10 }
        ]
    },
    'minecraft:pumpkin_seeds': {
        cost: 8000,
        drops: [
            { item: 'minecraft:pumpkin', amount: [2, 4], chance: 1 },
            { item: 'minecraft:pumpkin_pie', amount: 1, chance: 0.1 }
        ]
    },
    'minecraft:spruce_sapling': {
        cost: 8000,
        drops: [
            { item: 'minecraft:spruce_log', amount: [6, 10], chance: 1 },
            { item: 'minecraft:spruce_leaves', amount: [0, 4], chance: 1 },
            { item: 'minecraft:stick', amount: [0, 6], chance: 1 },
            { item: 'minecraft:spruce_sapling', amount: 1, chance: 0.05 }
        ]
    },
    'minecraft:sugar_cane': {
        cost: 8000,
        drops: [
            { item: 'minecraft:sugar_cane', amount: [4, 8], chance: 1 }
        ]
    },
    'minecraft:sweet_berries': {
        cost: 8000,
        drops: [
            { item: 'minecraft:sweet_berries', amount: [2, 4], chance: 1 }
        ]
    },
    'minecraft:warped_fungus': {
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
        cost: 8000,
        drops: [
            { item: 'minecraft:wheat', amount: [2, 4], chance: 1 },
            { item: 'minecraft:wheat_seeds', amount: 1, chance: 0.05 },
            { item: 'minecraft:bread', amount: 1, chance: 0.1 }
        ]
    },
    'utilitycraft:coal_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:coal', amount: [2, 4], chance: 1 },
            { item: 'utilitycraft:coal_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:copper_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:raw_copper', amount: [2, 4], chance: 1 },
            { item: 'utilitycraft:copper_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:dyes_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:black_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:blue_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:brown_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:cyan_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:gray_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:green_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:light_blue_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:light_gray_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:lime_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:magenta_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:orange_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:pink_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:purple_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:red_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:white_dye', amount: 1, chance: 0.05 },
            { item: 'minecraft:yellow_dye', amount: 1, chance: 0.05 },
            { item: 'utilitycraft:dyes_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:glass_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:glass', amount: [8, 16], chance: 1 },
            { item: 'utilitycraft:glass_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:gunpowder_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:gunpowder', amount: [4, 8], chance: 1 },
            { item: 'utilitycraft:gunpowder_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:iron_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:raw_iron', amount: [1, 3], chance: 1 },
            { item: 'utilitycraft:iron_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:leather_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:leather', amount: [4, 8], chance: 1 },
            { item: 'utilitycraft:leather_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:prismarine_crystals_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:prismarine_crystals', amount: [8, 12], chance: 1 },
            { item: 'utilitycraft:prismarine_crystals_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:prismarine_shards_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:prismarine_shard', amount: [8, 12], chance: 1 },
            { item: 'utilitycraft:prismarine_shards_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:water_seeds': {
        cost: 64000,
        drops: [
            { item: 'utilitycraft:water_ball', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:water_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:wool_seeds': {
        cost: 64000,
        drops: [
            { item: 'minecraft:wool', amount: [2, 4], chance: 1 },
            { item: 'utilitycraft:wool_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:ghast_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:ghast_tear', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:ghast_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:glowstone_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:glowstone_dust', amount: [2, 4], chance: 1 },
            { item: 'utilitycraft:glowstone_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:gold_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:raw_gold', amount: [1, 3], chance: 1 },
            { item: 'utilitycraft:gold_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:honey_seeds': {
        cost: 128000,
        drops: [
            { item: 'utilitycraft:honey_ball', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:honey_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:lapis_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:lapis_lazuli', amount: [4, 9], chance: 1 },
            { item: 'utilitycraft:lapis_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:lava_seeds': {
        cost: 128000,
        drops: [
            { item: 'utilitycraft:lava_ball', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:lava_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:quartz_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:quartz', amount: [4, 8], chance: 1 },
            { item: 'utilitycraft:quartz_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:redstone_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:redstone', amount: [3, 8], chance: 1 },
            { item: 'utilitycraft:redstone_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:slime_seeds': {
        cost: 128000,
        drops: [
            { item: 'minecraft:slime_ball', amount: [1, 3], chance: 1 },
            { item: 'utilitycraft:slime_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:amethyst_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:amethyst_shard', amount: [2, 4], chance: 1 },
            { item: 'utilitycraft:amethyst_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:blaze_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:blaze_rod', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:blaze_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:diamond_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:diamond', amount: 1, chance: 1 },
            { item: 'utilitycraft:diamond_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:emerald_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:emerald', amount: 1, chance: 1 },
            { item: 'utilitycraft:emerald_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:enderpearl_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:ender_pearl', amount: 1, chance: 1 },
            { item: 'utilitycraft:enderpearl_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:obsidian_seeds': {
        cost: 512000,
        drops: [
            { item: 'minecraft:obsidian', amount: [1, 2], chance: 1 },
            { item: 'utilitycraft:obsidian_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:netherite_seeds': {
        cost: 1024000,
        drops: [
            { item: 'minecraft:netherite_scrap', amount: 1, chance: 1 },
            { item: 'utilitycraft:netherite_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:nether_star_seeds': {
        cost: 1024000,
        drops: [
            { item: 'minecraft:nether_star', amount: 1, chance: 1 },
            { item: 'utilitycraft:nether_star_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:shulker_seeds': {
        cost: 1024000,
        drops: [
            { item: 'minecraft:shulker_shell', amount: 1, chance: 1 },
            { item: 'utilitycraft:shulker_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:totem_seeds': {
        cost: 1024000,
        drops: [
            { item: 'minecraft:totem_of_undying', amount: 1, chance: 1 },
            { item: 'utilitycraft:totem_seeds', amount: 1, chance: 0.05 }
        ]
    },
    'utilitycraft:wither_seeds': {
        cost: 1024000,
        drops: [
            { item: 'minecraft:wither_skeleton_skull', amount: 1, chance: 1 },
            { item: 'utilitycraft:wither_seeds', amount: 1, chance: 0.05 }
        ]
    },
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

/**
 * ScriptEvent receiver: "utilitycraft:register_plant"
 *
 * Allows other addons or scripts to dynamically add or replace plant definitions.
 * If the item already exists in `plantsData`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "utilitycraft:coal_crop": {
 *     "cost": 64000,
 *     "drops": [
 *       { "item": "minecraft:coal", "amount": [2, 4], "chance": 1 },
 *       { "item": "utilitycraft:coal_seeds", "amount": 1, "chance": 0.05 }
 *     ]
 *   },
 *   "utilitycraft:gold_crop": {
 *     "cost": 64000,
 *     "drops": [
 *       { "item": "minecraft:raw_gold", "amount": [1, 3], "chance": 1 },
 *       { "item": "utilitycraft:gold_seeds", "amount": 1, "chance": 0.05 }
 *     ]
 *   }
 * }
 * ```
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_plant") return

    try {
        const payload = JSON.parse(message)
        if (!payload || typeof payload !== "object") return

        let added = 0
        let replaced = 0

        for (const [plantId, data] of Object.entries(payload)) {
            if (!data.drops || !Array.isArray(data.drops)) continue

            if (plantsData[plantId]) {
                // console.warn(`[UtilityCraft] Replaced existing plant drop definition for '${plantId}'.`)
                replaced++
            } else {
                added++
            }

            plantsData[plantId] = data
        }

        // console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} plant drop definitions.`)
    } catch (err) {
        // console.warn("[UtilityCraft] Failed to parse plant registration payload:", err)
    }
})

// ==================================================
// EXAMPLES – How to register custom plant drops
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newPlants = {
        "utilitycraft:coal_crop": {
            cost: 64000,
            drops: [
                { item: "minecraft:coal", amount: [2, 4], chance: 1 },
                { item: "utilitycraft:coal_seeds", amount: 1, chance: 0.05 }
            ]
        },
        "utilitycraft:gold_crop": {
            cost: 64000,
            drops: [
                { item: "minecraft:raw_gold", amount: [1, 3], chance: 1 },
                { item: "utilitycraft:gold_seeds", amount: 1, chance: 0.05 }
            ]
        }
    }

    system.sendScriptEvent("utilitycraft:register_plant", JSON.stringify(newPlants))

    console.warn("[Addon] Custom plant drops registered via system event.")
})

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_plant {"utilitycraft:coal_crop":{"cost":64000,"drops":[{"item":"minecraft:coal","amount":[2,4],"chance":1},{"item":"utilitycraft:coal_seeds","amount":1,"chance":0.05}]},"utilitycraft:gold_crop":{"cost":64000,"drops":[{"item":"minecraft:raw_gold","amount":[1,3],"chance":1},{"item":"utilitycraft:gold_seeds","amount":1,"chance":0.05}]}}
*/

/**
 * ScriptEvent receiver: "utilitycraft:register_bonsai"
 *
 * Allows other addons or scripts to dynamically add or replace bonsai definitions.
 * If an existing sapling is found, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "utilitycraft:example_bonsai": {
 *     "sapling": "minecraft:cactus",
 *     "allowed": ["sand", "red_sand"],
 *     "entity": "utilitycraft:cactus",
 *     "cost": 8000,
 *     "drops": [
 *       { "item": "minecraft:cactus", "amount": [2,4], "chance": 1 }
 *     ]
 *   }
 * }
 * ```
 *
 * Behavior:
 * - Bonsai data (sapling, allowed, entity) are stored in `bonsaiItems`.
 * - Cost and drops are stored in `plantsData` under the same identifier.
 * - Missing "allowed" defaults to ["dirt", "grass_block"].
 * - Existing entries are replaced and logged.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_bonsai") return

    try {
        const payload = JSON.parse(message)
        if (!payload || typeof payload !== "object") return

        let added = 0
        let replaced = 0

        for (const [bonsaiId, data] of Object.entries(payload)) {
            const { sapling, allowed = ["dirt", "grass_block"], disableTimeBonus = false, disableYieldBonus = false, entity, cost, drops } = data
            if (!sapling || !entity || !drops || !Array.isArray(drops)) continue

            // Update bonsaiItems
            const existing = bonsaiItems.find(b => b.sapling === sapling)
            const newBonsai = { sapling, allowed, entity, disableTimeBonus, disableYieldBonus }

            if (existing) {
                Object.assign(existing, newBonsai)
                replaced++
            } else {
                bonsaiItems.push(newBonsai)
                added++
            }

            // Update plantsData
            plantsData[sapling] = { cost, drops }

            // console.warn(`${newBonsai.sapling}`)
            // console.warn(`${JSON.stringify(plantsData[bonsaiId])}`)
            // console.warn(`${JSON.stringify(newBonsai)}`)
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse bonsai registration payload:", err)
    }
})

// ==================================================
// EXAMPLES – How to register custom bonsais
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newBonsais = {
        "utilitycraft:cactus_bonsai": {
            sapling: "minecraft:cactus",
            allowed: ["sand", "red_sand"],
            entity: "utilitycraft:cactus",
            cost: 8000,
            drops: [
                { item: "minecraft:cactus", amount: [2, 4], chance: 1 }
            ]
        },
        "utilitycraft:oak_bonsai": {
            sapling: "minecraft:oak_sapling",
            entity: "utilitycraft:oak_tree",
            cost: 8000,
            drops: [
                { item: "minecraft:log", amount: [4, 8], chance: 1 },
                { item: "minecraft:stick", amount: [2, 4], chance: 1 }
            ]
        }
    }

    system.sendScriptEvent("utilitycraft:register_bonsai", JSON.stringify(newBonsais))

    console.warn("[Addon] Custom bonsai definitions registered via system event.")
})

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_bonsai {"utilitycraft:cactus_bonsai":{"sapling":"minecraft:cactus","allowed":["sand","red_sand"],"entity":"utilitycraft:cactus","cost":8000,"drops":[{"item":"minecraft:cactus","amount":[2,4],"chance":1}]},"utilitycraft:oak_bonsai":{"sapling":"minecraft:oak_sapling","entity":"utilitycraft:oak_tree","cost":8000,"drops":[{"item":"minecraft:log","amount":[4,8],"chance":1},{"item":"minecraft:stick","amount":[2,4],"chance":1}]}}
*/
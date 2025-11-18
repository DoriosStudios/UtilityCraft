import { system } from "@minecraft/server";

DoriosAPI.register.itemComponent('mesh', {})

/**
 * Represents a possible sieve loot drop.
 * 
 * @typedef {Object} SieveLoot
 * @property {string} item   Item identifier (namespace:item_name).
 * @property {number} amount Number of items granted on success.
 * @property {number} chance Drop probability (0–1).
 * @property {number} tier   Minimum sieve tier required.
 */

/**
 * Blocks accepted by the **Basic Sieve**.
 * Any blocks not listed here will be ignored when using
 * the Basic Sieve (tier 0), even if they have recipes.
 *
 * @type {string[]}
 */
export const acceptedBlocks = [
    "minecraft:gravel",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:sand",
    "minecraft:soul_sand",
    "utilitycraft:crushed_netherrack",
    "utilitycraft:crushed_endstone",
    "utilitycraft:crushed_cobbled_deepslate",
    "utilitycraft:compressed_gravel",
    "utilitycraft:compressed_dirt",
    "utilitycraft:compressed_sand",
    "utilitycraft:compressed_crushed_netherrack",
    "utilitycraft:compressed_crushed_cobbled_deepslate",
    "utilitycraft:compressed_crushed_endstone"
];

/**
 * Recipes for the Sieve machine.
 * Each key is the input block/item, and the value is an array of possible loot.
 *
 * @type {Object.<string, SieveLoot[]>}
 */
export const sieveRecipes = {
    'minecraft:gravel': [
        { item: 'minecraft:flint', amount: 1, chance: 0.20, tier: 0 },
        { item: 'utilitycraft:iron_chunk', amount: 1, chance: 0.15, tier: 1 },
        { item: 'utilitycraft:coal_chunk', amount: 1, chance: 0.25, tier: 0 },
        { item: 'utilitycraft:gold_chunk', amount: 1, chance: 0.05, tier: 3 },
        { item: 'utilitycraft:lapislazuli_chunk', amount: 1, chance: 0.025, tier: 3 },
        { item: 'utilitycraft:emerald_chunk', amount: 1, chance: 0.02, tier: 4 },
        { item: 'utilitycraft:diamond_chunk', amount: 1, chance: 0.01, tier: 4 }
    ],
    'minecraft:dirt': [
        { item: 'minecraft:carrot', amount: 1, chance: 0.10 },
        { item: 'minecraft:potato', amount: 1, chance: 0.10 },
        { item: 'minecraft:wheat_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:pumpkin_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:beetroot_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:melon_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:sugar_cane', amount: 1, chance: 0.10 },
        { item: 'minecraft:bamboo', amount: 1, chance: 0.10 },
        { item: 'minecraft:acacia_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:birch_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:dark_oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:jungle_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:mangrove_propagule', amount: 1, chance: 0.10 },
        { item: 'minecraft:oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:pale_oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:spruce_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:cherry_sapling', amount: 1, chance: 0.10 }
    ],
    'minecraft:grass_block': [
        { item: 'minecraft:red_flower', amount: 1, chance: 0.20 },
        { item: 'minecraft:yellow_flower', amount: 1, chance: 0.20 },
        { item: 'minecraft:double_plant', amount: 1, chance: 0.20 },
        { item: 'minecraft:torchflower', amount: 1, chance: 0.20 },
        { item: 'minecraft:pitcher_plant', amount: 1, chance: 0.20 },
        { item: 'minecraft:pink_petals', amount: 1, chance: 0.20 }
    ],
    'utilitycraft:crushed_netherrack': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 1, chance: 0.33, tier: 1 },
        { item: 'minecraft:gold_nugget', amount: 1, chance: 0.20, tier: 3 },
        { item: 'utilitycraft:nether_gold_chunk', amount: 1, chance: 0.33, tier: 3 },
        { item: 'utilitycraft:ancient_debris_chunk', amount: 1, chance: 0.025, tier: 5 }
    ],
    'minecraft:sand': [
        { item: 'minecraft:prismarine_shard', amount: 1, chance: 0.10, tier: 2 },
        { item: 'minecraft:prismarine_crystals', amount: 1, chance: 0.10, tier: 2 },
        { item: 'utilitycraft:copper_chunk', amount: 1, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:redstone_chunk', amount: 1, chance: 0.20, tier: 2 },
        { item: 'minecraft:bone_meal', amount: 1, chance: 0.25 },
        { item: 'minecraft:gunpowder', amount: 1, chance: 0.12 },
        { item: 'minecraft:glowstone_dust', amount: 1, chance: 0.08 },
        { item: 'minecraft:blaze_powder', amount: 1, chance: 0.10, tier: 3 },
        { item: 'minecraft:cactus', amount: 1, chance: 0.10 },
        { item: 'minecraft:kelp', amount: 1, chance: 0.10 },
        { item: 'minecraft:clay_ball', amount: 1, chance: 0.10, tier: 2 },
        { item: 'minecraft:cocoa_beans', amount: 1, chance: 0.01 },
        // Integrated Storage
        { item: 'ae2be:certus_quartz_crystal', amount: 1, chance: 0.17, tier: 3 },
        { item: 'ae2be:charged_certus_quartz_crystal', amount: 1, chance: 0.01, tier: 3 }
    ],
    'minecraft:soul_sand': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 1, chance: 0.33, tier: 1 },
        { item: 'utilitycraft:nether_quartz_chunk', amount: 3, chance: 0.10, tier: 1 },
        { item: 'minecraft:bone', amount: 1, chance: 0.15 },
        { item: 'minecraft:ghast_tear', amount: 1, chance: 0.08, tier: 4 },
        { item: 'minecraft:nether_wart', amount: 1, chance: 0.12 },
        { item: 'minecraft:warped_fungus', amount: 1, chance: 0.10 },
        { item: 'minecraft:crimson_fungus', amount: 1, chance: 0.10 }
    ],
    'utilitycraft:crushed_endstone': [
        { item: 'minecraft:chorus_flower', amount: 1, chance: 0.01, tier: 4 },
        { item: 'minecraft:chorus_fruit', amount: 1, chance: 0.80, tier: 4 },
        { item: 'minecraft:ender_pearl', amount: 1, chance: 0.16, tier: 4 }
    ],
    'utilitycraft:crushed_cobbled_deepslate': [
        { item: 'minecraft:echo_shard', amount: 1, chance: 0.05, tier: 5 },
        { item: 'minecraft:sculk_catalyst', amount: 1, chance: 0.005, tier: 5 },
        { item: 'minecraft:amethyst_shard', amount: 1, chance: 0.01, tier: 5 },
        { item: 'utilitycraft:deepslate_diamond_chunk', amount: 1, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_emerald_chunk', amount: 1, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_gold_chunk', amount: 1, chance: 0.20, tier: 4 },
        { item: 'utilitycraft:deepslate_iron_chunk', amount: 1, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:deepslate_lapislazuli_chunk', amount: 1, chance: 0.15, tier: 3 },
        { item: 'utilitycraft:deepslate_coal_chunk', amount: 1, chance: 0.30, tier: 0 }
    ],
    //Compressed
    'utilitycraft:compressed_gravel': [
        { item: 'minecraft:flint', amount: 9, chance: 0.20, tier: 0 },
        { item: 'utilitycraft:iron_chunk', amount: 9, chance: 0.15, tier: 1 },
        { item: 'utilitycraft:coal_chunk', amount: 9, chance: 0.25, tier: 0 },
        { item: 'utilitycraft:gold_chunk', amount: 9, chance: 0.05, tier: 3 },
        { item: 'utilitycraft:lapislazuli_chunk', amount: 9, chance: 0.025, tier: 3 },
        { item: 'utilitycraft:emerald_chunk', amount: 9, chance: 0.02, tier: 4 },
        { item: 'utilitycraft:diamond_chunk', amount: 9, chance: 0.01, tier: 4 }
    ],
    'utilitycraft:compressed_dirt': [
        { item: 'minecraft:carrot', amount: 9, chance: 0.10 },
        { item: 'minecraft:potato', amount: 9, chance: 0.10 },
        { item: 'minecraft:wheat_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:pumpkin_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:beetroot_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:melon_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:sugar_cane', amount: 9, chance: 0.10 },
        { item: 'minecraft:bamboo', amount: 9, chance: 0.10 },
        { item: 'minecraft:acacia_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:birch_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:dark_oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:jungle_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:mangrove_propagule', amount: 9, chance: 0.10 },
        { item: 'minecraft:oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:pale_oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:spruce_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:cherry_sapling', amount: 9, chance: 0.10 }
    ],
    'utilitycraft:compressed_sand': [
        { item: 'minecraft:prismarine_shard', amount: 9, chance: 0.10, tier: 2 },
        { item: 'minecraft:prismarine_crystals', amount: 9, chance: 0.10, tier: 2 },
        { item: 'utilitycraft:copper_chunk', amount: 9, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:redstone_chunk', amount: 9, chance: 0.20, tier: 2 },
        { item: 'minecraft:bone_meal', amount: 9, chance: 0.25 },
        { item: 'minecraft:gunpowder', amount: 9, chance: 0.12 },
        { item: 'minecraft:glowstone_dust', amount: 9, chance: 0.08 },
        { item: 'minecraft:blaze_powder', amount: 9, chance: 0.10, tier: 3 },
        { item: 'minecraft:cactus', amount: 9, chance: 0.10 },
        { item: 'minecraft:kelp', amount: 9, chance: 0.10 },
        { item: 'minecraft:clay_ball', amount: 9, chance: 0.10, tier: 2 },
        { item: 'minecraft:cocoa_beans', amount: 9, chance: 0.01 },
        // Integrated Storage
        { item: 'ae2be:certus_quartz_crystal', amount: 9, chance: 0.17, tier: 3 },
        { item: 'ae2be:charged_certus_quartz_crystal', amount: 9, chance: 0.01, tier: 3 }
    ],
    'utilitycraft:compressed_crushed_netherrack': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 9, chance: 0.33, tier: 1 },
        { item: 'minecraft:gold_nugget', amount: 9, chance: 0.20, tier: 3 },
        { item: 'utilitycraft:nether_gold_chunk', amount: 9, chance: 0.33, tier: 3 },
        { item: 'utilitycraft:ancient_debris_chunk', amount: 9, chance: 0.025, tier: 5 }
    ],
    'utilitycraft:compressed_crushed_cobbled_deepslate': [
        { item: 'minecraft:echo_shard', amount: 9, chance: 0.05, tier: 5 },
        { item: 'minecraft:sculk_catalyst', amount: 9, chance: 0.005, tier: 5 },
        { item: 'minecraft:amethyst_shard', amount: 9, chance: 0.01, tier: 5 },
        { item: 'utilitycraft:deepslate_diamond_chunk', amount: 9, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_emerald_chunk', amount: 9, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_gold_chunk', amount: 9, chance: 0.20, tier: 4 },
        { item: 'utilitycraft:deepslate_iron_chunk', amount: 9, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:deepslate_lapislazuli_chunk', amount: 9, chance: 0.15, tier: 3 },
        { item: 'utilitycraft:deepslate_coal_chunk', amount: 9, chance: 0.30, tier: 0 }
    ],
    'utilitycraft:compressed_crushed_endstone': [
        { item: 'minecraft:chorus_flower', amount: 9, chance: 0.01, tier: 4 },
        { item: 'minecraft:chorus_fruit', amount: 9, chance: 0.80, tier: 4 },
        { item: 'minecraft:ender_pearl', amount: 9, chance: 0.16, tier: 4 }
    ]
}


/**
 * ScriptEvent receiver: "utilitycraft:register_sieve_drop"
 * 
 * Allows other addons or scripts to **add new drops to existing blocks only**.
 * 
 * Expected payload format (JSON):
 * 
 * {
 *   "minecraft:gravel": [
 *     { "item": "minecraft:string", "amount": 1, "chance": 0.05 }
 *   ],
 *   "minecraft:dirt": [
 *     { "item": "minecraft:apple", "amount": 1, "chance": 0.10 }
 *   ]
 * }
 * 
 * - If a block ID is not already defined in `sieveRecipes`, the entry is skipped.
 * - If an invalid format is detected, a warning is printed and ignored.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_sieve_drop") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") {
            console.warn("[UtilityCraft] Invalid payload format received.");
            return;
        }

        let addedBlocks = 0;
        let addedDrops = 0;

        for (const [blockId, drops] of Object.entries(payload)) {
            if (!Array.isArray(drops)) continue;

            // Si el bloque no existía, se crea una nueva entrada
            if (!sieveRecipes[blockId]) {
                sieveRecipes[blockId] = [];
                addedBlocks++;
            }

            for (const drop of drops) {
                if (!drop.item || typeof drop.item !== "string") continue;

                sieveRecipes[blockId].push({
                    item: drop.item,
                    amount: drop.amount ?? 1,
                    chance: drop.chance ?? 0.1,
                    tier: drop.tier ?? 0
                });

                addedDrops++;
            }
        }
    } catch {
    }
});

// ==================================================
// EXAMPLES – How to register custom sieve drops
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add new custom drops for blocks
    // You can add drops to existing blocks (like gravel)
    // or define completely new ones that didn’t exist before.
    const newDrops = {
        "utilitycraft:crushed_basalt": [
            { item: "minecraft:blackstone", amount: 1, chance: 0.3, tier: 1 },
            { item: "minecraft:basalt", amount: 1, chance: 0.15, tier: 1 },
            { item: "minecraft:coal", amount: 1, chance: 0.1, tier: 2 }
        ],
        "minecraft:gravel": [
            { item: "minecraft:string", amount: 1, chance: 0.05 },
            { item: "minecraft:bone_meal", amount: 1, chance: 0.15 }
        ]
    };

    // Send the event to the sieve script
    // This tells UtilityCraft to register your new drops dynamically.
    system.sendScriptEvent("utilitycraft:register_sieve_drop", JSON.stringify(newDrops));

    console.warn("[Addon] Custom sieve drops registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_sieve_drop {"utilitycraft:crushed_endstone":[{"item":"minecraft:dragon_breath","amount":1,"chance":0.05,"tier":5}]}
*/

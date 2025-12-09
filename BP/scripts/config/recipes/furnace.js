import { system } from "@minecraft/server";

/**
 * Recipes for the Incinerator machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const furnaceRecipes = {
    // UtilityCraft
    "utilitycraft:raw_steel": {
        output: "utilitycraft:steel_ingot"
    },
    "utilitycraft:raw_energized_iron": {
        output: "utilitycraft:energized_iron_ingot"
    },
    "utilitycraft:iron_dust": {
        output: "minecraft:iron_ingot"
    },
    "utilitycraft:copper_dust": {
        output: "minecraft:copper_ingot"
    },
    "utilitycraft:gold_dust": {
        output: "minecraft:gold_ingot"
    },
    "utilitycraft:netherite_dust": {
        output: "minecraft:netherite_ingot"
    },
    "utilitycraft:netherite_scrap_dust": {
        output: "minecraft:netherite_scrap"
    },
    "utilitycraft:steel_dust": {
        output: "utilitycraft:steel_ingot"
    },
    "utilitycraft:energized_iron_dust": {
        output: "utilitycraft:energized_iron_ingot"
    },
    "utilitycraft:raw_steel_block": {
        output: "utilitycraft:steel_block"
    },
    "utilitycraft:raw_energized_iron_block": {
        output: "utilitycraft:energized_iron_block"
    },
    "utilitycraft:raw_leather": {
        output: "minecraft:leather"
    },
    'utilitycraft:crushed_kelp': {
        output: "minecraft:slime_ball"
    },
    // Compressed    
    "utilitycraft:compressed_sand": {
        output: "utilitycraft:compressed_glass"
    },
    // Utility Useful Recipes
    "minecraft:raw_iron_block": {
        output: "minecraft:iron_block"
    },
    "minecraft:raw_gold_block": {
        output: "minecraft:gold_block"
    },
    "minecraft:raw_copper_block": {
        output: "minecraft:copper_block"
    },
    // IS
    "ae2be:certus_quartz_dust": {
        output: "ae2be:silicon"
    },
    // Minecraft Vanilla
    "minecraft:porkchop": {
        output: "minecraft:cooked_porkchop"
    },
    "minecraft:beef": {
        output: "minecraft:cooked_beef"
    },
    "minecraft:chicken": {
        output: "minecraft:cooked_chicken"
    },
    "minecraft:cod": {
        output: "minecraft:cooked_cod"
    },
    "minecraft:salmon": {
        output: "minecraft:cooked_salmon"
    },
    "minecraft:potato": {
        output: "minecraft:baked_potato"
    },
    "minecraft:mutton": {
        output: "minecraft:cooked_mutton"
    },
    "minecraft:rabbit": {
        output: "minecraft:cooked_rabbit"
    },
    "minecraft:kelp": {
        output: "minecraft:dried_kelp"
    },
    "minecraft:rotten_flesh": {
        output: "strat:coagulated_blood"
    },
    "artifacts:everlasting_beef": {
        output: "artifacts:eternal_steak"
    },
    "bg:draconium_dust": {
        output: "bg:draconium_ingot"
    },
    "auxillium:amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:nether_amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:deepslate_amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:aurorus_ore": {
        output: "auxillium:aurorus"
    },
    "auxillium:deepslate_aurorus_ore": {
        output: "auxillium:aurorus"
    },
    "auxillium:auxillium_ore": {
        output: "auxillium:auxillium"
    },
    "auxillium:deepslate_auxillium_ore": {
        output: "auxillium:aurxillium"
    },
    "auxillium:cosmium_ore": {
        output: "auxillium:cosmium"
    },
    "auxillium:deepslate_cosmium_ore": {
        output: "auxillium:cosmium"
    },
    "auxillium:necrite_ore": {
        output: "auxillium:necrite"
    },
    "strat:raw_ardite": {
        output: "strat:ardite_ingot"
    },
    "strat:raw_aluminium": {
        output: "strat:aluminium_ingot"
    },
    "strat:aluminium_ore": {
        output: "strat:aluminium_ingot"
    },
    "strat:raw_cobalt": {
        output: "strat:cobalt_ingot"
    },
    "strat:cobalt_ore": {
        output: "strat:cobalt_ingot"
    },
    "strat:grout": {
        output: "strat:seared_brick"
    },
    "strat:nether_grout": {
        output: "strat:seared_brick"
    },
    "minecraft:raw_iron": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:raw_gold": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:raw_copper": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:copper_ore": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:iron_ore": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:diamond_ore": {
        output: "minecraft:diamond"
    },
    "minecraft:lapis_ore": {
        output: "minecraft:lapis_lazuli"
    },
    "minecraft:redstone_ore": {
        output: "minecraft:redstone"
    },
    "minecraft:coal_ore": {
        output: "minecraft:coal"
    },
    "minecraft:emerald_ore": {
        output: "minecraft:emerald"
    },
    "minecraft:deepslate_copper_ore": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:deepslate_iron_ore": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:deepslate_gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:deepslate_diamond_ore": {
        output: "minecraft:diamond"
    },
    "minecraft:deepslate_lapis_ore": {
        output: "minecraft:lapis_lazuli"
    },
    "minecraft:deepslate_redstone_ore": {
        output: "minecraft:redstone"
    },
    "minecraft:deepslate_coal_ore": {
        output: "minecraft:coal"
    },
    "minecraft:deepslate_emerald_ore": {
        output: "minecraft:emerald"
    },
    "minecraft:quartz_ore": {
        output: "minecraft:quartz"
    },
    "minecraft:ancient_debris": {
        output: "minecraft:netherite_scrap"
    },
    "minecraft:nether_gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:deepslate_emerald_ore": {
        output: "minecraft:emerald"
    },
    "bg:draconium_dust": {
        output: "bg:draconium_ingot"
    },
    "auxillium:amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:nether_amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:deepslate_amberine_ore": {
        output: "auxillium:amberine"
    },
    "auxillium:aurorus_ore": {
        output: "auxillium:aurorus"
    },
    "auxillium:deepslate_aurorus_ore": {
        output: "auxillium:aurorus"
    },
    "auxillium:auxillium_ore": {
        output: "auxillium:auxillium"
    },
    "auxillium:deepslate_auxillium_ore": {
        output: "auxillium:aurxillium"
    },
    "auxillium:cosmium_ore": {
        output: "auxillium:cosmium"
    },
    "auxillium:deepslate_cosmium_ore": {
        output: "auxillium:cosmium"
    },
    "auxillium:necrite_ore": {
        output: "auxillium:necrite"
    },
    "minecraft:rotten_flesh": {
        output: "strat:coagulated_blood"
    },
    "artifacts:everlasting_beef": {
        output: "artifacts:eternal_steak"
    },
    "strat:raw_ardite": {
        output: "strat:ardite_ingot"
    },
    "strat:raw_aluminium": {
        output: "strat:aluminium_ingot"
    },
    "strat:aluminium_ore": {
        output: "strat:aluminium_ingot"
    },
    "strat:raw_cobalt": {
        output: "strat:cobalt_ingot"
    },
    "strat:cobalt_ore": {
        output: "strat:cobalt_ingot"
    },
    "strat:grout": {
        output: "strat:seared_brick"
    },
    "strat:nether_grout": {
        output: "strat:seared_brick"
    },
    "minecraft:raw_iron": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:raw_gold": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:raw_copper": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:copper_ore": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:iron_ore": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:diamond_ore": {
        output: "minecraft:diamond"
    },
    "minecraft:lapis_ore": {
        output: "minecraft:lapis_lazuli"
    },
    "minecraft:redstone_ore": {
        output: "minecraft:redstone"
    },
    "minecraft:coal_ore": {
        output: "minecraft:coal"
    },
    "minecraft:emerald_ore": {
        output: "minecraft:emerald"
    },
    "minecraft:deepslate_copper_ore": {
        output: "minecraft:copper_ingot"
    },
    "minecraft:deepslate_iron_ore": {
        output: "minecraft:iron_ingot"
    },
    "minecraft:deepslate_gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:deepslate_diamond_ore": {
        output: "minecraft:diamond"
    },
    "minecraft:deepslate_lapis_ore": {
        output: "minecraft:lapis_lazuli"
    },
    "minecraft:deepslate_redstone_ore": {
        output: "minecraft:redstone"
    },
    "minecraft:deepslate_coal_ore": {
        output: "minecraft:coal"
    },
    "minecraft:deepslate_emerald_ore": {
        output: "minecraft:emerald"
    },
    "minecraft:quartz_ore": {
        output: "minecraft:quartz"
    },
    "minecraft:ancient_debris": {
        output: "minecraft:netherite_scrap"
    },
    "minecraft:nether_gold_ore": {
        output: "minecraft:gold_ingot"
    },
    "minecraft:deepslate_emerald_ore": {
        output: "minecraft:emerald"
    },
    "minecraft:porkchop": {
        output: "minecraft:cooked_porkchop"
    },
    "minecraft:beef": {
        output: "minecraft:cooked_beef"
    },
    "minecraft:chicken": {
        output: "minecraft:cooked_chicken"
    },
    "minecraft:cod": {
        output: "minecraft:cooked_cod"
    },
    "minecraft:salmon": {
        output: "minecraft:cooked_salmon"
    },
    "minecraft:potato": {
        output: "minecraft:baked_potato"
    },
    "minecraft:mutton": {
        output: "minecraft:cooked_mutton"
    },
    "minecraft:rabbit": {
        output: "minecraft:cooked_rabbit"
    },
    "minecraft:kelp": {
        output: "minecraft:dried_kelp"
    },
    "minecraft:sand": {
        output: "minecraft:glass"
    },
    "minecraft:cobblestone": {
        output: "minecraft:stone"
    },
    "minecraft:sandstone": {
        output: "minecraft:smooth_sandstone"
    },
    "minecraft:red_sandstone": {
        output: "minecraft:smooth_red_sandstone"
    },
    "minecraft:stone": {
        output: "minecraft:smooth_stone"
    },
    "minecraft:quartz_block": {
        output: "minecraft:quartz_block"
    },
    "minecraft:clay_ball": {
        output: "minecraft:brick"
    },
    "minecraft:netherrack": {
        output: "minecraft:netherbrick"
    },
    "minecraft:nether_brick": {
        output: "minecraft:cracked_nether_bricks"
    },
    "minecraft:basalt": {
        output: "minecraft:smooth_basalt"
    },
    "minecraft:clay": {
        output: "minecraft:hardened_clay"
    },
    "minecraft:stonebrick": {
        output: "minecraft:stonebrick"
    },
    "minecraft:polished_blackstone_bricks": {
        output: "minecraft:cracked_polished_blackstone_bricks"
    },
    "minecraft:coobled_deepslate": {
        output: "minecraft:deepslate"
    },
    "minecraft:deepslate_bricks": {
        output: "minecraft:cracked_deepslate_bricks"
    },
    "minecraft:deepslate_tiles": {
        output: "minecraft:cracked_deepslate_tiles"
    },
    "minecraft:cactus": {
        output: "minecraft:green_dye"
    },
    "minecraft:oak_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:spruce_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:birch_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:jungle_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:acacia_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:dark_oak_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:cherry_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:mangrove_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_oak_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_spruce_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_birch_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_jungle_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_acacia_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_dark_oak_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_cherry_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:stripped_mangrove_log": {
        output: "minecraft:charcoal"
    },
    "minecraft:wood": {
        output: "minecraft:charcoal"
    },
    "minecraft:chorus_fruit": {
        output: "minecraft:popped_chorus_fruit"
    },
    "minecraft:sea_pickle": {
        output: "minecraft:lime_dye"
    },
}

/**
 * ScriptEvent receiver: "utilitycraft:register_furnace_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace furnace recipes.
 * If the item already exists in `furnaceRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:stone": { "output": "minecraft:smooth_stone" },
 *   "minecraft:rotten_flesh": { "output": "strat:coagulated_blood" }
 * }
 * ```
 *
 * Behavior:
 * - New items are created automatically if missing.
 * - Existing items are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_furnace_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            if (furnaceRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            // Directly assign; machine will handle defaults
            furnaceRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse furnace registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom furnace recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace furnace recipes dynamically
    const newRecipes = {
        "minecraft:stone": { output: "minecraft:smooth_stone" },
        "minecraft:rotten_flesh": { output: "strat:coagulated_blood" },
        // This one replaces an existing recipe
        "minecraft:cobblestone": { output: "minecraft:deepslate" }
    };

    // Send the event to the furnace script
    system.sendScriptEvent("utilitycraft:register_furnace_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom furnace recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_furnace_recipe {"minecraft:stone":{"output":"minecraft:smooth_stone"},"minecraft:cobblestone":{"output":"minecraft:deepslate"}}
*/
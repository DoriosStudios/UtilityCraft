import { system } from "@minecraft/server";

/**
 * Infusing recipes for the Infuser machine.
 *
 * Uses a flat key format: "catalyst|input".
 * Each entry defines the output item and optional requirements.
 *
 * @constant
 * @type {InfuserRecipes}
 */
export const infuserRecipes = {
    "minecraft:redstone|minecraft:iron_ingot": {
        output: "utilitycraft:energized_iron_ingot",
        required: 4
    },
    "minecraft:redstone|utilitycraft:iron_dust": {
        output: "utilitycraft:energized_iron_dust",
        required: 4
    },
    "minecraft:redstone|utilitycraft:steel_plate": {
        output: "utilitycraft:chip",
        required: 2
    },
    "utilitycraft:gold_dust|utilitycraft:chip": {
        output: "utilitycraft:basic_chip",
        required: 2
    },
    "utilitycraft:energized_iron_dust|utilitycraft:basic_chip": {
        output: "utilitycraft:advanced_chip",
        required: 2
    },
    "utilitycraft:diamond_dust|utilitycraft:advanced_chip": {
        output: "utilitycraft:expert_chip",
        required: 2
    },
    "utilitycraft:netherite_dust|utilitycraft:expert_chip": {
        output: "utilitycraft:ultimate_chip",
        required: 2
    },
    "minecraft:coal|minecraft:iron_ingot": {
        output: "utilitycraft:steel_ingot",
        required: 1
    },
    "minecraft:coal|utilitycraft:iron_dust": {
        output: "utilitycraft:steel_dust",
        required: 1
    },
    "minecraft:charcoal|minecraft:iron_ingot": {
        output: "utilitycraft:steel_ingot",
        required: 1
    },
    "minecraft:charcoal|utilitycraft:iron_dust": {
        output: "utilitycraft:steel_dust",
        required: 1
    },
    "utilitycraft:coal_dust|minecraft:iron_ingot": {
        output: "utilitycraft:steel_ingot",
        required: 1
    },
    "utilitycraft:coal_dust|utilitycraft:iron_dust": {
        output: "utilitycraft:steel_dust",
        required: 1
    },
    "utilitycraft:charcoal_dust|minecraft:iron_ingot": {
        output: "utilitycraft:steel_ingot",
        required: 1
    },
    "utilitycraft:charcoal_dust|utilitycraft:iron_dust": {
        output: "utilitycraft:steel_dust",
        required: 1
    },
    "minecraft:blaze_powder|minecraft:sand": {
        output: "minecraft:soul_sand",
        required: 1
    },
    "minecraft:blaze_powder|minecraft:dirt": {
        output: "minecraft:soul_soil",
        required: 1
    },
    "minecraft:coal_block|minecraft:iron_block": {
        output: "utilitycraft:steel_block",
        required: 1
    },
    "minecraft:redstone_block|minecraft:iron_block": {
        output: "utilitycraft:energized_iron_block",
        required: 4
    },
    "utilitycraft:netherite_scrap_dust|minecraft:gold_ingot": {
        output: "minecraft:netherite_ingot",
        required: 4
    },
    "utilitycraft:netherite_scrap_dust|utilitycraft:gold_dust": {
        output: "utilitycraft:netherite_dust",
        required: 4
    },
    // Stone variants
    "minecraft:quartz|minecraft:cobblestone": {
        output: "minecraft:diorite",
        required: 1
    },
    "utilitycraft:flint|minecraft:cobblestone": {
        output: "minecraft:andesite",
        required: 1
    },
    "utilitycraft:dirt_handful|minecraft:cobblestone": {
        output: "minecraft:granite",
        required: 1
    },
    "minecraft:charcoal|minecraft:cobblestone": {
        output: "minecraft:blackstone",
        required: 1
    },
    "minecraft:coal|minecraft:cobblestone": {
        output: "minecraft:blackstone",
        required: 1
    },
    "utilitycraft:coal_dust|minecraft:cobblestone": {
        output: "minecraft:blackstone",
        required: 1
    },
    "utilitycraft:charcoal_dust|minecraft:cobblestone": {
        output: "minecraft:blackstone",
        required: 1
    },
    "minecraft:coal_block|utilitycraft:compressed_cobblestone": {
        output: "utilitycraft:compressed_blackstone",
        required: 1
    },
    "minecraft:blaze_powder|minecraft:cobblestone": {
        output: "minecraft:netherrack",
        required: 1
    },
    "utilitycraft:ender_pearl_dust|minecraft:cobblestone": {
        output: "minecraft:end_stone",
        required: 1
    },
    // Integrated Storage
    "minecraft:blaze_powder|ae2be:certus_quartz_crystal": {
        output: "ae2be:charged_certus_quartz_crystal",
        required: 1
    },
    "minecraft:redstone|ae2be:charged_certus_quartz_crystal": {
        output: "ae2be:fluix_crystal",
        required: 4
    },
    "ae2be:silicon|utilitycraft:chip": {
        output: "ae2be:silicon_press",
        required: 4
    },
    "ae2be:silicon|utilitycraft:basic_chip": {
        output: "ae2be:logic_processor_press",
        required: 4
    },
    "ae2be:silicon|utilitycraft:expert_chip": {
        output: "ae2be:engineering_processor_press",
        required: 4
    },
    "ae2be:silicon|ae2be:charged_certus_quartz_crystal": {
        output: "ae2be:calculation_processor_press",
        required: 4
    },
    // New Recipes for 3.2
    "utilitycraft:bag_of_blaze_powder|utilitycraft:compressed_cobblestone": {
        output: "utilitycraft:compressed_netherrack",
        required: 1
    },
    "minecraft:redstone|minecraft:raw_iron": {
        output: "utilitycraft:raw_energized_iron",
        required: 4
    }
    // Cost multiplier needed
};

/**
 * ScriptEvent receiver: "utilitycraft:register_infuser_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Infuser recipes.
 * The key must be in `"catalyst|input"` format.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:redstone|minecraft:iron_ingot": { "output": "utilitycraft:energized_iron_ingot", "required": 4 },
 *   "minecraft:coal|minecraft:iron_ingot": { "output": "utilitycraft:steel_ingot" }
 * }
 * ```
 *
 * Behavior:
 * - New recipes are created automatically if missing.
 * - Existing recipes are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_infuser_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeKey, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;
            if (!recipeKey.includes("|")) {
                console.warn(`[UtilityCraft] Invalid infuser key '${recipeKey}', expected "catalyst|input" format.`);
                continue;
            }

            if (infuserRecipes[recipeKey]) {
                replaced++;
            } else {
                added++;
            }

            infuserRecipes[recipeKey] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse infuser registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Infuser recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace infuser recipes dynamically
    const newRecipes = {
        "minecraft:redstone|minecraft:copper_ingot": { output: "utilitycraft:charged_copper_ingot", required: 2 },
        "minecraft:coal|minecraft:iron_ingot": { output: "utilitycraft:steel_ingot" },
        // This one replaces an existing recipe
        "minecraft:redstone|minecraft:iron_ingot": { output: "utilitycraft:energized_iron_ingot", required: 2 }
    };

    // Send the event to the Infuser script
    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom infuser recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_infuser_recipe {"minecraft:redstone|minecraft:copper_ingot":{"output":"utilitycraft:charged_copper_ingot","required":2},"minecraft:coal|minecraft:iron_ingot":{"output":"utilitycraft:steel_ingot"}}
*/
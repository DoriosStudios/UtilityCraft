import { world, system } from "@minecraft/server";

/**
 * @typedef {Object} LiquidRecipe
 * @property {string} liquid  The resulting liquid type (e.g. "lava", "water").
 * @property {number} amount  The produced liquid amount in millibuckets (mB).
 */

/**
 * Recipes for the Melter machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting liquid type and amount in millibuckets (mB).
 *
 * @constant
 * @type {Record<string, LiquidRecipe>}
 */
export const melterRecipes = {}

const melterRecipesRegister = {
    "minecraft:cobblestone": { liquid: "lava", amount: 250 },
    "minecraft:stone": { liquid: "lava", amount: 250 },
    "minecraft:diorite": { liquid: "lava", amount: 250 },
    "minecraft:granite": { liquid: "lava", amount: 250 },
    "minecraft:blackstone": { liquid: "lava", amount: 250 },
    "minecraft:netherrack": { liquid: "lava", amount: 1000 },
    "minecraft:magma": { liquid: "lava", amount: 1000 },
    "minecraft:magma_cream": { liquid: "lava", amount: 250 }
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_melter_recipe", JSON.stringify(melterRecipesRegister));
});

/**
 * ScriptEvent receiver: "utilitycraft:register_melter_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Melter recipes.
 * If the item already exists in `melterRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:cobblestone": { "liquid": "lava", "amount": 250 },
 *   "minecraft:ice": { "liquid": "water", "amount": 1000 }
 * }
 * ```
 *
 * Behavior:
 * - New items are added automatically if missing.
 * - Existing recipes are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_melter_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.liquid || typeof data.liquid !== "string") continue;
            if (typeof data.amount !== "number") continue;

            if (melterRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            melterRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse melter registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Melter recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace Melter recipes dynamically
    const newRecipes = {
        "minecraft:ice": { liquid: "water", amount: 1000 },
        "minecraft:obsidian": { liquid: "lava", amount: 500 },
        // This one replaces an existing recipe
        "minecraft:netherrack": { liquid: "lava", amount: 750 }
    };

    // Send the event to the Melter script
    system.sendScriptEvent("utilitycraft:register_melter_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom melter recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_melter_recipe {"minecraft:ice":{"liquid":"water","amount":1000},"minecraft:netherrack":{"liquid":"lava","amount":750}}
*/

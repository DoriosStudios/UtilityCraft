import { system } from "@minecraft/server";

/**
 * Pressing and compression recipes for the Electro Press machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const pressRecipes = {
    "minecraft:netherite_ingot": { output: "utilitycraft:netherite_plate", required: 1 },
    "minecraft:iron_ingot": { output: "utilitycraft:iron_plate", required: 1 },
    "minecraft:gold_ingot": { output: "utilitycraft:gold_plate", required: 1 },
    "minecraft:copper_ingot": { output: "utilitycraft:copper_plate", required: 1 },
    "utilitycraft:energized_iron_ingot": { output: "utilitycraft:energized_iron_plate", required: 1 },
    "utilitycraft:steel_ingot": { output: "utilitycraft:steel_plate", required: 1 },

    // Compress
    "minecraft:cobblestone": { output: "utilitycraft:compressed_cobblestone", required: 9 },
    "utilitycraft:compressed_cobblestone": { output: "utilitycraft:double_compressed_cobblestone", required: 9 },
    "utilitycraft:double_compressed_cobblestone": { output: "utilitycraft:triple_compressed_cobblestone", required: 9 },
    "utilitycraft:triple_compressed_cobblestone": { output: "utilitycraft:quadruple_compressed_cobblestone", required: 9 },
    "utilitycraft:quadruple_compressed_cobblestone": { output: "utilitycraft:quintuple_compressed_cobblestone", required: 9 },
    "utilitycraft:quintuple_compressed_cobblestone": { output: "utilitycraft:sextuple_compressed_cobblestone", required: 9 },
    "utilitycraft:sextuple_compressed_cobblestone": { output: "utilitycraft:septuple_compressed_cobblestone", required: 9 },
    "utilitycraft:septuple_compressed_cobblestone": { output: "utilitycraft:octuple_compressed_cobblestone", required: 9 },
    "utilitycraft:octuple_compressed_cobblestone": { output: "utilitycraft:nonuple_compressed_cobblestone", required: 9 },
    "minecraft:gravel": { output: "utilitycraft:compressed_gravel", required: 9 },
    "minecraft:sand": { output: "utilitycraft:compressed_sand", required: 9 },
    "minecraft:dirt": { output: "utilitycraft:compressed_dirt", required: 9 },
    "minecraft:netherrack": { output: "utilitycraft:compressed_netherrack", required: 9 },
    "minecraft:diamond_block": { output: "utilitycraft:compressed_diamond_block", required: 9 },
    "minecraft:iron_block": { output: "utilitycraft:compressed_iron_block", required: 9 },
    "minecraft:coal_block": { output: "utilitycraft:compressed_coal_block", required: 9 },

    // Extra
    "minecraft:packed_ice": { output: "minecraft:blue_ice", required: 9 },
    "minecraft:ice": { output: "minecraft:packed_ice", required: 9 },
    "minecraft:string": { output: "minecraft:wool", required: 4 },
    "minecraft:nether_wart": { output: "minecraft:nether_wart_block", required: 4 },
    "minecraft:magma_cream": { output: "minecraft:magma_block", required: 4 },
    "minecraft:slime_ball": { output: "minecraft:slime_block", required: 4 },
    "minecraft:stone": { output: "minecraft:deepslate", required: 4 },
    "minecraft:bone_meal": { output: "minecraft:bone_block", required: 9 },
    "minecraft:blaze_powder": { output: "minecraft:blaze_rod", required: 2 },
    "minecraft:dried_kelp": { output: "minecraft:dried_kelp_block", required: 9 },
    "minecraft:blue_ice": { output: "minecraft:packed_ice", required: 9 }
}

/**
 * ScriptEvent receiver: "utilitycraft:register_press_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Electro Press recipes.
 * If the item already exists in `pressRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:stone": { "output": "minecraft:deepslate", "required": 4 },
 *   "minecraft:ice": { "output": "minecraft:packed_ice", "required": 9 }
 * }
 * ```
 *
 * Behavior:
 * - New items are created automatically if missing.
 * - Existing items are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_press_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            if (pressRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            pressRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse press registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Electro Press recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace press recipes dynamically
    const newRecipes = {
        "minecraft:stone": { output: "minecraft:deepslate", required: 4 },
        "minecraft:ice": { output: "minecraft:packed_ice", required: 9 },
        // This one replaces an existing recipe
        "minecraft:sand": { output: "utilitycraft:compressed_glass", required: 9 }
    };

    // Send the event to the press script
    system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom press recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_press_recipe {"minecraft:stone":{"output":"minecraft:deepslate","required":4},"minecraft:sand":{"output":"utilitycraft:compressed_glass","required":9}}
*/
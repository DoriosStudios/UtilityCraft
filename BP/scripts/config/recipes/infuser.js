import { world, system } from "@minecraft/server";

/**
 * Infusing recipes for the Infuser machine.
 *
 * Uses a flat key format: "catalyst|input".
 * Each entry defines the output item and optional requirements.
 *
 * @constant
 * @type {InfuserRecipes}
 */
export const infuserRecipes = {}

const infuserRecipesRegister = {
    "utilitycraft:amethyst_dust|utilitycraft:obsidian_dust": {
        output: "utilitycraft:stabilized_obsidian_dust",
        required: 4
    },
    "utilitycraft:amethyst_dust|utilitycraft:crying_obsidian_dust": {
        output: "utilitycraft:stabilized_obsidian_dust",
        required: 1
    },
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
    },
    // Cost multiplier needed
    "minecraft:bone_meal|minecraft:cobblestone": {
        output: "minecraft:calcite",
        required: 4
    },
    // Color pattern templates (placeholders will be expanded at load time)
    "minecraft:{x}_dye|minecraft:{y}_terracotta": { output: "minecraft:{x}_terracotta", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_glazed_terracotta": { output: "minecraft:{x}_glazed_terracotta", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_concrete": { output: "minecraft:{x}_concrete", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_concrete_powder": { output: "minecraft:{x}_concrete_powder", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_stained_glass": { output: "minecraft:{x}_stained_glass", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_stained_glass_pane": { output: "minecraft:{x}_stained_glass_pane", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_wool": { output: "minecraft:{x}_wool", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_candle": { output: "minecraft:{x}_candle", required: 1 },
    "minecraft:{x}_dye|minecraft:{y}_harness": { output: "minecraft:{x}_harness", required: 1 },
    "minecraft:{x}_dye|utilitycraft:{y}_elevator": { output: "utilitycraft:{x}_elevator", required: 1 }
    // Note: bundles and shulker_boxes are intentionally NOT added because they are prone to data loss
};

/**
 * Families that must not be auto-expanded due to NBT/data risks.
 */
const BLOCKED_SUFFIXES = ['_bundle', '_shulker_box'];

/**
 * Colors used for expansion. Order matches Minecraft color names.
 */
const COLORS = [
    'white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'
];

/**
 * Expand pattern-based recipes that contain placeholders like {x} and {y}.
 * Example key: "minecraft:{x}_dye|minecraft:{y}_terracotta" with output "minecraft:{x}_terracotta"
 * will expand into 256 explicit entries (16x16 combinations).
 *
 * Rules:
 * - Placeholders are expressed as {name} in the key and/or output.
 * - Each placeholder will be substituted with every value in COLORS.
 * - Existing explicit keys in the original register are preserved and won't be overridden.
 */
function expandColorPatterns(register) {
    const expanded = {};

    const patternRegex = /{([^}]+)}/g;

    // First pass: copy explicit (non-pattern) entries
    for (const [key, data] of Object.entries(register)) {
        if (!patternRegex.test(key) && !(data.output && patternRegex.test(data.output))) {
            expanded[key] = data;
        }
        // Reset regex state
        patternRegex.lastIndex = 0;
    }

    // Second pass: expand pattern entries
    for (const [key, data] of Object.entries(register)) {
        // Check if this key or its output contains a placeholder
        if (!patternRegex.test(key) && !(data.output && patternRegex.test(data.output))) {
            patternRegex.lastIndex = 0;
            continue;
        }

        // Collect unique token names from key + output
        const combined = key + '|' + (data.output ?? '');
        const tokens = [];
        let m;
        while ((m = patternRegex.exec(combined)) !== null) {
            if (!tokens.includes(m[1])) tokens.push(m[1]);
        }
        patternRegex.lastIndex = 0;

        // Generate all combinations of colors for the tokens
        const combos = [];
        function gen(idx, current) {
            if (idx >= tokens.length) {
                combos.push(Object.assign({}, current));
                return;
            }
            const token = tokens[idx];
            for (const color of COLORS) {
                current[token] = color;
                gen(idx + 1, current);
            }
        }
        gen(0, {});

        // Expand each combination into a concrete recipe
        for (const combo of combos) {
            const expandedKey = key.replace(/\{([^}]+)\}/g, (_,t) => combo[t] ?? _);
            const newData = Object.assign({}, data);
            if (typeof newData.output === 'string') {
                newData.output = newData.output.replace(/\{([^}]+)\}/g, (_,t) => combo[t] ?? _);
            }

            // Skip blocked families to avoid data loss (bundles/shulker boxes etc.)
            const blocked = (s) => {
                if (!s || typeof s !== 'string') return false;
                return BLOCKED_SUFFIXES.some(suf => s.includes(suf));
            };

            if (blocked(expandedKey) || blocked(newData.output)) {
                continue;
            }

            // Don't override explicit entries
            if (!expanded[expandedKey]) {
                expanded[expandedKey] = newData;
            }
        }
    }

    return expanded;
}

world.afterEvents.worldLoad.subscribe(() => {
    const expanded = expandColorPatterns(infuserRecipesRegister);
    try {
        system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(expanded));
    } catch (err) {
        console.warn('[UtilityCraft] Failed to send expanded infuser recipes:', err);
    }
});

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
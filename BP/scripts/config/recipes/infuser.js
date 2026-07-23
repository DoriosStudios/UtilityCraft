import * as DoriosLib from "DoriosLib/index.js";
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
export const infuserRecipes = {};

const infuserRecipesRegister = {
  "utilitycraft:amethyst_dust|utilitycraft:obsidian_dust": { // Stabilized Obsidian Dust
    output: "utilitycraft:stabilized_obsidian_dust",
    required: 4,
  },
  "utilitycraft:amethyst_dust|utilitycraft:crying_obsidian_dust": { // Stabilized Obsidian Dust (variant)
    output: "utilitycraft:stabilized_obsidian_dust",
    required: 1,
  },
  "minecraft:redstone|minecraft:iron_ingot": { // Energized Iron Ingot
    output: "utilitycraft:energized_iron_ingot",
    required: 4,
  },
  "minecraft:redstone|utilitycraft:iron_dust": { // Energized Iron Dust
    output: "utilitycraft:energized_iron_dust",
    required: 4,
  },
  "minecraft:redstone|minecraft:raw_iron": { // Raw Energized Iron
    output: "utilitycraft:raw_energized_iron",
    required: 4,
  },
  "minecraft:redstone|utilitycraft:steel_plate": { // Base/Simple Chip
    output: "utilitycraft:chip",
    required: 2,
  },
  "utilitycraft:gold_dust|utilitycraft:chip": { // Basic Chip
    output: "utilitycraft:basic_chip",
    required: 2,
  },
  "utilitycraft:energized_iron_dust|utilitycraft:basic_chip": { // Advanced Chip
    output: "utilitycraft:advanced_chip",
    required: 2,
  },
  "utilitycraft:diamond_dust|utilitycraft:advanced_chip": { // Expert Chip
    output: "utilitycraft:expert_chip",
    required: 2,
  },
  "utilitycraft:netherite_dust|utilitycraft:expert_chip": { // Ultimate Chip
    output: "utilitycraft:ultimate_chip",
    required: 2,
  },
  "minecraft:coal|minecraft:iron_ingot": { // Steel Ingot (coal)
    output: "utilitycraft:steel_ingot",
    required: 1,
  },
  "utilitycraft:coal_dust|minecraft:iron_ingot": { // Steel Ingot (coal dust)
    output: "utilitycraft:steel_ingot",
    required: 1,
  },
  "minecraft:coal|utilitycraft:iron_dust": { // Steel Dust (coal)
    output: "utilitycraft:steel_dust",
    required: 1,
  },
  "utilitycraft:coal_dust|utilitycraft:iron_dust": { // Steel Dust (coal dust)
    output: "utilitycraft:steel_dust",
    required: 1,
  },
  "minecraft:charcoal|minecraft:iron_ingot": { // Steel Ingot (charcoal)
    output: "utilitycraft:steel_ingot",
    required: 1,
  },
  "minecraft:charcoal|utilitycraft:iron_dust": { // Steel Dust (charcoal)
    output: "utilitycraft:steel_dust",
    required: 1,
  },
  "utilitycraft:charcoal_dust|minecraft:iron_ingot": { // Steel Ingot (charcoal dust)
    output: "utilitycraft:steel_ingot",
    required: 1,
  },
  "utilitycraft:charcoal_dust|utilitycraft:iron_dust": { // Steel Dust (charcoal dust)
    output: "utilitycraft:steel_dust",
    required: 1,
  },
  "minecraft:coal|minecraft:raw_iron": { // Brute Steel (coal)
    output: "utilitycraft:raw_steel",
    required: 1,
  },
  "utilitycraft:coal_dust|minecraft:raw_iron": { // Brute Steel (coal dust)
    output: "utilitycraft:raw_steel",
    required: 1,
  },
  "minecraft:charcoal|minecraft:raw_iron": { // Brute Steel (charcoal)
    output: "utilitycraft:raw_steel",
    required: 1,
  },
  "utilitycraft:charcoal_dust|minecraft:raw_iron": { // Brute Steel (charcoal dust)
    output: "utilitycraft:raw_steel",
    required: 1,
  },
  "minecraft:blaze_powder|minecraft:ender_pearl": { // Eye of Ender
    output: "minecraft:ender_eye",
    required: 1,
  },
  "minecraft:blaze_powder|minecraft:slime_ball": { // Magma Cream
    output: "minecraft:magma_cream",
    required: 1,
  },
  "utilitycraft:gold_dust|minecraft:carrot": { // Golden Carrot
    output: "minecraft:golden_carrot",
    required: 1,
  },
  "utilitycraft:gold_dust|minecraft:apple": { // Golden Apple
    output: "minecraft:golden_apple",
    required: 4,
  },
  "utilitycraft:gold_dust|minecraft:melon_slice": { // Glistering Melon Slice
    output: "minecraft:glistering_melon_slice",
    required: 1,
  },
  "minecraft:blaze_powder|minecraft:sand": { // Soul Sand
    output: "minecraft:soul_sand",
    required: 1,
  },
  "minecraft:blaze_powder|minecraft:dirt": { // Soul Soil
    output: "minecraft:soul_soil",
    required: 1,
  },
  "minecraft:redstone|minecraft:sand": { // Red Sand
    output: "minecraft:red_sand",
    required: 1,
  },
  "minecraft:redstone|minecraft:stone": { // Cinnabar
    output: "minecraft:cinnabar",
    required: 1,
  },
  "minecraft:warped_wart_block|minecraft:netherrack": { // Warped Nylium
    output: "minecraft:warped_nylium",
    required: 1,
  },
  "minecraft:nether_wart_block|minecraft:netherrack": { // Crimson Nylium
    output: "minecraft:crimson_nylium",
    required: 1,
  },
  "minecraft:echo_shard|minecraft:dirt": { // Sculk
    output: "minecraft:sculk",
    required: 1,
  },
  "minecraft:gold_ingot|minecraft:blackstone": { // Gilded Blackstone
    output: "minecraft:gilded_blackstone",
    required: 1,
  },
  "minecraft:ghast_tear|minecraft:obsidian": { // Crying Obsidian
    output: "minecraft:crying_obsidian",
    required: 1,
  },
  "minecraft:coal_block|minecraft:iron_block": { // Steel Block
    output: "utilitycraft:steel_block",
    required: 1,
  },
  "minecraft:redstone_block|minecraft:iron_block": { // Energized Iron Block
    output: "utilitycraft:energized_iron_block",
    required: 4,
  },
  "utilitycraft:netherite_scrap_dust|minecraft:gold_ingot": { // Netherite Ingot
    output: "minecraft:netherite_ingot",
    required: 4,
  },
  "utilitycraft:netherite_scrap_dust|utilitycraft:gold_dust": { // Netherite Dust
    output: "utilitycraft:netherite_dust",
    required: 4,
  },
  // Stone variants
  "minecraft:quartz|minecraft:cobblestone": { // Diorite
    output: "minecraft:diorite",
    required: 1,
  },
  "minecraft:flint|minecraft:cobblestone": { // Andesite
    output: "minecraft:andesite",
    required: 1,
  },
  "utilitycraft:dirt_handful|minecraft:cobblestone": { // Granite
    output: "minecraft:granite",
    required: 1,
  },
  "minecraft:bone_meal|minecraft:cobblestone": { // Calcite
    output: "minecraft:calcite",
    required: 2,
  },
  "minecraft:vine|minecraft:rooted_dirt": { // Moss Block
    output: "minecraft:moss_block",
    required: 4,
  },
  "minecraft:moss_block|minecraft:cobblestone": { // Mossy Cobblestone
    output: "minecraft:mossy_cobblestone",
    required: 1,
  },
  "minecraft:moss_block|minecraft:stone_bricks": { // Mossy Stone Bricks
    output: "minecraft:mossy_stone_bricks",
    required: 1,
  },
  // Cost multiplier needed
  "minecraft:bone_meal|minecraft:dirt": { // Grass Block (bone meal route)
    output: "minecraft:grass_block",
    required: 1,
  },
  "minecraft:spruce_sapling|minecraft:grass_block": { // Podzol
    output: "minecraft:podzol",
    required: 1,
  },
  "minecraft:red_mushroom|minecraft:grass_block": { // Mycelium (red mushroom)
    output: "minecraft:mycelium",
    required: 1,
  },
  "minecraft:brown_mushroom|minecraft:grass_block": { // Mycelium (brown mushroom)
    output: "minecraft:mycelium",
    required: 1,
  },
  "minecraft:charcoal|minecraft:cobblestone": { // Blackstone (charcoal)
    output: "minecraft:blackstone",
    required: 1,
  },
  "minecraft:coal|minecraft:cobblestone": { // Blackstone (coal)
    output: "minecraft:blackstone",
    required: 1,
  },
  "utilitycraft:coal_dust|minecraft:cobblestone": { // Blackstone (coal dust)
    output: "minecraft:blackstone",
    required: 1,
  },
  "utilitycraft:charcoal_dust|minecraft:cobblestone": { // Blackstone (charcoal dust)
    output: "minecraft:blackstone",
    required: 1,
  },
  "minecraft:coal_block|utilitycraft:compressed_cobblestone": { // Compressed Blackstone
    output: "utilitycraft:compressed_blackstone",
    required: 1,
  },
  "minecraft:blaze_powder|minecraft:cobblestone": { // Netherrack
    output: "minecraft:netherrack",
    required: 1,
  },
  "utilitycraft:ender_pearl_dust|minecraft:cobblestone": { // End Stone
    output: "minecraft:end_stone",
    required: 1,
  },
  "utilitycraft:bag_of_blaze_powder|utilitycraft:compressed_cobblestone": { // Compressed Netherrack
    output: "utilitycraft:compressed_netherrack",
    required: 1,
  },
  "minecraft:mangrove_roots|minecraft:dirt": { // Rooted Dirt
    output: "minecraft:rooted_dirt",
    required: 1,
  },
  // ---------- Integrated Storage ----------
  "minecraft:blaze_powder|ae2be:certus_quartz_crystal": { // Charged Certus Quartz Crystal
    output: "ae2be:charged_certus_quartz_crystal",
    required: 1,
  },
  "minecraft:redstone|ae2be:charged_certus_quartz_crystal": { // Fluix Crystal
    output: "ae2be:fluix_crystal",
    required: 4,
  },
  "ae2be:silicon|utilitycraft:chip": { // Silicon Press
    output: "ae2be:silicon_press",
    required: 4,
  },
  "ae2be:silicon|utilitycraft:basic_chip": { // Logic Processor Press
    output: "ae2be:logic_processor_press",
    required: 4,
  },
  "ae2be:silicon|utilitycraft:expert_chip": { // Engineering Processor Press
    output: "ae2be:engineering_processor_press",
    required: 4,
  },
  "ae2be:silicon|ae2be:charged_certus_quartz_crystal": { // Calculation Processor Press
    output: "ae2be:calculation_processor_press",
    required: 4,
  },
  // Color pattern templates (placeholders will be expanded at load time)
  "minecraft:{x}_dye|minecraft:{y}_terracotta": { output: "minecraft:{x}_terracotta", required: 1 }, // Terracotta recolor template
  "minecraft:{x}_dye|minecraft:{y}_glazed_terracotta": { output: "minecraft:{x}_glazed_terracotta", required: 1 }, // Glazed terracotta recolor template
  "minecraft:{x}_dye|minecraft:{y}_concrete": { output: "minecraft:{x}_concrete", required: 1 }, // Concrete recolor template
  "minecraft:{x}_dye|minecraft:{y}_concrete_powder": { output: "minecraft:{x}_concrete_powder", required: 1 }, // Concrete powder recolor template
  "minecraft:{x}_dye|minecraft:{y}_stained_glass": { output: "minecraft:{x}_stained_glass", required: 1 }, // Stained glass recolor template
  "minecraft:{x}_dye|minecraft:{y}_stained_glass_pane": { output: "minecraft:{x}_stained_glass_pane", required: 1 }, // Stained glass pane recolor template
  "minecraft:{x}_dye|minecraft:{y}_wool": { output: "minecraft:{x}_wool", required: 1 }, // Wool recolor template
  "minecraft:{x}_dye|minecraft:{y}_candle": { output: "minecraft:{x}_candle", required: 1 }, // Candle recolor template
  "minecraft:{x}_dye|minecraft:{y}_harness": { output: "minecraft:{x}_harness", required: 1 }, // Harness recolor template
  "minecraft:white_dye|utilitycraft:{y}_elevator": { output: "utilitycraft:elevator", required: 1 }, // Elevator reset-to-white template
  "minecraft:{x}_dye|utilitycraft:{y}_elevator": { output: "utilitycraft:{x}_elevator", required: 1 }, // Elevator recolor template
  // Note: bundles and shulker_boxes are intentionally NOT added because they are prone to data loss
};

/**
 * Families that must not be auto-expanded due to NBT/data risks.
 */
const BLOCKED_SUFFIXES = ["_bundle", "_shulker_box"];
/**
 * Normalizes legacy elevator IDs that no longer exist.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeLegacyElevatorId(value) {
  if (typeof value !== "string") return value;
  return value.split("utilitycraft:white_elevator").join("utilitycraft:elevator");
}

/**
 * Colors used for expansion. Order matches Minecraft color names.
 */
const COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
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
      const normalizedKey = normalizeLegacyElevatorId(key);
      const normalizedData = Object.assign({}, data);
      if (typeof normalizedData.output === "string") {
        normalizedData.output = normalizeLegacyElevatorId(normalizedData.output);
      }
      expanded[normalizedKey] = normalizedData;
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
    const combined = key + "|" + (data.output ?? "");
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
      const expandedKey = normalizeLegacyElevatorId(key.replace(/\{([^}]+)\}/g, (_, t) => combo[t] ?? _));
      const newData = Object.assign({}, data);
      if (typeof newData.output === "string") {
        newData.output = normalizeLegacyElevatorId(newData.output.replace(/\{([^}]+)\}/g, (_, t) => combo[t] ?? _));
      }

      // Skip blocked families to avoid data loss (bundles/shulker boxes etc.)
      const blocked = (s) => {
        if (!s || typeof s !== "string") return false;
        return BLOCKED_SUFFIXES.some((suf) => s.includes(suf));
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

const expandedInfuserRecipes = expandColorPatterns(infuserRecipesRegister);
DoriosLib.registry.registerInfuserRecipe(expandedInfuserRecipes);

/**
 * ScriptEvent receiver: "utilitycraft:register_infuser_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Infuser recipes.
 * Queue the object with `DoriosLib.registry.registerInfuserRecipe(payload)`.
 * The key must be in `"catalyst|input"` format.
 *
 * Registration object shape:
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

      const normalizedRecipeKey = normalizeLegacyElevatorId(recipeKey);
      if (!normalizedRecipeKey.includes("|")) {
        console.warn(`[UtilityCraft] Invalid infuser key '${normalizedRecipeKey}', expected "catalyst|input" format.`);
        continue;
      }

      const normalizedData = Object.assign({}, data, {
        output: normalizeLegacyElevatorId(data.output),
      });

      if (infuserRecipes[normalizedRecipeKey]) {
        replaced++;
      } else {
        added++;
      }

      infuserRecipes[normalizedRecipeKey] = normalizedData;
    }
  } catch (err) {
    console.warn("[UtilityCraft] Failed to parse infuser registration payload:", err);
  }
});

// ==================================================
// EXAMPLES – How to register custom Infuser recipes
// ==================================================
/*
import * as DoriosLib from "DoriosLib/index.js";

// Add or replace Infuser recipes through DoriosLib's world-load queue.
const newRecipes = {
    "minecraft:redstone|minecraft:copper_ingot": { output: "utilitycraft:charged_copper_ingot", required: 2 },
    "minecraft:coal|minecraft:iron_ingot": { output: "utilitycraft:steel_ingot" },
    // This one replaces an existing recipe
    "minecraft:redstone|minecraft:iron_ingot": { output: "utilitycraft:energized_iron_ingot", required: 2 }
};

DoriosLib.registry.registerInfuserRecipe(newRecipes);
*/

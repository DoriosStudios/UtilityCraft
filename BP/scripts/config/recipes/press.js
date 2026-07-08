import { world, system } from "@minecraft/server";

/**
 * Pressing and compression recipes for the Electro Press machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const pressRecipes = {};

const pressRecipesRegister = {
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
  "minecraft:magma_cream": { output: "minecraft:magma", required: 4 },
  "minecraft:slime_ball": { output: "minecraft:slime", required: 4 },
  "minecraft:stone": { output: "minecraft:deepslate", required: 4 },
  "utilitycraft:compressed_stone": { output: "utilitycraft:compressed_deepslate", required: 4, cost: 7200 },
  "utilitycraft:compressed_stone_2": { output: "utilitycraft:compressed_deepslate_2", required: 4, cost: 64800 },
  "utilitycraft:compressed_stone_3": { output: "utilitycraft:compressed_deepslate_3", required: 4, cost: 583200 },
  "utilitycraft:compressed_stone_4": { output: "utilitycraft:compressed_deepslate_4", required: 4, cost: 5248800 },
  "minecraft:bone_meal": { output: "minecraft:bone_block", required: 9 },
  "minecraft:blaze_powder": { output: "minecraft:blaze_rod", required: 2 },
  "minecraft:dried_kelp": { output: "minecraft:dried_kelp_block", required: 9 },
  "minecraft:blue_ice": { output: "minecraft:packed_ice", required: 9 },
  "minecraft:wheat": { output: "minecraft:hay_block", required: 9 },
  "minecraft:clay_ball": { output: "minecraft:clay", required: 4 },
  "minecraft:brick": { output: "minecraft:brick_block", required: 4 },
  "minecraft:netherbrick": { output: "minecraft:nether_brick", required: 4 },
  "minecraft:glowstone_dust": { output: "minecraft:glowstone", required: 4 },
  "minecraft:quartz": { output: "minecraft:quartz_block", required: 4 },
  "minecraft:amethyst_shard": { output: "minecraft:amethyst_block", required: 4 },
  "minecraft:snowball": { output: "minecraft:snow", required: 4 },

  // Pebbles / handfuls / shards
  "utilitycraft:mud_ball": { output: "minecraft:mud", required: 4 },
  "utilitycraft:gravel_fragments": { output: "minecraft:gravel", required: 4 },
  "utilitycraft:nether_star_fragment": { output: "minecraft:nether_star", required: 9 },
  "utilitycraft:crushed_deepslate_handful": { output: "utilitycraft:crushed_cobbled_deepslate", required: 4 },
  "utilitycraft:dirt_handful": { output: "minecraft:dirt", required: 4 },
  "utilitycraft:crushed_endstone_handful": { output: "utilitycraft:crushed_endstone", required: 4 },
  "utilitycraft:crushed_netherrack_handful": { output: "utilitycraft:crushed_netherrack", required: 4 },
  "utilitycraft:red_sand_handful": { output: "minecraft:red_sand", required: 4 },
  "utilitycraft:sand_handful": { output: "minecraft:sand", required: 4 },
  "utilitycraft:souls_handful": { output: "minecraft:soul_sand", required: 4 },
  "utilitycraft:andesite_pebble": { output: "minecraft:andesite", required: 4 },
  "utilitycraft:basalt_pebble": { output: "minecraft:basalt", required: 4 },
  "utilitycraft:blackstone_pebble": { output: "minecraft:blackstone", required: 4 },
  "utilitycraft:calcite_pebble": { output: "minecraft:calcite", required: 4 },
  "utilitycraft:stone_pebble": { output: "minecraft:cobblestone", required: 4 },
  "utilitycraft:deepslate_pebble": { output: "minecraft:cobbled_deepslate", required: 4 },
  "utilitycraft:diorite_pebble": { output: "minecraft:diorite", required: 4 },
  "utilitycraft:dripstone_pebble": { output: "minecraft:dripstone_block", required: 4 },
  "utilitycraft:endstone_pebble": { output: "minecraft:end_stone", required: 4 },
  "utilitycraft:gilded_blackstone_pebble": { output: "minecraft:gilded_blackstone", required: 4 },
  "utilitycraft:granite_pebble": { output: "minecraft:granite", required: 4 },
  "utilitycraft:netherrack_pebble": { output: "minecraft:netherrack", required: 4 },
  "utilitycraft:tuff_pebble": { output: "minecraft:tuff", required: 4 },
  "utilitycraft:diamond_shard": { output: "minecraft:diamond", required: 9 },
  "utilitycraft:emerald_shard": { output: "minecraft:emerald", required: 9 },
  "utilitycraft:shulker_shell_shard": { output: "minecraft:shulker_shell", required: 9 },
  "utilitycraft:totem_shard": { output: "minecraft:totem_of_undying", required: 9 },
  "utilitycraft:wither_skull_shard": { output: "minecraft:wither_skeleton_skull", required: 9 },
};

world.afterEvents.worldLoad.subscribe(() => {
  system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(pressRecipesRegister));
});

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
// EXAMPLES â€“ How to register custom Electro Press recipes
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


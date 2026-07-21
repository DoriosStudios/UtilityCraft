import { system, world } from "@minecraft/server";

/**
 * @typedef {Object} CrafterRecipe
 * @property {string} output The resulting item identifier.
 * @property {number} [amount] The number of items produced (default 1).
 * @property {string[]} [leftover] Optional array of items returned after crafting.
 */

/**
 * Crafter recipes for the UtilityCraft Crafter machine.
 *
 * This table starts empty on purpose. Recipes with the "utilitycraft_workbench"
 * recipe tag are registered through the "utilitycraft:register_crafter_recipe"
 * script event at world load, matching the other machine recipe registries.
 *
 * Keys use unnamespaced item ids because the crafter grid stores item.typeId
 * as the segment after ":".
 *
 * @constant
 * @type {Record<string, CrafterRecipe>}
 */
export const crafterRecipes = {};

const crafterRecipeBatches = [
  {
    "advanced_chip,basic_battery,advanced_chip,basic_battery,redstone_block,basic_battery,advanced_chip,energized_iron_dust,advanced_chip": {
      "output": "utilitycraft:advanced_battery",
      "amount": 1
    },
    "basic_chip,redstone,basic_chip,redstone,redstone_block,redstone,basic_chip,gold_dust,basic_chip": {
      "output": "utilitycraft:basic_battery",
      "amount": 1
    },
    "expert_chip,advanced_battery,expert_chip,advanced_battery,redstone_block,advanced_battery,expert_chip,diamond_dust,expert_chip": {
      "output": "utilitycraft:expert_battery",
      "amount": 1
    },
    "ultimate_chip,expert_battery,ultimate_chip,expert_battery,redstone_block,expert_battery,ultimate_chip,netherite_dust,ultimate_chip": {
      "output": "utilitycraft:ultimate_battery",
      "amount": 1
    },
    "steel_plate,advanced_chip,steel_plate,advanced_chip,basic_furnator,advanced_chip,energized_iron_plate,redstone_block,energized_iron_plate": {
      "output": "utilitycraft:advanced_furnator",
      "amount": 1
    },
    "steel_ingot,basic_chip,steel_ingot,basic_chip,blast_furnace,basic_chip,iron_ingot,redstone_block,iron_ingot": {
      "output": "utilitycraft:basic_furnator",
      "amount": 1
    },
    "steel_plate,expert_chip,steel_plate,expert_chip,advanced_furnator,expert_chip,diamond_dust,redstone_block,diamond_dust": {
      "output": "utilitycraft:expert_furnator",
      "amount": 1
    },
    "steel_plate,ultimate_chip,steel_plate,ultimate_chip,expert_furnator,ultimate_chip,netherite_plate,redstone_block,netherite_plate": {
      "output": "utilitycraft:ultimate_furnator",
      "amount": 1
    },
    "energized_iron_plate,advanced_fluid_tank,energized_iron_plate,advanced_chip,basic_magmator,advanced_chip,steel_plate,advanced_chip,steel_plate": {
      "output": "utilitycraft:advanced_magmator",
      "amount": 1
    },
    "gold_plate,basic_fluid_tank,gold_plate,basic_chip,furnace,basic_chip,steel_plate,basic_chip,steel_plate": {
      "output": "utilitycraft:basic_magmator",
      "amount": 1
    },
    "diamond_dust,expert_fluid_tank,diamond_dust,expert_chip,advanced_magmator,expert_chip,steel_plate,expert_chip,steel_plate": {
      "output": "utilitycraft:expert_magmator",
      "amount": 1
    },
    "netherite_plate,ultimate_fluid_tank,netherite_plate,ultimate_chip,expert_magmator,ultimate_chip,netherite_plate,ultimate_chip,netherite_plate": {
      "output": "utilitycraft:ultimate_magmator",
      "amount": 1
    },
    "ender_pearl_dust,advanced_chip,ender_pearl_dust,advanced_chip,basic_energy_receiver,advanced_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:advanced_energy_receiver",
      "amount": 1
    },
    "ender_pearl_dust,redstone_torch,ender_pearl_dust,basic_chip,basic_battery,basic_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:basic_energy_receiver",
      "amount": 1
    },
    "ender_pearl_dust,expert_chip,ender_pearl_dust,expert_chip,advanced_energy_receiver,expert_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:expert_energy_receiver",
      "amount": 1
    },
    "ender_pearl_dust,ultimate_chip,ender_pearl_dust,ultimate_chip,expert_energy_receiver,ultimate_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:ultimate_energy_receiver",
      "amount": 1
    },
    "steel_plate,advanced_chip,steel_plate,advanced_chip,basic_solar_panel,advanced_chip,energized_iron_plate,redstone_block,energized_iron_plate": {
      "output": "utilitycraft:advanced_solar_panel",
      "amount": 1
    },
    "steel_ingot,basic_chip,steel_ingot,basic_chip,gold_ingot,basic_chip,gold_ingot,redstone_block,gold_ingot": {
      "output": "utilitycraft:basic_solar_panel",
      "amount": 1
    },
    "steel_plate,expert_chip,steel_plate,expert_chip,advanced_solar_panel,expert_chip,diamond_dust,redstone_block,diamond_dust": {
      "output": "utilitycraft:expert_solar_panel",
      "amount": 1
    },
    "steel_plate,ultimate_chip,steel_plate,ultimate_chip,expert_solar_panel,ultimate_chip,netherite_plate,redstone_block,netherite_plate": {
      "output": "utilitycraft:ultimate_solar_panel",
      "amount": 1
    },
    "copper_block,advanced_fluid_tank,copper_block,advanced_chip,basic_thermo_generator,advanced_chip,energized_iron_plate,copper_block,energized_iron_plate": {
      "output": "utilitycraft:advanced_thermo_generator",
      "amount": 1
    },
    "copper_block,copper_plate,copper_block,basic_chip,basic_fluid_tank,basic_chip,gold_plate,copper_block,gold_plate": {
      "output": "utilitycraft:basic_thermo_generator",
      "amount": 1
    },
    "copper_block,expert_fluid_tank,copper_block,expert_chip,advanced_thermo_generator,expert_chip,diamond_dust,copper_block,diamond_dust": {
      "output": "utilitycraft:expert_thermo_generator",
      "amount": 1
    },
    "copper_block,ultimate_fluid_tank,copper_block,ultimate_chip,expert_thermo_generator,ultimate_chip,netherite_plate,copper_block,netherite_plate": {
      "output": "utilitycraft:ultimate_thermo_generator",
      "amount": 1
    },
    "ender_pearl_dust,advanced_chip,ender_pearl_dust,advanced_chip,basic_energy_transmitter,advanced_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:advanced_energy_transmitter",
      "amount": 1
    },
    "ender_pearl_dust,repeater,ender_pearl_dust,basic_chip,basic_battery,basic_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:basic_energy_transmitter",
      "amount": 1
    },
    "ender_pearl_dust,expert_chip,ender_pearl_dust,expert_chip,advanced_energy_transmitter,expert_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:expert_energy_transmitter",
      "amount": 1
    },
    "ender_pearl_dust,ultimate_chip,ender_pearl_dust,ultimate_chip,expert_energy_transmitter,ultimate_chip,ender_pearl_dust,redstone_block,ender_pearl_dust": {
      "output": "utilitycraft:ultimate_energy_transmitter",
      "amount": 1
    },
    "steel_plate,advanced_chip,steel_plate,advanced_chip,basic_wind_turbine,advanced_chip,energized_iron_plate,redstone_block,energized_iron_plate": {
      "output": "utilitycraft:advanced_wind_turbine",
      "amount": 1
    },
    "steel_ingot,basic_chip,steel_ingot,basic_chip,fan,basic_chip,machine_case,redstone_block,machine_case": {
      "output": "utilitycraft:basic_wind_turbine",
      "amount": 1
    },
    "steel_plate,expert_chip,steel_plate,expert_chip,advanced_wind_turbine,expert_chip,diamond_dust,redstone_block,diamond_dust": {
      "output": "utilitycraft:expert_wind_turbine",
      "amount": 1
    },
    "steel_plate,ultimate_chip,steel_plate,ultimate_chip,expert_wind_turbine,ultimate_chip,netherite_plate,redstone_block,netherite_plate": {
      "output": "utilitycraft:ultimate_wind_turbine",
      "amount": 1
    },
    "steel_ingot,iron_ingot,steel_ingot,gold_ingot,redstone_block,gold_ingot,steel_ingot,iron_ingot,steel_ingot": {
      "output": "utilitycraft:machine_case",
      "amount": 1
    },
    "iron_plate,expert_chip,iron_plate,expert_chip,machine_case,expert_chip,steel_plate,crafter,steel_plate": {
      "output": "utilitycraft:assembler",
      "amount": 1
    },
    "redstone,fishing_rod,redstone,basic_chip,machine_case,basic_chip,redstone,steel_block,redstone": {
      "output": "utilitycraft:autofisher",
      "amount": 1
    },
    "redstone,sieve,redstone,chip,machine_case,chip,redstone,gold_block,redstone": {
      "output": "utilitycraft:autosieve",
      "amount": 1
    },
    "redstone,iron_pickaxe,redstone,chip,machine_case,chip,redstone,iron_plate,redstone": {
      "output": "utilitycraft:block_breaker",
      "amount": 1
    },
    "redstone,dropper,redstone,chip,machine_case,chip,redstone,iron_plate,redstone": {
      "output": "utilitycraft:block_placer",
      "amount": 1
    },
    "paper,paper,air,blue_dye,air,air,air,air,air": {
      "output": "utilitycraft:blueprint_paper",
      "amount": 1
    },
    "redstone,iron_hammer,redstone,chip,machine_case,chip,redstone,gold_ingot,redstone": {
      "output": "utilitycraft:crusher",
      "amount": 1
    },
    "iron_plate,expert_chip,iron_plate,expert_chip,machine_case,expert_chip,steel_plate,blueprint_paper,steel_plate": {
      "output": "utilitycraft:digitizer",
      "amount": 1
    },
    "redstone,piston,redstone,chip,machine_case,chip,redstone,compressed_cobblestone,redstone": {
      "output": "utilitycraft:electro_press",
      "amount": 1
    }
  },
  {
    "gold_plate,iron_hoe,gold_plate,advanced_chip,machine_case,advanced_chip,gold_plate,redstone_block,gold_plate": {
      "output": "utilitycraft:harvester",
      "amount": 1
    },
    "gold_plate,blast_furnace,gold_plate,basic_chip,machine_case,basic_chip,gold_plate,redstone_block,gold_plate": {
      "output": "utilitycraft:incinerator",
      "amount": 1
    },
    "gold_plate,anvil,gold_plate,advanced_chip,machine_case,advanced_chip,gold_plate,redstone_block,gold_plate": {
      "output": "utilitycraft:induction_anvil",
      "amount": 1
    },
    "redstone,lapis_lazuli,redstone,basic_chip,machine_case,basic_chip,redstone,redstone_block,redstone": {
      "output": "utilitycraft:infuser",
      "amount": 1
    },
    "gold_plate,copper_plate,gold_plate,advanced_chip,machine_case,advanced_chip,redstone_block,netherite_plate,redstone_block": {
      "output": "utilitycraft:magmatic_chamber",
      "amount": 1
    },
    "gold_plate,amethyst_shard,gold_plate,expert_chip,machine_case,expert_chip,gold_plate,redstone_block,gold_plate": {
      "output": "utilitycraft:seed_synthesizer",
      "amount": 1
    },
    "steel_ingot,steel_ingot,steel_ingot,steel_ingot,barrel,steel_ingot,steel_ingot,flint_and_steel,steel_ingot": {
      "output": "utilitycraft:basic_trash_can",
      "amount": 1
    },
    "ender_eye,echo_shard,ender_eye,expert_chip,machine_case,expert_chip,lapis_block,diamond_dust,lapis_block": {
      "output": "utilitycraft:waycenter",
      "amount": 1
    },
    "steel_plate,emerald_dust,steel_plate,expert_chip,machine_case,expert_chip,emerald_dust,lapis_block,emerald_dust": {
      "output": "utilitycraft:xp_condenser",
      "amount": 1
    },
    "steel_ingot,air,steel_ingot,steel_ingot,dropper,steel_ingot,air,steel_ingot,air": {
      "output": "utilitycraft:mechanic_dropper",
      "amount": 1
    },
    "steel_ingot,air,steel_ingot,steel_ingot,hopper,steel_ingot,air,steel_ingot,air": {
      "output": "utilitycraft:mechanic_hopper",
      "amount": 1
    },
    "air,steel_ingot,air,steel_ingot,hopper,steel_ingot,steel_ingot,air,steel_ingot": {
      "output": "utilitycraft:mechanic_upper",
      "amount": 1
    },
    "crying_obsidian,diamond,crying_obsidian,iron_bars,spawner_core,iron_bars,crying_obsidian,iron_bars,crying_obsidian": {
      "output": "utilitycraft:mechanical_spawner",
      "amount": 1
    },
    "redstone_block,soul_sand,redstone_block,soul_sand,diamond_block,soul_sand,redstone_block,soul_sand,redstone_block": {
      "output": "utilitycraft:spawner_core",
      "amount": 1
    },
    "obsidian,ender_eye,obsidian,obsidian,chest,obsidian,air,obsidian,air": {
      "output": "utilitycraft:ender_hopper",
      "amount": 1
    },
    "iron_ingot,redstone,iron_ingot,steel_ingot,machine_case,steel_ingot,iron_ingot,redstone,iron_ingot": {
      "output": "utilitycraft:fan",
      "amount": 1
    },
    "air,iron_ingot,air,iron_sword,redstone_block,iron_sword,cobblestone,cobblestone,cobblestone": {
      "output": "utilitycraft:mob_grinder",
      "amount": 1
    },
    "experience_bottle,experience_bottle,experience_bottle,experience_bottle,ender_eye,experience_bottle,experience_bottle,experience_bottle,experience_bottle": {
      "output": "utilitycraft:xp_magnet",
      "amount": 1
    },
    "steel_nugget,redstone,steel_nugget,copper_nugget,copper_nugget,copper_nugget,steel_nugget,redstone,steel_nugget": {
      "output": "utilitycraft:energy_cable",
      "amount": 8
    },
    "air,fluid_pipe,air,fluid_pipe,hopper,fluid_pipe,air,fluid_pipe,air": {
      "output": "utilitycraft:fluid_extractor",
      "amount": 1
    },
    "steel_nugget,steel_nugget,steel_nugget,glass,bucket,glass,steel_nugget,steel_nugget,steel_nugget": {
      "output": "utilitycraft:fluid_pipe",
      "amount": 8
    },
    "steel_nugget,steel_nugget,steel_nugget,glass,chest,glass,steel_nugget,steel_nugget,steel_nugget": {
      "output": "utilitycraft:item_conduit",
      "amount": 8
    },
    "air,item_conduit,air,item_conduit,hopper,item_conduit,air,item_conduit,air": {
      "output": "utilitycraft:item_exporter",
      "amount": 1
    },
    "air,item_conduit,air,item_conduit,item_conduit,item_conduit,air,hopper,air": {
      "output": "utilitycraft:item_importer",
      "amount": 1
    },
    "mechanic_upper,air,air,air,air,air,air,air,air": {
      "output": "utilitycraft:mechanic_hopper",
      "amount": 1
    },
    "mechanic_hopper,air,air,air,air,air,air,air,air": {
      "output": "utilitycraft:mechanic_upper",
      "amount": 1
    },
    "energized_iron_ingot,basic_fluid_tank,energized_iron_ingot,basic_fluid_tank,advanced_chip,basic_fluid_tank,energized_iron_ingot,glass,energized_iron_ingot": {
      "output": "utilitycraft:advanced_fluid_tank",
      "amount": 1
    },
    "gold_plate,glass,gold_plate,glass,basic_chip,glass,gold_plate,glass,gold_plate": {
      "output": "utilitycraft:basic_fluid_tank",
      "amount": 1
    },
    "diamond_dust,advanced_fluid_tank,diamond_dust,advanced_fluid_tank,expert_chip,advanced_fluid_tank,diamond_dust,glass,diamond_dust": {
      "output": "utilitycraft:expert_fluid_tank",
      "amount": 1
    },
    "netherite_dust,expert_fluid_tank,netherite_dust,expert_fluid_tank,ultimate_chip,expert_fluid_tank,netherite_dust,glass,netherite_dust": {
      "output": "utilitycraft:ultimate_fluid_tank",
      "amount": 1
    },
    "steel_ingot,iron_bars,steel_ingot,iron_bars,hopper,iron_bars,steel_ingot,iron_bars,steel_ingot": {
      "output": "utilitycraft:xp_drain",
      "amount": 1
    },
    "steel_ingot,lever,air,steel_ingot,dropper,iron_ingot,steel_ingot,air,air": {
      "output": "utilitycraft:xp_spout",
      "amount": 1
    },
    "black_wool,black_wool,black_wool,black_wool,ender_pearl,black_wool,black_wool,black_wool,black_wool": {
      "output": "utilitycraft:black_elevator",
      "amount": 1
    },
    "blue_wool,blue_wool,blue_wool,blue_wool,ender_pearl,blue_wool,blue_wool,blue_wool,blue_wool": {
      "output": "utilitycraft:blue_elevator",
      "amount": 1
    },
    "brown_wool,brown_wool,brown_wool,brown_wool,ender_pearl,brown_wool,brown_wool,brown_wool,brown_wool": {
      "output": "utilitycraft:brown_elevator",
      "amount": 1
    },
    "cyan_wool,cyan_wool,cyan_wool,cyan_wool,ender_pearl,cyan_wool,cyan_wool,cyan_wool,cyan_wool": {
      "output": "utilitycraft:cyan_elevator",
      "amount": 1
    },
    "gray_wool,gray_wool,gray_wool,gray_wool,ender_pearl,gray_wool,gray_wool,gray_wool,gray_wool": {
      "output": "utilitycraft:gray_elevator",
      "amount": 1
    },
    "green_wool,green_wool,green_wool,green_wool,ender_pearl,green_wool,green_wool,green_wool,green_wool": {
      "output": "utilitycraft:green_elevator",
      "amount": 1
    },
    "light_blue_wool,light_blue_wool,light_blue_wool,light_blue_wool,ender_pearl,light_blue_wool,light_blue_wool,light_blue_wool,light_blue_wool": {
      "output": "utilitycraft:light_blue_elevator",
      "amount": 1
    },
    "light_gray_wool,light_gray_wool,light_gray_wool,light_gray_wool,ender_pearl,light_gray_wool,light_gray_wool,light_gray_wool,light_gray_wool": {
      "output": "utilitycraft:light_gray_elevator",
      "amount": 1
    },
    "lime_wool,lime_wool,lime_wool,lime_wool,ender_pearl,lime_wool,lime_wool,lime_wool,lime_wool": {
      "output": "utilitycraft:lime_elevator",
      "amount": 1
    },
    "magenta_wool,magenta_wool,magenta_wool,magenta_wool,ender_pearl,magenta_wool,magenta_wool,magenta_wool,magenta_wool": {
      "output": "utilitycraft:magenta_elevator",
      "amount": 1
    },
    "orange_wool,orange_wool,orange_wool,orange_wool,ender_pearl,orange_wool,orange_wool,orange_wool,orange_wool": {
      "output": "utilitycraft:orange_elevator",
      "amount": 1
    },
    "pink_wool,pink_wool,pink_wool,pink_wool,ender_pearl,pink_wool,pink_wool,pink_wool,pink_wool": {
      "output": "utilitycraft:pink_elevator",
      "amount": 1
    },
    "purple_wool,purple_wool,purple_wool,purple_wool,ender_pearl,purple_wool,purple_wool,purple_wool,purple_wool": {
      "output": "utilitycraft:purple_elevator",
      "amount": 1
    },
    "red_wool,red_wool,red_wool,red_wool,ender_pearl,red_wool,red_wool,red_wool,red_wool": {
      "output": "utilitycraft:red_elevator",
      "amount": 1
    },
    "yellow_wool,yellow_wool,yellow_wool,yellow_wool,ender_pearl,yellow_wool,yellow_wool,yellow_wool,yellow_wool": {
      "output": "utilitycraft:yellow_elevator",
      "amount": 1
    }
  },
  {
    "white_wool,white_wool,white_wool,white_wool,ender_pearl,white_wool,white_wool,white_wool,white_wool": {
      "output": "utilitycraft:elevator",
      "amount": 1
    },
    "copper_ingot,copper_ingot,copper_ingot,copper_ingot,string_fishing_net,copper_ingot,copper_ingot,copper_ingot,copper_ingot": {
      "output": "utilitycraft:copper_fishing_net",
      "amount": 1
    },
    "diamond,diamond,diamond,diamond,emerald_fishing_net,diamond,diamond,diamond,diamond": {
      "output": "utilitycraft:diamond_fishing_net",
      "amount": 1
    },
    "emerald,emerald,emerald,golden_fishing_net,emerald,golden_fishing_net,emerald,emerald,emerald": {
      "output": "utilitycraft:emerald_fishing_net",
      "amount": 1
    },
    "gold_ingot,gold_ingot,gold_ingot,iron_fishing_net,gold_ingot,iron_fishing_net,gold_ingot,gold_ingot,gold_ingot": {
      "output": "utilitycraft:golden_fishing_net",
      "amount": 1
    },
    "iron_ingot,iron_ingot,iron_ingot,copper_fishing_net,iron_ingot,copper_fishing_net,iron_ingot,iron_ingot,iron_ingot": {
      "output": "utilitycraft:iron_fishing_net",
      "amount": 1
    },
    "netherite_ingot,netherite_ingot,netherite_ingot,diamond_fishing_net,netherite_ingot,diamond_fishing_net,netherite_ingot,netherite_ingot,netherite_ingot": {
      "output": "utilitycraft:netherite_fishing_net",
      "amount": 1
    },
    "string,air,string,string,string,string,air,string,air": {
      "output": "utilitycraft:string_fishing_net",
      "amount": 1
    },
    "redstone,energized_iron_ingot,redstone,energized_iron_ingot,basic_chip,energized_iron_ingot,redstone,energized_iron_ingot,redstone": {
      "output": "utilitycraft:advanced_chip",
      "amount": 1
    },
    "redstone,gold_ingot,redstone,gold_ingot,chip,gold_ingot,redstone,gold_ingot,redstone": {
      "output": "utilitycraft:basic_chip",
      "amount": 1
    },
    "air,steel_ingot,air,steel_ingot,redstone,steel_ingot,air,steel_ingot,air": {
      "output": "utilitycraft:chip",
      "amount": 1
    },
    "redstone,diamond,redstone,diamond,advanced_chip,diamond,redstone,diamond,redstone": {
      "output": "utilitycraft:expert_chip",
      "amount": 1
    },
    "redstone,netherite_ingot,redstone,netherite_ingot,expert_chip,netherite_ingot,redstone,netherite_ingot,redstone": {
      "output": "utilitycraft:ultimate_chip",
      "amount": 1
    },
    "steel_ingot,air,air,air,air,air,air,air,air": {
      "output": "utilitycraft:settings",
      "amount": 1
    },
    "steel_ingot,iron_ingot,steel_ingot,redstone,gold_ingot,redstone,steel_ingot,redstone,steel_ingot": {
      "output": "utilitycraft:base_upgrade",
      "amount": 1
    },
    "steel_plate,iron_sword,steel_plate,energized_iron_dust,base_upgrade,energized_iron_dust,steel_plate,redstone_block,steel_plate": {
      "output": "utilitycraft:damage_upgrade",
      "amount": 1
    },
    "steel_plate,diamond_dust,steel_plate,diamond_dust,base_upgrade,diamond_dust,steel_plate,redstone_block,steel_plate": {
      "output": "utilitycraft:energy_upgrade",
      "amount": 1
    },
    "redstone,comparator,redstone,steel_ingot,base_upgrade,steel_ingot,redstone,hopper,redstone": {
      "output": "utilitycraft:filter_upgrade",
      "amount": 1
    },
    "steel_ingot,cyan_dye,steel_ingot,lapis_block,base_upgrade,lapis_block,steel_ingot,spawner_core,steel_ingot": {
      "output": "utilitycraft:quantity_upgrade",
      "amount": 1
    },
    "steel_plate,blue_dye,steel_plate,redstone,base_upgrade,redstone,steel_plate,gold_ingot,steel_plate": {
      "output": "utilitycraft:range_upgrade",
      "amount": 1
    },
    "steel_plate,emerald_dust,steel_plate,redstone_block,base_upgrade,redstone_block,steel_plate,emerald_block,steel_plate": {
      "output": "utilitycraft:speed_upgrade",
      "amount": 1
    },
    "air,ender_eye,air,steel_plate,expert_chip,steel_plate,air,air,air": {
      "output": "utilitycraft:waycarpet",
      "amount": 1
    },
    "lapis_lazuli,ender_pearl_dust,lapis_lazuli,ender_pearl_dust,base_upgrade,ender_pearl_dust,lapis_lazuli,ender_pearl_dust,lapis_lazuli": {
      "output": "utilitycraft:way_chip",
      "amount": 1
    }
  }
];

world.afterEvents.worldLoad.subscribe(() => {
  for (const batch of crafterRecipeBatches) {
    system.sendScriptEvent("utilitycraft:register_crafter_recipe", JSON.stringify(batch));
  }
});

/**
 * ScriptEvent receiver: "utilitycraft:register_crafter_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Crafter recipes.
 * The key must contain exactly 9 comma-separated entries.
 *
 * Expected payload format (JSON):
 * {
 *   "iron_ingot,iron_ingot,iron_ingot,air,redstone,air,iron_ingot,iron_ingot,iron_ingot": {
 *     "output": "utilitycraft:machine_case",
 *     "amount": 1
 *   }
 * }
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
  if (id !== "utilitycraft:register_crafter_recipe") return;

  try {
    const payload = JSON.parse(message);
    if (!payload || typeof payload !== "object") return;

    for (const [pattern, data] of Object.entries(payload)) {
      const slots = pattern.split(",");
      if (slots.length !== 9) {
        console.warn(`[UtilityCraft] Invalid Crafter pattern '${pattern}' (must have 9 slots).`);
        continue;
      }
      if (!data?.output || typeof data.output !== "string") continue;

      crafterRecipes[pattern] = data;
    }
  } catch (err) {
    console.warn("[UtilityCraft] Failed to parse crafter registration payload:", err);
  }
});

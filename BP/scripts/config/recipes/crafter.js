import { system } from "@minecraft/server";

/**
 * @typedef {Object} CrafterRecipe
 * @property {string} output     The resulting item identifier.
 * @property {number} [amount]   The number of items produced (default 1).
 * @property {string[]} [leftover] Optional array of items returned after crafting (e.g. ["minecraft:bucket"]).
 */

/**
 * Crafter recipes for the UtilityCraft Crafter machine.
 *
 * Keys represent a comma-separated list of 9 slots (3×3 grid),
 * ordered left-to-right and top-to-bottom.
 *
 * "air" is used as an empty slot.
 *
 * @example
 * "iron_ingot,iron_ingot,iron_ingot,air,redstone,air,iron_ingot,iron_ingot,iron_ingot"
 *
 * @constant
 * @type {Record<string, CrafterRecipe>}
 */
export const crafterRecipes = {
    "steel_ingot,iron_ingot,steel_ingot,gold_ingot,redstone_block,gold_ingot,steel_ingot,iron_ingot,steel_ingot": {
        output: "utilitycraft:machine_case",
        amount: 1
    },
    // Batteries
    "basic_chip,redstone,basic_chip,redstone,redstone_block,redstone,basic_chip,gold_dust,basic_chip": {
        output: "utilitycraft:basic_battery",
        amount: 1
    },
    "advanced_chip,basic_battery,advanced_chip,basic_battery,redstone_block,basic_battery,advanced_chip,energized_iron_dust,advanced_chip": {
        output: "utilitycraft:advanced_battery",
        amount: 1
    },
    "expert_chip,advanced_battery,expert_chip,advanced_battery,redstone_block,advanced_battery,expert_chip,diamond_dust,expert_chip": {
        output: "utilitycraft:expert_battery",
        amount: 1
    },
    "ultimate_chip,expert_battery,ultimate_chip,expert_battery,redstone_block,expert_battery,ultimate_chip,netherite_dust,ultimate_chip": {
        output: "utilitycraft:ultimate_battery",
        amount: 1
    },
    // Furnators
    "steel_ingot,basic_chip,steel_ingot,basic_chip,blast_furnace,basic_chip,iron_ingot,redstone_block,iron_ingot": {
        output: "utilitycraft:basic_furnator",
        amount: 1
    },
    "steel_plate,advanced_chip,steel_plate,advanced_chip,basic_furnator,advanced_chip,energized_iron_plate,redstone_block,energized_iron_plate": {
        output: "utilitycraft:advanced_furnator",
        amount: 1
    },
    "steel_plate,expert_chip,steel_plate,expert_chip,advanced_furnator,expert_chip,diamond_dust,redstone_block,diamond_dust": {
        output: "utilitycraft:expert_furnator",
        amount: 1
    },
    "steel_plate,ultimate_chip,steel_plate,ultimate_chip,expert_furnator,ultimate_chip,netherite_plate,redstone_block,netherite_plate": {
        output: "utilitycraft:ultimate_furnator",
        amount: 1
    },
    // Magmators
    "gold_plate,basic_fluid_tank,gold_plate,basic_chip,furnace,basic_chip,steel_plate,basic_chip,steel_plate": {
        output: "utilitycraft:basic_magmator",
        amount: 1
    },
    "energized_iron_plate,advanced_fluid_tank,energized_iron_plate,advanced_chip,basic_magmator,advanced_chip,steel_plate,advanced_chip,steel_plate": {
        output: "utilitycraft:advanced_magmator",
        amount: 1
    },
    "diamond_dust,expert_fluid_tank,diamond_dust,expert_chip,advanced_magmator,expert_chip,steel_plate,expert_chip,steel_plate": {
        output: "utilitycraft:expert_magmator",
        amount: 1
    },
    "netherite_plate,ultimate_fluid_tank,netherite_plate,ultimate_chip,expert_magmator,ultimate_chip,netherite_plate,ultimate_chip,netherite_plate": {
        output: "utilitycraft:ultimate_magmator",
        amount: 1
    },
    // Solar Panels
    "steel_ingot,basic_chip,steel_ingot,basic_chip,gold_ingot,basic_chip,gold_ingot,redstone_block,gold_ingot": {
        output: "utilitycraft:basic_solar_panel",
        amount: 1
    },
    "steel_plate,advanced_chip,steel_plate,advanced_chip,basic_solar_panel,advanced_chip,energized_iron_plate,redstone_block,energized_iron_plate": {
        output: "utilitycraft:advanced_solar_panel",
        amount: 1
    },
    "steel_plate,expert_chip,steel_plate,expert_chip,advanced_solar_panel,expert_chip,diamond_dust,redstone_block,diamond_dust": {
        output: "utilitycraft:expert_solar_panel",
        amount: 1
    },
    "steel_plate,ultimate_chip,steel_plate,ultimate_chip,expert_solar_panel,ultimate_chip,netherite_plate,redstone_block,netherite_plate": {
        output: "utilitycraft:ultimate_solar_panel",
        amount: 1
    },
    // Thermo Generator
    "copper_block,copper_plate,copper_block,basic_chip,basic_fluid_tank,basic_chip,gold_plate,copper_block,gold_plate": {
        output: "utilitycraft:basic_thermo_generator",
        amount: 1
    },
    "copper_block,advanced_fluid_tank,copper_block,advanced_chip,basic_thermo_generator,advanced_chip,energized_iron_plate,copper_block,energized_iron_plate": {
        output: "utilitycraft:advanced_thermo_generator",
        amount: 1
    },
    "copper_block,expert_fluid_tank,copper_block,expert_chip,advanced_thermo_generator,expert_chip,diamond_dust,copper_block,diamond_dust": {
        output: "utilitycraft:expert_thermo_generator",
        amount: 1
    },
    "copper_block,ultimate_fluid_tank,copper_block,ultimate_chip,expert_thermo_generator,ultimate_chip,netherite_plate,copper_block,netherite_plate": {
        output: "utilitycraft:ultimate_thermo_generator",
        amount: 1
    },
    // Tanks
    "gold_plate,glass,gold_plate,glass,basic_chip,glass,gold_plate,glass,gold_plate": {
        output: "utilitycraft:basic_fluid_tank",
        amount: 1
    },
    "energized_iron_ingot,basic_fluid_tank,energized_iron_ingot,basic_fluid_tank,advanced_chip,basic_fluid_tank,energized_iron_ingot,glass,energized_iron_ingot": {
        output: "utilitycraft:advanced_fluid_tank",
        amount: 1
    },
    "diamond_dust,advanced_fluid_tank,diamond_dust,advanced_fluid_tank,expert_chip,advanced_fluid_tank,diamond_dust,glass,diamond_dust": {
        output: "utilitycraft:expert_fluid_tank",
        amount: 1
    },
    "netherite_dust,expert_fluid_tank,netherite_dust,expert_fluid_tank,ultimate_chip,expert_fluid_tank,netherite_dust,glass,netherite_dust": {
        output: "utilitycraft:ultimate_fluid_tank",
        amount: 1
    },
    "steel_ingot,iron_bars,hopper,steel_ingot,iron_bars,hopper": {
        output: "utilitycraft:xp_drain",
        amount: 1
    },
    "steel_ingot,dropper,lever,iron_ingot,steel_ingot,dropper,lever,iron_ingot": {
        output: "utilitycraft:xp_spout",
        amount: 1
    },
    // Machines
    "iron_plate,expert_chip,iron_plate,expert_chip,machine_case,expert_chip,steel_plate,crafter,steel_plate": {
        output: "utilitycraft:assembler",
        amount: 1
    },
    "redstone,sieve,redstone,chip,machine_case,chip,redstone,gold_block,redstone": {
        output: "utilitycraft:autosieve",
        amount: 1
    },
    "redstone,iron_pickaxe,redstone,chip,machine_case,chip,redstone,iron_plate,redstone": {
        output: "utilitycraft:block_breaker",
        amount: 1
    },
    "redstone,dropper,redstone,chip,machine_case,chip,redstone,iron_plate,redstone": {
        output: "utilitycraft:block_placer",
        amount: 1
    },
    "redstone,iron_hammer,redstone,chip,machine_case,chip,redstone,gold_ingot,redstone": {
        output: "utilitycraft:crusher",
        amount: 1
    },
    "iron_plate,expert_chip,iron_plate,expert_chip,machine_case,expert_chip,steel_plate,blueprint_paper,steel_plate": {
        output: "utilitycraft:digitizer",
        amount: 1
    },
    "redstone,piston,redstone,chip,machine_case,chip,redstone,compressed_cobblestone,redstone": {
        output: "utilitycraft:electro_press",
        amount: 1
    },
    "gold_plate,iron_hoe,gold_plate,advanced_chip,machine_case,advanced_chip,gold_plate,redstone_block,gold_plate": {
        output: "utilitycraft:harvester",
        amount: 1
    },
    "gold_plate,blast_furnace,gold_plate,basic_chip,machine_case,basic_chip,gold_plate,redstone_block,gold_plate": {
        output: "utilitycraft:incinerator",
        amount: 1
    },
    "gold_plate,anvil,gold_plate,advanced_chip,machine_case,advanced_chip,gold_plate,redstone_block,gold_plate": {
        output: "utilitycraft:induction_anvil",
        amount: 1
    },
    "redstone,lapis_lazuli,redstone,basic_chip,machine_case,basic_chip,redstone,redstone_block,redstone": {
        output: "utilitycraft:infuser",
        amount: 1
    },
    "gold_plate,copper_plate,gold_plate,advanced_chip,machine_case,advanced_chip,redstone_block,netherite_plate,redstone_block": {
        output: "utilitycraft:magmatic_chamber",
        amount: 1
    },
    "gold_plate,amethyst_shard,gold_plate,expert_chip,machine_case,expert_chip,gold_plate,redstone_block,gold_plate": {
        output: "utilitycraft:seed_synthesizer",
        amount: 1
    },
    "ender_eye,echo_shard,ender_eye,expert_chip,machine_case,expert_chip,lapis_block,diamond_dust,lapis_block": {
        output: "utilitycraft:waycenter",
        amount: 1
    },
    "steel_plate,emerald_dust,steel_plate,expert_chip,machine_case,expert_chip,steel_plate,lapis_block,steel_plate": {
        output: "utilitycraft:xp_condenser",
        amount: 1
    },
    // Item Transport
    "redstone,asphalt,redstone,air,air,air,air,air,air": {
        output: "utilitycraft:conveyor_horizontal",
        amount: 4
    },
    "air,air,redstone,air,asphalt,air,redstone,air,air": {
        output: "utilitycraft:conveyor_inclined",
        amount: 4
    },
    "steel_ingot,air,steel_ingot,steel_ingot,dropper,steel_ingot,air,steel_ingot,air": {
        output: "utilitycraft:mechanic_dropper",
        amount: 1
    },
    "steel_ingot,air,steel_ingot,steel_ingot,hopper,steel_ingot,air,steel_ingot,air": {
        output: "utilitycraft:mechanic_hopper",
        amount: 1
    },
    "mechanic_upper,air,air,air,air,air,air,air,air": {
        output: "utilitycraft:mechanic_hopper",
        amount: 1
    },
    "mechanic_hopper,air,air,air,air,air,air,air,air": {
        output: "utilitycraft:mechanic_upper",
        amount: 1
    },
    "steel_nugget,steel_nugget,steel_nugget,glass,chest,glass,steel_nugget,steel_nugget,steel_nugget": {
        output: "utilitycraft:item_conduit",
        amount: 8
    },
    "air,item_conduit,air,item_conduit,hopper,item_conduit,air,item_conduit,air": {
        output: "utilitycraft:item_exporter",
        amount: 1
    },
    // Cables
    "air,fluid_pipe,air,fluid_pipe,hopper,fluid_pipe,air,fluid_pipe,air": {
        output: "utilitycraft:fluid_extractor",
        amount: 1
    },
    "steel_nugget,steel_nugget,steel_nugget,glass,bucket,glass,steel_nugget,steel_nugget,steel_nugget": {
        output: "utilitycraft:fluid_pipe",
        amount: 8
    },
    "gold_ingot,hopper,gold_ingot,glass,dispenser,glass,steel_ingot,gold_ingot,steel_ingot": {
        output: "utilitycraft:fluid_pump",
        amount: 1
    },
    "steel_nugget,redstone,steel_nugget,copper_nugget,copper_nugget,copper_nugget,steel_nugget,redstone,steel_nugget": {
        output: "utilitycraft:energy_cable",
        amount: 8
    },
    // Upgrades
    "steel_ingot,iron_ingot,steel_ingot,redstone,gold_ingot,redstone,steel_ingot,redstone,steel_ingot": {
        output: "utilitycraft:base_upgrade",
        amount: 1
    },
    "redstone,comparator,redstone,steel_ingot,base_upgrade,steel_ingot,redstone,hopper,redstone": {
        output: "utilitycraft:filter_upgrade",
        amount: 1
    },
    "steel_plate,diamond_dust,steel_plate,diamond_dust,base_upgrade,diamond_dust,steel_plate,redstone_block,steel_plate": {
        output: "utilitycraft:energy_upgrade",
        amount: 1
    },
    "steel_ingot,cyan_dye,steel_ingot,lapis_block,base_upgrade,lapis_block,steel_ingot,spawner_core,steel_ingot": {
        output: "utilitycraft:quantity_upgrade",
        amount: 1
    },
    "steel_plate,blue_dye,steel_plate,redstone,base_upgrade,redstone,steel_plate,gold_ingot,steel_plate": {
        output: "utilitycraft:range_upgrade",
        amount: 1
    },
    "steel_plate,emerald_dust,steel_plate,redstone_block,base_upgrade,redstone_block,steel_plate,emerald_block,steel_plate": {
        output: "utilitycraft:speed_upgrade",
        amount: 1
    },
    "steel_plate,iron_sword,steel_plate,energized_iron_dust,base_upgrade,energized_iron_dust,steel_plate,redstone_block,steel_plate": {
        output: "utilitycraft:damage_upgrade",
        amount: 1
    },
    // Other Stuff
    "air,ender_eye,air,steel_plate,expert_chip,steel_plate,air,air,air": {
        output: "utilitycraft:waycarpet",
        amount: 1
    },
    "lapis_lazuli,ender_pearl_dust,lapis_lazuli,ender_pearl_dust,base_upgrade,ender_pearl_dust,lapis_lazuli,ender_pearl_dust,lapis_lazuli": {
        output: "utilitycraft:way_chip",
        amount: 1
    },
    "lapis_lazuli,soul_soil,lapis_lazuli,soul_sand,glass_bottle,soul_sand,lapis_lazuli,soul_soil,lapis_lazuli": {
        output: "utilitycraft:essence_vessel",
        amount: 1
    },
    "crying_obsidian,diamond,crying_obsidian,iron_bars,spawner_core,iron_bars,crying_obsidian,iron_bars,crying_obsidian": {
        output: "utilitycraft:mechanical_spawner",
        amount: 1
    },
    "redstone_block,soul_sand,redstone_block,soul_sand,diamond_block,soul_sand,redstone_block,soul_sand,redstone_block": {
        output: "utilitycraft:spawner_core",
        amount: 1
    },
    "obsidian,ender_eye,obsidian,obsidian,chest,obsidian,air,obsidian,": {
        output: "utilitycraft:ender_hopper",
        amount: 1
    },
    "iron_ingot,redstone,iron_ingot,steel_ingot,machine_case,steel_ingot,iron_ingot,redstone,iron_ingot": {
        output: "utilitycraft:fan",
        amount: 1
    },
    "air,iron_ingot,air,iron_sword,redstone_block,iron_sword,cobblestone,cobblestone,cobblestone": {
        output: "utilitycraft:mob_grinder",
        amount: 1
    },
    "experience_bottle,experience_bottle,experience_bottle,experience_bottle,ender_eye,experience_bottle,experience_bottle,experience_bottle,experience_bottle": {
        output: "utilitycraft:xp_magnet",
        amount: 1
    },
    // Utility Table
    "diamond,diamond_sword,diamond,string,diamond_paxel,diamond_hoe,stick,string,diamond": {
        output: "utilitycraft:diamond_aiot",
        amount: 1
    },
    "gold_ingot,golden_sword,gold_ingot,string,golden_paxel,golden_hoe,stick,string,gold_ingot": {
        output: "utilitycraft:golden_aiot",
        amount: 1
    },
    "iron_ingot,iron_sword,iron_ingot,string,iron_paxel,iron_hoe,stick,string,iron_ingot": {
        output: "utilitycraft:iron_aiot",
        amount: 1
    },
    "cobblestone,stone_sword,cobblestone,string,stone_paxel,stone_hoe,stick,string,cobblestone": {
        output: "utilitycraft:stone_aiot",
        amount: 1
    },
    "air,iron_ingot,iron_block,repeater,amethyst_block,iron_ingot,redstone_block,repeater,air": {
        output: "utilitycraft:drill",
        amount: 1
    },
    "air,diamond,diamond_block,repeater,drill,diamond,redstone_block,repeater,air": {
        output: "utilitycraft:heavy_drill",
        amount: 1
    },
    "cobblestone,stone,cobblestone,cobblestone,stick,cobblestone,air,stick,air": {
        output: "utilitycraft:stone_hammer",
        amount: 1
    },
    "iron_ingot,iron_block,iron_ingot,iron_ingot,stick,iron_ingot,air,stick,air": {
        output: "utilitycraft:iron_hammer",
        amount: 1
    },
    "diamond,diamond_block,diamond,diamond,stick,diamond,air,stick,air": {
        output: "utilitycraft:diamond_hammer",
        amount: 1
    }
}

/**
 * ScriptEvent receiver: "utilitycraft:register_crafter_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Crafter recipes.
 * The key must contain exactly 9 comma-separated entries.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "iron_ingot,iron_ingot,iron_ingot,air,redstone,air,iron_ingot,iron_ingot,iron_ingot": {
 *     "output": "utilitycraft:machine_case",
 *     "amount": 1
 *   },
 *   "bucket,iron_ingot,bucket,iron_ingot,blast_furnace,iron_ingot,bucket,iron_ingot,bucket": {
 *     "output": "utilitycraft:molten_core",
 *     "amount": 1,
 *     "leftover": ["minecraft:bucket"]
 *   }
 * }
 * ```
 *
 * Behavior:
 * - Automatically adds new recipes if missing.
 * - Replaces existing ones when keys match.
 * - Supports optional `amount` and `leftover` properties.
 * - Only a summary log is printed after completion.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_crafter_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [pattern, data] of Object.entries(payload)) {
            const slots = pattern.split(",");
            if (slots.length !== 9) {
                console.warn(`[UtilityCraft] Invalid Crafter pattern '${pattern}' (must have 9 slots).`);
                continue;
            }
            if (!data.output || typeof data.output !== "string") continue;

            if (crafterRecipes[pattern]) {
                replaced++;
            } else {
                added++;
            }

            crafterRecipes[pattern] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse crafter registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Crafter recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace Crafter recipes dynamically
    const newRecipes = {
        // Normal shaped recipe (3x3)
        "iron_ingot,iron_ingot,iron_ingot,air,redstone,air,iron_ingot,iron_ingot,iron_ingot": {
            output: "utilitycraft:machine_case",
            amount: 1
        },
        // Recipe with leftover bucket
        "bucket,iron_ingot,bucket,iron_ingot,blast_furnace,iron_ingot,bucket,iron_ingot,bucket": {
            output: "utilitycraft:molten_core",
            amount: 1,
            leftover: ["minecraft:bucket"]
        },
        // Replace existing
        "steel_ingot,iron_ingot,steel_ingot,gold_ingot,redstone_block,gold_ingot,steel_ingot,iron_ingot,steel_ingot": {
            output: "utilitycraft:machine_case_v2",
            amount: 2
        }
    };

    // Send the event to the Crafter script
    system.sendScriptEvent("utilitycraft:register_crafter_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom Crafter recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_crafter_recipe {"iron_ingot,iron_ingot,iron_ingot,air,redstone,air,iron_ingot,iron_ingot,iron_ingot":{"output":"utilitycraft:machine_case","amount":1},"bucket,iron_ingot,bucket,iron_ingot,blast_furnace,iron_ingot,bucket,iron_ingot,bucket":{"output":"utilitycraft:molten_core","amount":1,"leftover":["minecraft:bucket"]}}
*/
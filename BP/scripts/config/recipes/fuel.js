import { system } from "@minecraft/server";

/**
 * Represents a solid fuel entry for the Furnator.
 *
 * @typedef {Object} SolidFuel
 * @property {string} id  The item identifier or keyword (e.g. "coal", "plank").
 * @property {number} de  Dorios Energy (DE) produced when consumed.
 */

/**
 * Solid fuels used by the Furnator generator.
 * Each entry defines the item ID (or pattern) and the energy produced (in DE).
 *
 * @constant
 * @type {SolidFuel[]}
 */
export const solidFuels = [
    { id: "compressed_charcoal_block_2", de: 8000000 },
    { id: "compressed_charcoal_block_3", de: 80000000 },
    { id: "compressed_charcoal_block_4", de: 800000000 },
    { id: "compressed_charcoal_block", de: 800000 },
    { id: "charcoal_block", de: 80000 },
    { id: "charcoal", de: 8000 },
    { id: "compressed_coal_block_3", de: 80000000 },
    { id: "compressed_coal_block_2", de: 8000000 },
    { id: "compressed_coal_block_4", de: 800000000 },
    { id: "compressed_coal_block", de: 800000 },
    { id: "coal_block", de: 80000 },
    { id: "coal", de: 8000 },
    { id: "plank", de: 1500 },
    { id: "stair", de: 1500 },
    { id: "fence", de: 1500 },
    { id: "stick", de: 500 },
    { id: "door", de: 1000 },
    { id: "ladder", de: 750 },
    { id: "scaffolding", de: 250 },
    { id: "log", de: 1500 },
    { id: "_wood", de: 1500 },
    { id: "stem", de: 1500 },
    { id: "hyphae", de: 1500 },
    { id: "sapling", de: 500 },
    { id: "dried_kelp_block", de: 20000 },
    { id: "lava_ball", de: 100000 },
    { id: "bundle_of_blaze_rods", de: 108000 },
    { id: "blaze_rod", de: 12000 },
    { id: "boat", de: 6000 },
    { id: "button", de: 500 },
    { id: "wooden", de: 1000 },
    { id: "banner", de: 1500 },
    { id: "chest", de: 3000 },
    { id: "leaves", de: 500 }
];

/**
 * ScriptEvent receiver: "utilitycraft:register_fuel"
 *
 * Allows other addons or scripts to dynamically add or replace solid fuels.
 * If a fuel with the same ID already exists, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "custom_fuel_1": 50000,
 *   "minecraft:apple": 1000
 * }
 * ```
 *
 * Behavior:
 * - New fuels are added automatically if missing.
 * - Existing fuels are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_fuel") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [fuelId, de] of Object.entries(payload)) {
            if (typeof de !== "number") continue;

            const existing = solidFuels.find(f => f.id === fuelId);
            if (existing) {
                existing.de = de;
                replaced++;
            } else {
                solidFuels.push({ id: fuelId, de });
                added++;
            }
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse fuel registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Furnator fuels
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace solid fuels dynamically
    const newFuels = {
        "utilitycraft:bio_fuel": 12000,
        "minecraft:bamboo_block": 4000,
        // This one replaces an existing entry
        "minecraft:coal": 10000
    };

    // Send the event to the Furnator script
    system.sendScriptEvent("utilitycraft:register_fuel", JSON.stringify(newFuels));

    console.warn("[Addon] Custom Furnator fuels registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_fuel {"utilitycraft:bio_fuel":12000,"minecraft:coal":10000}
*/

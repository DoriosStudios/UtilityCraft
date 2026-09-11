import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

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
export const solidFuels = [];

// Defaults use the same registration event as addon-provided fuels.
DoriosLib.registry.registerFuel({
    "compressed_charcoal_block_4": 800000000,
    "compressed_coal_block_4": 800000000,
    "compressed_charcoal_block_3": 80000000,
    "compressed_coal_block_3": 80000000,
    "compressed_charcoal_block_2": 8000000,
    "compressed_coal_block_2": 8000000,
    "compressed_charcoal_block": 800000,
    "compressed_coal_block": 800000,
    "utilitycraft:compressed_*_wood_4": 15000000,
    "utilitycraft:compressed_*_wood_3": 1500000,
    "utilitycraft:compressed_*_wood_2": 150000,
    "utilitycraft:compressed_*_wood": 15000,
    "bundle_of_blaze_rods": 108000,
    "lava_ball": 100000,
    "charcoal_block": 80000,
    "coal_block": 80000,
    "dried_kelp_block": 20000,
    "blaze_rod": 12000,
    "coal": 8000,
    "charcoal": 8000,
    "boat": 6000,
    "chest": 3000,
    "plank": 1500,
    "stair": 1500,
    "fence": 1500,
    "log": 1500,
    "_wood": 1500,
    "stem": 1500,
    "hyphae": 1500,
    "banner": 1500,
    "wooden": 1000,
    "_door": 1000,
    "ladder": 750,
    "stick": 500,
    "sapling": 500,
    "button": 500,
    "leaves": 500,
    "scaffolding": 250,
});

/**
 * ScriptEvent receiver: "utilitycraft:register_fuel"
 *
 * Allows other addons or scripts to dynamically add or replace solid fuels.
 * Queue the object with `DoriosLib.registry.registerFuel(payload)`.
 * If a fuel with the same ID already exists, it will be replaced.
 *
 * Registration object shape:
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
import * as DoriosLib from "DoriosLib/index.js";

// Add or replace solid fuels through DoriosLib's world-load queue.
const newFuels = {
    "utilitycraft:bio_fuel": 12000,
    "minecraft:bamboo_block": 4000,
    // This one replaces an existing entry
    "minecraft:coal": 10000
};

DoriosLib.registry.registerFuel(newFuels);
*/

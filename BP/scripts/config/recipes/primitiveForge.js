import { furnaceRecipes } from "./furnace.js";

/**
 * Primitive Forge combinations, keyed by first input|second input.
 * required, secondary_required and amount default to 1.
 * Register both orders explicitly when a combination should be reversible.
 */
export const primitiveForgeRecipes = {
    "utilitycraft:iron_dust|minecraft:coal": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "minecraft:coal|utilitycraft:iron_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "utilitycraft:iron_dust|minecraft:charcoal": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "minecraft:charcoal|utilitycraft:iron_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "utilitycraft:iron_dust|utilitycraft:coal_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "utilitycraft:coal_dust|utilitycraft:iron_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "utilitycraft:iron_dust|utilitycraft:charcoal_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
    "utilitycraft:charcoal_dust|utilitycraft:iron_dust": { output: "utilitycraft:raw_steel", secondary_required: 1 },
};

Object.assign(furnaceRecipes, primitiveForgeRecipes);

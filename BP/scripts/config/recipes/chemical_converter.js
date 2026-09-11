import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export const chemicalConverterRecipes = {};

const defaultRecipes = {
    "utilitycraft:charcoal_dust|empty|hydrogen_gas": {
        "required_items": 1,
        "required_gas": 1000,
        "output_gas": {
            "type": "methane_gas",
            "amount": 1000
        },
        "cost": 256000
    }
};
DoriosLib.registry.registerChemicalConverterRecipe(defaultRecipes);

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_chemical_converter_recipe") return;
    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
        for (const [key, recipe] of Object.entries(payload)) {
            if (!recipe || typeof recipe !== "object" || !(recipe.cost > 0)) continue;
            chemicalConverterRecipes[key] = recipe;
        }
    } catch (error) {
        console.warn("[UtilityCraft] Invalid chemical_converter recipe registration:", error);
    }
});

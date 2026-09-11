import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export const electrolyzerRecipes = {};

const defaultRecipes = {
    "water|empty": {
        "required_liquid": 1000,
        "output1": {
            "type": "hydrogen_gas",
            "amount": 1000
        },
        "output2": {
            "type": "oxygen_gas",
            "amount": 500
        },
        "cost": 512000
    }
};
DoriosLib.registry.registerElectrolyzerRecipe(defaultRecipes);

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_electrolyzer_recipe") return;
    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
        for (const [key, recipe] of Object.entries(payload)) {
            if (!recipe || typeof recipe !== "object" || !(recipe.cost > 0)) continue;
            electrolyzerRecipes[key] = recipe;
        }
    } catch (error) {
        console.warn("[UtilityCraft] Invalid electrolyzer recipe registration:", error);
    }
});

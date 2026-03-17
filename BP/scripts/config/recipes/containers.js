import { system } from "@minecraft/server";

/**
 * Import some vanilla containers.
 * 
*/

system.beforeEvents.startup.subscribe(() => {
    system.run(() => {
        system.sendScriptEvent(
            "utilitycraft:register_special_container_slots",
            JSON.stringify({
                "minecraft:furnace": {
                    "Input Slot": 0,
                    "Fuel Slot": 1
                },
                "minecraft:blast_furnace": {
                    "Input Slot": 0,
                    "Fuel Slot": 1
                },
                "minecraft:smoker": {
                    "Input Slot": 0,
                    "Fuel Slot": 1
                },
                "minecraft:brewing_stand": {
                    "Ingredient Slot": 0,
                    "Potion Slots": [1, 2, 3],
                    "Blaze Powder Slot": 4
                }
            })
        );
    });
});
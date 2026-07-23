import * as DoriosLib from "DoriosLib/index.js";

/**
 * Queues slot definitions for supported vanilla containers. DoriosLib waits
 * for world load and dispatches the registration through its shared queue.
 */
DoriosLib.registry.registerSpecialContainerSlots({
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
});

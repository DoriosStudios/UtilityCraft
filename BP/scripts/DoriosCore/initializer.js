import { ItemStack, system, world } from "@minecraft/server";
import * as ButtonConstants from "./buttons/constants.js";
import { loadButtonItemStack } from "./buttons/index.js";
import { scriptEventHandler } from "./scriptEvents.js";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./machinery/energyStorage.js";
import { FluidStorage } from "./machinery/fluidStorage.js";

globalThis[Constants.GLOBAL_WORLD_LOADED_KEY] = false;
globalThis[Constants.GLOBAL_TICK_COUNT_KEY] = 0;
globalThis[Constants.GLOBAL_TICK_SPEED_KEY] = Constants.DEFAULT_TICK_SPEED;

system.runInterval(() => {
    globalThis[Constants.GLOBAL_TICK_COUNT_KEY] += 2;
    if (globalThis[Constants.GLOBAL_TICK_COUNT_KEY] === 1000) {
        globalThis[Constants.GLOBAL_TICK_COUNT_KEY] = 0;
    }
}, 2);

/**
 * Initializes global scoreboard objectives and core runtime
 * configuration once the world has fully loaded.
 *
 * Responsibilities:
 * - Ensure energy-related objectives exist.
 * - Mark the world as loaded.
 * - Initialize global tick speed from dynamic property.
 *
 * This runs exactly once per world session.
 */
world.afterEvents.worldLoad.subscribe(() => {

    // Initialize energy system scoreboard objectives
    EnergyStorage.initializeObjectives();

    // Initialize fluid objectives
    FluidStorage.initializeObjectives();

    // Mark world as ready
    if (world.getDimension("overworld").getEntities()[0]) {
        globalThis[Constants.GLOBAL_WORLD_LOADED_KEY] = true;
    }

    // Load configurable tick speed
    const configuredTickSpeed =
        world.getDynamicProperty(Constants.TICK_SPEED_PROPERTY_ID)
        ?? Constants.DEFAULT_TICK_SPEED;

    globalThis[Constants.GLOBAL_TICK_SPEED_KEY] = configuredTickSpeed;

    loadButtonItemStack(ButtonConstants.DEFAULT_BUTTON_ITEM_ID, ItemStack);
});

// --- Al primer spawn del jugador ---
world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
        globalThis[Constants.GLOBAL_WORLD_LOADED_KEY] = true;
    }, 50);
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
    const event = scriptEventHandler[e.id];
    if (event) event(e);
});

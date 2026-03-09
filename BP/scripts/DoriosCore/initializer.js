import { system, world } from "@minecraft/server";
import { Energy } from "./machinery/energyManager.js"
import { FluidManager } from "./machinery/fluidManager.js"
import * as Constants from "./constants";

globalThis.worldLoaded = false;
globalThis.tickCount = 0;
globalThis.tickSpeed = 10;

system.runInterval(() => {
    globalThis.tickCount += 2;
    if (globalThis.tickCount == 1000) globalThis.tickCount = 0;
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
    Energy.initializeObjectives()

    // Initialize fluid objectives
    FluidManager.initializeObjectives()

    // Mark world as ready
    if (world.getDimension("overworld").getEntities()[0]) {
        worldLoaded = true;
    }

    // Load configurable tick speed
    const configuredTickSpeed =
        world.getDynamicProperty("utilitycraft:tickSpeed")
        ?? Constants.DEFAULT_TICK_SPEED;

    globalThis.tickSpeed = configuredTickSpeed;
});

// --- Al primer spawn del jugador ---
world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
        worldLoaded = true;
    }, 50);
});
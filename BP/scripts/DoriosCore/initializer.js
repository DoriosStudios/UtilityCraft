import { ItemStack, system, world } from "@minecraft/server";
import { scriptEventHandler } from "./scriptEvents.js";
import { EnergyStorage } from "./machinery/energyStorage.js"
import { FluidStorage } from "./machinery/fluidStorage.js"
import * as Constants from "./constants";
import { loadButtonItemStack } from "./buttons/index.js";

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
    EnergyStorage.initializeObjectives()

    // Initialize fluid objectives
    FluidStorage.initializeObjectives()

    // Mark world as ready
    if (world.getDimension("overworld").getEntities()[0]) {
        worldLoaded = true;
    }

    // Load configurable tick speed
    const configuredTickSpeed =
        world.getDynamicProperty("utilitycraft:tickSpeed")
        ?? Constants.DEFAULT_TICK_SPEED;

    globalThis.tickSpeed = configuredTickSpeed;

    loadButtonItemStack("utilitycraft:ui_filler", ItemStack);
});

// --- Al primer spawn del jugador ---
world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
        worldLoaded = true;
    }, 50);
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
    const event = scriptEventHandler[e.id]
    if (event) event(e)
});

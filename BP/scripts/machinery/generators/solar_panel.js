import { world } from '@minecraft/server'
import { Generator, Energy } from '../DoriosMachinery/core.js'

DoriosAPI.register.blockComponent('solar_panel', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings);
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;
        const { block } = e;
        const generator = new Generator(block, settings);
        if (!generator.valid) return

        const { energy, rate } = generator
        generator.energy.transferToNetwork(rate * 4)

        const time = world.getTimeOfDay()
        const adjusted = (time + 1000) % 24000  // mover día real a rango 0–14000
        const isDay = adjusted >= 0 && adjusted <= 14000

        let efficiency = 0
        if (isDay) {
            efficiency = 1 - Math.pow((adjusted - 7000) / 7000, 2)
            efficiency = Math.max(0, efficiency)
        }


        if (!isDay) {
            generator.off();
            generator.displayEnergy();
            generator.setLabel(`
§r§eInactive

§r§eInformation
 §r§eTime: §f${getTime12h(time)}
 §r§aEfficiency §f${Math.floor(efficiency * 100)}%% 

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${Energy.formatEnergyToText(generator.baseRate * efficiency)}/t
                    `)
            return
        }

        if (energy.get() >= energy.cap) {
            generator.off()
            generator.displayEnergy();
            generator.setLabel(`
§r§eEnergy Full

§r§eInformation
 §r§eTime: §f${getTime12h(time)}
 §r§aEfficiency §f${Math.floor(efficiency * 100)}%% 

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${Energy.formatEnergyToText(generator.baseRate * efficiency)}/t
                    `)
            return
        }


        let burnSpeed = Math.min(rate * efficiency, energy.cap - energy.get())
        energy.add(burnSpeed)

        // Update visuals
        generator.on();
        generator.displayEnergy();
        generator.setLabel(`
§r§aRunning

§r§eInformation
 §r§eTime: §f${getTime12h(time)}
 §r§aEfficiency §f${Math.floor(efficiency * 100)}%% 

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${Energy.formatEnergyToText(generator.baseRate * efficiency)}/t
                    `)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

/**
 * Converts Minecraft time (0–24000 ticks) into a 12-hour clock format with AM/PM.
 *
 * In Minecraft:
 * - 0 ticks  → 6:00 AM
 * - 6000     → 12:00 PM (noon)
 * - 12000    → 6:00 PM
 * - 18000    → 12:00 AM (midnight)
 * - 24000    → 6:00 AM (next day)
 *
 * @param {number} ticks Minecraft time from world.getTimeOfDay() (0–24000)
 * @returns {string} Formatted time string (e.g., "3:45 PM")
 */
function getTime12h(ticks) {
    // Shift the time so 0 ticks corresponds to 6:00 AM
    const totalTicks = (ticks + 6000) % 24000;

    // Each 1000 ticks = 1 hour; 1000 / 60 = 16.67 ticks per minute
    const hours = Math.floor(totalTicks / 1000);
    const minutes = Math.floor((totalTicks % 1000) * 60 / 1000);

    // Convert to 12-hour format
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    const period = hours < 12 ? "AM" : "PM";

    return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

import { Generator, EnergyStorage, FluidStorage } from "DoriosCore/machinery/index.js"
import { ButtonManager } from "DoriosCore/buttons/index.js"

const ENERGY_PER_LAVA_MB = 100

const MAGMATOR_MACHINE_ID = "magmator"
const MAGMATOR_BUTTON_SLOT = 3

ButtonManager.registerMachineButton(MAGMATOR_MACHINE_ID, MAGMATOR_BUTTON_SLOT, (event) => {
    const { entity, block, container, slot } = event

    const state = entity.getDynamicProperty("active") ?? true
    entity.setDynamicProperty("active", !state)
})

DoriosAPI.register.blockComponent(MAGMATOR_MACHINE_ID, {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnEntity(e, settings, (entity) => {
            entity.setItem(1, 'utilitycraft:progress_right_big_bar_00', 1, " ")
        });
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const generator = new Generator(e.block, settings);
        if (!generator.valid) return
        const { entity, energy, rate } = generator
        ButtonManager.ensureWatching(entity, MAGMATOR_MACHINE_ID)
        energy.transferToNetwork(rate * 4)

        /** @type {FluidStorage} */
        const fluid = FluidStorage.initializeSingle(entity);

        const state = entity.getDynamicProperty("active") ?? true
        if (!state) {
            generator.displayEnergy();
            fluid.display(2)
            generator.off();
            generator.setLabel(`
§r§eOff

§r§eFuel Information
 §eTime: §f---
 §eValue: §f---

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
            return
        }

        if (fluid.type == 'empty') {
            generator.displayEnergy();
            fluid.display(2)
            generator.off();
            generator.setLabel(`
§r§eNo Fuel

§r§eFuel Information
 §eTime: §f---
 §eValue: §f---

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
            return
        }

        if (fluid.type != 'lava') {
            generator.displayEnergy();
            fluid.display(2)
            generator.off();
            generator.setLabel(`
§r§eInvalid Fuel

§r§eFuel Information
 §eTime: §f---
 §eValue: §f---

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
            return
        }

        // If generator has space for energy
        if (energy.getFreeSpace() <= 0) {
            generator.displayEnergy();
            fluid.display(2)
            generator.off();
            generator.setLabel(`
§r§eEnergy Full

§r§eFuel Information
 §eTime: §f${DoriosAPI.utils.formatTime((fluid.get() / (rate / 50)) / 10)}
 §eValue: §f${EnergyStorage.formatEnergyToText(fluid.get() * ENERGY_PER_LAVA_MB)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
            return
        }

        let burnSpeed = Math.min(
            generator.rate,
            energy.getFreeSpace(),
            fluid.get() * ENERGY_PER_LAVA_MB
        )

        fluid.consume(burnSpeed / 100)
        energy.add(burnSpeed)

        // Update visuals
        generator.on();
        generator.displayEnergy();
        fluid.display(2)
        generator.setLabel(`
§r§aRunning

§r§eFuel Information
 §eTime: §f${DoriosAPI.utils.formatTime((fluid.get() / (rate / 50)) / 10)}
 §eValue: §f${EnergyStorage.formatEnergyToText(fluid.get() * ENERGY_PER_LAVA_MB)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

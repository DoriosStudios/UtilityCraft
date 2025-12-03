import { Generator, Energy, FluidManager } from '../DoriosMachinery/core.js'

const ENERGY_PER_LAVA_MB = 100

DoriosAPI.register.blockComponent('magmator', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings, (entity) => {
            entity.setItem(1, 'utilitycraft:arrow_right_0', 1, "")
        });
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
        const { entity, energy, rate } = generator
        generator.energy.transferToNetwork(rate * 4)

        /** @type {FluidManager} */
        const fluid = FluidManager.initializeSingle(entity);

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
§r§cRate ${Energy.formatEnergyToText(generator.baseRate)}/t
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
§r§cRate ${Energy.formatEnergyToText(generator.baseRate)}/t
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
 §eValue: §f${Energy.formatEnergyToText(fluid.get() * ENERGY_PER_LAVA_MB)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${Energy.formatEnergyToText(generator.baseRate)}/t
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
 §eValue: §f${Energy.formatEnergyToText(fluid.get() * ENERGY_PER_LAVA_MB)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${Energy.formatEnergyToText(generator.baseRate)}/t
                    `)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

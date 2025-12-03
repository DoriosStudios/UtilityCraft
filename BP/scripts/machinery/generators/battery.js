import { world } from '@minecraft/server'
import { Generator, Energy } from '../DoriosMachinery/core.js'

const entitySettings = {
    name: "battery",
    type: "battery"
}

DoriosAPI.register.blockComponent('battery', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params }) {
        const settings = {
            entity: entitySettings,
            generator: params
        }
        Generator.spawnGeneratorEntity(e, settings);
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params }) {
        if (!worldLoaded) return;
        const settings = {
            entity: entitySettings,
            generator: params
        }
        const { block } = e;
        const generator = new Generator(block, settings);
        if (!generator.valid) return

        const { energy, rate, entity } = generator;
        generator.energy.transferToNetwork(rate * 4)
        const current = energy.get();

        const lastEnergy = entity.getDynamicProperty('lastEnergy') ?? current;
        const beforeTransfer = current;

        // Calculate change since last tick (raw delta)
        const delta = beforeTransfer - lastEnergy;

        // Transfer energy out (output)
        const transferred = energy.transferToNetwork(rate / 100);

        // Get energy after transfer (final value)
        const afterTransfer = energy.get();

        // Input is only positive delta (incoming energy)
        const input = Math.max(0, afterTransfer - lastEnergy + transferred);

        // Output is the energy transferred to network
        const output = transferred;

        // Update capacity visuals
        block.setState('utilitycraft:capacity',
            DoriosAPI.math.scaleToSetNumber(current, energy.cap, 6));

        // Update visuals and label
        generator.on();
        generator.displayEnergy();
        generator.setLabel(`
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${Energy.formatEnergyToText(current)} / ${Energy.formatEnergyToText(energy.cap)}

§r§aInput §f${Energy.formatEnergyToText(input)}/t
§r§cOutput §f${Energy.formatEnergyToText(output)}/t
        `);

        entity.setDynamicProperty('lastEnergy', afterTransfer);
    },


    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

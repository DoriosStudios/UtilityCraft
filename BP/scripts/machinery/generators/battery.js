import * as DoriosLib from "DoriosLib/index.js";
import { Generator, EnergyStorage } from "DoriosCore/index.js"

const entitySettings = {
    name: "battery",
    type: "battery",
    inventory_size: 2
}

DoriosLib.registry.blockComponent('utilitycraft:battery', {
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
        Generator.spawnEntity(e, settings);
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params }) {
        const settings = {
            entity: entitySettings,
            generator: params
        }
        const { block } = e;
        const generator = new Generator(block, settings);
        if (!generator.valid) return

        const { energy, rate, entity } = generator;
        const beforeTransfer = energy.get();
        const lastEnergy = entity.getDynamicProperty('lastEnergy') ?? beforeTransfer;

        // Transfer energy out (output)
        const transferred = energy.transferToNetwork(rate);

        // Get energy after transfer (final value)
        const afterTransfer = energy.get();

        // Input is only positive delta (incoming energy)
        const input = Math.max(0, afterTransfer - lastEnergy + transferred);

        // Output is the energy transferred to network
        const output = transferred;

        // Update capacity visuals
        DoriosLib.block.setState(block, 'utilitycraft:capacity', DoriosLib.math.scaleTo(afterTransfer, energy.cap, 6));

        // Update visuals and label
        generator.on();
        generator.displayEnergy();
        generator.setLabel(`
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(afterTransfer)} / ${EnergyStorage.formatEnergyToText(energy.cap)}

§r§aInput §f${EnergyStorage.formatEnergyToText(input)}/t
§r§cOutput §f${EnergyStorage.formatEnergyToText(output)}/t
        `);

        entity.setDynamicProperty('lastEnergy', afterTransfer);
    },


    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

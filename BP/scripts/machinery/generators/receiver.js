import { Generator, EnergyStorage } from "DoriosCore/machinery/index.js"

const entitySettings = {
    name: "receiver",
    type: "battery",
    inventory_size: 2
}

DoriosAPI.register.blockComponent('receiver', {
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
        Generator.spawnEntity(e, settings, (entity) => {
            entity.addTag("dorios:receiver")
        });
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
        energy.transferToNetwork(rate)

        const received = entity.getDynamicProperty("energy_received") ?? 0

        // Update visuals and label
        generator.displayEnergy();
        generator.setLabel(`
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}

§r§aReceiving §f${EnergyStorage.formatEnergyToText(received)}/t
        `);
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

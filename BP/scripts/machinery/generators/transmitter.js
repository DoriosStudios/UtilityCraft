import { world } from '@minecraft/server'
import { Generator, EnergyStorage } from "DoriosCore/machinery/index.js"

const entitySettings = {
    name: "transmitter",
    type: "machine",
    inventory_size: 2
}

DoriosAPI.register.blockComponent('transmitter', {
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
            entity.addTag("bn:white|white|white")
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
        const range = settings.generator.range

        const networkTag = entity.getTags().find(tag => tag.startsWith("bn"))
        if (!networkTag) return

        // Transfer energy out (output)
        const receivers = entity.dimension.getEntities({ tags: ["dorios:receiver", networkTag], maxDistance: range, location: entity.location })

        let transferedTotal = 0;

        for (const receiver of receivers) {

            const remainingRate = rate - transferedTotal;
            if (remainingRate <= 0) break;

            const available = energy.get();
            if (available <= 0) break;

            const amountToTransfer = Math.min(remainingRate, available);

            const transfered = energy.transferToEntity(receiver, amountToTransfer);

            if (typeof transfered === "number" && transfered > 0) {
                receiver.setDynamicProperty("energy_received", transfered);
                transferedTotal += transfered;
            }
        }

        if (transferedTotal > 0) {
            generator.on();
        } else { generator.off() }

        // Update visuals and label

        generator.displayEnergy();
        generator.setLabel(`
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}

§r§aTransferring §f${EnergyStorage.formatEnergyToText(transferedTotal)}/t
        `);
    },


    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

import { Generator, EnergyStorage, registerIOInterface } from "DoriosCore/index.js"
import { solidFuels } from "../../config/recipes/fuel.js";

for (const blockTypeId of [
    "utilitycraft:basic_furnator",
    "utilitycraft:advanced_furnator",
    "utilitycraft:expert_furnator",
    "utilitycraft:ultimate_furnator"
]) {
    registerIOInterface(blockTypeId, {
        items: {
            buttonSlots: [4, 9],
            anyInputSlots: [3],
            anyOutputSlots: [],
            modes: [
                { id: "disabled" },
                { id: "fuel", inputSlots: [3] }
            ]
        }
    });
}

DoriosAPI.register.blockComponent('furnator', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnEntity(e, settings, (entity) => {
            entity.setItem(2, "utilitycraft:fuel_bar_0", 1, " ")
        });
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block } = e;
        const generator = new Generator(block, settings);
        if (!generator.valid) return
        const { entity, energy, rate } = generator
        generator.processIO();

        generator.energy.transferToNetwork(rate * 4)

        let energyR = entity.getDynamicProperty("utilitycraft:energyR") ?? 0;
        let energyF = entity.getDynamicProperty("utilitycraft:energyF") ?? 0;

        // Update fuel bar (0–13)
        let fuelP = energyF > 0 ? Math.floor((energyR / energyF) * 13) : 0;
        entity.setItem(2, `utilitycraft:fuel_bar_${fuelP}`);


        // If generator has space for energy
        if (energy.get() < energy.cap) {
            if (energyR > 0) {
                // Continue burning residual fuel
                const used = Math.min(energyR, rate, energy.getFreeSpace());
                energyR -= used;
                energy.add(used);
                generator.on();
            } else {
                // Try consuming a new fuel item
                entity.setDynamicProperty("utilitycraft:energyF", 0);

                const item = generator.container.getItem(3);
                if (!item) {
                    generator.setLabel(`
§r§eInvalid Fuel

§r§eFuel Information
 §eTime: §f---
 §eValue: §f---

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
                    generator.off()
                    generator.displayEnergy()
                    return
                }
                const fuel = solidFuels.find(f => {
                    // If the fuel ID contains a wildcard (*), treat it as a Regex pattern.
                    if (f.id.includes('*')) {
                        // Converts the pattern into a safe regular expression.
                        const pattern = new RegExp(`^${f.id.replace(/\*/g, '.*')}$`);
                        return pattern.test(item?.typeId);
                    }
                    // If there's no wildcard, uses the regular format.
                    return item?.typeId.includes(f.id);
                });
                if (!fuel) {
                    generator.setLabel(`
§r§eInvalid Fuel

§r§eFuel Information
 §eTime: §f---
 §eValue: §f---

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
                    generator.off()
                    generator.displayEnergy()
                    return
                }

                const used = Math.min(fuel.de, rate, energy.getFreeSpace());
                energyR = fuel.de - used;
                energy.add(used);
                generator.on();

                // Consume one fuel item
                entity.changeItemAmount(3, -1);
                // Store full fuel value for the cycle
                entity.setDynamicProperty("utilitycraft:energyF", fuel.de);
            }
        } else {
            // Full energy → stop burning
            generator.displayEnergy();
            generator.off();
            generator.setLabel(`
§r§eEnergy Full

§r§eFuel Information
 §eTime: §f${DoriosAPI.utils.formatTime((energyR / rate) / 10)}
 §eValue: §f${EnergyStorage.formatEnergyToText(energyF)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
            return
        }
        entity.setDynamicProperty('utilitycraft:energyR', energyR)


        // Update visuals
        generator.on();
        generator.displayEnergy();
        generator.setLabel(`
§r§aRunning

§r§eFuel Information
 §eTime: §f${DoriosAPI.utils.formatTime((energyR / rate) / 10)}
 §eValue: §f${EnergyStorage.formatEnergyToText(energyF)}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
                    `)
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});

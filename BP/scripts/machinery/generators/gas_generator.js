import * as DoriosLib from "DoriosLib/index.js";
import { Generator, EnergyStorage, GasStorage, registerIOInterfaceForBlockTag } from "DoriosCore/index.js";
import { gasFuels } from "config/recipes/gas_fuel.js";

registerIOInterfaceForBlockTag("utilitycraft:io.gas_generator", {
    items: { anyInputSlots: [], anyOutputSlots: [], modes: [{ id: "default" }, { id: "disabled" }] },
    gases: {
        buttonSlots: [3, 8],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [{ id: "default" }, { id: "fuel", inputIndices: [0] }, { id: "disabled" }],
    },
});

DoriosLib.registry.blockComponent("utilitycraft:gas_generator", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnEntity(e, settings, (entity) => {
            DoriosLib.entity.setNewItem(entity, { slot: 1, typeId: "utilitycraft:progress_right_big_bar_00", amount: 1, nameTag: " " });
            GasStorage.initializeSingle(entity).display(2);
        });
    },
    onTick(e, { params: settings }) {
        const generator = new Generator(e.block, settings);
        if (!generator.valid) return;
        const { entity, energy, rate } = generator;
        energy.transferToNetwork(rate * 4);
        const gas = GasStorage.initializeSingle(entity);
        generator.processIO();
        const fuel = gasFuels[gas.getType()];
        if (gas.get() <= 0 || gas.getType() === "empty") {
            entity.setDynamicProperty("utilitycraft:gas_burn_progress", 0);
            updateState(generator, gas, "No Fuel");
            return;
        }
        if (!fuel) {
            entity.setDynamicProperty("utilitycraft:gas_burn_progress", 0);
            updateState(generator, gas, "Invalid Fuel");
            return;
        }
        if (energy.getFreeSpace() < fuel.energy) {
            updateState(generator, gas, "Energy Full", fuel);
            return;
        }
        // Gas storage uses whole mB. Accumulate burn time before consuming a whole unit,
        // so low tiers retain the same fuel value without rounding away fractional fuel.
        const progress = (entity.getDynamicProperty("utilitycraft:gas_burn_progress") ?? 0)
            + rate * fuel.power / fuel.energy;
        const consumed = Math.min(Math.floor(progress), gas.get(), Math.floor(energy.getFreeSpace() / fuel.energy));
        if (consumed > 0) {
            gas.consume(consumed);
            energy.add(consumed * fuel.energy);
        }
        entity.setDynamicProperty("utilitycraft:gas_burn_progress", gas.get() > 0 ? progress % 1 : 0);
        updateState(generator, gas, "Running", fuel, true);
    },
    onPlayerBreak(e) {
        Generator.onDestroy(e);
    },
});

function updateState(generator, gas, status, fuel, powered = false) {
    if (powered) generator.on(); else generator.off();
    generator.displayEnergy();
    gas.display(2);
    const storedValue = gas.get() * (fuel?.energy ?? 0);
    const outputRate = generator.baseRate * (fuel?.power ?? 0);
    const fuelTime = outputRate > 0 ? DoriosLib.time.formatDuration(storedValue / outputRate / 20) : "---";
    const fuelValue = fuel ? EnergyStorage.formatEnergyToText(storedValue) : "---";
    generator.setLabel(`
§r§${powered ? "a" : "e"}${status}

§r§eFuel Information
 §eTime: §f${fuelTime}
 §eValue: §f${fuelValue}

§r§bEnergy at ${Math.floor(generator.energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(outputRate)}/t
`);
}

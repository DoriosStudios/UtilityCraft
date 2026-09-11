import * as DoriosLib from "DoriosLib/index.js";
import { Machine, FluidStorage, GasStorage, registerIOInterface } from "DoriosCore/index.js";
import { electrolyzerRecipes } from "config/recipes/electrolyzer.js";

registerIOInterface("utilitycraft:electrolyzer", {
    items: {
        anyInputSlots: [],
        anyOutputSlots: [],
        modes: [{ id: "disabled" }],
    },
    liquids: {
        buttonSlots: [8, 13],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "default" },
            { id: "input_1", inputIndices: [0] },
            { id: "output_1", outputIndices: [0] },
            { id: "disabled" },
        ],
    },
    gases: {
        buttonSlots: [14, 19],
        anyInputIndices: [2],
        anyOutputIndices: [0, 1],
        modes: [
            { id: "default" },
            { id: "input_1", inputIndices: [2] },
            { id: "output_1", outputIndices: [0] },
            { id: "output_2", outputIndices: [1] },
            { id: "output_3", outputIndices: [2] },
            { id: "disabled" },
        ],
    },
});

DoriosLib.registry.blockComponent("utilitycraft:electrolyzer", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            DoriosLib.entity.setNewItem(machine.entity, {
                slot: 1, typeId: "utilitycraft:arrow_right_0", nameTag: " ",
            });
        });
    },

    onTick({ block }, { params: settings }) {
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const liquid = FluidStorage.initializeSingle(machine.entity);
        const [gas1, gas2, inputGas] = GasStorage.initializeMultiple(machine.entity, 3);
        machine.processIO();

        const recipeKey = `${liquid.getType()}|${inputGas.getType()}`;
        const recipe = electrolyzerRecipes[recipeKey];
        if (!recipe) {
            machine.showWarning("No Recipe");
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }

        const requiredLiquid = recipe.required_liquid ?? 0;
        const requiredGas = recipe.required_gas ?? 0;
        const output1 = recipe.output1;
        const output2 = recipe.output2;
        const amount1 = output1.amount ?? 1000;
        const amount2 = output2.amount ?? 1000;
        const cost = recipe.cost ?? settings.machine.energy_cost;
        if (machine.getEnergyCost() !== cost) machine.setProgress(0, { display: false });
        machine.setEnergyCost(cost);

        if (liquid.get() < requiredLiquid) {
            machine.showWarning("Not Enough Liquid");
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }
        if (inputGas.get() < requiredGas) {
            machine.showWarning("Not Enough Gas");
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }
        if ((gas1.getType() !== "empty" && gas1.getType() !== output1.type)
            || (gas2.getType() !== "empty" && gas2.getType() !== output2.type)) {
            machine.showWarning("Output Gas Conflict");
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }
        if (gas1.getFreeSpace() < amount1 || gas2.getFreeSpace() < amount2) {
            machine.showWarning("Output Full", { resetProgress: false });
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", { resetProgress: false });
            updateUI(machine, liquid, inputGas, gas1, gas2);
            return;
        }

        let progress = machine.getProgress();
        const maxAmountToCraft = Math.floor(Math.min(
            requiredLiquid > 0 ? liquid.get() / requiredLiquid : Infinity,
            requiredGas > 0 ? inputGas.get() / requiredGas : Infinity,
            gas1.getFreeSpace() / amount1,
            gas2.getFreeSpace() / amount2,
        ));
        const consumption = machine.boosts.consumption;
        const progressCapacity = Math.max(0, maxAmountToCraft * cost - progress);
        const energyToConsume = Math.min(machine.energy.get(), machine.rate, progressCapacity * consumption);
        machine.energy.consume(energyToConsume);
        progress += energyToConsume / consumption;

        const processCount = Math.min(Math.floor(progress / cost), maxAmountToCraft);
        if (processCount > 0) {
            if (requiredLiquid > 0) liquid.consume(requiredLiquid * processCount);
            if (requiredGas > 0) inputGas.consume(requiredGas * processCount);
            if (gas1.getType() === "empty") gas1.setType(output1.type);
            if (gas2.getType() === "empty") gas2.setType(output2.type);
            gas1.add(amount1 * processCount);
            gas2.add(amount2 * processCount);
            progress -= cost * processCount;
        }

        machine.setProgress(progress, { display: false });
        machine.on();
        machine.showStatus("Running");
        updateUI(machine, liquid, inputGas, gas1, gas2);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    },
});

function updateUI(machine, liquid, inputGas, gas1, gas2) {
    liquid.display(3);
    inputGas.display(20);
    gas1.display(4);
    gas2.display(5);
    machine.displayProgress();
    machine.displayEnergy();
}

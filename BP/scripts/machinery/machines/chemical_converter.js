import * as DoriosLib from "DoriosLib/index.js";
import { Machine, FluidStorage, GasStorage, registerIOInterface } from "DoriosCore/index.js";
import { chemicalConverterRecipes } from "config/recipes/chemical_converter.js";

registerIOInterface("utilitycraft:chemical_converter", {
    "items": {
        "buttonSlots": [
            9,
            14
        ],
        "anyInputSlots": [
            3
        ],
        "anyOutputSlots": [],
        "modes": [
            {
                "id": "default"
            },
            {
                "id": "input_1",
                "inputSlots": [
                    3
                ]
            },
            {
                "id": "disabled"
            }
        ]
    },
    "liquids": {
        "buttonSlots": [
            15,
            20
        ],
        "anyInputIndices": [
            0
        ],
        "anyOutputIndices": [],
        "modes": [
            {
                "id": "default"
            },
            {
                "id": "input_1",
                "inputIndices": [
                    0
                ]
            },
            {
                "id": "output_1",
                "outputIndices": [
                    0
                ]
            },
            {
                "id": "disabled"
            }
        ]
    },
    "gases": {
        "buttonSlots": [
            21,
            26
        ],
        "anyInputIndices": [
            0
        ],
        "anyOutputIndices": [
            1
        ],
        "modes": [
            {
                "id": "default"
            },
            {
                "id": "input_1",
                "inputIndices": [
                    0
                ]
            },
            {
                "id": "output_1",
                "outputIndices": [
                    1
                ]
            },
            {
                "id": "output_2",
                "outputIndices": [
                    0
                ]
            },
            {
                "id": "disabled"
            }
        ]
    }
});

DoriosLib.registry.blockComponent("utilitycraft:chemical_converter", {
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
        const [gas, outputGas] = GasStorage.initializeMultiple(machine.entity, 2);
        machine.processIO();
        const inv = machine.container;
        const inputItem = inv.getItem(3);
        const recipeKey = `${inputItem?.typeId ?? "empty"}|${liquid.getType()}|${gas.getType()}`;
        const recipe = chemicalConverterRecipes[recipeKey];
        const refresh = () => updateUI(machine, liquid, gas, outputGas);
        if (!recipe) {
            machine.showWarning("No Recipe");
            refresh();
            return;
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        if (machine.getEnergyCost() !== cost) machine.setProgress(0, { display: false });
        machine.setEnergyCost(cost);
        const requiredLiquid = recipe.required_liquid ?? 0;
        const requiredItems = recipe.required_items ?? 1;
        const requiredGas = recipe.required_gas ?? 0;
        if (liquid.get() < requiredLiquid || (inputItem?.amount ?? 0) < requiredItems || gas.get() < requiredGas) {
            machine.showWarning("Not Enough Input");
            refresh();
            return;
        }

        const gasProduct = recipe.output_gas;
        const gasAmount = gasProduct.amount;
        if (outputGas.getType() !== "empty" && outputGas.getType() !== gasProduct.type) {
            machine.showWarning("Output Gas Conflict");
            refresh();
            return;
        }
        const maxAmountToCraft = Math.floor(Math.min(
            requiredLiquid > 0 ? liquid.get() / requiredLiquid : Infinity,
            requiredItems > 0 ? inputItem.amount / requiredItems : Infinity,
            requiredGas > 0 ? gas.get() / requiredGas : Infinity,
            outputGas.getFreeSpace() / gasAmount,
        ));
        if (maxAmountToCraft <= 0) {
            machine.showWarning("Output Full", { resetProgress: false });
            refresh();
            return;
        }
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", { resetProgress: false });
            refresh();
            return;
        }

        let progress = machine.getProgress();
        const consumption = machine.boosts.consumption;
        const progressCapacity = Math.max(0, maxAmountToCraft * cost - progress);
        const energyToConsume = Math.min(machine.energy.get(), machine.rate, progressCapacity * consumption);
        machine.energy.consume(energyToConsume);
        progress += energyToConsume / consumption;
        const processCount = Math.min(Math.floor(progress / cost), maxAmountToCraft);
        if (processCount > 0) {
            if (requiredItems > 0) DoriosLib.entity.changeItemAmount(machine.entity, { slot: 3, amount: -requiredItems * processCount });
            if (requiredLiquid > 0) liquid.consume(requiredLiquid * processCount);
            if (requiredGas > 0) gas.consume(requiredGas * processCount);
            if (outputGas.getType() === "empty") outputGas.setType(gasProduct.type);
            outputGas.add(gasAmount * processCount);
            progress -= cost * processCount;
        }
        machine.setProgress(progress, { display: false });
        machine.on();
        machine.showStatus("Running");
        refresh();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    },
});

function updateUI(machine, liquid, gas, outputGas) {
    liquid.display(4);
    gas.display(5);
    outputGas.display(6);
    machine.displayProgress();
    machine.displayEnergy();
}

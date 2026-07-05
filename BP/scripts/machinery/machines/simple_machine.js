import { Machine, registerIOInterface } from "DoriosCore/index.js"
import { crusherRecipes } from "../../config/recipes/crusher.js";
import { furnaceRecipes } from "../../config/recipes/furnace.js";
import { pressRecipes } from "../../config/recipes/press.js";

const UTILITYCRAFT_RECIPES = {
    'crusher': crusherRecipes,
    'furnace': furnaceRecipes,
    'presser': pressRecipes
}

const INPUTSLOT = 3
const OUTPUTSLOT = 6

for (const blockTypeId of ["utilitycraft:crusher", "utilitycraft:electro_press", "utilitycraft:incinerator"]) {
    registerIOInterface(blockTypeId, {
        items: {
            slots: [7, 12],
            modes: ["disabled", "input", "output"]
        }
    });
}

DoriosAPI.register.blockComponent('simple_machine', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, (entity) => {
            entity.setItem(1, 'utilitycraft:arrow_right_0', 1, " ")
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return

        const inv = machine.container;
        let outputSlot = inv.getItem(OUTPUTSLOT);
        if (outputSlot && machine.transferItems()) {
            outputSlot = inv.getItem(OUTPUTSLOT);
        }

        //#region Comprobations
        // Get the input slot (slot 3 in this case)
        const inputSlot = inv.getItem(INPUTSLOT);
        if (!inputSlot) {
            machine.showWarning('No Input Item');
            return;
        }

        const recipesComponent = block.getComponent("utilitycraft:machine_recipes")?.customComponentParameters?.params
        let recipes;
        if (recipesComponent.type) {
            recipes = UTILITYCRAFT_RECIPES[recipesComponent.type]
        } else {
            recipes = recipesComponent
        }

        if (!recipes) {
            machine.showWarning('No Recipes');
            return;
        }

        // Validate recipe based on the input item
        const recipe = recipes[inputSlot?.typeId];
        if (!recipe) {
            machine.showWarning('Invalid Recipe');
            return;
        }


        // Get the output slot (usually the last one)
        // Output slot must either match the recipe result or be empty
        if (outputSlot && outputSlot.typeId !== recipe.output) {
            machine.showWarning('Recipe Conflict');
            return;
        }

        // Check how many items can still fit in the output slot
        const spaceLeft = (outputSlot?.maxAmount ?? 64) - (outputSlot?.amount ?? 0);
        const recipeAmount = recipe.amount ?? 1
        if (recipeAmount > spaceLeft) {
            machine.showWarning('Output Full');
            return;
        }

        // Check if there are enough items in the input slot
        const required = recipe.required ?? 1;
        if (inputSlot.amount < required) {
            machine.showWarning(`Needs ${required} Items`);
            return;
        }
        //#endregion

        let progress = machine.getProgress();
        const energyCost = recipe.cost ?? settings.machine.energy_cost;
        machine.setEnergyCost(energyCost)

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', { resetProgress: false });
            return;
        }

        const maxAmountToCraft = Math.floor(Math.min(spaceLeft / recipeAmount, inputSlot.amount / required))
        const consumption = machine.boosts.consumption
        const maxProgress = maxAmountToCraft * energyCost;
        const progressCapacity = Math.max(0, maxProgress - progress);
        const energyToConsume = Math.min(machine.energy.get(), machine.rate, progressCapacity * consumption);

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume);
            progress += energyToConsume / consumption;
            machine.setProgress(progress, { display: false });
        }

        const processCount = Math.min(
            Math.floor(progress / energyCost),
            maxAmountToCraft
        );
        if (processCount > 0) {
            // Add the processed items to the output
            if (!outputSlot) {
                machine.entity.setItem(OUTPUTSLOT, recipe.output, processCount * recipeAmount);
            } else {
                machine.entity.changeItemAmount(OUTPUTSLOT, processCount * recipeAmount);
            }

            // Deduct progress and input items while preserving leftover progress.
            progress -= processCount * energyCost;
            machine.setProgress(progress, { display: false });
            machine.entity.changeItemAmount(INPUTSLOT, -processCount * required);
        }

        // Update machine visuals and state
        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        // Machine operating normally
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

DoriosAPI.register.blockComponent('machine_recipes', {})

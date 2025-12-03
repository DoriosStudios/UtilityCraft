import { Machine } from '../DoriosMachinery/core.js'
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

DoriosAPI.register.blockComponent('simple_machine', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress()
            // Fill Slot to avoid issues
            machine.entity.setItem(1, 'utilitycraft:arrow_right_0', 1, "")
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return

        machine.transferItems()

        const inv = machine.inv;

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
        const outputSlot = inv.getItem(OUTPUTSLOT);
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

        const progress = machine.getProgress();
        const energyCost = recipe.cost ?? settings.machine.energy_cost;
        machine.setEnergyCost(energyCost)

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            return;
        }

        const maxAmountToCraft = Math.floor(Math.min(spaceLeft / recipeAmount, inputSlot.amount / required))
        // If there is enough progress accumulated to process
        if (progress >= energyCost) {
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

                // Deduct progress and input items
                machine.addProgress(-processCount * energyCost);
                machine.entity.changeItemAmount(INPUTSLOT, -processCount * required);
            }
        } else {
            // If not enough progress, continue charging with energy
            const consumption = machine.boosts.consumption
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, maxAmountToCraft * energyCost * consumption);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / consumption);
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
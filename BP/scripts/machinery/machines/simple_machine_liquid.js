import { Machine, FluidManager } from '../DoriosMachinery/core.js'
import { melterRecipes } from "../../config/recipes/melter.js";

const INPUTSLOT = 3

DoriosAPI.register.blockComponent('simple_machine_liquid', {
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

        /** @type {FluidManager} */
        const liquid = FluidManager.initializeSingle(machine.entity);
        liquid.transferFluids(block)

        const inv = machine.inv;

        //#region Comprobations
        // Get the input slot (slot 3 in this case)
        const inputSlot = inv.getItem(INPUTSLOT);
        if (!inputSlot) {
            machine.showWarning('No Input Item');
            liquid.display()
            return;
        }

        const recipesComponent = block.getComponent("utilitycraft:machine_recipes")?.customComponentParameters?.params

        let recipes;
        if (recipesComponent.type == 'melter') {
            recipes = melterRecipes
        } else {
            recipes = recipesComponent
        }

        if (!recipes) {
            machine.showWarning('No Recipes');
            liquid.display()
            return;
        }

        // Validate recipe based on the input item
        const recipe = recipes[inputSlot?.typeId];
        if (!recipe) {
            machine.showWarning('Invalid Recipe');
            liquid.display()
            return;
        }

        // Liquid type must either match the recipe result or be empty
        if (liquid.type != 'empty' && recipe.liquid != liquid.type) {
            machine.showWarning('Recipe Conflict');
            liquid.display()
            return;
        }

        const recipeAmount = recipe.amount ?? 1000
        const spaceLeft = liquid.getFreeSpace()
        if (spaceLeft < recipeAmount) {
            machine.showWarning('Container Full');
            liquid.display()
            return;
        }

        //#endregion

        const progress = machine.getProgress();
        const energyCost = recipe.cost ?? settings.machine.energy_cost;
        machine.setEnergyCost(energyCost)

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            liquid.display()
            return;
        }

        const maxAmountToCraft = Math.floor(Math.min(spaceLeft / recipeAmount, inputSlot.amount))
        // If there is enough progress accumulated to process
        if (progress >= energyCost) {
            const processCount = Math.min(
                Math.floor(progress / energyCost),
                maxAmountToCraft
            );
            if (processCount > 0) {
                // Add the processed items to the output
                liquid.add(recipeAmount * processCount)
                if (liquid.type == 'empty') liquid.setType(recipe.liquid)
                // Deduct progress and input items
                machine.addProgress(-processCount * energyCost);
                machine.entity.changeItemAmount(INPUTSLOT, -processCount);
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
        liquid.display()
        // Machine operating normally
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});


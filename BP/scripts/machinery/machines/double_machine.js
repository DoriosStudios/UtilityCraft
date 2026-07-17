import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js"
import { infuserRecipes } from "../../config/recipes/infuser.js"

const INPUT_SLOT = 3
const CATALYST_SLOT = 4
const OUTPUT_SLOT = 7

registerIOInterface("utilitycraft:infuser", {
    items: {
        buttonSlots: [8, 13],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
            { id: "input_2", inputSlots: [CATALYST_SLOT] },
        ],
    }
});

DoriosLib.registry.blockComponent('utilitycraft:double_machine', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {BlockComponentPlayerPlaceBeforeEvent} e 
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.displayProgress()
            // Fill Slot to avoid issues
            DoriosLib.entity.setNewItem(machine.entity, { slot: 1, typeId: 'utilitycraft:arrow_indicator_90', amount: 1, nameTag: " " })
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return

        const inv = machine.container;
        machine.processIO();

        let outputSlot = inv.getItem(OUTPUT_SLOT);

        //#region Comprobations
        // Get the catalyst slot
        const catalystSlot = inv.getItem(CATALYST_SLOT);
        if (!catalystSlot) {
            machine.showWarning('No Catalyst');
            return;
        }

        // Get the input slot (slot 3 in this case)
        const inputSlot = inv.getItem(INPUT_SLOT);
        if (!inputSlot) {
            machine.showWarning('No Base Item');
            return;
        }

        const recipesComponent = block.getComponent("utilitycraft:machine_recipes")?.customComponentParameters?.params
        let recipes;
        if (recipesComponent.type) {
            recipes = infuserRecipes
        } else {
            recipes = recipesComponent
        }

        if (!recipes) {
            machine.showWarning('No Recipes');
            return;
        }

        // Validate recipe based on the input item
        const recipe = recipes[catalystSlot.typeId + '|' + inputSlot.typeId];
        if (!recipe) {
            machine.showWarning('Invalid Recipe');
            return;
        }

        // Get the output slot (usually the last one)
        // Output slot must either match the recipe result or be empty
        if (outputSlot && outputSlot?.typeId !== recipe.output) {
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

        // Check if there are enough items in the catalyst slot
        const requiredCatalyst = recipe.required ?? 1;
        if (catalystSlot.amount < requiredCatalyst) {
            machine.showWarning(`Needs ${requiredCatalyst} Items`);
            return;
        }
        // Check if there are enough items in the input slot
        const requiredInput = recipe.input_required ?? 1;
        if (inputSlot.amount < requiredInput) {
            machine.showWarning(`Needs ${requiredInput} Items`);
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

        const maxAmountToCraft = Math.floor(Math.min(spaceLeft / recipeAmount, catalystSlot.amount / requiredCatalyst, inputSlot.amount / requiredInput))
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
                DoriosLib.entity.setNewItem(machine.entity, { slot: OUTPUT_SLOT, typeId: recipe.output, amount: processCount * recipeAmount });
            } else {
                DoriosLib.entity.changeItemAmount(machine.entity, { slot: OUTPUT_SLOT, amount: processCount * recipeAmount });
            }

            // Deduct progress and input items while preserving leftover progress.
            progress -= processCount * energyCost;
            machine.setProgress(progress, { display: false });
            DoriosLib.entity.changeItemAmount(machine.entity, { slot: INPUT_SLOT, amount: -processCount * requiredInput });
            DoriosLib.entity.changeItemAmount(machine.entity, { slot: CATALYST_SLOT, amount: -processCount * requiredCatalyst });
        }

        // Update machine visuals and state
        machine.on();
        machine.displayProgress();
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

import { Machine, registerIOInterface } from "DoriosCore/index.js"
import { sieveRecipes } from "../../config/recipes/sieve.js";

const INPUT_SLOT = 3
const MESH_SLOT = 6
const OUTPUT_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15]

registerIOInterface("utilitycraft:autosieve", {
    items: {
        buttonSlots: [16, 21],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
            { id: "input_2", inputSlots: [MESH_SLOT] }
        ]
    }
});

DoriosAPI.register.blockComponent('autosieve', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress()
            // Fill Slot to avoid issues
            machine.entity.setItem(1, 'utilitycraft:arrow_right_0', 1, " ")
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
        machine.processIO();

        // Get the input slot (slot 3 in this case)
        const inputSlot = inv.getItem(INPUT_SLOT);
        if (!inputSlot) {
            machine.showWarning('No Input Item')
            return;
        }

        const meshSlot = inv.getItem(MESH_SLOT)
        if (!meshSlot || !meshSlot?.hasComponent("utilitycraft:mesh")) {
            machine.showWarning('No Mesh Item')
            return;
        }

        /** @type {MeshParams} */
        const meshData = meshSlot.getComponent("utilitycraft:mesh").customComponentParameters.params

        // Validate recipe based on the input item
        const recipe = sieveRecipes[inputSlot?.typeId]
        if (!recipe) {
            machine.showWarning('Invalid Block')
            return;
        }

        const upgrades = {
            hasSpeed: machine.upgrades.speed !== 0,
            hasEnergy: machine.upgrades.energy !== 0
        };

        // Base count of empty slots
        let filledSlots = inv.emptySlotsCount;

        // Subtract empty upgrade slots so they don't count as usable space
        if (!upgrades.hasSpeed) filledSlots--;
        if (!upgrades.hasEnergy) filledSlots--;

        // Check how many items can still fit in the output slot
        if (filledSlots == 0) {
            machine.showWarning('Output Full')
            return;
        }

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy')
            return;
        }

        let progress = machine.getProgress();
        const energyCost = recipe.cost ?? settings.machine.energy_cost;
        machine.setEnergyCost(energyCost)

        const consumption = machine.boosts.consumption
        const maxAmountToCraft = inputSlot.amount;
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
            const multi = meshData.multiplier
            const tier = meshData.tier

            machine.blockSlots(settings.machine.upgrades)

            // === 2) Process and add loot ===
            recipe.forEach(loot => {
                if (tier < (loot.tier ?? 0)) return;
                if (loot.item == "minecraft:flint" && tier >= 7) return;
                if (Math.random() <= loot.chance * multi) {
                    let qty = Array.isArray(loot.amount)
                        ? DoriosAPI.math.randomInterval(loot.amount[0], loot.amount[1])
                        : loot.amount;

                    if (meshData.amount_multiplier) qty *= meshData.amount_multiplier;

                    try {
                        machine.entity.tryAddItem(
                            loot.item,
                            processCount * Math.ceil(Math.random() * qty)
                        );
                    } catch { }
                }
            });

            machine.unblockSlots(settings.machine.upgrades)


            // Deduct progress and input items
            progress -= processCount * energyCost;
            machine.setProgress(progress, { display: false });
            machine.entity.changeItemAmount(INPUT_SLOT, -processCount);
        }

        // Update machine visuals and state
        machine.on();
        machine.displayProgress();
        machine.showStatus('Running')

    },
    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

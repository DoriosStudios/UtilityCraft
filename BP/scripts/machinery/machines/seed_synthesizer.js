import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js"
import { plantsData } from "../../config/recipes/plants.js";

const INPUT_SLOT = 3
const SOIL_SLOT = 6
const OUTPUT_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15]

registerIOInterface("utilitycraft:seed_synthesizer", {
    items: {
        buttonSlots: [16, 21],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
            { id: "input_2", inputSlots: [SOIL_SLOT] }
        ]
    }
});

/**
 * A registry of all accepted soils with their properties.
 * 
 * @type {Record<string, SoilData>}
 */
const acceptedSoils = {
    'minecraft:dirt': { cost: 2, multi: 1 },
    'minecraft:grass_block': { cost: 1.5, multi: 1 },
    'utilitycraft:yellow_soil': { cost: 1, multi: 1 },
    'utilitycraft:red_soil': { cost: 0.75, multi: 2 },
    'utilitycraft:blue_soil': { cost: 0.5, multi: 3 },
    'utilitycraft:black_soil': { cost: 0.25, multi: 4 },
};


DoriosLib.registry.blockComponent('utilitycraft:seed_synthesizer', {
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
            DoriosLib.entity.setNewItem(machine.entity, { slot: 1, typeId: 'utilitycraft:arrow_right_0', amount: 1, nameTag: " " })
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
            machine.showWarning('No Seed')
            return;
        }

        const soilSlot = inv.getItem(SOIL_SLOT)
        if (!soilSlot) {
            machine.showWarning('No Soil')
            return;
        }

        const soil = acceptedSoils[soilSlot.typeId]
        if (!soil) {
            machine.showWarning('Invalid Soil')
            return;
        }

        // Validate recipe based on the input item
        const recipe = plantsData[inputSlot?.typeId]
        if (!recipe) {
            machine.showWarning('Invalid Seed')
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

        let progress = machine.getProgress();
        const energyCost = recipe.cost * soil.cost
        machine.setEnergyCost(energyCost)

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', { resetProgress: false })
            return;
        }

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
            machine.blockSlots(settings.machine.upgrades)

            recipe.drops.forEach(loot => {
                if (Math.random() <= loot.chance) {
                    let qty = Array.isArray(loot.amount)
                        ? DoriosLib.math.randomInt(loot.amount[0], loot.amount[1])
                        : loot.amount;


                    // if (!loot.item.endsWith('_seeds')) qty *= soil.multi;

                    try {
                        DoriosLib.entity.tryAddItem(machine.entity, {
                            item: loot.item,
                            amount: processCount * Math.ceil(Math.random() * qty),
                        });
                    } catch { }
                }
            });

            machine.unblockSlots(settings.machine.upgrades)

            // Deduct progress and input items
            progress -= processCount * energyCost;
            machine.setProgress(progress, { display: false });
        }

        // Update machine visuals and state
        machine.on();
        machine.displayProgress();
        // Machine operating normally
        machine.showStatus('Running')

    },
    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

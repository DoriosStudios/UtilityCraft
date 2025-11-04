import { Machine, Energy } from '../managers.js'
import { plantsData } from "../../config/recipes/plants.js";

const INTPUTSLOT = 3
const MESHSLOT = 6

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


DoriosAPI.register.blockComponent('seed_synthesizer', {
    /**
     * Runs before the machine is placed by the player.
     * 
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

        // Get the input slot (slot 3 in this case)
        const inputSlot = inv.getItem(INTPUTSLOT);
        if (!inputSlot) {
            machine.showWarning('No Seed')
            return;
        }

        const soilSlot = inv.getItem(MESHSLOT)
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

        const progress = machine.getProgress();
        const energyCost = recipe.cost * soil.cost
        machine.setEnergyCost(energyCost)

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy')
            return;
        }

        // If there is enough progress accumulated to process
        if (progress >= energyCost) {
            const processCount = Math.min(
                Math.floor(progress / energyCost),
                inputSlot.amount
            );
            machine.blockSlots(settings.machine.upgrades)

            recipe.drops.forEach(loot => {
                if (Math.random() <= loot.chance) {
                    let qty = Array.isArray(loot.amount)
                        ? DoriosAPI.math.randomInterval(loot.amount[0], loot.amount[1])
                        : loot.amount;


                    // if (!loot.item.endsWith('_seeds')) qty *= soil.multi;

                    try {
                        machine.entity.addItem(
                            loot.item,
                            processCount * Math.ceil(Math.random() * qty)
                        );
                    } catch { }
                }
            });

            machine.unblockSlots(settings.machine.upgrades)

            // Deduct progress and input items
            machine.addProgress(-processCount * energyCost);
        } else {
            // If not enough progress, continue charging with energy
            const consumption = machine.boosts.consumption
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, inputSlot.amount * energyCost * consumption);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / machine.boosts.consumption);
        }

        // Update machine visuals and state
        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        // Machine operating normally
        machine.showStatus('Running')

    },
    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});
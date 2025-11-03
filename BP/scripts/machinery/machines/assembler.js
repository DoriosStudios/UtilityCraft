import { Machine, Energy } from '../managers.js';
const COLORS = DoriosAPI.constants.textColors
/**
 * Auto Assembler Machine Component
 * - Uses blueprints created by the Digitizer.
 * - Consumes materials automatically and crafts items according to the blueprint.
 * - Requires Dorios Energy (DE) to operate.
 * - Automatically consumes energy over time and processes when progress >= energy_cost.
 */

const BLUEPRINT_SLOT = 3;

DoriosAPI.register.blockComponent('assembler', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            // Visual filler slot (optional, same as autosieve)
            machine.entity.setItem(1, 'utilitycraft:arrow_right_0', 1, "");
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

        const size = inv.size;
        const OUTPUT_SLOT = size - 1;
        const INPUT_START = size - 10;
        const INPUT_END = size - 2;

        const speedFactor = machine.upgrades.speed <= 1
            ? machine.upgrades.speed + 1
            : machine.upgrades.speed ** 2;

        // --- 1) Validate blueprint ---
        const blueprint = inv.getItem(BLUEPRINT_SLOT);
        if (!blueprint || blueprint?.typeId !== 'utilitycraft:blueprint') {
            showWarning(machine, speedFactor, 'No Blueprint');
            return; // label: No Blueprint
        }

        // --- 2) Validate energy ---
        if (machine.energy.get() <= 0) {
            showWarning(machine, speedFactor, 'No Energy', false);
            return; // label: No Energy
        }

        // --- 3) Validate materials ---
        let hasMaterials = false;
        for (let i = INPUT_START; i <= INPUT_END; i++) {
            if (inv.getItem(i)) {
                hasMaterials = true;
                break;
            }
        }
        if (!hasMaterials) {
            showWarning(machine, speedFactor, 'No Materials');
            return; // label: No Materials
        }

        // --- 4) Validate output space ---
        const resultItem = blueprint.getDynamicProperty('id');
        const resultAmount = blueprint.getDynamicProperty('amount');
        const leftover = blueprint.getDynamicProperty('leftover') || false;

        if (!resultItem || !resultAmount) {
            showWarning(machine, speedFactor, 'Invalid Blueprint');
            return;
        }

        const outputSlot = inv.getItem(OUTPUT_SLOT);
        const available = outputSlot
            ? (outputSlot.typeId === resultItem
                ? Math.max(0, 64 - outputSlot.amount)
                : 0)
            : 64;

        if (available < resultAmount) {
            showWarning(machine, speedFactor, 'Output Full');
            return; // label: Output Full
        }

        const energyCost = settings.machine.energy_cost;
        const progress = machine.getProgress();

        // --- 5) Processing Logic ---
        if (progress >= energyCost) {
            const maxCraftAmount = Math.min(
                Math.floor(available / resultAmount),
                speedFactor
            );

            const craftCount = amountToCraft(blueprint, inv, maxCraftAmount);
            if (craftCount <= 0) {
                showWarning(machine, speedFactor, 'Missing Materials', false);
                return;
            }
            // Add crafted items to output
            if (!outputSlot) {
                machine.entity.setItem(OUTPUT_SLOT, resultItem, craftCount * resultAmount);
            } else {
                machine.entity.changeItemAmount(OUTPUT_SLOT, craftCount * resultAmount);
            }

            // Add leftover item if exists
            if (leftover !== false) {
                machine.entity.addItem(leftover, 1);
            }

            // Consume progress
            machine.addProgress(-energyCost);
        } else {
            // If not enough progress, continue charging with energy
            const energyToConsume = Math.min(machine.energy.get(), machine.rate / machine.boosts.speed);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / machine.boosts.consumption);
        }

        // --- 6) Visuals and status ---
        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        showStatus(machine, speedFactor, 'Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});


/**
 * Calculates how many times the blueprint can be crafted given the input inventory,
 * respecting the maximum craft amount, and consumes the materials.
 * Used by the Assembler (Autocrafter).
 *
 * @param {import('@minecraft/server').ItemStack} blueprint The blueprint containing the 'materials' dynamic property (JSON array).
 * @param {import('@minecraft/server').Container} inventory The inventory container to consume materials from.
 * @param {number} maxCraftAmount The max number of times to craft.
 * @returns {number} The number of crafts performed (0 if not possible).
 */
function amountToCraft(blueprint, inventory, maxCraftAmount) {
    // Parse the recipe materials from the blueprint dynamic property
    const recipe = JSON.parse(blueprint.getDynamicProperty('materials') || '[]');

    // Map of available materials
    const materialMap = {};
    for (let slot = inventory.size - 10; slot < inventory.size - 1; slot++) {
        const item = inventory.getItem(slot);
        if (item) {
            materialMap[item.typeId] = (materialMap[item.typeId] || 0) + item.amount;
        }
    }

    // Calculate max possible crafts based on available materials
    let possibleCrafts = 64;
    for (const mat of recipe) {
        const available = materialMap[mat.id] || 0;
        const craftsForMat = Math.floor(available / (mat.amount + 1));
        if (craftsForMat === 0) return 0;
        possibleCrafts = Math.min(possibleCrafts, craftsForMat);
    }

    // Limit crafts by maxCraftAmount
    const craftsToDo = Math.min(possibleCrafts, maxCraftAmount);
    if (craftsToDo === 0) return 0;

    // Consume materials from input slots
    for (const mat of recipe) {
        let remainingToConsume = mat.amount * craftsToDo;

        for (let slot = inventory.size - 10; slot < inventory.size - 1 && remainingToConsume > 0; slot++) {
            const item = inventory.getItem(slot);
            if (item && item.typeId === mat.id) {
                if (item.amount <= remainingToConsume) {
                    remainingToConsume -= item.amount;
                    inventory.setItem(slot, undefined);
                } else {
                    item.amount -= remainingToConsume;
                    inventory.setItem(slot, item);
                    remainingToConsume = 0;
                }
            }
        }
    }

    return craftsToDo;
}

/**
 * Displays a warning label in the machine.
 *
 * Optionally resets the machine progress to 0 and turns off the machine.
 *
 * @param {string} message The warning text to display.
 * @param {boolean} [resetProgress=true] Whether to reset the machine progress to 0.
 */
function showWarning(machine, speed, message, resetProgress = true) {
    if (resetProgress) {
        machine.setProgress(0);
    }

    machine.displayEnergy();
    machine.off()
    machine.setLabel(`
§r${COLORS.yellow}${message}!

§r${COLORS.green}Speed x${speed}
§r${COLORS.green}Efficiency ${((1 / machine.boosts.consumption) * 100).toFixed(0)}%%
§r${COLORS.green}Cost ---

§r${COLORS.red}Rate ${Energy.formatEnergyToText(Math.floor(machine.baseRate))}/t
    `);
}

/**
 * Displays a normal status label in the machine (green).
 *
 * Does not reset the machine progress.
 *
 * @param {string} message The status text to display.
 */
function showStatus(machine, speed, message) {
    machine.displayEnergy();

    machine.setLabel(`
§r${COLORS.darkGreen}${message}!

§r${COLORS.green}Speed x${speed}
§r${COLORS.green}Efficiency ${((1 / machine.boosts.consumption) * 100).toFixed(0)}%%
§r${COLORS.green}Cost ${Energy.formatEnergyToText(machine.getEnergyCost() * machine.boosts.consumption)}

§r${COLORS.red}Rate ${Energy.formatEnergyToText(Math.floor(machine.baseRate))}/t
    `);
}

import { Machine } from '../DoriosMachinery/core.js'

const INPUTSLOT = 3

DoriosAPI.register.blockComponent('induction_anvil', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.entity.setItem(2, 'utilitycraft:arrow_right_0', 1, "");
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const inv = machine.inv;
        const stack = inv.getItem(INPUTSLOT);

        // No item
        if (!stack) {
            machine.showWarning("No Item", false);
            return;
        }

        // Must be a durable item
        let durability = stack.durability

        if (!durability) {
            machine.showWarning("Invalid Item", false);
            return;
        }

        const remaining = durability.getRemaining();     // you already noticed: 0 = almost broken
        const max = durability.getMax();            // full health is remaining == max

        // Fully repaired
        if (remaining >= max) {
            machine.showWarning("Fully Repaired", false);
            return;
        }

        // No energy at all
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", false);
            return;
        }

        // Repair continuously every tick (bounded by rate + available energy)
        const energyAvailableThisTick = Math.min(machine.energy.get(), machine.rate);

        // Your previous logic implied: 10 DE = 1 durability.
        // Respect upgrades: consumption > 1 should make it cost more.
        const ENERGY_PER_DURABILITY = 10 * (machine.boosts?.consumption ?? 1);

        // How much durability we can repair this tick (integer)
        const missing = max - remaining;
        const canRepair = Math.floor(energyAvailableThisTick / ENERGY_PER_DURABILITY);

        if (canRepair <= 0) {
            machine.showWarning("No Energy", false);
            return;
        }

        const repairAmount = Math.min(missing, canRepair);
        const energyToConsume = repairAmount * ENERGY_PER_DURABILITY;

        try {
            durability.repair(repairAmount);
            inv.setItem(INPUTSLOT, stack);
            machine.energy.consume(energyToConsume);
        } catch {
            machine.showWarning("Invalid Item", false);
            return;
        }

        // Update visuals
        machine.on();
        machine.displayEnergy();
        machine.showStatus("Running");
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

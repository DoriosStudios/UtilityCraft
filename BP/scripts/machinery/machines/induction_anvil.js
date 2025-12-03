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
        if (!machine.valid) return

        const progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;
        const inv = machine.inv;

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            return;
        }

        if (progress >= energyCost) {
            const stack = inv.getItem(INPUTSLOT);
            if (!stack) {
                machine.showWarning('No Item', false);
                return;
            }

            const remaining = stack.durability.getRemaining()
            // Si ya está full reparado
            if (remaining === 0) {
                machine.showWarning('Fully Repaired', false);
                machine.setProgress(0, undefined, undefined, false);
                return;
            }

            try {
                const repairAmount = Math.min(remaining, energyCost / 10)
                stack.durability.repair(repairAmount);
                inv.setItem(INPUTSLOT, stack);
                machine.addProgress(-repairAmount * 10)
            } catch {
                machine.showWarning('Invalid Item', false);
                return;
            }

        } else {
            // Charge up progress
            const energyToConsume = Math.min(
                machine.energy.get(),
                machine.rate,
                energyCost - progress
            );
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / machine.boosts.consumption);
        }

        // Update visuals
        machine.on();
        machine.displayEnergy();
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

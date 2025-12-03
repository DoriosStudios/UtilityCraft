import { Machine } from '../DoriosMachinery/core.js'

const INPUTSLOT = 3

DoriosAPI.register.blockComponent('block_placer', {
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
            machine.entity.setItem(2, 'utilitycraft:arrow_right_0', 1, "")
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

        const progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;
        const inv = machine.inv;

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            return;
        }

        if (progress >= energyCost) {
            const facing = machine.block.getFacingBlock();
            if (!facing) return;

            // Si no es aire => warning
            if (!facing.isAir) {
                machine.showWarning('Block in Front', false);
                return;
            }

            // Revisar ítem en el slot
            const stack = inv.getItem(INPUTSLOT);
            if (!stack) {
                machine.showWarning('No Block', false);
                return;
            }
            try {
                // Intentar colocar el bloque
                facing.setType(`${stack.typeId}`)

                // Consumir 1 ítem si se colocó bien
                machine.entity.changeItemAmount(INPUTSLOT, -1);

                // Resetear progreso
                machine.setProgress(0, undefined, undefined, false);
            } catch {
                // Si no se pudo colocar => no era un bloque válido
                machine.showWarning('Invalid Item', false);
                return
            }

        } else {
            // Charge up progress
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, energyCost - progress);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume);
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

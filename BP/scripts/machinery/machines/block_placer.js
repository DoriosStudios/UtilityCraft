import { Machine, registerIOInterface } from "DoriosCore/index.js"

const INPUTSLOT = 3

registerIOInterface("utilitycraft:block_placer", {
    items: {
        buttonSlots: [6, 11],
        anyInputSlots: [INPUTSLOT],
        anyOutputSlots: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUTSLOT] }
        ]
    }
});

DoriosAPI.register.blockComponent('block_placer', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.entity.setItem(2, 'utilitycraft:arrow_right_0', 1, " ")
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

        let progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;
        const inv = machine.container;
        machine.processIO();

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', { resetProgress: false });
            return;
        }

        const energyToConsume = Math.min(machine.energy.get(), machine.rate, Math.max(0, energyCost - progress));
        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume);
            progress += energyToConsume;
            machine.setProgress(progress, { display: false });
        }

        if (progress >= energyCost) {
            const facing = machine.block.getFacingBlock();
            if (!facing) return;

            // Si no es aire => warning
            if (!facing.isAir) {
                machine.showWarning('Block in Front', { resetProgress: false });
                return;
            }

            // Revisar ítem en el slot
            const stack = inv.getItem(INPUTSLOT);
            if (!stack) {
                machine.showWarning('No Block', { resetProgress: false });
                return;
            }
            try {
                // Intentar colocar el bloque
                facing.setType(`${stack.typeId}`)

                // Consumir 1 ítem si se colocó bien
                machine.entity.changeItemAmount(INPUTSLOT, -1);

                // Resetear progreso
                machine.setProgress(0, { display: false });
            } catch {
                // Si no se pudo colocar => no era un bloque válido
                machine.showWarning('Invalid Item', { displayProgress: false, resetProgress: false });
                return
            }
        }

        // Update visuals
        machine.on();
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

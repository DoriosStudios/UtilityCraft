import { Machine } from "DoriosCore/machinery/index.js"

DoriosAPI.register.blockComponent('block_breaker', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, (entity) => {
            const machine = new Machine(e.block, settings);
            machine.setEnergyCost(settings.machine.energy_cost);
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block, dimension } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return

        const progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', { resetProgress: true, displayProgress: false });
            return;
        }

        if (progress >= energyCost) {
            // Block in front
            /**
             * @type {Block}
             */
            const facing = machine.block.getFacingBlock();
            if (facing) {
                // Conditions: not unbreakable, not air, not fluid
                if (
                    !DoriosAPI.constants.unbreakableBlocks.includes(facing.typeId) &&
                    !facing.isAir &&
                    !facing.isLiquid
                ) {
                    // Break with fill command (air destroy)
                    const { x, y, z } = facing.location;
                    dimension.runCommand(
                        `fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`
                    );
                    // Reset progress after operation
                    machine.on();
                    DoriosAPI.utils.waitSeconds(1, () => {
                        machine.off()
                    })
                    machine.setProgress(0, { display: false });
                } else {
                    machine.showWarning('Nothing to Break', { resetProgress: false, displayProgress: false });
                    return;
                }
            }

        } else {
            // Charge up progress
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, energyCost - progress);
            machine.off()
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume);
        }

        // Update visuals
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

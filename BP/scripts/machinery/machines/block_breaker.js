import { Machine } from "DoriosCore/index.js"

DoriosAPI.register.blockComponent('block_breaker', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, (entity) => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
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

        let progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;

        // Check energy availability
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', { resetProgress: true, displayProgress: false });
            return;
        }

        const energyToConsume = Math.min(machine.energy.get(), machine.rate, Math.max(0, energyCost - progress));
        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume);
            progress += energyToConsume;
            machine.setProgress(progress, { display: false });
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
            machine.off()
        }

        // Update visuals
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

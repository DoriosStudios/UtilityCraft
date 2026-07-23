import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine } from "DoriosCore/index.js"
import { getOppositeFacingBlock } from "./oppositeFacing.js";
import {
    handleMachineOutlineInteract,
    initializeMachineOutline,
    removeMachineOutline
} from "../machineOutline.js"

DoriosLib.registry.blockComponent('utilitycraft:block_breaker', {
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
            initializeMachineOutline(e.block, entity, e.player)
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
            showWarning(machine, 'No Energy', { resetProgress: true, displayProgress: false });
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
            const facing = getOppositeFacingBlock(machine.block);
            if (facing) {
                // Conditions: not unbreakable, not air, not fluid
                if (
                    !DoriosLib.constants.UNBREAKABLE_BLOCKS.includes(facing.typeId) &&
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
                    DoriosLib.time.runAfterSeconds(1, () => {
                        machine.off()
                    })
                    machine.setProgress(0, { display: false });
                } else {
                    showWarning(machine, 'Nothing to Break', { resetProgress: false, displayProgress: false });
                    return;
                }
            }
        } else {
            machine.off()
        }

        // Update visuals
        showStatus(machine, 'Running');
    },

    onPlayerInteract(e) {
        handleMachineOutlineInteract(e)
    },

    onPlayerBreak(e) {
        removeMachineOutline(e.block)
        Machine.onDestroy(e);
    }
});

function showWarning(machine, message, options) {
    options ??= {};
    if (options.resetProgress !== false) {
        machine.setProgress(0, { ...options, display: options.displayProgress !== false });
    }

    machine.displayEnergy();
    machine.off();
    machine.setLabel(`
§r${DoriosLib.text.FORMAT.yellow}${message}!

§r${DoriosLib.text.FORMAT.green}Speed x${machine.boosts.speed.toFixed(2)}
§r${DoriosLib.text.FORMAT.green}Efficiency x${(1 / machine.boosts.consumption).toFixed(2)}
§r${DoriosLib.text.FORMAT.green}Cost ---

§r${DoriosLib.text.FORMAT.red}Rate ${EnergyStorage.formatEnergyToText(Math.floor(machine.baseRate))}/t
`);
}

function showStatus(machine, message) {
    machine.displayEnergy();
    machine.setLabel(`
§r${DoriosLib.text.FORMAT.darkGreen}${message}!

§r${DoriosLib.text.FORMAT.green}Speed x${machine.boosts.speed.toFixed(2)}
§r${DoriosLib.text.FORMAT.green}Efficiency x${(1 / machine.boosts.consumption).toFixed(2)}
§r${DoriosLib.text.FORMAT.green}Cost ${EnergyStorage.formatEnergyToText(machine.getEnergyCost() * machine.boosts.consumption)}

§r${DoriosLib.text.FORMAT.red}Rate ${EnergyStorage.formatEnergyToText(Math.floor(machine.baseRate))}/t
    `);
}

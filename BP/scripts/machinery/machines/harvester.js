import { system } from "@minecraft/server";
import { Machine } from "../DoriosMachinery/core.js";

/**
 * Harvester Machine Component
 * - Harvests crops or blocks in an area depending on its range upgrades.
 * - Uses Dorios Energy (DE) progressively per operation.
 * - Executes a `function harvester` in the targeted area once progress is full.
 */

DoriosAPI.register.blockComponent("harvester", {
    /**
     * Called when the machine is placed by the player.
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.displayEnergy();
        });
    },

    /**
     * Called each tick.
     * Handles energy consumption, progress, and harvesting logic.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;
        const { block, dimension } = e;

        if (!block || block.typeId === "minecraft:air") return;

        const machine = new Machine(block, settings);
        if (!machine.valid) return

        // --- Machine parameters ---
        const range = machine.upgrades.range
        const side = (range * 2) + 3;
        const area = side ** 2;

        const progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;
        const realEnergyCost = energyCost * machine.boosts.consumption;

        machine.setEnergyCost(energyCost * area)
        // --- Energy check ---
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", false);
            return;
        }

        // --- Progress full, perform harvest ---
        if (progress >= realEnergyCost * area) {
            let { x, y, z } = block.location;
            y += 0.25; x += 0.5; z += 0.5;

            let xtp = x, ytp = y, ztp = z;
            let tx = 1, tz = 1;
            let adjustedSide = (side === 11) ? 9 : side;

            // Facing direction handling

            const axis = block.getState('utilitycraft:axis')
            switch (axis) {
                case "up":
                    y--;
                    ytp++;
                    x += ((adjustedSide - 1) / 2);
                    z -= ((adjustedSide - 1) / 2) + 1;
                    tx = -1;
                    break;
                case "down":
                    y += 2;
                    ytp--;
                    x += ((adjustedSide - 1) / 2);
                    z -= ((adjustedSide - 1) / 2) + 1;
                    tx = -1;
                    break;
                case "north":
                    x += ((adjustedSide - 1) / 2);
                    tx = -1;
                    ztp--;
                    break;
                case "south":
                    z -= (1 + adjustedSide);
                    x += ((adjustedSide - 1) / 2);
                    tx = -1;
                    ztp++;
                    break;
                case "west":
                    x += (adjustedSide);
                    z -= ((adjustedSide - 1) / 2) + 1;
                    tx = -1;
                    xtp--;
                    break;
                case "east":
                    x--;
                    z -= ((adjustedSide - 1) / 2) + 1;
                    tx = -1;
                    xtp++;
                    break;
            }

            // Perform harvest using function call
            for (let i = 1; i <= adjustedSide; i++) {
                for (let j = 1; j <= adjustedSide; j++) {
                    z += tz;
                    dimension.runCommand(
                        `execute positioned ${x} ${y} ${z} run function harvester`
                    );
                }
                z -= adjustedSide * tz;
                x += tx;
            }

            // Collect items back to machine center after delay
            if (machine.upgrades.range == 4) {
                system.runTimeout(() => {
                    dimension.runCommand(
                        `tp @e[x=${x},y=${y - 1},z=${z},dx=${adjustedSide},dz=${adjustedSide},dy=${y - 1},type=item] ${xtp} ${ytp} ${ztp}`
                    );
                }, 30);
            }

            // Reset progress after operation
            machine.setProgress(0, undefined, undefined, false);
        } else {
            // --- Charge energy & accumulate progress ---
            const energyToConsume = Math.min(
                machine.energy.get(),
                machine.rate,
                realEnergyCost * area - progress
            );
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume);
        }

        // --- Visual updates ---
        machine.on();
        machine.displayEnergy();
        machine.showStatus("Running");
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

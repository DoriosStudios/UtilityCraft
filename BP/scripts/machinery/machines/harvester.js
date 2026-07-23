import * as DoriosLib from "DoriosLib/index.js";
import { system } from "@minecraft/server";
import { Machine } from "DoriosCore/index.js"
import { getOppositeFacingDirection } from "./oppositeFacing.js";
import { harvestAutomatedCrop } from "../../crops/harvest.js";
import {
    getHarvesterSide,
    hasHarvesterCollection
} from "./harvesterArea.js"
import {
    handleMachineOutlineInteract,
    initializeMachineOutline,
    removeMachineOutline,
    syncHarvesterOutlineIfNeeded
} from "../machineOutline.js"

/**
 * Harvester Machine Component
 * - Harvests crops or blocks in an area depending on its range upgrades.
 * - Uses Dorios Energy (DE) progressively per operation.
 * - Executes a `function harvester` in the targeted area once progress is full.
 */

DoriosLib.registry.blockComponent("utilitycraft:harvester", {
    /**
     * Called when the machine is placed by the player.
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, (entity) => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.displayEnergy();
            initializeMachineOutline(e.block, entity, e.player)
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
        const { block, dimension } = e;

        if (!block || block.typeId === "minecraft:air") return;

        const machine = new Machine(block, settings);
        if (!machine.valid) return
        syncHarvesterOutlineIfNeeded(machine)

        // --- Machine parameters ---
        const range = machine.upgrades.range
        const side = getHarvesterSide(range)
        const area = side ** 2;


        const progress = machine.getProgress();
        const energyCost = settings.machine.energy_cost;
        const realEnergyCost = energyCost * machine.boosts.consumption;

        machine.setRate(area)
        machine.setEnergyCost(energyCost * area)
        // --- Energy check ---
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", { displayProgress: false });
            return;
        }

        // --- Progress full, perform harvest ---
        if (progress >= realEnergyCost * area) {
            let { x, y, z } = block.location;
            y += 0.25; x += 0.5; z += 0.5;

            let xtp = x, ytp = y, ztp = z;
            let tx = 1, tz = 1;
            // Facing direction handling
            const axis = getOppositeFacingDirection(block)
                ?? DoriosLib.block.getState(block, "utilitycraft:axis");
            switch (axis) {
                case "up":
                    y--;
                    ytp++;
                    x += ((side - 1) / 2);
                    z -= ((side - 1) / 2) + 1;
                    tx = -1;
                    break;
                case "down":
                    y += 2;
                    ytp--;
                    x += ((side - 1) / 2);
                    z -= ((side - 1) / 2) + 1;
                    tx = -1;
                    break;
                case "north":
                    x += ((side - 1) / 2);
                    tx = -1;
                    ztp--;
                    break;
                case "south":
                    z -= (1 + side);
                    x += ((side - 1) / 2);
                    tx = -1;
                    ztp++;
                    break;
                case "west":
                    x += (side);
                    z -= ((side - 1) / 2) + 1;
                    tx = -1;
                    xtp--;
                    break;
                case "east":
                    x--;
                    z -= ((side - 1) / 2) + 1;
                    tx = -1;
                    xtp++;
                    break;
            }

            // Perform harvest using function call
            for (let i = 1; i <= side; i++) {
                for (let j = 1; j <= side; j++) {
                    z += tz;
                    const targetBlock = dimension.getBlock({
                        x: Math.floor(x),
                        y: Math.floor(y),
                        z: Math.floor(z)
                    });

                    if (!targetBlock || !harvestAutomatedCrop(targetBlock)) {
                        dimension.runCommand(
                            `execute positioned ${x} ${y} ${z} run function harvester`
                        );
                    }
                }
                z -= side * tz;
                x += tx;
            }

            // Collect items back to machine center after delay
            if (hasHarvesterCollection(machine.upgrades.range)) {
                system.runTimeout(() => {
                    dimension.runCommand(
                        `tp @e[x=${x},y=${y - 1},z=${z},dx=${side},dz=${side},dy=${y - 1},type=item] ${xtp} ${ytp} ${ztp}`
                    );
                }, 30);
            }

            // Reset progress after operation
            machine.setProgress(0, { display: false });
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
        machine.showStatus("Running");
    },

    onPlayerInteract(e) {
        handleMachineOutlineInteract(e)
    },

    onPlayerBreak(e) {
        removeMachineOutline(e.block)
        Machine.onDestroy(e);
    }
});

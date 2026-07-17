import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js"

const INPUTSLOT = 3

registerIOInterface("utilitycraft:induction_anvil", {
    items: {
        anyInputSlots: [INPUTSLOT],
        anyOutputSlots: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUTSLOT] }
        ]
    }
})

DoriosLib.registry.blockComponent('utilitycraft:induction_anvil', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.setEnergyCost(settings.machine.energy_cost);
            DoriosLib.entity.setNewItem(machine.entity, { slot: 2, typeId: 'utilitycraft:arrow_right_0', amount: 1, nameTag: " " });
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const inv = machine.container;
        const stack = inv.getItem(INPUTSLOT);

        // No item
        if (!stack) {
            machine.showWarning("No Item", { displayProgress: false });
            return;
        }

        // Must be a durable item
        const durability = DoriosLib.item.durability.getInfo(stack)

        if (!durability) {
            machine.showWarning("Invalid Item", { displayProgress: false });
            return;
        }

        const remaining = durability.remaining;     // 0 = almost broken
        const max = durability.max;                  // full health is remaining == max

        // Fully repaired
        if (remaining >= max) {
            machine.showWarning("Fully Repaired", { displayProgress: false });
            return;
        }

        // No energy at all
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", { displayProgress: false });
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
            machine.showWarning("No Energy", { displayProgress: false });
            return;
        }

        const repairAmount = Math.min(missing, canRepair);
        const energyToConsume = repairAmount * ENERGY_PER_DURABILITY;

        try {
            DoriosLib.item.durability.repair(stack, repairAmount);
            inv.setItem(INPUTSLOT, stack);
            machine.energy.consume(energyToConsume);
        } catch {
            machine.showWarning("Invalid Item", { displayProgress: false });
            return;
        }

        // Update visuals
        machine.on();
        machine.showStatus("Running");
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine, registerIOInterface } from "DoriosCore/index.js"

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
            showWarning(machine, "No Item", { displayProgress: false });
            return;
        }

        // Must be a durable item
        const durability = DoriosLib.item.durability.getInfo(stack)

        if (!durability) {
            showWarning(machine, "Invalid Item", { displayProgress: false });
            return;
        }

        const remaining = durability.remaining;     // 0 = almost broken
        const max = durability.max;                  // full health is remaining == max

        // Fully repaired
        if (remaining >= max) {
            showWarning(machine, "Fully Repaired", { displayProgress: false });
            return;
        }

        // No energy at all
        if (machine.energy.get() <= 0) {
            showWarning(machine, "No Energy", { displayProgress: false });
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
            showWarning(machine, "No Energy", { displayProgress: false });
            return;
        }

        const repairAmount = Math.min(missing, canRepair);
        const energyToConsume = repairAmount * ENERGY_PER_DURABILITY;

        try {
            DoriosLib.item.durability.repair(stack, repairAmount);
            inv.setItem(INPUTSLOT, stack);
            machine.energy.consume(energyToConsume);
        } catch {
            showWarning(machine, "Invalid Item", { displayProgress: false });
            return;
        }

        // Update visuals
        machine.on();
        showStatus(machine, "Running");
    },

    onPlayerBreak(e) {
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

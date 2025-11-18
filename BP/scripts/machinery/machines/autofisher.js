import { Machine } from '../managers.js';
import { autoFisherLoot } from '../../config/recipes/fisher.js';

const NET_SLOT = 6;
const UNUSED_INPUT_SLOT = 3;
const UI_PLACEHOLDER_ITEM = 'utilitycraft:arrow_right_0';
const WATER_TYPES = new Set([
    'minecraft:water',
    'minecraft:flowing_water',
    'minecraft:bubble_column',
    'utilitycraft:sink'
]);

const DEFAULT_ROLLS = 1;
const DEFAULT_SPEED = 1;
const DEFAULT_CHANCE = 1;

const ITEM_ID_FIXES = {
    'minecraft:lily_pad': 'minecraft:waterlily'
};

const sanitizeLootItemId = (id) => ITEM_ID_FIXES[id] ?? id;
const resolveLootItemId = (loot) => sanitizeLootItemId(loot.item);

function resolveNetParams(netItem) {
    const params = netItem?.getComponent('utilitycraft:fishing_net')?.customComponentParameters?.params ?? {};
    return {
        speed: params.speed ?? DEFAULT_SPEED,
        chance: params.chance_multiplier ?? DEFAULT_CHANCE,
        amount: params.amount_multiplier ?? 1,
        rolls: params.rolls ?? DEFAULT_ROLLS,
        tier: params.tier ?? 0
    };
}

const getTickSpeed = () => globalThis.tickSpeed ?? 10;

function hasWaterNearby(block, radius = 1) {
    const { x, y, z } = block.location;
    const dim = block.dimension;

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                const neighbor = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
                if (!neighbor) continue;
                if (WATER_TYPES.has(neighbor.typeId)) {
                    return true;
                }
            }
        }
    }

    return false;
}

function rollAmount(definition) {
    if (Array.isArray(definition)) {
        const [min, max] = definition;
        return DoriosAPI.math.randomInterval(min, max);
    }
    return definition ?? 1;
}

function ensureHiddenInputSlot(machine) {
    const inv = machine.inv;
    if (!inv) return;

    const slotItem = inv.getItem(UNUSED_INPUT_SLOT);
    if (!slotItem) {
        machine.entity.setItem(UNUSED_INPUT_SLOT, UI_PLACEHOLDER_ITEM, 1, '');
        return;
    }

    if (slotItem.typeId === UI_PLACEHOLDER_ITEM) return;

    // Relocate misplaced items into the main inventory before locking the slot again.
    inv.setItem(UNUSED_INPUT_SLOT, undefined);
    machine.entity.setItem(UNUSED_INPUT_SLOT, UI_PLACEHOLDER_ITEM, 1, '');
    machine.entity.addItem(slotItem, undefined, true);
}

DoriosAPI.register.blockComponent('autofisher', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            machine.entity.setItem(1, UI_PLACEHOLDER_ITEM, 1, '');
            ensureHiddenInputSlot(machine);
        });
    },

    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        machine.transferItems();
        ensureHiddenInputSlot(machine);

        const inv = machine.inv;
        const netItem = inv.getItem(NET_SLOT);
        if (!netItem || !netItem.hasComponent('utilitycraft:fishing_net')) {
            machine.showWarning('No Net Item');
            return;
        }

        if (!hasWaterNearby(block)) {
            machine.showWarning('Need Water');
            return;
        }

        const netData = resolveNetParams(netItem);
        const speedMultiplier = netData.speed;
        const chanceMultiplier = netData.chance;
        const amountMultiplier = netData.amount;
        const rollsPerCast = netData.rolls;
        const netTier = netData.tier;

        const upgrades = settings.machine?.upgrades ?? [];
        let freeSlots = inv.emptySlotsCount;
        for (const slotIndex of upgrades) {
            if (!inv.getItem(slotIndex)) {
                freeSlots--;
            }
        }

        if (freeSlots <= 0) {
            machine.showWarning('Output Full');
            return;
        }

        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy');
            return;
        }

        const energyCost = settings.machine.energy_cost;
        machine.setEnergyCost(energyCost);

        machine.baseRate = settings.machine.rate_speed_base * speedMultiplier * machine.boosts.speed * machine.boosts.consumption;
        machine.rate = machine.baseRate * getTickSpeed();
        const progress = machine.getProgress();

        if (progress >= energyCost) {
            const processCount = Math.floor(progress / energyCost);
            const totalRolls = processCount * rollsPerCast;
            const shouldBlockSlots = totalRolls > 0 && upgrades.length > 0;

            if (shouldBlockSlots) {
                machine.blockSlots(upgrades);
            }

            try {
                for (let roll = 0; roll < totalRolls; roll++) {
                    for (const loot of autoFisherLoot) {
                        if (netTier < (loot.tier ?? 0)) continue;

                        const rawChance = loot.chance ?? 0;
                        const finalChance = Math.min(1, rawChance * chanceMultiplier);
                        if (Math.random() > finalChance) continue;

                        let qty = rollAmount(loot.amount);
                        qty = Math.max(1, Math.ceil(qty * amountMultiplier));

                        try {
                            machine.entity.addItem(resolveLootItemId(loot), qty);
                        } catch {
                            // Inventory full mid-loop, break early to avoid unnecessary work
                            roll = totalRolls;
                            break;
                        }
                    }
                }
            } finally {
                if (shouldBlockSlots) {
                    machine.unblockSlots(upgrades);
                }
            }

            machine.addProgress(-processCount * energyCost);
        } else {
            const consumption = machine.boosts.consumption;
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, energyCost * consumption);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / consumption);
        }

        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        machine.showStatus('Fishing');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

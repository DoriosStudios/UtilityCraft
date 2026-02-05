import { ItemStack, Enchantment, EnchantmentTypes } from '@minecraft/server';
import { Machine } from '../DoriosMachinery/core.js';
import { autoFisherConfig, autoFisherLoot } from '../../config/recipes/fisher.js';

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

const BOOK_ITEM_ID = 'minecraft:book';
const ENCHANTED_BOOK_ITEM_ID = 'minecraft:enchanted_book';
const LUCK_CONFIG = autoFisherConfig?.luck ?? {};
const BOOK_ENCHANT_CONFIG = autoFisherConfig?.bookEnchant ?? {};
const EQUIPMENT_CONFIG = autoFisherConfig?.equipment ?? {};
const DEFAULT_LUCK = LUCK_CONFIG.default ?? 0;
let cachedEnchantmentTypes = null;

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
        tier: params.tier ?? 0,
        luck: params.luck ?? DEFAULT_LUCK
    };
}

const getTickSpeed = () => globalThis.tickSpeed ?? 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomFloat = (min, max) => min + ((max - min) * Math.random());
const getEnchantable = (item) => item?.getComponent('minecraft:enchantable');

const getLuckChanceBonus = (luck) => (LUCK_CONFIG.enchantChancePerLuck ?? 0) * Math.max(0, luck ?? 0);
const getLuckCountBonus = (luck) => Math.max(0, Math.floor((LUCK_CONFIG.enchantCountPerLuck ?? 0) * Math.max(0, luck ?? 0)));
const getLuckQualityFactor = (luck) => clamp((LUCK_CONFIG.enchantQualityPerLuck ?? 0) * Math.max(0, luck ?? 0), 0, 1);

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

const getBookEnchantChance = (tier = 0) => Math.min(
    BOOK_ENCHANT_CONFIG.maxChance ?? 1,
    (BOOK_ENCHANT_CONFIG.baseChance ?? 0.35) + ((BOOK_ENCHANT_CONFIG.chancePerTier ?? 0) * Math.max(0, tier))
);

function getAllEnchantmentTypes() {
    if (!worldLoaded) return [];
    if (cachedEnchantmentTypes) return cachedEnchantmentTypes;

    try {
        cachedEnchantmentTypes = EnchantmentTypes.getAll();
    } catch {
        cachedEnchantmentTypes = [];
    }

    return cachedEnchantmentTypes;
}

function rollRandomEnchantmentsFromTypes(types, count, qualityFactor = 0) {
    if (!types?.length || count <= 0) return [];

    const pool = types.slice();
    const picked = [];
    const total = Math.min(count, pool.length);

    for (let i = 0; i < total; i++) {
        const index = Math.floor(Math.random() * pool.length);
        const type = pool.splice(index, 1)[0];
        const minLevel = type.minLevel ?? 1;
        const maxLevel = type.maxLevel ?? 1;
        const adjustedMin = Math.min(
            maxLevel,
            Math.floor(minLevel + ((maxLevel - minLevel) * clamp(qualityFactor, 0, 1)))
        );
        const level = DoriosAPI.math.randomInterval(adjustedMin, maxLevel);
        picked.push(new Enchantment(type, level));
    }

    return picked;
}

function getCompatibleEnchantmentTypes(item) {
    const enchantable = getEnchantable(item);
    if (!enchantable) return [];

    const types = getAllEnchantmentTypes();
    if (!types?.length) return [];

    return types.filter((type) => {
        const minLevel = type.minLevel ?? 1;
        try {
            return enchantable.canAddEnchantment(new Enchantment(type, minLevel));
        } catch {
            return false;
        }
    });
}

function rollRandomEnchantmentsForItem(item, count, qualityFactor = 0) {
    const compatibleTypes = getCompatibleEnchantmentTypes(item);
    return rollRandomEnchantmentsFromTypes(compatibleTypes, count, qualityFactor);
}

/**
* Enchants an item with the specified enchantments.
* @param {ItemStack} item - The item to enchant.
 * @param {Enchantment[]} enchantments - Enchantments to apply.
* @example
*/
function enchantItem(item, enchantments) {
    const enchantable = getEnchantable(item);
    if (!enchantable || !Array.isArray(enchantments)) return false;

    for (const enchantment of enchantments) {
        try {
            enchantable.addEnchantment(enchantment);
        } catch {
            // Skip invalid or unsupported enchantments for this item.
        }
    }

    return true;
}

function applyRandomDurability(item, damageRange) {
    const durability = item.getComponent('minecraft:durability');
    if (!durability || !Array.isArray(damageRange)) return;

    const [minDamage, maxDamage] = damageRange;
    if (minDamage === undefined || maxDamage === undefined) return;

    const clampedMin = clamp(minDamage, 0, 1);
    const clampedMax = clamp(maxDamage, clampedMin, 1);
    const damagePercent = randomFloat(clampedMin, clampedMax);
    durability.damage = Math.min(durability.maxDurability, Math.floor(durability.maxDurability * damagePercent));
}

function resolveCountRange(value, fallbackMin, fallbackMax) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'number') return [value, value];
    return [fallbackMin, fallbackMax];
}

function createBookDropStacks(amount, netTier = 0, netLuck = 0) {
    const total = Math.max(0, Math.floor(amount ?? 0));
    if (total <= 0) return [];

    const allTypes = getAllEnchantmentTypes();
    if (!allTypes?.length) {
        return [new ItemStack(BOOK_ITEM_ID, total)];
    }

    const chanceBonus = getLuckChanceBonus(netLuck);
    const baseChance = getBookEnchantChance(netTier);
    const maxChance = BOOK_ENCHANT_CONFIG.maxChance ?? 1;
    const finalChance = clamp(baseChance + chanceBonus, 0, maxChance);

    const shouldEnchant = Math.random() <= finalChance;
    if (!shouldEnchant) {
        return [new ItemStack(BOOK_ITEM_ID, total)];
    }

    const countBonus = getLuckCountBonus(netLuck);
    const baseMin = BOOK_ENCHANT_CONFIG.minCount ?? 1;
    const baseMax = BOOK_ENCHANT_CONFIG.maxCount ?? 3;
    const maxEnchantments = Math.min(baseMax + Math.max(0, netTier) + countBonus, allTypes.length);
    const minEnchantments = Math.min(baseMin, maxEnchantments);
    const qualityFactor = getLuckQualityFactor(netLuck);
    const stacks = [];

    for (let i = 0; i < total; i++) {
        const bookStack = new ItemStack(ENCHANTED_BOOK_ITEM_ID, 1);
        const enchantCount = DoriosAPI.math.randomInterval(minEnchantments, maxEnchantments);
        const enchantments = rollRandomEnchantmentsForItem(bookStack, enchantCount, qualityFactor);
        if (enchantments.length > 0 && enchantItem(bookStack, enchantments)) {
            stacks.push(bookStack);
        } else {
            stacks.push(new ItemStack(BOOK_ITEM_ID, 1));
        }
    }

    return stacks;
}

function createEquipmentDropStacks(loot, amount, netLuck = 0) {
    const total = Math.max(0, Math.floor(amount ?? 0));
    if (total <= 0) return [];

    const damageRange = loot.durabilityDamageRange ?? EQUIPMENT_CONFIG.durabilityDamageRange;
    const randomEnchant = loot.randomEnchant ?? {};
    const baseChance = randomEnchant.chance ?? EQUIPMENT_CONFIG.enchantChance ?? 0;
    const chancePerLuck = randomEnchant.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck ?? 0;
    const countPerLuck = randomEnchant.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck ?? 0;
    const qualityPerLuck = randomEnchant.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck ?? 0;
    const [baseMinCount, baseMaxCount] = resolveCountRange(
        randomEnchant.count ?? EQUIPMENT_CONFIG.enchantCount,
        1,
        1
    );

    const stacks = [];
    for (let i = 0; i < total; i++) {
        const stack = new ItemStack(loot.item, 1);
        applyRandomDurability(stack, damageRange);

        const luck = Math.max(0, netLuck ?? 0);
        const chance = clamp(baseChance + (chancePerLuck * luck), 0, 1);
        if (chance > 0 && Math.random() <= chance) {
            const countBonus = Math.max(0, Math.floor(countPerLuck * luck));
            const allTypes = getAllEnchantmentTypes();
            const maxCount = Math.min(baseMaxCount + countBonus, allTypes.length || baseMaxCount);
            const minCount = Math.min(baseMinCount, maxCount);
            const qualityFactor = clamp(qualityPerLuck * luck, 0, 1);
            const enchantCount = DoriosAPI.math.randomInterval(minCount, maxCount);
            const enchantments = rollRandomEnchantmentsForItem(stack, enchantCount, qualityFactor);
            if (enchantments.length > 0) {
                enchantItem(stack, enchantments);
            }
        }

        stacks.push(stack);
    }

    return stacks;
}

DoriosAPI.register.blockComponent('autofisher', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            machine.entity.setItem(1, UI_PLACEHOLDER_ITEM, 1, '');
            ensureHiddenInputSlot(machine);
            const player = e.player;
            if (player) {
                player.sendMessage('§eAutoFisher placed! Ensure there is water nearby for it to function.§r');
            }
        });
    },

    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        ensureHiddenInputSlot(machine);

        const finalizeTick = () => {
            machine.transferItems();
            ensureHiddenInputSlot(machine);
        };

        const inv = machine.inv;
        const netItem = inv.getItem(NET_SLOT);
        if (!netItem || !netItem.hasComponent('utilitycraft:fishing_net')) {
            machine.showWarning('No Net Item');
            finalizeTick();
            return;
        }

        if (!hasWaterNearby(block)) {
            machine.showWarning('Need Water Nearby!');
            finalizeTick();
            return;
        }

        const netData = resolveNetParams(netItem);
        const speedMultiplier = netData.speed;
        const chanceMultiplier = netData.chance;
        const amountMultiplier = netData.amount;
        const rollsPerCast = netData.rolls;
        const netTier = netData.tier;
        const netLuck = netData.luck;

        const upgrades = settings.machine?.upgrades ?? [];
        let freeSlots = inv.emptySlotsCount;
        for (const slotIndex of upgrades) {
            if (!inv.getItem(slotIndex)) {
                freeSlots--;
            }
        }

        if (freeSlots <= 0) {
            machine.showWarning('Output Full');
            finalizeTick();
            return;
        }

        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy');
            finalizeTick();
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
                            const lootItemId = resolveLootItemId(loot);

                            if (lootItemId === BOOK_ITEM_ID) {
                                const bookStacks = createBookDropStacks(qty, netTier, netLuck);
                                for (const stack of bookStacks) {
                                    machine.entity.addItem(stack);
                                }
                            } else if (loot.randomEnchant || loot.durabilityDamageRange) {
                                const equipmentStacks = createEquipmentDropStacks(loot, qty, netLuck);
                                for (const stack of equipmentStacks) {
                                    machine.entity.addItem(stack);
                                }
                            } else {
                                machine.entity.addItem(lootItemId, qty);
                            }
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

        finalizeTick();

        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        machine.showStatus('Fishing');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

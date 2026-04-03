import { ItemStack, EnchantmentTypes } from '@minecraft/server';
import { Machine } from "DoriosCore/machinery/index.js"
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
const AUTO_FISHER_ENCHANTMENT_SOURCES = Object.freeze([
    Object.freeze({ entries: Object.freeze(['minecraft:protection', 'minecraft:fire_protection', 'minecraft:blast_protection', 'minecraft:projectile_protection']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods', 'minecraft:density']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:silk_touch', 'minecraft:fortune']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:depth_strider', 'minecraft:frost_walker']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:multishot', 'minecraft:piercing', 'minecraft:breach']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:loyalty', 'minecraft:riptide']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:unbreaking']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:mending']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:efficiency']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:respiration']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:aqua_affinity']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:thorns']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:feather_falling']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:fire_aspect']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:knockback']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:looting']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:power']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:punch']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:flame']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:infinity']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:quick_charge']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:impaling']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:channeling']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:lure']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:luck_of_the_sea']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:soul_speed']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:swift_sneak']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:wind_burst']), weight: 1 }),
    Object.freeze({ entries: Object.freeze(['minecraft:lunge']), weight: 1 })
]);

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

function getEnchantableComponent(stack) {
    if (!stack || typeof stack.getComponent !== 'function') return null;
    return stack.getComponent('minecraft:enchantable')
        ?? stack.getComponent('minecraft:enchantments')
        ?? stack.getComponent('enchantments')
        ?? null;
}

function canApplyEnchantment(enchantComp, type) {
    if (!enchantComp || !type) return false;
    if (typeof enchantComp.canAddEnchantment === 'function') {
        let can = null;
        try {
            can = enchantComp.canAddEnchantment({ type, level: 1 });
        } catch {
            can = null;
        }
        if (can === true) return true;

        try {
            can = enchantComp.canAddEnchantment(type);
        } catch {
            can = null;
        }
        if (can === true) return true;
        if (can === false) return false;
        return false;
    }

    return true;
}

function canWriteEnchantments(enchantComp) {
    if (!enchantComp) return false;
    if (typeof enchantComp.addEnchantments === 'function') return true;
    if (typeof enchantComp.addEnchantment === 'function') return true;
    return false;
}

function normalizeEnchantmentId(type) {
    if (!type) return '';
    const id = type.id ?? type.identifier ?? type.typeId ?? type.name ?? '';
    return typeof id === 'string' ? id.toLowerCase() : '';
}

function normalizeEnchantmentList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(entry => {
            const id = normalizeEnchantmentId(entry?.type);
            const level = Math.floor(Number(entry?.level ?? entry?.lvl ?? entry?.amount ?? 0));
            if (!id || level <= 0) return null;
            return { id, level };
        })
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
}

function buildEnchantmentSignature(list) {
    const normalized = normalizeEnchantmentList(list);
    if (!normalized.length) return '';
    return normalized.map(entry => `${entry.id}:${entry.level}`).join('|');
}

function readEnchantments(stack) {
    const comp = getEnchantableComponent(stack);
    if (!comp) return [];

    let list = [];
    try {
        if (typeof comp.getEnchantments === 'function') {
            list = comp.getEnchantments();
        } else if (Array.isArray(comp.enchantments)) {
            list = comp.enchantments;
        }
    } catch {
        return [];
    }

    if (!Array.isArray(list)) return [];
    return list
        .map(entry => {
            if (!entry?.type) return null;
            const level = Math.floor(Number(entry.level ?? entry.lvl ?? entry.amount ?? 0));
            if (level <= 0) return null;
            return { type: entry.type, level };
        })
        .filter(Boolean);
}

function sanitizeEnchantmentEntries(enchantComp, enchantments) {
    if (!Array.isArray(enchantments)) return [];

    const selected = new Map();
    for (const entry of enchantments) {
        const type = entry?.type ?? null;
        const level = Math.floor(Number(entry?.level ?? 0));
        const id = normalizeEnchantmentId(type);
        if (!id || level <= 0) continue;
        if (!canApplyEnchantment(enchantComp, type)) continue;

        const previous = selected.get(id);
        if (!previous || previous.level < level) {
            selected.set(id, { type, level });
        }
    }

    return [...selected.values()];
}

function applyEnchantmentEntriesToStack(targetStack, enchantments) {
    const enchantComp = getEnchantableComponent(targetStack);
    if (!enchantComp || !canWriteEnchantments(enchantComp)) return false;

    const sanitized = sanitizeEnchantmentEntries(enchantComp, enchantments);
    if (!sanitized.length) return false;

    try {
        enchantComp.removeAllEnchantments?.();
    } catch {
        // Ignore components without explicit clear support.
    }

    try {
        if (typeof enchantComp.addEnchantments === 'function') {
            enchantComp.addEnchantments(sanitized);
        } else if (typeof enchantComp.addEnchantment === 'function') {
            for (const entry of sanitized) {
                enchantComp.addEnchantment(entry);
            }
        } else {
            return false;
        }
    } catch {
        return false;
    }

    return buildEnchantmentSignature(readEnchantments(targetStack)) === buildEnchantmentSignature(sanitized);
}

function cloneSingleItemStack(stack) {
    if (typeof stack?.clone === 'function') {
        const clone = stack.clone();
        clone.amount = 1;
        return clone;
    }

    const clone = new ItemStack(stack.typeId, 1);
    if (stack?.nameTag) clone.nameTag = stack.nameTag;
    const lore = typeof stack?.getLore === 'function' ? stack.getLore() : [];
    if (Array.isArray(lore) && lore.length && typeof clone.setLore === 'function') {
        clone.setLore(lore);
    }
    return clone;
}

function buildVerifiedEnchantmentPlan(item, enchantments) {
    const trialStack = cloneSingleItemStack(item);
    if (!applyEnchantmentEntriesToStack(trialStack, enchantments)) {
        return [];
    }

    return readEnchantments(trialStack);
}

function buildEnchantCandidatePool(types) {
    if (!Array.isArray(types) || !types.length) return [];

    const typeById = new Map(types.map(type => [normalizeEnchantmentId(type), type]));
    const consumedIds = new Set();
    const pool = [];

    for (const source of AUTO_FISHER_ENCHANTMENT_SOURCES) {
        const options = (source.entries ?? [])
            .map(id => typeById.get(String(id).toLowerCase()))
            .filter(Boolean);
        if (!options.length) continue;

        for (const option of options) {
            consumedIds.add(normalizeEnchantmentId(option));
        }

        pool.push({
            options,
            weight: Math.max(0, Number(source.weight ?? 1) || 1)
        });
    }

    const fallbackOptions = types.filter(type => !consumedIds.has(normalizeEnchantmentId(type)));
    if (fallbackOptions.length) {
        pool.push({
            options: fallbackOptions,
            weight: 1
        });
    }

    return pool;
}

function pickWeightedPoolEntry(pool) {
    const totalWeight = pool.reduce((sum, entry) => sum + Math.max(0, Number(entry?.weight ?? 1) || 0), 0);
    if (totalWeight <= 0) return pool[0] ?? null;

    let roll = Math.random() * totalWeight;
    for (const entry of pool) {
        roll -= Math.max(0, Number(entry?.weight ?? 1) || 0);
        if (roll <= 0) return entry;
    }

    return pool[pool.length - 1] ?? null;
}

function pickCandidateFromPool(pool, blockedIds) {
    const availablePool = pool
        .map(entry => ({
            ...entry,
            options: entry.options.filter(option => !blockedIds.has(normalizeEnchantmentId(option)))
        }))
        .filter(entry => entry.options.length > 0);

    const source = pickWeightedPoolEntry(availablePool);
    if (!source) return null;

    const choiceIndex = Math.floor(Math.random() * source.options.length);
    return source.options[choiceIndex] ?? null;
}

function createRandomEnchantment(type, qualityFactor = 0) {
    const minLevel = type.minLevel ?? 1;
    const maxLevel = type.maxLevel ?? 1;
    const adjustedMin = Math.min(
        maxLevel,
        Math.floor(minLevel + ((maxLevel - minLevel) * clamp(qualityFactor, 0, 1)))
    );
    const level = DoriosAPI.math.randomInterval(adjustedMin, maxLevel);
    return { type, level };
}

function getCompatibleEnchantmentTypes(item) {
    const enchantable = getEnchantableComponent(item);
    if (!enchantable) return [];

    const types = getAllEnchantmentTypes();
    if (!types?.length) return [];

    return types.filter(type => canApplyEnchantment(enchantable, type));
}

function rollRandomEnchantmentsFromTypes(item, types, count, qualityFactor = 0) {
    if (!item || !types?.length || count <= 0) return [];

    const pool = buildEnchantCandidatePool(types);
    const picked = [];
    const blockedIds = new Set();
    const total = Math.min(count, types.length);

    for (let i = 0; i < total; i++) {
        let accepted = false;
        let attempts = 0;

        while (attempts < Math.max(8, types.length * 2)) {
            attempts += 1;

            const type = pickCandidateFromPool(pool, blockedIds);
            if (!type) break;

            const typeId = normalizeEnchantmentId(type);
            const candidate = createRandomEnchantment(type, qualityFactor);
            const verified = buildVerifiedEnchantmentPlan(item, [...picked, candidate]);
            if (verified.length > picked.length) {
                picked.splice(0, picked.length, ...verified);
                blockedIds.add(typeId);
                accepted = true;
                break;
            }

            blockedIds.add(typeId);
        }

        if (!accepted) break;
    }

    return picked;
}

function rollRandomEnchantmentsForItem(item, count, qualityFactor = 0) {
    const compatibleTypes = getCompatibleEnchantmentTypes(item);
    return rollRandomEnchantmentsFromTypes(item, compatibleTypes, count, qualityFactor);
}

function shouldGuaranteeEnchant(config, netTier = 0, netLuck = 0) {
    const guaranteedLuckThreshold = Number(config?.guaranteedLuckThreshold);
    const guaranteedTierThreshold = Number(config?.guaranteedTierThreshold);

    return (Number.isFinite(guaranteedLuckThreshold) && Math.max(0, netLuck) >= guaranteedLuckThreshold)
        || (Number.isFinite(guaranteedTierThreshold) && Math.max(0, netTier) >= guaranteedTierThreshold);
}

function resolveEnchantChance(config, netTier = 0, netLuck = 0) {
    if (shouldGuaranteeEnchant(config, netTier, netLuck)) {
        return 1;
    }

    const baseChance = Number(config?.chance ?? config?.baseChance) || 0;
    const chancePerTier = Number(config?.chancePerTier) || 0;
    const chancePerLuck = Number(config?.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck) || 0;
    const maxChance = clamp(Number(config?.maxChance ?? 1) || 1, 0, 1);

    return clamp(
        baseChance
        + (Math.max(0, netTier) * chancePerTier)
        + (Math.max(0, netLuck) * chancePerLuck),
        0,
        maxChance
    );
}

function resolveEnchantCountRange(config, fallbackMin, fallbackMax, netTier = 0, netLuck = 0, maxAvailable = 1) {
    const [baseMin, baseMax] = resolveCountRange(config?.count, fallbackMin, fallbackMax);
    const countPerLuck = Number(config?.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck) || 0;
    const countPerTier = Number(config?.countPerTier) || 0;
    const bonus = Math.max(0, Math.floor((Math.max(0, netLuck) * countPerLuck) + (Math.max(0, netTier) * countPerTier)));
    const maxCount = Math.min(Math.max(0, maxAvailable), baseMax + bonus);
    const minCount = Math.min(maxCount, baseMin + Math.floor(bonus / 2));

    if (maxCount <= 0) {
        return [0, 0];
    }

    return [
        Math.max(1, minCount),
        Math.max(1, maxCount)
    ];
}

function resolveEnchantQualityFactor(config, netTier = 0, netLuck = 0) {
    const minQuality = Number(config?.minQuality) || 0;
    const qualityPerTier = Number(config?.qualityPerTier) || 0;
    const qualityPerLuck = Number(config?.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck) || 0;

    return clamp(
        minQuality
        + (Math.max(0, netTier) * qualityPerTier)
        + (Math.max(0, netLuck) * qualityPerLuck),
        0,
        1
    );
}

function enchantItem(item, enchantments) {
    const verified = buildVerifiedEnchantmentPlan(item, enchantments);
    if (!verified.length) return false;
    return applyEnchantmentEntriesToStack(item, verified);
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

    const enchantConfig = {
        chance: BOOK_ENCHANT_CONFIG.baseChance ?? 0.2,
        chancePerTier: BOOK_ENCHANT_CONFIG.chancePerTier ?? 0,
        chancePerLuck: BOOK_ENCHANT_CONFIG.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck ?? 0,
        maxChance: BOOK_ENCHANT_CONFIG.maxChance ?? 1,
        count: [
            BOOK_ENCHANT_CONFIG.minCount ?? 1,
            BOOK_ENCHANT_CONFIG.maxCount ?? 3
        ],
        countPerLuck: BOOK_ENCHANT_CONFIG.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck ?? 0,
        qualityPerLuck: BOOK_ENCHANT_CONFIG.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck ?? 0,
        minQuality: BOOK_ENCHANT_CONFIG.minQuality ?? 0,
        guaranteedLuckThreshold: BOOK_ENCHANT_CONFIG.guaranteedLuckThreshold,
        guaranteedTierThreshold: BOOK_ENCHANT_CONFIG.guaranteedTierThreshold
    };
    const finalChance = resolveEnchantChance(enchantConfig, netTier, netLuck);
    const [minEnchantments, maxEnchantments] = resolveEnchantCountRange(enchantConfig, 1, 1, netTier, netLuck, allTypes.length);
    const qualityFactor = resolveEnchantQualityFactor(enchantConfig, netTier, netLuck);

    if (maxEnchantments <= 0) {
        return [new ItemStack(BOOK_ITEM_ID, total)];
    }
    const stacks = [];

    for (let i = 0; i < total; i++) {
        if (Math.random() > finalChance) {
            stacks.push(new ItemStack(BOOK_ITEM_ID, 1));
            continue;
        }

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

function createEquipmentDropStacks(loot, amount, netLuck = 0, netTier = 0) {
    const total = Math.max(0, Math.floor(amount ?? 0));
    if (total <= 0) return [];

    const damageRange = loot.durabilityDamageRange ?? EQUIPMENT_CONFIG.durabilityDamageRange;
    const randomEnchant = loot.randomEnchant ?? {};
    const enchantConfig = {
        chance: randomEnchant.chance ?? EQUIPMENT_CONFIG.enchantChance ?? 0,
        chancePerTier: randomEnchant.chancePerTier ?? EQUIPMENT_CONFIG.chancePerTier ?? 0,
        chancePerLuck: randomEnchant.chancePerLuck ?? EQUIPMENT_CONFIG.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck ?? 0,
        maxChance: randomEnchant.maxChance ?? EQUIPMENT_CONFIG.maxChance ?? 1,
        count: randomEnchant.count ?? EQUIPMENT_CONFIG.enchantCount,
        countPerLuck: randomEnchant.countPerLuck ?? EQUIPMENT_CONFIG.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck ?? 0,
        countPerTier: randomEnchant.countPerTier,
        qualityPerLuck: randomEnchant.qualityPerLuck ?? EQUIPMENT_CONFIG.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck ?? 0,
        qualityPerTier: randomEnchant.qualityPerTier,
        minQuality: randomEnchant.minQuality ?? EQUIPMENT_CONFIG.minQuality ?? 0,
        guaranteedLuckThreshold: randomEnchant.guaranteedLuckThreshold ?? EQUIPMENT_CONFIG.guaranteedLuckThreshold,
        guaranteedTierThreshold: randomEnchant.guaranteedTierThreshold ?? EQUIPMENT_CONFIG.guaranteedTierThreshold
    };
    const enchantChance = resolveEnchantChance(enchantConfig, netTier, netLuck);
    const qualityFactor = resolveEnchantQualityFactor(enchantConfig, netTier, netLuck);
    const probeStack = new ItemStack(loot.item, 1);
    const compatibleTypes = getCompatibleEnchantmentTypes(probeStack);
    const [minEnchantCount, maxEnchantCount] = resolveEnchantCountRange(
        enchantConfig,
        1,
        1,
        netTier,
        netLuck,
        compatibleTypes.length
    );

    const stacks = [];
    for (let i = 0; i < total; i++) {
        const stack = new ItemStack(loot.item, 1);
        applyRandomDurability(stack, damageRange);

        if (compatibleTypes.length > 0 && enchantChance > 0 && Math.random() <= enchantChance) {
            const enchantCount = DoriosAPI.math.randomInterval(minEnchantCount, maxEnchantCount);
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
        Machine.spawnEntity(e, settings, (entity) => {
            entity.setItem(3, UI_PLACEHOLDER_ITEM, 1, ' ');
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            ensureHiddenInputSlot(machine);
            const player = e.player;
            if (player) {
                player.sendMessage('§eAutoFisher placed! Ensure there is water nearby for it to function.§r');
            }
        });
    },

    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        ensureHiddenInputSlot(machine);

        const finalizeTick = () => {
            machine.transferItems();
            ensureHiddenInputSlot(machine);
        };

        const inv = machine.container;
        const netItem = inv.getItem(NET_SLOT);
        if (!netItem || !netItem.hasComponent('utilitycraft:fishing_net')) {
            machine.showWarning('No Net Item');
            finalizeTick();
            return;
        }

        if (!hasWaterNearby(block)) {
            machine.showWarning('Need Water!');
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
                                const equipmentStacks = createEquipmentDropStacks(loot, qty, netLuck, netTier);
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
        machine.displayProgress();
        machine.showStatus('Fishing');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

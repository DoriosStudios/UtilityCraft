import { ItemStack, system, world } from "@minecraft/server";

DoriosAPI.register.itemComponent('fishing_net', {});

export const fishingNetItemIds = [
    'utilitycraft:string_fishing_net',
    'utilitycraft:copper_fishing_net',
    'utilitycraft:iron_fishing_net',
    'utilitycraft:golden_fishing_net',
    'utilitycraft:emerald_fishing_net',
    'utilitycraft:diamond_fishing_net',
    'utilitycraft:netherite_fishing_net'
];

export const fishingNetStacks = {};

world.afterEvents.worldLoad.subscribe(() => {
    for (const id of fishingNetItemIds) {
        fishingNetStacks[id] = new ItemStack(id);
    }
});

/**
 * Represents a possible auto fisher loot drop.
 *
 * @typedef {Object} FisherEnchantment
 * @property {string} id                     Enchantment identifier (e.g. "minecraft:lure").
 * @property {number|[number,number]} level  Fixed level or min/max range to roll from.
 * @property {number} [chance=1]             Probability (0-1) to apply this enchantment per drop.
 * @property {number} [chancePerTier=0]      Additional chance applied per fishing net tier.
 * @property {number} [levelBonusPerTier=0]  Extra maximum level unlocked per tier.
 *
 * @typedef {Object} FisherRandomEnchant
 * @property {number} chance                  Probability (0-1) to apply random enchantments.
 * @property {number|[number,number]} count   Fixed count or min/max range of enchantments.
 * @property {number} [chancePerLuck=0]       Extra chance applied per net luck point.
 * @property {number} [countPerLuck=0]        Extra enchantments per luck point (floored).
 * @property {number} [qualityPerLuck=0]      Quality factor per luck point (0-1) to bias higher levels.
 *
 * @typedef {Object} FisherLoot
 * @property {string} item         Item identifier (namespace:item_name).
 * @property {number|[number,number]} amount Item count or min/max range.
 * @property {number} chance       Drop probability (0-1).
 * @property {number} tier         Minimum fishing net tier required.
 * @property {FisherEnchantment[]} [enchantments] Optional scripted enchantments applied when the item supports it.
 * @property {FisherRandomEnchant} [randomEnchant] Optional random enchantments for this drop.
 * @property {[number,number]} [durabilityDamageRange] Damage percent range (0-1) applied to the item.
 */

/**
 * Auto Fisher tuning parameters.
 *
 * - `luck` affects enchant chances and quality (higher levels) when nets provide a luck parameter.
 * - `bookEnchant` controls enchanted book generation.
 * - `equipment` defines defaults for bows/rods (durability + enchant chance).
 */
export const autoFisherConfig = {
    luck: {
        default: 0,
        enchantChancePerLuck: 0.01,
        enchantCountPerLuck: 0.15,
        enchantQualityPerLuck: 0.08
    },
    bookEnchant: {
        baseChance: 0.18,
        chancePerTier: 0.02,
        maxChance: 0.35,
        minCount: 1,
        maxCount: 3
    },
    equipment: {
        durabilityDamageRange: [0.6, 0.95],
        enchantChance: 0.08,
        enchantCount: [1, 2]
    }
};

/**
 * Loot table used by the Auto Fisher.
 * Items with higher tiers require better fishing nets.
 *
 * @type {FisherLoot[]}
 */
export const autoFisherLoot = [
    { item: 'minecraft:cod', amount: [1, 3], chance: 0.45, tier: 0 },
    { item: 'minecraft:salmon', amount: [1, 2], chance: 0.25, tier: 0 },
    { item: 'minecraft:tropical_fish', amount: 1, chance: 0.10, tier: 1 },
    { item: 'minecraft:pufferfish', amount: 1, chance: 0.08, tier: 1 },
    { item: 'minecraft:string', amount: [1, 4], chance: 0.12, tier: 0 },
    { item: 'minecraft:bone', amount: [1, 3], chance: 0.10, tier: 0 },
    { item: 'minecraft:waterlily', amount: 1, chance: 0.08, tier: 0 },
    { item: 'minecraft:ink_sac', amount: [1, 3], chance: 0.06, tier: 1 },
    { item: 'minecraft:glow_ink_sac', amount: [1, 2], chance: 0.05, tier: 2 },
    { item: 'minecraft:prismarine_shard', amount: [1, 3], chance: 0.04, tier: 2 },
    { item: 'minecraft:prismarine_crystals', amount: [1, 3], chance: 0.03, tier: 2 },
    { item: 'minecraft:nautilus_shell', amount: 1, chance: 0.025, tier: 3 },
    { item: 'minecraft:experience_bottle', amount: 1, chance: 0.02, tier: 4 },
    { item: 'minecraft:name_tag', amount: 1, chance: 0.02, tier: 4 },
    { item: 'minecraft:saddle', amount: 1, chance: 0.02, tier: 4 },
    { item: 'minecraft:emerald', amount: [1, 2], chance: 0.015, tier: 5 },
    { item: 'minecraft:water_bottle', amount: 1, chance: 0.005, tier: 2 },
    { item: 'minecraft:book', amount: 1, chance: 0.005, tier: 4 },
    {
        item: 'minecraft:fishing_rod',
        amount: 1,
        chance: 0.004,
        tier: 2,
        durabilityDamageRange: autoFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: autoFisherConfig.equipment.enchantChance,
            count: autoFisherConfig.equipment.enchantCount
        }
    },
    {
        item: 'minecraft:bow',
        amount: 1,
        chance: 0.0008,
        tier: 3,
        durabilityDamageRange: autoFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: autoFisherConfig.equipment.enchantChance,
            count: autoFisherConfig.equipment.enchantCount
        }
    },
    { item: 'minecraft:trident', amount: 1, chance: 0.0005, tier: 6 },
    { item: 'minecraft:heart_of_the_sea', amount: 1, chance: 0.001, tier: 6 },
    { item: 'minecraft:stick', amount: [0, 2], chance: 0.10, tier: 0 },
    { 
        item: 'minecraft:leather_boots',
        amount: 1, 
        chance: 0.0008, 
        tier: 2, 
        durabilityDamageRange: autoFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: autoFisherConfig.equipment.enchantChance,
            count: autoFisherConfig.equipment.enchantCount
        }
    },
    { item: 'utilitycraft:empty_liquid_capsule', amount: 1, chance: 0.004, tier: 5 },
    { item: 'utilitycraft:totem_shard', amount: 1, chance: 0.0002, tier: 7 },
    { item: 'utilitycraft:sand_handful', amount: [1,6], chance: 0.02, tier: 0 }
    
];

/**
 * Allows external addons to register new Auto Fisher drops at runtime.
 *
 * Expected payload (array or single object):
 *   {
 *     "item": "minecraft:apple",            // The Item identifier
 *     "amount": 1,                          // Optional, number or [min,max] range, default 1
 *     "chance": 0.05,                       // Optional, drop chance between 0 and 1, default 0.1
 *     "tier": 0                             // Optional, minimum fishing net tier required, default 0
 *   }
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_autofisher_drop") return;

    try {
        const payload = JSON.parse(message);
        const entries = Array.isArray(payload) ? payload : [payload];

        for (const entry of entries) {
            if (!entry || typeof entry !== 'object') continue;
            if (typeof entry.item !== 'string') continue;
            autoFisherLoot.push({
                item: entry.item,
                amount: entry.amount ?? 1,
                chance: entry.chance ?? 0.1,
                tier: entry.tier ?? 0
            });
        }
    } catch {
        // Ignore malformed payloads silently
    }
});

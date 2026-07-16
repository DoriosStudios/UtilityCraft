// @ts-check

import { ItemComponentTypes } from "@minecraft/server";

/** @typedef {import("@minecraft/server").ItemDurabilityComponent} ItemDurabilityComponent */
/** @typedef {import("@minecraft/server").ItemEnchantableComponent} ItemEnchantableComponent */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */

/**
 * @typedef {object} DurabilityInfo
 * @property {number} damage
 * @property {number} max
 * @property {number} remaining
 * @property {number} percentage
 */

/**
 * @typedef {object} DamageResult
 * @property {number} applied
 * @property {boolean} broken
 * @property {number} remaining
 */

/**
 * Gets an item's durability component.
 *
 * @param {ItemStack} item
 * @returns {ItemDurabilityComponent|undefined}
 */
export function getComponent(item) {
  return /** @type {ItemDurabilityComponent|undefined} */ (
    item?.getComponent(ItemComponentTypes.Durability)
  );
}

/**
 * Gets normalized durability information.
 *
 * @param {ItemStack} item
 * @returns {DurabilityInfo|undefined}
 */
export function getInfo(item) {
  const durability = getComponent(item);
  if (!durability) return undefined;

  const remaining = Math.max(0, durability.maxDurability - durability.damage);
  return {
    damage: durability.damage,
    max: durability.maxDurability,
    remaining,
    percentage: durability.maxDurability <= 0
      ? 0
      : Math.round((remaining / durability.maxDurability) * 10000) / 100,
  };
}

/**
 * Repairs an item by reducing its accumulated damage.
 *
 * @param {ItemStack} item
 * @param {number} [amount=1]
 * @returns {number} Amount of damage repaired.
 */
export function repair(item, amount = 1) {
  const durability = getComponent(item);
  if (!durability || amount <= 0) return 0;

  const repaired = Math.min(durability.damage, Math.floor(amount));
  durability.damage -= repaired;
  return repaired;
}

/**
 * Applies durability attempts while respecting Unbreaking and a custom chance.
 * The caller is responsible for removing a stack when `broken` is true.
 *
 * @param {ItemStack} item
 * @param {number} [amount=1] Number of damage attempts.
 * @param {number} [chance=1] Probability from 0 to 1 before Unbreaking.
 * @param {() => number} [random=Math.random] Injectable random source for tests.
 * @returns {DamageResult}
 */
export function damage(item, amount = 1, chance = 1, random = Math.random) {
  const durability = getComponent(item);
  if (!durability || durability.unbreakable) {
    return { applied: 0, broken: false, remaining: getInfo(item)?.remaining ?? 0 };
  }

  const attempts = Math.max(0, Math.floor(amount));
  const baseChance = Math.max(0, Math.min(1, chance));
  const enchantable = /** @type {ItemEnchantableComponent|undefined} */ (
    item.getComponent(ItemComponentTypes.Enchantable)
  );
  const unbreakingLevel = enchantable?.getEnchantment("unbreaking")?.level ?? 0;
  const damageChance = baseChance * durability.getDamageChance(unbreakingLevel);
  let applied = 0;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (random() < damageChance) applied++;
  }

  const nextDamage = durability.damage + applied;
  const broken = nextDamage >= durability.maxDurability;
  durability.damage = Math.min(durability.maxDurability, nextDamage);

  return {
    applied,
    broken,
    remaining: Math.max(0, durability.maxDurability - durability.damage),
  };
}

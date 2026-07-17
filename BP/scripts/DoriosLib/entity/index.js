// @ts-check

import { EntityComponentTypes, EquipmentSlot, ItemStack } from "@minecraft/server";
import { create as createItem } from "../item/index.js";

/** @typedef {import("@minecraft/server").Container} Container */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").EntityEquippableComponent} EntityEquippableComponent */
/** @typedef {import("@minecraft/server").EntityHealthComponent} EntityHealthComponent */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */

/** @type {ReadonlySet<string>} */
const EQUIPMENT_SLOTS = new Set(Object.values(EquipmentSlot));

/**
 * @typedef {object} InventoryEntry
 * @property {number} slot
 * @property {ItemStack} item
 */

/**
 * @typedef {object} SetItemOptions
 * @property {number} slot
 * @property {ItemStack|undefined} item
 */

/**
 * @typedef {object} SetNewItemOptions
 * @property {number} slot
 * @property {string} typeId
 * @property {number} [amount=1]
 * @property {string} [nameTag]
 * @property {(import("@minecraft/server").RawMessage|string)[]} [lore]
 */

/**
 * @typedef {object} SetEquipmentOptions
 * @property {EquipmentSlot|string} slot
 * @property {ItemStack|undefined} item
 */

/**
 * @typedef {object} HealthInfo
 * @property {number} current
 * @property {number} min
 * @property {number} max
 * @property {number} missing
 * @property {number} percentage
 */

/**
 * Gets an entity's inventory container.
 *
 * @param {Entity} entity
 * @returns {Container|undefined}
 */
export function getInventory(entity) {
  const component = /** @type {EntityInventoryComponent|undefined} */ (
    entity?.getComponent(EntityComponentTypes.Inventory)
  );
  return component?.container;
}

/**
 * Gets every occupied inventory slot.
 *
 * @param {Entity} entity
 * @returns {InventoryEntry[]}
 */
export function getInventoryEntries(entity) {
  const container = getInventory(entity);
  if (!container) return [];

  /** @type {InventoryEntry[]} */
  const entries = [];
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item) entries.push({ slot, item });
  }
  return entries;
}

/**
 * Gets every item in an entity's inventory without slot information.
 *
 * @param {Entity} entity
 * @returns {ItemStack[]}
 */
export function getItems(entity) {
  return getInventoryEntries(entity).map(({ item }) => item);
}

/**
 * Gets the item in an inventory slot.
 *
 * @param {Entity} entity
 * @param {number} slot
 * @returns {ItemStack|undefined}
 */
export function getItem(entity, slot) {
  return getInventory(entity)?.getItem(slot);
}

/**
 * Sets or clears an entity inventory slot.
 *
 * @param {Entity} entity
 * @param {SetItemOptions} options
 * @returns {boolean}
 */
export function setItem(entity, options) {
  const container = getInventory(entity);
  if (!container) return false;

  try {
    container.setItem(options.slot, options.item);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates an ItemStack and places it in an entity inventory slot.
 *
 * Only `slot` and `typeId` are required. Item creation errors are allowed to
 * propagate so invalid configuration is visible to the caller.
 *
 * @param {Entity} entity
 * @param {SetNewItemOptions} options
 * @returns {boolean}
 */
export function setNewItem(entity, options) {
  const item = createItem({
    typeId: options.typeId,
    amount: options.amount,
    nameTag: options.nameTag,
    lore: options.lore,
  });
  return setItem(entity, { slot: options.slot, item });
}

/**
 * Adds an item to an entity inventory and optionally drops any remainder.
 *
 * @param {Entity} entity
 * @param {{item: string|ItemStack, amount?: number, dropRemainder?: boolean}} options
 * @returns {{added: number, remainder: ItemStack|undefined, dropped: boolean}}
 */
export function tryAddItem(entity, options) {
  const stack = typeof options.item === "string"
    ? createItem({ typeId: options.item, amount: options.amount })
    : options.item.clone();
  const container = getInventory(entity);
  if (!container) return { added: 0, remainder: stack, dropped: false };

  const remainder = container.addItem(stack);
  const added = stack.amount - (remainder?.amount ?? 0);
  if (remainder && options.dropRemainder) {
    entity.dimension.spawnItem(remainder, entity.location);
    return { added, remainder: undefined, dropped: true };
  }

  return { added, remainder, dropped: false };
}

/**
 * Changes the amount stored in one occupied inventory slot.
 *
 * @param {Entity} entity
 * @param {{slot: number, amount: number}} options
 * @returns {boolean}
 */
export function changeItemAmount(entity, options) {
  const container = getInventory(entity);
  const item = container?.getItem(options.slot);
  if (!container || !item || !Number.isInteger(options.amount)) return false;

  const nextAmount = item.amount + options.amount;
  if (nextAmount < 0 || nextAmount > item.maxAmount) return false;

  try {
    if (nextAmount === 0) container.setItem(options.slot, undefined);
    else {
      item.amount = nextAmount;
      container.setItem(options.slot, item);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the first matching item.
 *
 * String searches match by type identifier. ItemStack searches use native
 * stack compatibility rules.
 *
 * @param {Entity} entity
 * @param {string|ItemStack} query
 * @returns {InventoryEntry|undefined}
 */
export function findItem(entity, query) {
  for (const entry of getInventoryEntries(entity)) {
    if (typeof query === "string") {
      if (entry.item.typeId === query) return entry;
    } else if (entry.item.isStackableWith(query)) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Counts every item with a type identifier.
 *
 * @param {Entity} entity
 * @param {string} typeId
 * @returns {number}
 */
export function countItem(entity, typeId) {
  let total = 0;
  for (const { item } of getInventoryEntries(entity)) {
    if (item.typeId === typeId) total += item.amount;
  }
  return total;
}

/**
 * Checks whether an entity has at least an amount of one item type.
 *
 * @param {Entity} entity
 * @param {string} typeId
 * @param {number} [amount=1]
 * @returns {boolean}
 */
export function hasItem(entity, typeId, amount = 1) {
  return amount <= 0 || countItem(entity, typeId) >= amount;
}

/**
 * Removes up to an amount of an item type and returns the amount removed.
 *
 * @param {Entity} entity
 * @param {string} typeId
 * @param {number} [amount=1]
 * @returns {number}
 */
export function removeItem(entity, typeId, amount = 1) {
  const container = getInventory(entity);
  if (!container || amount <= 0) return 0;

  let remaining = Math.floor(amount);
  let removed = 0;

  for (let slot = 0; slot < container.size && remaining > 0; slot++) {
    const item = container.getItem(slot);
    if (!item || item.typeId !== typeId) continue;

    const taken = Math.min(item.amount, remaining);
    remaining -= taken;
    removed += taken;

    if (taken === item.amount) {
      container.setItem(slot, undefined);
    } else {
      item.amount -= taken;
      container.setItem(slot, item);
    }
  }

  return removed;
}

/**
 * Clears inventory slots except for explicitly excluded item identifiers.
 *
 * @param {Entity} entity
 * @param {Iterable<string>} [excludedTypeIds=[]]
 * @returns {number} Number of cleared slots.
 */
export function clearInventory(entity, excludedTypeIds = []) {
  const container = getInventory(entity);
  if (!container) return 0;

  const excluded = new Set(excludedTypeIds);
  let cleared = 0;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item || excluded.has(item.typeId)) continue;
    container.setItem(slot, undefined);
    cleared++;
  }
  return cleared;
}

/**
 * Drops inventory contents at the entity's position, excluding selected types.
 *
 * @param {Entity} entity
 * @param {Iterable<string>} [excludedTypeIds=[]]
 * @returns {number} Number of dropped stacks.
 */
export function dropAllItems(entity, excludedTypeIds = []) {
  const container = getInventory(entity);
  if (!container) return 0;

  const excluded = new Set(excludedTypeIds);
  let dropped = 0;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item || excluded.has(item.typeId)) continue;

    entity.dimension.spawnItem(item, entity.location);
    container.setItem(slot, undefined);
    dropped++;
  }
  return dropped;
}

/**
 * Returns the first empty inventory slot.
 *
 * @param {Entity} entity
 * @returns {number|undefined}
 */
export function findFirstEmptySlot(entity) {
  return getInventory(entity)?.firstEmptySlot();
}

/**
 * Places an item in the first empty inventory slot.
 *
 * @param {Entity} entity
 * @param {ItemStack} item
 * @returns {number|undefined} Used slot, or undefined when none is available.
 */
export function setInFirstEmptySlot(entity, item) {
  const container = getInventory(entity);
  const slot = container?.firstEmptySlot();
  if (!container || slot === undefined) return undefined;

  try {
    container.setItem(slot, item);
    return slot;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether an inventory has no empty slots.
 *
 * @param {Entity} entity
 * @returns {boolean}
 */
export function isInventoryFull(entity) {
  const container = getInventory(entity);
  return Boolean(container && container.emptySlotsCount === 0);
}

/**
 * Gets the entity's health component.
 *
 * @param {Entity} entity
 * @returns {EntityHealthComponent|undefined}
 */
export function getHealthComponent(entity) {
  return /** @type {EntityHealthComponent|undefined} */ (
    entity?.getComponent(EntityComponentTypes.Health)
  );
}

/**
 * Gets the current entity health.
 *
 * @param {Entity} entity
 * @returns {number|undefined}
 */
export function getHealth(entity) {
  return getHealthComponent(entity)?.currentValue;
}

/**
 * Sets entity health, clamped to its effective attribute bounds.
 *
 * @param {Entity} entity
 * @param {number} value
 * @returns {boolean}
 */
export function setHealth(entity, value) {
  const health = getHealthComponent(entity);
  if (!health || !Number.isFinite(value)) return false;

  try {
    health.setCurrentValue(Math.max(health.effectiveMin, Math.min(health.effectiveMax, value)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds a delta to current entity health.
 *
 * @param {Entity} entity
 * @param {number} delta
 * @returns {boolean}
 */
export function addHealth(entity, delta) {
  const current = getHealth(entity);
  return current !== undefined && setHealth(entity, current + delta);
}

/**
 * Gets normalized health information.
 *
 * @param {Entity} entity
 * @returns {HealthInfo|undefined}
 */
export function getHealthInfo(entity) {
  const health = getHealthComponent(entity);
  if (!health) return undefined;

  const current = health.currentValue;
  const min = health.effectiveMin;
  const max = health.effectiveMax;
  const range = max - min;
  return {
    current,
    min,
    max,
    missing: Math.max(0, max - current),
    percentage: range <= 0 ? 100 : Math.round(((current - min) / range) * 10000) / 100,
  };
}

/**
 * Gets the equippable component of an entity.
 *
 * @param {Entity} entity
 * @returns {EntityEquippableComponent|undefined}
 */
export function getEquippable(entity) {
  return /** @type {EntityEquippableComponent|undefined} */ (
    entity?.getComponent(EntityComponentTypes.Equippable)
  );
}

/**
 * Gets an equipped item.
 *
 * @param {Entity} entity
 * @param {EquipmentSlot|string} slot
 * @returns {ItemStack|undefined}
 */
export function getEquipment(entity, slot) {
  if (!EQUIPMENT_SLOTS.has(String(slot))) return undefined;
  return getEquippable(entity)?.getEquipment(/** @type {EquipmentSlot} */ (slot));
}

/**
 * Sets or clears an equipped item.
 *
 * @param {Entity} entity
 * @param {SetEquipmentOptions} options
 * @returns {boolean}
 */
export function setEquipment(entity, options) {
  if (!EQUIPMENT_SLOTS.has(String(options.slot))) return false;
  const equippable = getEquippable(entity);
  if (!equippable) return false;

  try {
    return equippable.setEquipment(
      /** @type {EquipmentSlot} */ (options.slot),
      options.item,
    );
  } catch {
    return false;
  }
}

// @ts-check

/** @typedef {Record<string, number>} MachineUpgradePerks */

/**
 * @typedef {object} MachineUpgradeRegistration
 * @property {string} type Semantic category used to prevent stacking equivalent upgrades.
 * @property {Record<number, MachineUpgradePerks> | MachineUpgradePerks[]} levels Perks contributed at each level.
 * @property {number} [value=1] Effective levels contributed by each item in the stack.
 */

/**
 * @typedef {object} CompiledMachineUpgrade
 * @property {string} itemTypeId Registered item identifier.
 * @property {string} type Semantic upgrade category.
 * @property {number} typeIndex Numeric category identifier used by the hot path.
 * @property {number} value Effective levels contributed by each item.
 * @property {number} maxLevel Highest registered level.
 * @property {MachineUpgradePerks[]} levels Compiled level lookup table.
 */

const upgradesByItemType = new Map();
const typeIndices = new Map();
let nextTypeIndex = 0;

const EMPTY_PERKS = Object.create(null);

/**
 * Compiles author-friendly numeric level keys into a dense array. Missing
 * levels inherit the preceding level and all validation happens once here,
 * never while a machine is ticking.
 *
 * @param {Record<number, MachineUpgradePerks> | MachineUpgradePerks[]} rawLevels
 * @returns {MachineUpgradePerks[]}
 */
function compileLevels(rawLevels) {
  if (!rawLevels || typeof rawLevels !== "object") {
    throw new TypeError("Machine upgrade levels must be an object or array");
  }

  const levelKeys = Object.keys(rawLevels)
    .map(Number)
    .filter((level) => Number.isInteger(level) && level > 0);
  const maxLevel = levelKeys.length > 0 ? Math.max(...levelKeys) : 0;
  if (maxLevel === 0) {
    throw new TypeError("Machine upgrades must register at least level 1");
  }

  const levels = new Array(maxLevel + 1);
  levels[0] = EMPTY_PERKS;
  let previous = EMPTY_PERKS;

  for (let level = 1; level <= maxLevel; level++) {
    const rawPerks = rawLevels[level];
    if (rawPerks !== undefined && (!rawPerks || typeof rawPerks !== "object" || Array.isArray(rawPerks))) {
      throw new TypeError(`Machine upgrade level ${level} perks must be an object`);
    }

    if (rawPerks === undefined) {
      levels[level] = previous;
      continue;
    }

    /** @type {MachineUpgradePerks} */
    const perks = Object.assign(Object.create(null), previous);
    for (const perk in rawPerks) {
      const value = Number(rawPerks[perk]);
      if (!perk || !Number.isFinite(value)) {
        throw new TypeError(`Machine upgrade level ${level} has an invalid perk`);
      }
      perks[perk] = value;
    }

    previous = perks;
    levels[level] = previous;
  }

  return levels;
}

/**
 * Local compiled registry and hot-path resolver for machine upgrades.
 *
 * Every addon owns a separate instance of this registry. DoriosCore's machine
 * upgrade ScriptEvent receiver forwards shared definitions into each local
 * instance. Definitions are indexed by exact item type id. Multiple item ids
 * may share the same semantic `type`; only the first such type found in a
 * machine's ordered upgrade slots contributes perks.
 */
export class MachineUpgradeRegistry {
  /**
   * Registers and compiles one upgrade item.
   *
   * @param {string} itemTypeId
   * @param {MachineUpgradeRegistration} registration
   * @returns {CompiledMachineUpgrade}
   */
  static register(itemTypeId, registration) {
    const normalizedItemTypeId = String(itemTypeId ?? "").trim();
    const type = String(registration?.type ?? "").trim();
    const value = Number(registration?.value ?? 1);

    if (!normalizedItemTypeId || !type) {
      throw new TypeError("Machine upgrade itemTypeId and type are required");
    }
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`Machine upgrade ${normalizedItemTypeId} has an invalid value`);
    }
    if (upgradesByItemType.has(normalizedItemTypeId)) {
      throw new Error(`Machine upgrade ${normalizedItemTypeId} is already registered`);
    }

    let typeIndex = typeIndices.get(type);
    if (typeIndex === undefined) {
      typeIndex = nextTypeIndex++;
      typeIndices.set(type, typeIndex);
    }

    const levels = compileLevels(registration.levels);
    const compiled = {
      itemTypeId: normalizedItemTypeId,
      type,
      typeIndex,
      value,
      maxLevel: levels.length - 1,
      levels,
    };

    upgradesByItemType.set(normalizedItemTypeId, compiled);
    return compiled;
  }

  /**
   * Performs a direct lookup by exact item type id.
   *
   * @param {string} itemTypeId
   * @returns {CompiledMachineUpgrade | undefined}
   */
  static get(itemTypeId) {
    return upgradesByItemType.get(itemTypeId);
  }

  /**
   * Resolves all accepted upgrades into one flat additive boosts object.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {number[] | undefined} slots Ordered inventory slots to scan.
   * @param {MachineUpgradePerks} [defaults] Initial boost values.
   * @returns {MachineUpgradePerks}
   */
  static resolveBoosts(container, slots, defaults = {}) {
    /** @type {MachineUpgradePerks} */
    const boosts = Object.assign(Object.create(null), defaults);
    if (!container || !Array.isArray(slots) || slots.length === 0) return boosts;

    /** @type {number[]} */
    const usedTypes = [];

    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index];
      if (!Number.isInteger(slot) || slot < 0 || slot >= container.size) continue;

      const item = container.getItem(slot);
      if (!item) continue;

      const upgrade = upgradesByItemType.get(item.typeId);
      if (!upgrade) continue;

      let repeatedType = false;
      for (let typeIndex = 0; typeIndex < usedTypes.length; typeIndex++) {
        if (usedTypes[typeIndex] !== upgrade.typeIndex) continue;
        repeatedType = true;
        break;
      }
      if (repeatedType) continue;
      usedTypes.push(upgrade.typeIndex);

      const effectiveLevel = Math.min(
        upgrade.maxLevel,
        Math.max(0, Math.floor(item.amount * upgrade.value)),
      );
      const perks = upgrade.levels[effectiveLevel];

      for (const perk in perks) {
        boosts[perk] = (boosts[perk] ?? 0) + perks[perk];
      }
    }

    return boosts;
  }
}

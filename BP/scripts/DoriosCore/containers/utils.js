/**
 * Converts a slot list into a unique, sorted array of valid slot indices.
 *
 * @param {number[] | Iterable<number>} slots
 * @returns {number[]}
 */
export function normalizeObservedSlots(slots) {
  const normalized = [];
  const seen = new Set();

  for (const slot of slots ?? []) {
    if (!Number.isInteger(slot) || slot < 0 || seen.has(slot)) continue;
    seen.add(slot);
    normalized.push(slot);
  }

  normalized.sort((a, b) => a - b);
  return normalized;
}

/**
 * Reads a slot safely.
 *
 * @param {import("@minecraft/server").Container} container
 * @param {number} slotIndex
 * @returns {import("@minecraft/server").ItemStack | undefined}
 */
export function readSlotItem(container, slotIndex) {
  if (!container || !Number.isInteger(slotIndex) || slotIndex < 0) return undefined;

  try {
    return container.getItem(slotIndex);
  } catch {
    return undefined;
  }
}

/**
 * Clones an item if possible so cache/event payloads are not mutated by later changes.
 *
 * @param {import("@minecraft/server").ItemStack | undefined} item
 * @returns {import("@minecraft/server").ItemStack | undefined}
 */
export function cloneItem(item) {
  if (!item) return undefined;

  try {
    return item.clone();
  } catch {
    return item;
  }
}

/**
 * Builds a comparable signature for an item.
 *
 * By default it compares enough data to detect:
 * - empty -> item
 * - item -> empty
 * - item A -> item B
 * - same item with relevant metadata changes
 *
 * @param {import("@minecraft/server").ItemStack | undefined} item
 * @param {{
 *   includeAmount?: boolean,
 *   includeNameTag?: boolean,
 *   includeLore?: boolean,
 *   includeTags?: boolean
 * }} [options]
 * @returns {string}
 */
export function createItemSignature(item, options = {}) {
  if (!item) return "empty";

  const {
    includeAmount = true,
    includeNameTag = true,
    includeLore = true,
    includeTags = true,
  } = options;

  const payload = {
    typeId: item.typeId,
  };

  if (includeAmount) payload.amount = item.amount;
  if (includeNameTag) payload.nameTag = item.nameTag ?? "";
  if (includeLore) payload.lore = safeGetLore(item);
  if (includeTags) payload.tags = safeGetTags(item);

  return JSON.stringify(payload);
}

/**
 * @param {import("@minecraft/server").ItemStack | undefined} beforeItem
 * @param {import("@minecraft/server").ItemStack | undefined} item
 * @param {object} [options]
 * @returns {boolean}
 */
export function hasItemChanged(beforeItem, item, options) {
  return createItemSignature(beforeItem, options) !== createItemSignature(item, options);
}

/**
 * @param {import("@minecraft/server").ItemStack} item
 * @returns {string[]}
 */
function safeGetTags(item) {
  try {
    return [...item.getTags()].sort();
  } catch {
    return [];
  }
}

/**
 * @param {import("@minecraft/server").ItemStack} item
 * @returns {string[]}
 */
function safeGetLore(item) {
  try {
    return [...item.getLore()];
  } catch {
    return [];
  }
}

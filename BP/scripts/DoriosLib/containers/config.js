// @ts-check

import { isPlainObject } from "../utils/index.js";
import { DIRECTIONS, ITEM_CONFIG_VERSION } from "./constants.js";

/** @typedef {"up"|"down"|"north"|"south"|"east"|"west"} ContainerFace */
/** @typedef {Partial<Record<ContainerFace, number[]>>} FaceSlotConfig */

/**
 * @typedef {object} SimpleItemConfig
 * @property {1} version
 * @property {"simple"} type
 * @property {number[]} inputConfig
 * @property {number[]} outputConfig
 */

/**
 * @typedef {object} ComplexItemConfig
 * @property {1} version
 * @property {"complex"} type
 * @property {number[]} anyInputSlots Explicit fallback used when no input face is known.
 * @property {number[]} anyOutputSlots Explicit fallback used when no output face is known.
 * @property {FaceSlotConfig} inputConfig
 * @property {FaceSlotConfig} outputConfig
 */

/** @typedef {SimpleItemConfig|ComplexItemConfig} ItemConfig */

/**
 * Validates and converts an item configuration into its canonical persisted
 * representation.
 *
 * Complex fallback lists are explicit and are never inferred from the current
 * face assignments. The UI registration layer is responsible for ensuring
 * they belong to one of its declared modes.
 *
 * @param {unknown} value Raw configuration.
 * @param {number} containerSize Inventory size used to validate slot indexes.
 * @returns {ItemConfig}
 */
export function normalizeItemConfig(value, containerSize) {
  if (!Number.isInteger(containerSize) || containerSize < 0) {
    throw new RangeError("containerSize must be a non-negative integer");
  }
  if (!isPlainObject(value)) throw new TypeError("Item configuration must be an object");
  if (value.version !== ITEM_CONFIG_VERSION) {
    throw new RangeError(`Unsupported item configuration version: ${String(value.version)}`);
  }

  if (value.type === "simple") {
    return {
      version: ITEM_CONFIG_VERSION,
      type: "simple",
      inputConfig: normalizeSlots(value.inputConfig, containerSize, "inputConfig"),
      outputConfig: normalizeSlots(value.outputConfig, containerSize, "outputConfig"),
    };
  }

  if (value.type === "complex") {
    const inputConfig = normalizeFaceConfig(value.inputConfig, containerSize, "inputConfig");
    const outputConfig = normalizeFaceConfig(value.outputConfig, containerSize, "outputConfig");
    const anyInputSlots = normalizeSlots(value.anyInputSlots, containerSize, "anyInputSlots");
    const anyOutputSlots = normalizeSlots(value.anyOutputSlots, containerSize, "anyOutputSlots");

    return {
      version: ITEM_CONFIG_VERSION,
      type: "complex",
      anyInputSlots,
      anyOutputSlots,
      inputConfig,
      outputConfig,
    };
  }

  throw new TypeError(`Unknown item configuration type: ${String(value.type)}`);
}

/**
 * Produces a mutable snapshot without exposing arrays held by the runtime
 * cache.
 *
 * @param {ItemConfig} config
 * @returns {ItemConfig}
 */
export function cloneItemConfig(config) {
  if (config.type === "simple") {
    return {
      version: ITEM_CONFIG_VERSION,
      type: "simple",
      inputConfig: [...config.inputConfig],
      outputConfig: [...config.outputConfig],
    };
  }

  return {
    version: ITEM_CONFIG_VERSION,
    type: "complex",
    anyInputSlots: [...config.anyInputSlots],
    anyOutputSlots: [...config.anyOutputSlots],
    inputConfig: cloneFaceConfig(config.inputConfig),
    outputConfig: cloneFaceConfig(config.outputConfig),
  };
}

/**
 * @param {unknown} value
 * @param {number} containerSize
 * @param {string} path
 * @returns {number[]}
 */
function normalizeSlots(value, containerSize, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);

  /** @type {number[]} */
  const slots = [];
  const seen = new Set();

  for (const slot of value) {
    if (!Number.isInteger(slot)) throw new TypeError(`${path} contains a non-integer slot`);
    if (slot < 0 || slot >= containerSize) {
      throw new RangeError(`${path} contains out-of-range slot ${slot}`);
    }
    if (seen.has(slot)) continue;
    seen.add(slot);
    slots.push(slot);
  }

  return slots;
}

/**
 * @param {unknown} value
 * @param {number} containerSize
 * @param {string} path
 * @returns {FaceSlotConfig}
 */
function normalizeFaceConfig(value, containerSize, path) {
  if (!isPlainObject(value)) throw new TypeError(`${path} must be an object`);

  for (const face of Object.keys(value)) {
    if (!DIRECTIONS.includes(face)) throw new RangeError(`${path} contains unknown face ${face}`);
  }

  /** @type {FaceSlotConfig} */
  const normalized = {};
  for (const face of DIRECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(value, face)) continue;
    const slots = normalizeSlots(value[face], containerSize, `${path}.${face}`);
    if (slots.length > 0) normalized[/** @type {ContainerFace} */ (face)] = slots;
  }
  return normalized;
}

/**
 * @param {FaceSlotConfig} config
 * @returns {FaceSlotConfig}
 */
function cloneFaceConfig(config) {
  /** @type {FaceSlotConfig} */
  const clone = {};
  for (const face of DIRECTIONS) {
    const slots = config[/** @type {ContainerFace} */ (face)];
    if (slots) clone[/** @type {ContainerFace} */ (face)] = [...slots];
  }
  return clone;
}

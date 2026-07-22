// @ts-check

import { GasStorage } from "./gasStorage.js";
import * as Constants from "./constants.js";
import {
  GAS_CONTAINER_FAMILY,
  getGasConfigRevision,
  getInputGasIndices,
  getOutputGasIndices,
} from "../interfaces/gasIO.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../interfaces/gasIO.js").GasFace} GasFace */

/**
 * @typedef {object} ResolvedGasContainer
 * @property {"entity"|"tank"} kind
 * @property {Block|undefined} block
 * @property {Entity|undefined} entity
 */

/** @typedef {Block|Entity|ResolvedGasContainer} GasContainerTarget */

/**
 * @typedef {object} GasTransferOptions
 * @property {number} sourceIndex Exact source gas index selected by the caller.
 * @property {GasContainerTarget} target
 * @property {GasFace} [targetFace]
 * @property {ReadonlyArray<number>} [targetIndices] Explicit indices that override targetFace.
 * @property {number} [maxAmount]
 */

/**
 * @typedef {object} GasInsertOptions
 * @property {string} type
 * @property {number} amount
 * @property {GasFace} [face]
 * @property {ReadonlyArray<number>} [indices]
 * @property {boolean} [exact] When true, nothing is inserted unless the full amount fits.
 */

const EMPTY_INDICES = [];

/**
 * Resolves a compatible gas entity or an empty UtilityCraft tank block.
 *
 * @param {GasContainerTarget} target
 * @returns {ResolvedGasContainer|undefined}
 */
export function resolveGasContainer(target) {
  if (!target) return undefined;
  if (isResolvedGasContainer(target)) return refreshResolved(target);
  if (isEntityReference(target)) {
    return isCompatibleGasEntity(target)
      ? { kind: "entity", block: undefined, entity: target }
      : undefined;
  }
  if (isBlockReference(target)) return resolveGasContainerAt(target.dimension, target.location);
  return undefined;
}

/**
 * Resolves a gas container accessible through one block position. Multiblock
 * ports return their controller entity while preserving the real access block.
 *
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @returns {ResolvedGasContainer|undefined}
 */
export function resolveGasContainerAt(dimension, location) {
  if (!dimension || !isLocation(location)) return undefined;
  try {
    const block = dimension.getBlock(location);
    if (!block) return undefined;

    if (block.hasTag("dorios:multiblock.port") && block.hasTag("dorios:gas")) {
      const entity = dimension.getEntities({
        tags: [`input:[${location.x},${location.y},${location.z}]`],
      }).find(isCompatibleGasEntity);
      return entity ? { kind: "entity", block, entity } : undefined;
    }

    const entity = dimension.getEntitiesAtBlockLocation(location).find(isCompatibleGasEntity);
    if (entity) return { kind: "entity", block, entity };
    if (isGasTankBlock(block)) return { kind: "tank", block, entity: undefined };
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Returns gas indices that accept insertion. Basic containers expose all of
 * their real indices; Complex containers use the requested face or fallback.
 *
 * @param {GasContainerTarget} target
 * @param {{face?:GasFace}} [options]
 */
export function getGasInputIndices(target, options = {}) {
  const resolved = resolveGasContainer(target);
  if (!resolved) return EMPTY_INDICES;
  if (!resolved.entity) return resolved.kind === "tank" ? [0] : EMPTY_INDICES;
  return getInputGasIndices(resolved.entity, options);
}

/**
 * Returns gas indices that allow extraction.
 *
 * @param {GasContainerTarget} target
 * @param {{face?:GasFace}} [options]
 */
export function getGasOutputIndices(target, options = {}) {
  const resolved = resolveGasContainer(target);
  if (!resolved?.entity) return EMPTY_INDICES;
  return getOutputGasIndices(resolved.entity, options);
}

/** @param {GasContainerTarget} target */
export function getGasContainerRevision(target) {
  const resolved = resolveGasContainer(target);
  return resolved?.entity ? getGasConfigRevision(resolved.entity) : 0;
}

/**
 * Moves gas from one exact source index. Source output policy belongs to the
 * caller, matching the low-level item transfer primitive.
 *
 * @param {GasContainerTarget} source
 * @param {GasTransferOptions} options
 * @returns {number}
 */
export function transferGas(source, options) {
  if (!options || !Number.isInteger(options.sourceIndex) || options.sourceIndex < 0) {
    throw new TypeError("transferGas requires a non-negative sourceIndex");
  }

  const resolvedSource = resolveGasContainer(source);
  const resolvedTarget = resolveGasContainer(options.target);
  if (!resolvedSource?.entity || !resolvedTarget) return 0;

  const sourceCount = GasStorage.getMaxGases(resolvedSource.entity);
  if (options.sourceIndex >= sourceCount) return 0;
  const sourceStorage = createStorage(resolvedSource.entity, options.sourceIndex);
  const type = sourceStorage.getType();
  const available = sourceStorage.get();
  if (!type || type === Constants.EMPTY_GAS_TYPE || available <= 0) return 0;

  const amount = normalizeAmount(options.maxAmount, available);
  if (amount <= 0) return 0;

  const targetIndices = options.targetIndices === undefined
    ? getGasInputIndices(resolvedTarget, { face: options.targetFace })
    : normalizeExplicitIndices(options.targetIndices, getResolvedCount(resolvedTarget));
  if (targetIndices.length === 0) return 0;

  let remaining = amount;
  for (const targetIndex of targetIndices) {
    if (remaining <= 0) break;
    const targetStorage = getOrCreateStorage(resolvedTarget, targetIndex, type);
    if (!targetStorage) continue;
    const targetType = targetStorage.getType();
    if (targetType !== Constants.EMPTY_GAS_TYPE && targetType !== type) continue;
    const moved = sourceStorage.transferTo(targetStorage, remaining);
    if (moved > 0) remaining -= moved;
  }
  return amount - remaining;
}

/**
 * Inserts an external gas source into allowed target indices.
 *
 * @param {GasContainerTarget} target
 * @param {GasInsertOptions} options
 * @returns {number}
 */
export function insertGas(target, options) {
  if (!options || typeof options.type !== "string" || options.type.length === 0) {
    throw new TypeError("insertGas requires a gas type");
  }
  const amount = normalizeAmount(options.amount, options.amount);
  if (amount <= 0 || options.type === Constants.EMPTY_GAS_TYPE) return 0;

  const resolved = resolveGasContainer(target);
  if (!resolved) return 0;
  const indices = options.indices === undefined
    ? getGasInputIndices(resolved, { face: options.face })
    : normalizeExplicitIndices(options.indices, getResolvedCount(resolved));

  const storages = [];
  let freeSpace = 0;
  for (const gasIndex of indices) {
    const storage = getOrCreateStorage(resolved, gasIndex, options.type);
    if (!storage) continue;
    const currentType = storage.getType();
    if (currentType !== Constants.EMPTY_GAS_TYPE && currentType !== options.type) continue;
    const free = storage.getFreeSpace();
    if (free <= 0) continue;
    storages.push(storage);
    freeSpace += free;
  }
  if (options.exact && freeSpace < amount) return 0;

  let remaining = amount;
  for (const storage of storages) {
    if (remaining <= 0) break;
    const currentType = storage.getType();
    if (currentType === Constants.EMPTY_GAS_TYPE) storage.setType(options.type);
    const added = storage.add(Math.min(remaining, storage.getFreeSpace()));
    if (added > 0) remaining -= added;
  }
  return amount - remaining;
}

/**
 * Returns one storage after validating the resolved index.
 *
 * @param {GasContainerTarget} target
 * @param {number} gasIndex
 * @returns {GasStorage|undefined}
 */
export function getGasStorage(target, gasIndex) {
  if (!Number.isInteger(gasIndex) || gasIndex < 0) return undefined;
  const resolved = resolveGasContainer(target);
  if (!resolved?.entity || gasIndex >= GasStorage.getMaxGases(resolved.entity)) return undefined;
  return createStorage(resolved.entity, gasIndex);
}

/** @param {ResolvedGasContainer} resolved */
function refreshResolved(resolved) {
  if (resolved.entity?.isValid) return resolved;
  if (resolved.block) return resolveGasContainerAt(resolved.block.dimension, resolved.block.location);
  return undefined;
}

/** @param {ResolvedGasContainer} resolved */
function getResolvedCount(resolved) {
  return resolved.entity ? GasStorage.getMaxGases(resolved.entity) : resolved.kind === "tank" ? 1 : 0;
}

/** @param {Entity} entity @param {number} gasIndex */
function createStorage(entity, gasIndex) {
  GasStorage.initializeObjectives(gasIndex);
  return new GasStorage(entity, gasIndex);
}

/** @param {ResolvedGasContainer} resolved @param {number} gasIndex @param {string} type */
function getOrCreateStorage(resolved, gasIndex, type) {
  if (!resolved.entity && resolved.kind === "tank" && resolved.block && gasIndex === 0) {
    const entity = GasStorage.addGasToTank(resolved.block, type, 0);
    if (entity) resolved.entity = entity;
  }
  if (!resolved.entity || gasIndex >= GasStorage.getMaxGases(resolved.entity)) return undefined;
  return createStorage(resolved.entity, gasIndex);
}

/** @param {ReadonlyArray<number>} indices @param {number} count */
function normalizeExplicitIndices(indices, count) {
  const normalized = [];
  const seen = new Set();
  for (const gasIndex of indices) {
    if (!Number.isInteger(gasIndex) || gasIndex < 0 || gasIndex >= count || seen.has(gasIndex)) continue;
    seen.add(gasIndex);
    normalized.push(gasIndex);
  }
  return normalized;
}

/** @param {number|undefined} requested @param {number} available */
function normalizeAmount(requested, available) {
  const amount = requested === undefined ? available : Number(requested);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(available, amount);
}

/** @param {Block} block */
function isGasTankBlock(block) {
  return typeof block?.typeId === "string" && block.typeId.includes("gas_tank");
}

/** @param {Entity} entity */
function isCompatibleGasEntity(entity) {
  try {
    return Boolean(entity?.isValid
      && entity.getComponent("minecraft:type_family")?.hasTypeFamily(GAS_CONTAINER_FAMILY));
  } catch {
    return false;
  }
}

/** @param {unknown} value @returns {value is ResolvedGasContainer} */
function isResolvedGasContainer(value) {
  return Boolean(value && typeof value === "object"
    && (value.kind === "entity" || value.kind === "tank")
    && Object.prototype.hasOwnProperty.call(value, "entity"));
}

/** @param {unknown} value @returns {value is Entity} */
function isEntityReference(value) {
  return Boolean(value && typeof value === "object" && typeof value.getComponent === "function"
    && typeof value.runCommand === "function");
}

/** @param {unknown} value @returns {value is Block} */
function isBlockReference(value) {
  return Boolean(value && typeof value === "object" && value.dimension && value.location
    && typeof value.typeId === "string");
}

/** @param {unknown} value @returns {value is Vector3} */
function isLocation(value) {
  return Boolean(value && typeof value === "object"
    && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z));
}

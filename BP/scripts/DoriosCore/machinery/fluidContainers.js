// @ts-check

import { FluidStorage } from "./fluidStorage.js";
import * as Constants from "./constants.js";
import {
  FLUID_CONTAINER_FAMILY,
  getFluidConfigRevision,
  getInputFluidIndices,
  getOutputFluidIndices,
} from "../interfaces/fluidIO.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../interfaces/fluidIO.js").FluidFace} FluidFace */

/**
 * @typedef {object} ResolvedFluidContainer
 * @property {"entity"|"tank"} kind
 * @property {Block|undefined} block
 * @property {Entity|undefined} entity
 */

/** @typedef {Block|Entity|ResolvedFluidContainer} FluidContainerTarget */

/**
 * @typedef {object} FluidTransferOptions
 * @property {number} sourceIndex Exact source fluid index selected by the caller.
 * @property {FluidContainerTarget} target
 * @property {FluidFace} [targetFace]
 * @property {ReadonlyArray<number>} [targetIndices] Explicit indices that override targetFace.
 * @property {number} [maxAmount]
 */

/**
 * @typedef {object} FluidInsertOptions
 * @property {string} type
 * @property {number} amount
 * @property {FluidFace} [face]
 * @property {ReadonlyArray<number>} [indices]
 * @property {boolean} [exact] When true, nothing is inserted unless the full amount fits.
 */

const EMPTY_INDICES = [];

/**
 * Resolves a compatible fluid entity or an empty UtilityCraft tank block.
 *
 * @param {FluidContainerTarget} target
 * @returns {ResolvedFluidContainer|undefined}
 */
export function resolveFluidContainer(target) {
  if (!target) return undefined;
  if (isResolvedFluidContainer(target)) return refreshResolved(target);
  if (isEntityReference(target)) {
    return isCompatibleFluidEntity(target)
      ? { kind: "entity", block: undefined, entity: target }
      : undefined;
  }
  if (isBlockReference(target)) return resolveFluidContainerAt(target.dimension, target.location);
  return undefined;
}

/**
 * Resolves a fluid container accessible through one block position. Multiblock
 * ports return their controller entity while preserving the real access block.
 *
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @returns {ResolvedFluidContainer|undefined}
 */
export function resolveFluidContainerAt(dimension, location) {
  if (!dimension || !isLocation(location)) return undefined;
  try {
    const block = dimension.getBlock(location);
    if (!block) return undefined;

    if (block.hasTag("dorios:multiblock.port") && block.hasTag("dorios:fluid")) {
      const entity = dimension.getEntities({
        tags: [`input:[${location.x},${location.y},${location.z}]`],
      }).find(isCompatibleFluidEntity);
      return entity ? { kind: "entity", block, entity } : undefined;
    }

    const entity = dimension.getEntitiesAtBlockLocation(location).find(isCompatibleFluidEntity);
    if (entity) return { kind: "entity", block, entity };
    if (isFluidTankBlock(block)) return { kind: "tank", block, entity: undefined };
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Returns fluid indices that accept insertion. Basic containers expose all of
 * their real indices; Complex containers use the requested face or fallback.
 *
 * @param {FluidContainerTarget} target
 * @param {{face?:FluidFace}} [options]
 */
export function getFluidInputIndices(target, options = {}) {
  const resolved = resolveFluidContainer(target);
  if (!resolved) return EMPTY_INDICES;
  if (!resolved.entity) return resolved.kind === "tank" ? [0] : EMPTY_INDICES;
  return getInputFluidIndices(resolved.entity, options);
}

/**
 * Returns fluid indices that allow extraction.
 *
 * @param {FluidContainerTarget} target
 * @param {{face?:FluidFace}} [options]
 */
export function getFluidOutputIndices(target, options = {}) {
  const resolved = resolveFluidContainer(target);
  if (!resolved?.entity) return EMPTY_INDICES;
  return getOutputFluidIndices(resolved.entity, options);
}

/** @param {FluidContainerTarget} target */
export function getFluidContainerRevision(target) {
  const resolved = resolveFluidContainer(target);
  return resolved?.entity ? getFluidConfigRevision(resolved.entity) : 0;
}

/**
 * Moves fluid from one exact source index. Source output policy belongs to the
 * caller, matching the low-level item transfer primitive.
 *
 * @param {FluidContainerTarget} source
 * @param {FluidTransferOptions} options
 * @returns {number}
 */
export function transferFluid(source, options) {
  if (!options || !Number.isInteger(options.sourceIndex) || options.sourceIndex < 0) {
    throw new TypeError("transferFluid requires a non-negative sourceIndex");
  }

  const resolvedSource = resolveFluidContainer(source);
  const resolvedTarget = resolveFluidContainer(options.target);
  if (!resolvedSource?.entity || !resolvedTarget) return 0;

  const sourceCount = FluidStorage.getMaxLiquids(resolvedSource.entity);
  if (options.sourceIndex >= sourceCount) return 0;
  const sourceStorage = createStorage(resolvedSource.entity, options.sourceIndex);
  const type = sourceStorage.getType();
  const available = sourceStorage.get();
  if (!type || type === Constants.EMPTY_FLUID_TYPE || available <= 0) return 0;

  const amount = normalizeAmount(options.maxAmount, available);
  if (amount <= 0) return 0;

  const targetIndices = options.targetIndices === undefined
    ? getFluidInputIndices(resolvedTarget, { face: options.targetFace })
    : normalizeExplicitIndices(options.targetIndices, getResolvedCount(resolvedTarget));
  if (targetIndices.length === 0) return 0;

  let remaining = amount;
  for (const targetIndex of targetIndices) {
    if (remaining <= 0) break;
    const targetStorage = getOrCreateStorage(resolvedTarget, targetIndex, type);
    if (!targetStorage) continue;
    const targetType = targetStorage.getType();
    if (targetType !== Constants.EMPTY_FLUID_TYPE && targetType !== type) continue;
    const moved = sourceStorage.transferTo(targetStorage, remaining);
    if (moved > 0) remaining -= moved;
  }
  return amount - remaining;
}

/**
 * Inserts an external fluid source into allowed target indices.
 *
 * @param {FluidContainerTarget} target
 * @param {FluidInsertOptions} options
 * @returns {number}
 */
export function insertFluid(target, options) {
  if (!options || typeof options.type !== "string" || options.type.length === 0) {
    throw new TypeError("insertFluid requires a fluid type");
  }
  const amount = normalizeAmount(options.amount, options.amount);
  if (amount <= 0 || options.type === Constants.EMPTY_FLUID_TYPE) return 0;

  const resolved = resolveFluidContainer(target);
  if (!resolved) return 0;
  const indices = options.indices === undefined
    ? getFluidInputIndices(resolved, { face: options.face })
    : normalizeExplicitIndices(options.indices, getResolvedCount(resolved));

  const storages = [];
  let freeSpace = 0;
  for (const fluidIndex of indices) {
    const storage = getOrCreateStorage(resolved, fluidIndex, options.type);
    if (!storage) continue;
    const currentType = storage.getType();
    if (currentType !== Constants.EMPTY_FLUID_TYPE && currentType !== options.type) continue;
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
    if (currentType === Constants.EMPTY_FLUID_TYPE) storage.setType(options.type);
    const added = storage.add(Math.min(remaining, storage.getFreeSpace()));
    if (added > 0) remaining -= added;
  }
  return amount - remaining;
}

/**
 * Returns one storage after validating the resolved index.
 *
 * @param {FluidContainerTarget} target
 * @param {number} fluidIndex
 * @returns {FluidStorage|undefined}
 */
export function getFluidStorage(target, fluidIndex) {
  if (!Number.isInteger(fluidIndex) || fluidIndex < 0) return undefined;
  const resolved = resolveFluidContainer(target);
  if (!resolved?.entity || fluidIndex >= FluidStorage.getMaxLiquids(resolved.entity)) return undefined;
  return createStorage(resolved.entity, fluidIndex);
}

/** @param {ResolvedFluidContainer} resolved */
function refreshResolved(resolved) {
  if (resolved.entity?.isValid) return resolved;
  if (resolved.block) return resolveFluidContainerAt(resolved.block.dimension, resolved.block.location);
  return undefined;
}

/** @param {ResolvedFluidContainer} resolved */
function getResolvedCount(resolved) {
  return resolved.entity ? FluidStorage.getMaxLiquids(resolved.entity) : resolved.kind === "tank" ? 1 : 0;
}

/** @param {Entity} entity @param {number} fluidIndex */
function createStorage(entity, fluidIndex) {
  FluidStorage.initializeObjectives(fluidIndex);
  return new FluidStorage(entity, fluidIndex);
}

/** @param {ResolvedFluidContainer} resolved @param {number} fluidIndex @param {string} type */
function getOrCreateStorage(resolved, fluidIndex, type) {
  if (!resolved.entity && resolved.kind === "tank" && resolved.block && fluidIndex === 0) {
    const entity = FluidStorage.addfluidToTank(resolved.block, type, 0);
    if (entity) resolved.entity = entity;
  }
  if (!resolved.entity || fluidIndex >= FluidStorage.getMaxLiquids(resolved.entity)) return undefined;
  return createStorage(resolved.entity, fluidIndex);
}

/** @param {ReadonlyArray<number>} indices @param {number} count */
function normalizeExplicitIndices(indices, count) {
  const normalized = [];
  const seen = new Set();
  for (const fluidIndex of indices) {
    if (!Number.isInteger(fluidIndex) || fluidIndex < 0 || fluidIndex >= count || seen.has(fluidIndex)) continue;
    seen.add(fluidIndex);
    normalized.push(fluidIndex);
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
function isFluidTankBlock(block) {
  return typeof block?.typeId === "string" && block.typeId.includes("fluid_tank");
}

/** @param {Entity} entity */
function isCompatibleFluidEntity(entity) {
  try {
    return Boolean(entity?.isValid
      && entity.getComponent("minecraft:type_family")?.hasTypeFamily(FLUID_CONTAINER_FAMILY));
  } catch {
    return false;
  }
}

/** @param {unknown} value @returns {value is ResolvedFluidContainer} */
function isResolvedFluidContainer(value) {
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

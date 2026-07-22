// @ts-check

import { system, world } from "@minecraft/server";
import { isPlainObject } from "../../DoriosLib/utils/index.js";
import { IO_CONFIG_PROPERTY } from "../../DoriosLib/containers/constants.js";
import { GasStorage } from "../machinery/gasStorage.js";
import { DIRECTIONS } from "../utils/directions.js";

export const GAS_CONFIG_VERSION = 1;
export const GAS_CONFIG_KEY = "gases";
export const GAS_CONTAINER_FAMILY = "dorios:gas_container";
export const GAS_CONFIG_EVENT_NAMESPACE = "dorios_gas";
export const SET_GAS_CONFIG_EVENT_ID = `${GAS_CONFIG_EVENT_NAMESPACE}:set_config`;
export const DEFAULT_GAS_IO_MODE = "disabled";

/** @typedef {"north"|"south"|"east"|"west"|"up"|"down"} GasFace */
/** @typedef {Partial<Record<GasFace, number[]>>} FaceIndexConfig */

/**
 * @typedef {object} SimpleGasConfig
 * @property {1} version
 * @property {"simple"} type
 * @property {number[]} inputConfig
 * @property {number[]} outputConfig
 */

/**
 * @typedef {object} ComplexGasConfig
 * @property {1} version
 * @property {"complex"} type
 * @property {number[]} anyInputIndices
 * @property {number[]} anyOutputIndices
 * @property {FaceIndexConfig} inputConfig
 * @property {FaceIndexConfig} outputConfig
 */

/** @typedef {SimpleGasConfig|ComplexGasConfig} GasConfig */

/**
 * @typedef {object} GasIOMode
 * @property {string} id
 * @property {number[]} inputIndices
 * @property {number[]} outputIndices
 */

/**
 * @typedef {object} GasIODefinition
 * @property {number[]} anyInputIndices
 * @property {number[]} anyOutputIndices
 * @property {GasIOMode[]} modes
 */

/** @type {Map<string,GasIODefinition>} */
const definitions = new Map();
/** @type {Map<string,number>} */
const definitionRevisions = new Map();

/** @typedef {{status:"unsupported"|"invalid"}} EmptyCacheEntry */
/** @typedef {{status:"basic",count:number,indices:number[]}} BasicCacheEntry */
/** @typedef {{status:"configured",config:GasConfig,revision:number}} ConfiguredCacheEntry */
/** @typedef {EmptyCacheEntry|BasicCacheEntry|ConfiguredCacheEntry} CacheEntry */

/** @type {Map<string,CacheEntry>} */
const configCache = new Map();
/** @type {Map<string,{signature:string,config:ComplexGasConfig}>} */
const pendingEntities = new Map();
/** @type {Map<string,{blockTypeId:string,configRevision:number,definitionRevision:number}>} */
const validatedEntities = new Map();
/** @type {Map<string,{blockTypeId:string,definitionRevision:number,signature:string}>} */
const publishedEntities = new Map();

const EMPTY_INDICES = [];
let nextConfigRevision = 1;

/** @type {GasIODefinition} */
const EMPTY_DEFINITION = {
  anyInputIndices: [],
  anyOutputIndices: [],
  modes: [{ id: DEFAULT_GAS_IO_MODE, inputIndices: [], outputIndices: [] }],
};

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  configCache.delete(removedEntityId);
  pendingEntities.delete(removedEntityId);
  validatedEntities.delete(removedEntityId);
  publishedEntities.delete(removedEntityId);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== SET_GAS_CONFIG_EVENT_ID || !event.sourceEntity) return;

  try {
    applyGasConfig(event.sourceEntity, JSON.parse(event.message));
  } catch (error) {
    console.warn("[DoriosCore:gasIO] Ignored invalid gas configuration", error);
  }
}, {
  namespaces: [GAS_CONFIG_EVENT_NAMESPACE],
});

/**
 * Registers the static gas-index policy and visual modes of a machine type.
 *
 * @param {string} blockTypeId
 * @param {unknown} value
 * @returns {GasIODefinition}
 */
export function registerGasIODefinition(blockTypeId, value) {
  if (typeof blockTypeId !== "string" || blockTypeId.length === 0) {
    throw new TypeError("blockTypeId must be a non-empty string");
  }

  const definition = normalizeDefinition(value);
  definitions.set(blockTypeId, cloneDefinition(definition));
  definitionRevisions.set(blockTypeId, (definitionRevisions.get(blockTypeId) ?? 0) + 1);
  return cloneDefinition(definition);
}

/** @param {string} blockTypeId @returns {GasIODefinition|undefined} */
export function getGasIODefinition(blockTypeId) {
  const definition = definitions.get(blockTypeId);
  return definition ? cloneDefinition(definition) : undefined;
}

/**
 * Ensures a registered machine owns a valid Complex gas-index document.
 * Unregistered gas containers remain Basic and expose every real tank index.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} blockTypeId
 * @returns {boolean}
 */
export function ensureGasIOConfig(entity, blockTypeId) {
  const definition = definitions.get(blockTypeId);
  if (!definition || !isCompatibleGasEntity(entity)) return false;

  const count = GasStorage.getMaxGases(entity);
  if (count < getRequiredGasCount(definition)) return false;

  const status = getGasStatus(entity);
  const definitionRevision = definitionRevisions.get(blockTypeId) ?? 0;
  if (status === "unsupported") return false;

  if (status === "complex") {
    const pending = pendingEntities.get(entity.id);
    let current = getGasConfig(entity);
    if (pending) {
      if (current?.type !== "complex" || pending.signature !== getConfigSignature(current)) return false;
      pendingEntities.delete(entity.id);
    }
    if (current?.type !== "complex") return false;

    const configRevision = getGasConfigRevision(entity);
    const validated = validatedEntities.get(entity.id);
    if (validated?.blockTypeId === blockTypeId
      && validated.configRevision === configRevision
      && validated.definitionRevision === definitionRevision) return true;

    const reconciled = reconcileConfig(current, definition);
    if (reconciled.changed) {
      publishConfig(entity, reconciled.config, blockTypeId, definitionRevision);
      return false;
    }

    const signature = getConfigSignature(reconciled.config);
    const published = publishedEntities.get(entity.id);
    if (published?.blockTypeId !== blockTypeId
      || published.definitionRevision !== definitionRevision
      || published.signature !== signature) {
      publishConfig(entity, reconciled.config, blockTypeId, definitionRevision);
      return false;
    }

    validatedEntities.set(entity.id, { blockTypeId, configRevision, definitionRevision });
    return true;
  }

  validatedEntities.delete(entity.id);
  publishConfig(entity, createEmptyConfig(definition), blockTypeId, definitionRevision);
  return false;
}

/**
 * Publishes a complete gas configuration through a cross-addon script event.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {GasConfig} config
 */
export function setGasConfig(entity, config) {
  const count = requireCompatibleGasEntity(entity);
  const normalized = normalizeGasConfig(config, count);
  entity.runCommand(`scriptevent ${SET_GAS_CONFIG_EVENT_ID} ${JSON.stringify(normalized)}`);
  configCache.set(entity.id, createConfiguredEntry(normalized));
  return true;
}

/** @param {import("@minecraft/server").Entity} entity @returns {GasConfig|undefined} */
export function getGasConfig(entity) {
  const entry = resolveCacheEntry(entity);
  return entry.status === "configured" ? cloneGasConfig(entry.config) : undefined;
}

/** @param {import("@minecraft/server").Entity} entity */
export function getGasConfigRevision(entity) {
  const entry = resolveCacheEntry(entity);
  return entry.status === "configured" ? entry.revision : 0;
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @returns {"basic"|"simple"|"complex"|"invalid"|"unsupported"}
 */
export function getGasStatus(entity) {
  const entry = resolveCacheEntry(entity);
  return entry.status === "configured" ? entry.config.type : entry.status;
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {{face?:GasFace}} [options]
 * @returns {ReadonlyArray<number>}
 */
export function getInputGasIndices(entity, options = {}) {
  return resolveIndices(entity, "input", options.face);
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {{face?:GasFace}} [options]
 * @returns {ReadonlyArray<number>}
 */
export function getOutputGasIndices(entity, options = {}) {
  return resolveIndices(entity, "output", options.face);
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} blockTypeId
 * @param {string} direction
 */
export function getGasIODirectionMode(entity, blockTypeId, direction) {
  if (!DIRECTIONS.includes(direction)) return DEFAULT_GAS_IO_MODE;
  const definition = definitions.get(blockTypeId) ?? EMPTY_DEFINITION;
  const pending = pendingEntities.get(entity.id);
  if (pending) return findModeForFace(pending.config, definition, direction)?.id ?? DEFAULT_GAS_IO_MODE;
  if (!ensureGasIOConfig(entity, blockTypeId)) return DEFAULT_GAS_IO_MODE;

  return findModeForIndices(
    definition,
    getInputGasIndices(entity, { face: /** @type {GasFace} */ (direction) }),
    getOutputGasIndices(entity, { face: /** @type {GasFace} */ (direction) }),
  )?.id ?? DEFAULT_GAS_IO_MODE;
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} blockTypeId
 * @param {string} direction
 */
export function cycleGasIODirectionMode(entity, blockTypeId, direction) {
  if (!DIRECTIONS.includes(direction)) return DEFAULT_GAS_IO_MODE;
  const definition = definitions.get(blockTypeId) ?? EMPTY_DEFINITION;
  const pending = pendingEntities.get(entity.id);
  if (!pending && !ensureGasIOConfig(entity, blockTypeId)) return DEFAULT_GAS_IO_MODE;

  const current = pending ? cloneGasConfig(pending.config) : getGasConfig(entity);
  if (current?.type !== "complex") return DEFAULT_GAS_IO_MODE;

  const currentMode = findModeForFace(current, definition, direction);
  const disabledIndex = definition.modes.findIndex((mode) => mode.id === DEFAULT_GAS_IO_MODE);
  const currentIndex = currentMode ? definition.modes.indexOf(currentMode) : disabledIndex;
  const nextMode = definition.modes[(currentIndex + 1) % definition.modes.length]
    ?? definition.modes[0]
    ?? EMPTY_DEFINITION.modes[0];
  const face = /** @type {GasFace} */ (direction);

  delete current.inputConfig[face];
  delete current.outputConfig[face];
  if (nextMode.inputIndices.length > 0) current.inputConfig[face] = [...nextMode.inputIndices];
  if (nextMode.outputIndices.length > 0) current.outputConfig[face] = [...nextMode.outputIndices];

  publishConfig(entity, current, blockTypeId, definitionRevisions.get(blockTypeId) ?? 0);
  return nextMode.id;
}

/** @param {unknown} value @param {number} count @returns {GasConfig} */
export function normalizeGasConfig(value, count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError("gas count must be a non-negative integer");
  if (!isPlainObject(value)) throw new TypeError("Gas configuration must be an object");
  if (value.version !== GAS_CONFIG_VERSION) {
    throw new RangeError(`Unsupported gas configuration version: ${String(value.version)}`);
  }

  if (value.type === "simple") {
    return {
      version: GAS_CONFIG_VERSION,
      type: "simple",
      inputConfig: normalizeIndices(value.inputConfig, count, "inputConfig"),
      outputConfig: normalizeIndices(value.outputConfig, count, "outputConfig"),
    };
  }
  if (value.type === "complex") {
    return {
      version: GAS_CONFIG_VERSION,
      type: "complex",
      anyInputIndices: normalizeIndices(value.anyInputIndices, count, "anyInputIndices"),
      anyOutputIndices: normalizeIndices(value.anyOutputIndices, count, "anyOutputIndices"),
      inputConfig: normalizeFaceConfig(value.inputConfig, count, "inputConfig"),
      outputConfig: normalizeFaceConfig(value.outputConfig, count, "outputConfig"),
    };
  }
  throw new TypeError(`Unknown gas configuration type: ${String(value.type)}`);
}

/** @param {GasConfig} config @returns {GasConfig} */
export function cloneGasConfig(config) {
  if (config.type === "simple") {
    return {
      version: GAS_CONFIG_VERSION,
      type: "simple",
      inputConfig: [...config.inputConfig],
      outputConfig: [...config.outputConfig],
    };
  }
  return {
    version: GAS_CONFIG_VERSION,
    type: "complex",
    anyInputIndices: [...config.anyInputIndices],
    anyOutputIndices: [...config.anyOutputIndices],
    inputConfig: cloneFaceConfig(config.inputConfig),
    outputConfig: cloneFaceConfig(config.outputConfig),
  };
}

/** @param {unknown} value */
function normalizeDefinition(value) {
  if (!isPlainObject(value)) throw new TypeError("Gas IO definition must be an object");
  const anyInputIndices = normalizeDeclaredIndices(value.anyInputIndices, "gases.anyInputIndices");
  const anyOutputIndices = normalizeDeclaredIndices(value.anyOutputIndices, "gases.anyOutputIndices");
  const modes = normalizeModes(value.modes);
  const declaredInputs = new Set(modes.flatMap((mode) => mode.inputIndices));
  const declaredOutputs = new Set(modes.flatMap((mode) => mode.outputIndices));
  assertSubset(anyInputIndices, declaredInputs, "gases.anyInputIndices", "mode inputIndices");
  assertSubset(anyOutputIndices, declaredOutputs, "gases.anyOutputIndices", "mode outputIndices");
  return { anyInputIndices, anyOutputIndices, modes };
}

/** @param {unknown} value @returns {GasIOMode[]} */
function normalizeModes(value) {
  if (!Array.isArray(value)) throw new TypeError("gases.modes must be an array");
  /** @type {GasIOMode[]} */
  const modes = [];
  const ids = new Set();
  const signatures = new Set();

  for (const [index, entry] of value.entries()) {
    if (!isPlainObject(entry)) throw new TypeError(`gases.modes[${index}] must be an object`);
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      throw new TypeError(`gases.modes[${index}].id must be a non-empty string`);
    }
    if (ids.has(entry.id)) throw new RangeError(`Duplicate gas IO mode: ${entry.id}`);

    const inputIndices = entry.inputIndices === undefined
      ? []
      : normalizeDeclaredIndices(entry.inputIndices, `gases.modes[${index}].inputIndices`);
    const outputIndices = entry.outputIndices === undefined
      ? []
      : normalizeDeclaredIndices(entry.outputIndices, `gases.modes[${index}].outputIndices`);
    if (entry.id === DEFAULT_GAS_IO_MODE && (inputIndices.length > 0 || outputIndices.length > 0)) {
      throw new RangeError(`${DEFAULT_GAS_IO_MODE} cannot expose gas indices`);
    }
    if (entry.id !== DEFAULT_GAS_IO_MODE && inputIndices.length === 0 && outputIndices.length === 0) {
      throw new RangeError(`Gas IO mode ${entry.id} must expose at least one index`);
    }

    const signature = getModeSignature(inputIndices, outputIndices);
    if (signatures.has(signature)) {
      throw new RangeError(`Gas IO mode ${entry.id} duplicates another mode's index configuration`);
    }
    ids.add(entry.id);
    signatures.add(signature);
    modes.push({ id: entry.id, inputIndices, outputIndices });
  }

  if (!ids.has(DEFAULT_GAS_IO_MODE)) {
    modes.unshift({ id: DEFAULT_GAS_IO_MODE, inputIndices: [], outputIndices: [] });
  }
  return modes;
}

/** @param {unknown} value @param {string} path */
function normalizeDeclaredIndices(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  const indices = [];
  const seen = new Set();
  for (const gasIndex of value) {
    if (!Number.isInteger(gasIndex) || gasIndex < 0 || gasIndex > 255) {
      throw new RangeError(`${path} contains invalid gas index ${String(gasIndex)}`);
    }
    if (seen.has(gasIndex)) continue;
    seen.add(gasIndex);
    indices.push(gasIndex);
  }
  return indices;
}

/** @param {unknown} value @param {number} count @param {string} path */
function normalizeIndices(value, count, path) {
  const indices = normalizeDeclaredIndices(value, path);
  for (const gasIndex of indices) {
    if (gasIndex >= count) throw new RangeError(`${path} contains out-of-range gas index ${gasIndex}`);
  }
  return indices;
}

/** @param {unknown} value @param {number} count @param {string} path @returns {FaceIndexConfig} */
function normalizeFaceConfig(value, count, path) {
  if (!isPlainObject(value)) throw new TypeError(`${path} must be an object`);
  for (const face of Object.keys(value)) {
    if (!DIRECTIONS.includes(face)) throw new RangeError(`${path} contains unknown face ${face}`);
  }
  /** @type {FaceIndexConfig} */
  const normalized = {};
  for (const direction of DIRECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(value, direction)) continue;
    const indices = normalizeIndices(value[direction], count, `${path}.${direction}`);
    if (indices.length > 0) normalized[/** @type {GasFace} */ (direction)] = indices;
  }
  return normalized;
}

/** @param {FaceIndexConfig} config */
function cloneFaceConfig(config) {
  /** @type {FaceIndexConfig} */
  const clone = {};
  for (const direction of DIRECTIONS) {
    const face = /** @type {GasFace} */ (direction);
    if (config[face]) clone[face] = [...config[face]];
  }
  return clone;
}

/** @param {number[]} values @param {Set<number>} allowed @param {string} valuePath @param {string} allowedPath */
function assertSubset(values, allowed, valuePath, allowedPath) {
  for (const gasIndex of values) {
    if (!allowed.has(gasIndex)) {
      throw new RangeError(`${valuePath} index ${gasIndex} is not declared by any ${allowedPath}`);
    }
  }
}

/** @param {GasIODefinition} definition */
function getRequiredGasCount(definition) {
  let highest = -1;
  for (const gasIndex of definition.anyInputIndices) highest = Math.max(highest, gasIndex);
  for (const gasIndex of definition.anyOutputIndices) highest = Math.max(highest, gasIndex);
  for (const mode of definition.modes) {
    for (const gasIndex of mode.inputIndices) highest = Math.max(highest, gasIndex);
    for (const gasIndex of mode.outputIndices) highest = Math.max(highest, gasIndex);
  }
  return highest + 1;
}

/** @param {GasIODefinition} definition @returns {ComplexGasConfig} */
function createEmptyConfig(definition) {
  return {
    version: GAS_CONFIG_VERSION,
    type: "complex",
    anyInputIndices: [...definition.anyInputIndices],
    anyOutputIndices: [...definition.anyOutputIndices],
    inputConfig: {},
    outputConfig: {},
  };
}

/** @param {ComplexGasConfig} current @param {GasIODefinition} definition */
function reconcileConfig(current, definition) {
  const config = createEmptyConfig(definition);
  let changed = !arraysEqual(current.anyInputIndices, definition.anyInputIndices)
    || !arraysEqual(current.anyOutputIndices, definition.anyOutputIndices);

  for (const direction of DIRECTIONS) {
    const face = /** @type {GasFace} */ (direction);
    const mode = findModeForFace(current, definition, direction);
    if (!mode || mode.id === DEFAULT_GAS_IO_MODE) {
      if (current.inputConfig[face]?.length || current.outputConfig[face]?.length) changed = true;
      continue;
    }
    if (mode.inputIndices.length > 0) config.inputConfig[face] = [...mode.inputIndices];
    if (mode.outputIndices.length > 0) config.outputConfig[face] = [...mode.outputIndices];
    changed ||= !arraysEqual(current.inputConfig[face] ?? [], mode.inputIndices)
      || !arraysEqual(current.outputConfig[face] ?? [], mode.outputIndices);
  }
  return { changed, config };
}

/** @param {ComplexGasConfig} config @param {GasIODefinition} definition @param {string} direction */
function findModeForFace(config, definition, direction) {
  const face = /** @type {GasFace} */ (direction);
  return findModeForIndices(definition, config.inputConfig[face] ?? [], config.outputConfig[face] ?? []);
}

/** @param {GasIODefinition} definition @param {ReadonlyArray<number>} inputs @param {ReadonlyArray<number>} outputs */
function findModeForIndices(definition, inputs, outputs) {
  return definition.modes.find((mode) => (
    arraysEqual(inputs, mode.inputIndices) && arraysEqual(outputs, mode.outputIndices)
  ));
}

/** @param {ReadonlyArray<number>} left @param {ReadonlyArray<number>} right */
function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** @param {number[]} inputs @param {number[]} outputs */
function getModeSignature(inputs, outputs) {
  return `${inputs.join(",")}|${outputs.join(",")}`;
}

/** @param {ComplexGasConfig} config */
function getConfigSignature(config) {
  return JSON.stringify({
    anyInputIndices: config.anyInputIndices,
    anyOutputIndices: config.anyOutputIndices,
    faces: DIRECTIONS.map((direction) => {
      const face = /** @type {GasFace} */ (direction);
      return { direction, input: config.inputConfig[face] ?? [], output: config.outputConfig[face] ?? [] };
    }),
  });
}

/** @param {GasIODefinition} definition */
function cloneDefinition(definition) {
  return {
    anyInputIndices: [...definition.anyInputIndices],
    anyOutputIndices: [...definition.anyOutputIndices],
    modes: definition.modes.map((mode) => ({
      id: mode.id,
      inputIndices: [...mode.inputIndices],
      outputIndices: [...mode.outputIndices],
    })),
  };
}

/** @param {import("@minecraft/server").Entity} entity @param {ComplexGasConfig} config @param {string} blockTypeId @param {number} definitionRevision */
function publishConfig(entity, config, blockTypeId, definitionRevision) {
  const snapshot = /** @type {ComplexGasConfig} */ (cloneGasConfig(config));
  const signature = getConfigSignature(snapshot);
  if (pendingEntities.get(entity.id)?.signature === signature) return;

  validatedEntities.delete(entity.id);
  pendingEntities.set(entity.id, { signature, config: snapshot });
  try {
    setGasConfig(entity, snapshot);
    publishedEntities.set(entity.id, { blockTypeId, definitionRevision, signature });
  } catch (error) {
    if (pendingEntities.get(entity.id)?.signature === signature) pendingEntities.delete(entity.id);
    throw error;
  }

  system.runTimeout(() => {
    if (pendingEntities.get(entity.id)?.signature === signature) pendingEntities.delete(entity.id);
  }, 20);
}

/** @param {import("@minecraft/server").Entity} entity @param {"input"|"output"} operation @param {GasFace|undefined} face */
function resolveIndices(entity, operation, face) {
  const entry = resolveCacheEntry(entity);
  if (entry.status === "basic") return entry.indices;
  if (entry.status !== "configured") return EMPTY_INDICES;
  const config = entry.config;
  if (config.type === "simple") return operation === "input" ? config.inputConfig : config.outputConfig;
  if (face === undefined) return operation === "input" ? config.anyInputIndices : config.anyOutputIndices;
  if (!DIRECTIONS.includes(face)) return EMPTY_INDICES;
  return (operation === "input" ? config.inputConfig[face] : config.outputConfig[face]) ?? EMPTY_INDICES;
}

/** @param {import("@minecraft/server").Entity} entity @returns {CacheEntry} */
function resolveCacheEntry(entity) {
  if (!isCompatibleGasEntity(entity)) return { status: "unsupported" };
  const count = GasStorage.getMaxGases(entity);
  const cached = configCache.get(entity.id);
  if (cached?.status === "configured" || cached?.status === "invalid") return cached;
  if (cached?.status === "basic" && cached.count === count) return cached;

  const root = readRoot(entity);
  if (!Object.prototype.hasOwnProperty.call(root, GAS_CONFIG_KEY)) {
    const entry = { status: /** @type {"basic"} */ ("basic"), count, indices: createAllIndices(count) };
    configCache.set(entity.id, entry);
    return entry;
  }

  try {
    const entry = createConfiguredEntry(normalizeGasConfig(root[GAS_CONFIG_KEY], count));
    configCache.set(entity.id, entry);
    return entry;
  } catch {
    const entry = { status: /** @type {"invalid"} */ ("invalid") };
    configCache.set(entity.id, entry);
    return entry;
  }
}

/** @param {GasConfig} config @returns {ConfiguredCacheEntry} */
function createConfiguredEntry(config) {
  const revision = nextConfigRevision;
  nextConfigRevision = nextConfigRevision >= Number.MAX_SAFE_INTEGER ? 1 : nextConfigRevision + 1;
  return { status: "configured", config: cloneGasConfig(config), revision };
}

/** @param {number} count */
function createAllIndices(count) {
  return Array.from({ length: count }, (_, index) => index);
}

/** @param {import("@minecraft/server").Entity} entity */
function isCompatibleGasEntity(entity) {
  try {
    return Boolean(entity?.isValid
      && entity.getComponent("minecraft:type_family")?.hasTypeFamily(GAS_CONTAINER_FAMILY));
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Entity} entity */
function requireCompatibleGasEntity(entity) {
  if (!isCompatibleGasEntity(entity)) throw new TypeError("Entity is not a compatible gas container");
  return GasStorage.getMaxGases(entity);
}

/** @param {import("@minecraft/server").Entity} entity */
function readRoot(entity) {
  const raw = entity.getDynamicProperty(IO_CONFIG_PROPERTY);
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {import("@minecraft/server").Entity} entity @param {unknown} value */
function applyGasConfig(entity, value) {
  const count = requireCompatibleGasEntity(entity);
  const config = normalizeGasConfig(value, count);
  const root = readRoot(entity);
  root[GAS_CONFIG_KEY] = config;
  entity.setDynamicProperty(IO_CONFIG_PROPERTY, JSON.stringify(root));
  configCache.set(entity.id, createConfiguredEntry(config));
}

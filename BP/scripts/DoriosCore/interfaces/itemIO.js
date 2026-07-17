// @ts-check

import { system, world } from "@minecraft/server";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import { DIRECTIONS } from "../utils/directions.js";

export const DEFAULT_ITEM_IO_MODE = "disabled";

/** @typedef {import("../../DoriosLib/containers/config.js").ComplexItemConfig} ComplexItemConfig */
/** @typedef {import("../../DoriosLib/containers/config.js").ContainerFace} ContainerFace */

/**
 * @typedef {object} ItemIOMode
 * @property {string} id Visual mode identifier written to the IO button name tag.
 * @property {number[]} inputSlots Machine slots that accept items in this mode.
 * @property {number[]} outputSlots Machine slots that expose items in this mode.
 */

/**
 * @typedef {object} ItemIODefinition
 * @property {number[]} anyInputSlots Slots accepted when the source face is unavailable.
 * @property {number[]} anyOutputSlots Slots exposed when the destination face is unavailable.
 * @property {ItemIOMode[]} modes Ordered modes cycled by the six IO buttons.
 */

/** @type {Map<string, ItemIODefinition>} */
const definitions = new Map();

/** @type {Map<string, number>} */
const definitionRevisions = new Map();

/**
 * @typedef {object} PendingConfig
 * @property {string} signature
 * @property {ComplexItemConfig} config
 */

/** Latest optimistic configs waiting for their script event to be applied. */
/** @type {Map<string, PendingConfig>} */
const pendingEntities = new Map();

/**
 * @typedef {object} ValidatedConfig
 * @property {string} blockTypeId
 * @property {number} configRevision
 * @property {number} definitionRevision
 */

/** Config/definition revisions already checked against every registered mode. */
/** @type {Map<string, ValidatedConfig>} */
const validatedEntities = new Map();

/**
 * @typedef {object} PublishedConfig
 * @property {string} blockTypeId
 * @property {number} definitionRevision
 * @property {string} signature
 */

/** Complete configs already announced by their owning machine this runtime. */
/** @type {Map<string, PublishedConfig>} */
const publishedEntities = new Map();

/** @type {ItemIODefinition} */
const EMPTY_DEFINITION = {
  anyInputSlots: [],
  anyOutputSlots: [],
  modes: [{ id: DEFAULT_ITEM_IO_MODE, inputSlots: [], outputSlots: [] }],
};

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  pendingEntities.delete(removedEntityId);
  validatedEntities.delete(removedEntityId);
  publishedEntities.delete(removedEntityId);
});

/**
 * Registers the static item policy for one machine block type.
 *
 * The policy is intentionally separate from the entity DP. The registry owns
 * mode names and UI choices; each entity DP owns its current per-face slots.
 *
 * @param {string} blockTypeId Machine block identifier.
 * @param {unknown} value Raw item IO definition.
 * @returns {ItemIODefinition} Canonical registered definition.
 */
export function registerItemIODefinition(blockTypeId, value) {
  if (typeof blockTypeId !== "string" || blockTypeId.length === 0) {
    throw new TypeError("blockTypeId must be a non-empty string");
  }

  const definition = normalizeDefinition(value);
  definitions.set(blockTypeId, cloneDefinition(definition));
  definitionRevisions.set(blockTypeId, (definitionRevisions.get(blockTypeId) ?? 0) + 1);
  return cloneDefinition(definition);
}

/**
 * Gets the registered policy for a machine block.
 *
 * @param {string} blockTypeId Machine block identifier.
 * @returns {ItemIODefinition|undefined}
 */
export function getItemIODefinition(blockTypeId) {
  const definition = definitions.get(blockTypeId);
  return definition ? cloneDefinition(definition) : undefined;
}

/**
 * Ensures a machine entity has a valid Complex item configuration.
 *
 * Machines without an explicit item definition receive a fail-closed Complex
 * config. This prevents their UI, energy, or upgrade slots from becoming a
 * Basic container merely because they do not expose item IO.
 *
 * The write is published through DoriosContainers so every addon in the world
 * receives the same configuration. Processing is skipped until that event has
 * been applied locally.
 *
 * @param {import("@minecraft/server").Entity} entity Machine entity.
 * @param {string} blockTypeId Machine block identifier.
 * @param {object} [options] Initialization safeguards.
 * @param {boolean} [options.failClosedWhileResizing=false] Publish a temporary
 * empty Complex policy when a newly spawned entity still exposes its base
 * inventory size.
 * @returns {boolean} True when the current DP already matches the policy.
 */
export function ensureItemIOConfig(entity, blockTypeId, options = {}) {
  const definition = definitions.get(blockTypeId) ?? EMPTY_DEFINITION;
  const containerSize = getEntityContainerSize(entity);
  if (containerSize === undefined) return false;

  if (containerSize < getRequiredContainerSize(definition)) {
    if (options.failClosedWhileResizing === true) {
      publishConfig(
        entity,
        createEmptyConfig(EMPTY_DEFINITION),
        blockTypeId,
        definitionRevisions.get(blockTypeId) ?? 0,
      );
    }
    return false;
  }

  const status = DoriosContainer.getStatus(entity);

  if (status === "unsupported") return false;

  if (status === "complex") {
    let current;
    const pending = pendingEntities.get(entity.id);
    if (pending) {
      current = DoriosContainer.getConfig(entity);
      if (current?.type !== "complex") return false;
      if (pending.signature !== getConfigSignature(current)) return false;
      pendingEntities.delete(entity.id);
    }

    const configRevision = DoriosContainer.getConfigRevision(entity);
    const definitionRevision = definitionRevisions.get(blockTypeId) ?? 0;
    const validated = validatedEntities.get(entity.id);
    if (validated?.blockTypeId === blockTypeId
      && validated.configRevision === configRevision
      && validated.definitionRevision === definitionRevision) {
      return true;
    }

    current ??= DoriosContainer.getConfig(entity);
    if (current?.type !== "complex") return false;

    const reconciled = reconcileConfig(current, definition);
    if (!reconciled.changed) {
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

    publishConfig(entity, reconciled.config, blockTypeId, definitionRevision);
    return false;
  }

  validatedEntities.delete(entity.id);
  publishConfig(
    entity,
    createEmptyConfig(definition),
    blockTypeId,
    definitionRevisions.get(blockTypeId) ?? 0,
  );
  return false;
}

/**
 * Returns the minimum inventory size needed by every operational item slot in
 * a registered definition. UI button slots are intentionally excluded because
 * they are not part of the persisted container policy.
 *
 * @param {ItemIODefinition} definition
 * @returns {number}
 */
function getRequiredContainerSize(definition) {
  let highestSlot = -1;

  for (const slot of definition.anyInputSlots) highestSlot = Math.max(highestSlot, slot);
  for (const slot of definition.anyOutputSlots) highestSlot = Math.max(highestSlot, slot);
  for (const mode of definition.modes) {
    for (const slot of mode.inputSlots) highestSlot = Math.max(highestSlot, slot);
    for (const slot of mode.outputSlots) highestSlot = Math.max(highestSlot, slot);
  }

  return highestSlot + 1;
}

/**
 * Reads the current native inventory size without exposing component timing or
 * invalid-entity errors to callers during entity initialization.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @returns {number|undefined}
 */
function getEntityContainerSize(entity) {
  try {
    const container = entity?.getComponent("minecraft:inventory")?.container;
    if (!container || container.isValid === false) return undefined;
    return container.size;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the visual mode represented by one absolute face.
 *
 * A custom or stale slot combination is displayed as disabled. Pressing that
 * button then clears both branches before applying the next registered mode.
 *
 * @param {import("@minecraft/server").Entity} entity Machine entity.
 * @param {string} blockTypeId Machine block identifier.
 * @param {string} direction Absolute direction.
 * @returns {string} Registered mode ID, or `disabled`.
 */
export function getItemIODirectionMode(entity, blockTypeId, direction) {
  if (!DIRECTIONS.includes(direction)) return DEFAULT_ITEM_IO_MODE;

  const definition = definitions.get(blockTypeId) ?? EMPTY_DEFINITION;
  const pending = pendingEntities.get(entity.id);
  if (pending) return findModeForFace(pending.config, definition, direction)?.id ?? DEFAULT_ITEM_IO_MODE;

  if (!ensureItemIOConfig(entity, blockTypeId)) return DEFAULT_ITEM_IO_MODE;

  const mode = findModeForSlots(
    definition,
    DoriosContainer.getInputSlots(entity, { face: /** @type {ContainerFace} */ (direction) }),
    DoriosContainer.getOutputSlots(entity, { face: /** @type {ContainerFace} */ (direction) }),
  );
  return mode?.id ?? DEFAULT_ITEM_IO_MODE;
}

/**
 * Advances one absolute face to its next registered mode.
 *
 * @param {import("@minecraft/server").Entity} entity Machine entity.
 * @param {string} blockTypeId Machine block identifier.
 * @param {string} direction Absolute direction.
 * @returns {string} Mode ID that will be applied, or `disabled` while pending.
 */
export function cycleItemIODirectionMode(entity, blockTypeId, direction) {
  if (!DIRECTIONS.includes(direction)) return DEFAULT_ITEM_IO_MODE;

  const definition = definitions.get(blockTypeId) ?? EMPTY_DEFINITION;
  const pending = pendingEntities.get(entity.id);
  if (!pending && !ensureItemIOConfig(entity, blockTypeId)) return DEFAULT_ITEM_IO_MODE;

  const config = pending
    ? cloneComplexConfig(pending.config)
    : DoriosContainer.getConfig(entity);
  if (config?.type !== "complex") return DEFAULT_ITEM_IO_MODE;

  const currentMode = findModeForFace(config, definition, direction);
  const disabledIndex = definition.modes.findIndex((mode) => mode.id === DEFAULT_ITEM_IO_MODE);
  const currentIndex = currentMode ? definition.modes.indexOf(currentMode) : disabledIndex;
  const nextMode = definition.modes[(currentIndex + 1) % definition.modes.length]
    ?? definition.modes[0]
    ?? EMPTY_DEFINITION.modes[0];

  delete config.inputConfig[/** @type {ContainerFace} */ (direction)];
  delete config.outputConfig[/** @type {ContainerFace} */ (direction)];

  if (nextMode.inputSlots.length > 0) {
    config.inputConfig[/** @type {ContainerFace} */ (direction)] = [...nextMode.inputSlots];
  }
  if (nextMode.outputSlots.length > 0) {
    config.outputConfig[/** @type {ContainerFace} */ (direction)] = [...nextMode.outputSlots];
  }

  publishConfig(
    entity,
    config,
    blockTypeId,
    definitionRevisions.get(blockTypeId) ?? 0,
  );
  return nextMode.id;
}

/**
 * @param {unknown} value
 * @returns {ItemIODefinition}
 */
function normalizeDefinition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Item IO definition must be an object");
  }

  const raw = /** @type {Record<string, unknown>} */ (value);
  const anyInputSlots = normalizeSlots(raw.anyInputSlots, "items.anyInputSlots");
  const anyOutputSlots = normalizeSlots(raw.anyOutputSlots, "items.anyOutputSlots");
  const modes = normalizeModes(raw.modes);

  const declaredInputSlots = new Set(modes.flatMap((mode) => mode.inputSlots));
  const declaredOutputSlots = new Set(modes.flatMap((mode) => mode.outputSlots));

  assertSubset(anyInputSlots, declaredInputSlots, "items.anyInputSlots", "mode inputSlots");
  assertSubset(anyOutputSlots, declaredOutputSlots, "items.anyOutputSlots", "mode outputSlots");

  return { anyInputSlots, anyOutputSlots, modes };
}

/**
 * @param {unknown} value
 * @returns {ItemIOMode[]}
 */
function normalizeModes(value) {
  if (!Array.isArray(value)) throw new TypeError("items.modes must be an array");

  /** @type {ItemIOMode[]} */
  const modes = [];
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {Set<string>} */
  const signatures = new Set();

  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`items.modes[${index}] must be an object`);
    }

    const raw = /** @type {Record<string, unknown>} */ (entry);
    if (typeof raw.id !== "string" || raw.id.length === 0) {
      throw new TypeError(`items.modes[${index}].id must be a non-empty string`);
    }
    if (ids.has(raw.id)) throw new RangeError(`Duplicate item IO mode: ${raw.id}`);

    const inputSlots = raw.inputSlots === undefined
      ? []
      : normalizeSlots(raw.inputSlots, `items.modes[${index}].inputSlots`);
    const outputSlots = raw.outputSlots === undefined
      ? []
      : normalizeSlots(raw.outputSlots, `items.modes[${index}].outputSlots`);

    if (raw.id === DEFAULT_ITEM_IO_MODE && (inputSlots.length > 0 || outputSlots.length > 0)) {
      throw new RangeError(`${DEFAULT_ITEM_IO_MODE} cannot expose input or output slots`);
    }
    if (raw.id !== DEFAULT_ITEM_IO_MODE && inputSlots.length === 0 && outputSlots.length === 0) {
      throw new RangeError(`Item IO mode ${raw.id} must expose at least one slot`);
    }

    const signature = getModeSignature(inputSlots, outputSlots);
    if (signatures.has(signature)) {
      throw new RangeError(`Item IO mode ${raw.id} duplicates another mode's slot configuration`);
    }

    ids.add(raw.id);
    signatures.add(signature);
    modes.push({ id: raw.id, inputSlots, outputSlots });
  }

  if (!ids.has(DEFAULT_ITEM_IO_MODE)) {
    modes.unshift({ id: DEFAULT_ITEM_IO_MODE, inputSlots: [], outputSlots: [] });
  }

  return modes;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {number[]}
 */
function normalizeSlots(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);

  /** @type {number[]} */
  const slots = [];
  /** @type {Set<number>} */
  const seen = new Set();
  for (const slot of value) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 255) {
      throw new RangeError(`${path} contains invalid slot ${String(slot)}`);
    }
    if (seen.has(slot)) continue;
    seen.add(slot);
    slots.push(slot);
  }
  return slots;
}

/**
 * @param {number[]} values
 * @param {Set<number>} allowed
 * @param {string} valuePath
 * @param {string} allowedPath
 */
function assertSubset(values, allowed, valuePath, allowedPath) {
  for (const slot of values) {
    if (!allowed.has(slot)) {
      throw new RangeError(`${valuePath} slot ${slot} is not declared by any ${allowedPath}`);
    }
  }
}

/**
 * @param {ItemIODefinition} definition
 * @returns {ComplexItemConfig}
 */
function createEmptyConfig(definition) {
  return {
    version: DoriosContainer.ITEM_CONFIG_VERSION,
    type: "complex",
    anyInputSlots: [...definition.anyInputSlots],
    anyOutputSlots: [...definition.anyOutputSlots],
    inputConfig: {},
    outputConfig: {},
  };
}

/**
 * @param {ComplexItemConfig} current
 * @param {ItemIODefinition} definition
 * @returns {{changed:boolean, config:ComplexItemConfig}}
 */
function reconcileConfig(current, definition) {
  const config = /** @type {ComplexItemConfig} */ ({
    version: DoriosContainer.ITEM_CONFIG_VERSION,
    type: "complex",
    anyInputSlots: [...definition.anyInputSlots],
    anyOutputSlots: [...definition.anyOutputSlots],
    inputConfig: {},
    outputConfig: {},
  });

  let changed = !arraysEqual(current.anyInputSlots, definition.anyInputSlots)
    || !arraysEqual(current.anyOutputSlots, definition.anyOutputSlots);

  for (const direction of DIRECTIONS) {
    const mode = findModeForFace(current, definition, direction);
    if (!mode || mode.id === DEFAULT_ITEM_IO_MODE) {
      if (current.inputConfig[/** @type {ContainerFace} */ (direction)]?.length
        || current.outputConfig[/** @type {ContainerFace} */ (direction)]?.length) {
        changed = true;
      }
      continue;
    }

    if (mode.inputSlots.length > 0) {
      config.inputConfig[/** @type {ContainerFace} */ (direction)] = [...mode.inputSlots];
    }
    if (mode.outputSlots.length > 0) {
      config.outputConfig[/** @type {ContainerFace} */ (direction)] = [...mode.outputSlots];
    }

    changed ||= !arraysEqual(
      current.inputConfig[/** @type {ContainerFace} */ (direction)] ?? [],
      mode.inputSlots,
    ) || !arraysEqual(
      current.outputConfig[/** @type {ContainerFace} */ (direction)] ?? [],
      mode.outputSlots,
    );
  }

  return { changed, config };
}

/**
 * @param {ComplexItemConfig} config
 * @param {ItemIODefinition} definition
 * @param {string} direction
 * @returns {ItemIOMode|undefined}
 */
function findModeForFace(config, definition, direction) {
  const inputSlots = config.inputConfig[/** @type {ContainerFace} */ (direction)] ?? [];
  const outputSlots = config.outputConfig[/** @type {ContainerFace} */ (direction)] ?? [];

  return findModeForSlots(definition, inputSlots, outputSlots);
}

/**
 * @param {ItemIODefinition} definition
 * @param {ReadonlyArray<number>} inputSlots
 * @param {ReadonlyArray<number>} outputSlots
 * @returns {ItemIOMode|undefined}
 */
function findModeForSlots(definition, inputSlots, outputSlots) {
  return definition.modes.find((mode) => (
    arraysEqual(inputSlots, mode.inputSlots)
    && arraysEqual(outputSlots, mode.outputSlots)
  ));
}

/**
 * @param {number[]} inputSlots
 * @param {number[]} outputSlots
 * @returns {string}
 */
function getModeSignature(inputSlots, outputSlots) {
  return `${inputSlots.join(",")}|${outputSlots.join(",")}`;
}

/**
 * @param {ReadonlyArray<number>} left
 * @param {ReadonlyArray<number>} right
 * @returns {boolean}
 */
function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Produces an order-stable signature for pending script-event writes.
 *
 * @param {ComplexItemConfig} config
 * @returns {string}
 */
function getConfigSignature(config) {
  const faces = DIRECTIONS.map((direction) => ({
    direction,
    input: config.inputConfig[/** @type {ContainerFace} */ (direction)] ?? [],
    output: config.outputConfig[/** @type {ContainerFace} */ (direction)] ?? [],
  }));

  return JSON.stringify({
    anyInputSlots: config.anyInputSlots,
    anyOutputSlots: config.anyOutputSlots,
    faces,
  });
}

/**
 * @param {ComplexItemConfig} config
 * @returns {ComplexItemConfig}
 */
function cloneComplexConfig(config) {
  /** @type {ComplexItemConfig["inputConfig"]} */
  const inputConfig = {};
  /** @type {ComplexItemConfig["outputConfig"]} */
  const outputConfig = {};

  for (const direction of DIRECTIONS) {
    const face = /** @type {ContainerFace} */ (direction);
    if (config.inputConfig[face]) inputConfig[face] = [...config.inputConfig[face]];
    if (config.outputConfig[face]) outputConfig[face] = [...config.outputConfig[face]];
  }

  return {
    version: DoriosContainer.ITEM_CONFIG_VERSION,
    type: "complex",
    anyInputSlots: [...config.anyInputSlots],
    anyOutputSlots: [...config.anyOutputSlots],
    inputConfig,
    outputConfig,
  };
}

/**
 * Copies a static policy so callers cannot mutate the registry without a new
 * registration and definition revision.
 *
 * @param {ItemIODefinition} definition
 * @returns {ItemIODefinition}
 */
function cloneDefinition(definition) {
  return {
    anyInputSlots: [...definition.anyInputSlots],
    anyOutputSlots: [...definition.anyOutputSlots],
    modes: definition.modes.map((mode) => ({
      id: mode.id,
      inputSlots: [...mode.inputSlots],
      outputSlots: [...mode.outputSlots],
    })),
  };
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {ComplexItemConfig} config
 * @param {string} blockTypeId
 * @param {number} definitionRevision
 */
function publishConfig(entity, config, blockTypeId, definitionRevision) {
  const snapshot = cloneComplexConfig(config);
  const signature = getConfigSignature(snapshot);
  if (pendingEntities.get(entity.id)?.signature === signature) return;

  validatedEntities.delete(entity.id);
  pendingEntities.set(entity.id, { signature, config: snapshot });
  try {
    DoriosContainer.setConfig(entity, snapshot);
    publishedEntities.set(entity.id, { blockTypeId, definitionRevision, signature });
  } catch (error) {
    if (pendingEntities.get(entity.id)?.signature === signature) pendingEntities.delete(entity.id);
    throw error;
  }

  system.runTimeout(() => {
    if (pendingEntities.get(entity.id)?.signature === signature) pendingEntities.delete(entity.id);
  }, 20);
}

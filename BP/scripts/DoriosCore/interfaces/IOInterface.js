// @ts-check

import { InterfaceManager } from "./index.js";
import {
  OPPOSITE_DIRECTIONS,
  RELATIVE_IO_FACES,
  resolveRelativeFaceDirection,
} from "../utils/directions.js";
import {
  cycleItemIODirectionMode,
  getItemIODirectionMode,
  registerItemIODefinition,
} from "./itemIO.js";
import {
  cycleFluidIODirectionMode,
  getFluidIODirectionMode,
  registerFluidIODefinition,
} from "./fluidIO.js";
import {
  cycleGasIODirectionMode,
  getGasIODirectionMode,
  registerGasIODefinition,
} from "./gasIO.js";

const FACES = RELATIVE_IO_FACES;

/** Tagged IO templates keyed by their exact runtime block tag. */
const blockTagDefinitions = new Map();

/** Block types with a complete item/liquid/gas IO registration. */
const registeredBlockTypes = new Set();

/** Block types already checked for an exact registration or tagged fallback. */
const resolvedBlockTypes = new Set();

/** Tagged templates materialized as ordinary block-type registrations. */
const materializedBlockTags = new Map();

/** Conflicts already reported during the current registry revision. */
const warnedTagConflicts = new Set();

/** @typedef {"top"|"left"|"front"|"right"|"bottom"|"back"} IOFace */
/** @typedef {import("./itemIO.js").ItemIOMode} ItemIOMode */
/** @typedef {import("./fluidIO.js").FluidIOMode} FluidIOMode */
/** @typedef {import("./gasIO.js").GasIOMode} GasIOMode */

/**
 * @typedef {object} ItemButtonContext
 * @property {import("@minecraft/server").Entity} entity
 * @property {import("@minecraft/server").Block|undefined} block
 * @property {{face: IOFace, blockTypeId: string, modes: ItemIOMode[]}} button
 */

/**
 * @typedef {object} LiquidButtonContext
 * @property {import("@minecraft/server").Entity} entity
 * @property {import("@minecraft/server").Block|undefined} block
 * @property {{face: IOFace, blockTypeId: string, modes: FluidIOMode[]}} button
 */

/**
 * @typedef {object} GasButtonContext
 * @property {import("@minecraft/server").Entity} entity
 * @property {import("@minecraft/server").Block|undefined} block
 * @property {{face: IOFace, blockTypeId: string, modes: GasIOMode[]}} button
 */

/**
 * @typedef {object} ItemModeConfig
 * @property {string} id Visual mode ID, such as `input_1`, `fuel`, or `output_1`.
 * @property {number[]} [inputSlots] Slots assigned as input while this mode is active.
 * @property {number[]} [outputSlots] Slots assigned as output while this mode is active.
 */

/**
 * @typedef {object} ItemIOGroupConfig
 * @property {number[]|[number, number]} [buttonSlots] Six face-button slots, explicit or inclusive range.
 * @property {number[]} anyInputSlots Explicit fallback inputs when no face is available.
 * @property {number[]} anyOutputSlots Explicit fallback outputs when no face is available.
 * @property {ItemModeConfig[]} modes Ordered modes cycled by each face button.
 */

/**
 * @typedef {object} LiquidIOGroupConfig
 * @property {number[]|[number, number]} [buttonSlots] Six face-button slots, explicit or inclusive range.
 * @property {number[]} anyInputIndices Explicit fallback inputs when no face is available.
 * @property {number[]} anyOutputIndices Explicit fallback outputs when no face is available.
 * @property {Array<{id:string,inputIndices?:number[],outputIndices?:number[]}>} modes Ordered modes cycled by each face button.
 */

/**
 * @typedef {object} IOInterfaceConfig
 * @property {boolean} [invertFaces] Whether every visual face resolves to its opposite physical direction.
 * @property {ItemIOGroupConfig} [items] Item policy and optional face buttons.
 * @property {LiquidIOGroupConfig} [liquids] Fluid-index policy and optional face buttons.
 * @property {LiquidIOGroupConfig} [gases] Gas-index policy and optional face buttons.
 */

/**
 * Normalizes a button-slot declaration into exactly the first six usable slots.
 * A two-value declaration is treated as an inclusive range only for UI buttons.
 * Operational item slot arrays are always explicit.
 *
 * @param {unknown} value
 * @param {string} path
 * @returns {number[]}
 */
function normalizeButtonSlots(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);

  let slots;
  if (value.length === 2) {
    const start = value[0];
    const end = value[1];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      throw new RangeError(`${path} must contain a valid inclusive range`);
    }
    slots = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  } else {
    slots = [...value];
  }

  if (slots.length !== FACES.length || slots.some((slot) => !Number.isInteger(slot) || slot < 0 || slot > 255)) {
    throw new RangeError(`${path} must resolve to exactly six valid slots`);
  }
  if (new Set(slots).size !== slots.length) throw new RangeError(`${path} contains duplicate slots`);
  return slots;
}

/**
 * @param {import("@minecraft/server").Block|undefined} block
 * @param {IOFace} face
 * @param {boolean} invertFaces
 * @returns {string}
 */
function resolveButtonDirection(block, face, invertFaces) {
  const direction = resolveRelativeFaceDirection(block, face);
  return invertFaces ? (OPPOSITE_DIRECTIONS[direction] ?? direction) : direction;
}

/**
 * @param {Record<string, any>} buttons
 * @param {string} blockTypeId
 * @param {ItemIOGroupConfig} definition
 * @param {import("./itemIO.js").ItemIODefinition} registeredDefinition
 * @param {boolean} [invertFaces=false]
 * @returns {boolean} True when six visual buttons were added.
 */
function addItemButtons(buttons, blockTypeId, definition, registeredDefinition, invertFaces = false) {
  if (definition.buttonSlots === undefined) return false;
  const slots = normalizeButtonSlots(definition.buttonSlots, "items.buttonSlots");
  const operationalSlots = new Set(registeredDefinition.modes.flatMap((mode) => [
    ...mode.inputSlots,
    ...mode.outputSlots,
  ]));

  for (const slot of slots) {
    if (operationalSlots.has(slot)) {
      throw new RangeError(`items.buttonSlots overlaps operational slot ${slot}`);
    }
  }

  for (const [index, face] of FACES.entries()) {
    buttons[`items_${face}`] = {
      slot: slots[index],
      face,
      blockTypeId,
      modes: registeredDefinition.modes,
      nameTag: (/** @type {ItemButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return getItemIODirectionMode(entity, button.blockTypeId, direction);
      },
      onPress: (/** @type {ItemButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return cycleItemIODirectionMode(entity, button.blockTypeId, direction);
      },
    };
  }

  return true;
}

/**
 * Adds fluid-index buttons using the same face-policy model as item IO.
 *
 * @param {Record<string, any>} buttons
 * @param {string} blockTypeId
 * @param {LiquidIOGroupConfig} definition
 * @param {import("./fluidIO.js").FluidIODefinition} registeredDefinition
 * @param {boolean} [invertFaces=false]
 * @returns {boolean} True when six visual buttons were added.
 */
function addLiquidButtons(buttons, blockTypeId, definition, registeredDefinition, invertFaces = false) {
  if (definition.buttonSlots === undefined) return false;
  const slots = normalizeButtonSlots(definition.buttonSlots, "liquids.buttonSlots");

  for (const [index, face] of FACES.entries()) {
    buttons[`liquids_${face}`] = {
      slot: slots[index],
      face,
      blockTypeId,
      modes: registeredDefinition.modes,
      nameTag: (/** @type {LiquidButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return getFluidIODirectionMode(entity, button.blockTypeId, direction);
      },
      onPress: (/** @type {LiquidButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return cycleFluidIODirectionMode(entity, button.blockTypeId, direction);
      },
    };
  }

  return true;
}

/**
 * Adds gas-index buttons while keeping their modes and persisted config
 * separate from liquid buttons.
 *
 * @param {Record<string, any>} buttons
 * @param {string} blockTypeId
 * @param {LiquidIOGroupConfig} definition
 * @param {import("./gasIO.js").GasIODefinition} registeredDefinition
 * @param {boolean} [invertFaces=false]
 */
function addGasButtons(buttons, blockTypeId, definition, registeredDefinition, invertFaces = false) {
  if (definition.buttonSlots === undefined) return false;
  const slots = normalizeButtonSlots(definition.buttonSlots, "gases.buttonSlots");

  for (const [index, face] of FACES.entries()) {
    buttons[`gases_${face}`] = {
      slot: slots[index],
      face,
      blockTypeId,
      modes: registeredDefinition.modes,
      nameTag: (/** @type {GasButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return getGasIODirectionMode(entity, button.blockTypeId, direction);
      },
      onPress: (/** @type {GasButtonContext} */ { entity, block, button }) => {
        const direction = resolveButtonDirection(block, button.face, invertFaces);
        return cycleGasIODirectionMode(entity, button.blockTypeId, direction);
      },
    };
  }

  return true;
}

/**
 * Registers a machine's static IO policy and its optional six-face interface.
 *
 * Item modes are not persisted by name. Their input/output slot arrays are
 * written into `utilitycraft:io_config.items` through DoriosContainers, while
 * the mode ID exists only to render and cycle the UI. A backend item policy may
 * omit `buttonSlots`, which is useful for machines that must be Complex but do
 * not expose face controls.
 *
 * @param {string} blockTypeId Block identifier, e.g. `utilitycraft:infuser`.
 * @param {IOInterfaceConfig} [config={}] Item/liquid declaration.
 * @returns {boolean} True when a backend group or visual interface was registered.
 */
function registerIOInterfaceDefinition(blockTypeId, config = {}, sourceTag) {
  if (typeof blockTypeId !== "string" || blockTypeId.length === 0) return false;

  /** @type {Record<string, any>} */
  const buttons = {};
  let registered = false;
  const invertFaces = config.invertFaces === true;

  if (config.items !== undefined) {
    const definition = registerItemIODefinition(blockTypeId, config.items);
    addItemButtons(buttons, blockTypeId, config.items, definition, invertFaces);
    registered = true;
  }

  if (config.liquids !== undefined) {
    const definition = registerFluidIODefinition(blockTypeId, config.liquids);
    addLiquidButtons(buttons, blockTypeId, config.liquids, definition, invertFaces);
    registered = true;
  }

  if (config.gases !== undefined) {
    const definition = registerGasIODefinition(blockTypeId, config.gases);
    addGasButtons(buttons, blockTypeId, config.gases, definition, invertFaces);
    registered = true;
  }

  if (Object.keys(buttons).length > 0) {
    const buttonSlots = Object.values(buttons).map((button) => button.slot);
    if (new Set(buttonSlots).size !== buttonSlots.length) {
      throw new RangeError("Item, liquid, and gas IO buttons cannot share inventory slots");
    }

    const interfaceId = `${blockTypeId}:io_config`;
    InterfaceManager.registerInterface(interfaceId, { buttons });
    InterfaceManager.linkBlockInterface(blockTypeId, interfaceId);
  }

  if (registered) {
    registeredBlockTypes.add(blockTypeId);
    resolvedBlockTypes.add(blockTypeId);

    if (sourceTag === undefined) {
      materializedBlockTags.delete(blockTypeId);
    } else {
      materializedBlockTags.set(blockTypeId, sourceTag);
    }
  }

  return registered;
}

/**
 * Registers a machine's IO policy directly for one exact block type.
 * Exact registrations always take priority over tagged fallbacks.
 *
 * @param {string} blockTypeId Block identifier, e.g. `utilitycraft:infuser`.
 * @param {IOInterfaceConfig} [config={}] Item/liquid/gas declaration.
 * @returns {boolean} True when a backend group or visual interface was registered.
 */
export function registerIOInterface(blockTypeId, config = {}) {
  return registerIOInterfaceDefinition(blockTypeId, config);
}

/**
 * Registers a reusable IO template for one exact block tag.
 *
 * The template is not checked every tick. The first encountered block type
 * carrying this tag is materialized through the ordinary block-type registry,
 * after which all existing IO paths continue resolving by `block.typeId`.
 *
 * Runtime tag names do not include the JSON `tag:` component prefix.
 *
 * @param {string} blockTag Exact runtime tag, e.g. `utilitycraft:io.furnator`.
 * @param {IOInterfaceConfig} [config={}] Item/liquid/gas declaration.
 * @returns {boolean} True when the tagged template was stored.
 */
export function registerIOInterfaceForBlockTag(blockTag, config = {}) {
  if (typeof blockTag !== "string" || blockTag.length === 0 || blockTag.startsWith("tag:")) {
    return false;
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;

  blockTagDefinitions.set(blockTag, config);
  resolvedBlockTypes.clear();
  warnedTagConflicts.clear();

  // Tagged definitions are normally installed before gameplay. Supporting an
  // update here keeps already materialized external block types deterministic.
  for (const [blockTypeId, materializedTag] of materializedBlockTags) {
    if (materializedTag !== blockTag) continue;
    registerIOInterfaceDefinition(blockTypeId, config, blockTag);
  }

  return true;
}

/**
 * Returns whether one exact block type already owns a complete IO registration.
 *
 * @param {string} blockTypeId Block identifier.
 * @returns {boolean}
 */
export function hasRegisteredIOInterface(blockTypeId) {
  return typeof blockTypeId === "string" && registeredBlockTypes.has(blockTypeId);
}

/**
 * Resolves a tagged IO template for a block type that has no exact registration.
 *
 * Resolution is cached per block type. Exactly one registered family tag must
 * match; ambiguous blocks fail closed instead of depending on tag order.
 *
 * @param {import("@minecraft/server").Block|undefined} block Block to resolve.
 * @returns {boolean} True when the block type has a usable IO registration.
 */
export function ensureBlockIOInterface(block) {
  const blockTypeId = block?.typeId;
  if (typeof blockTypeId !== "string" || blockTypeId.length === 0) return false;

  if (registeredBlockTypes.has(blockTypeId)) {
    resolvedBlockTypes.add(blockTypeId);
    return true;
  }
  if (resolvedBlockTypes.has(blockTypeId)) return false;

  let tags;
  try {
    tags = block.getTags();
  } catch {
    return false;
  }

  const matches = tags.filter((tag) => blockTagDefinitions.has(tag));
  resolvedBlockTypes.add(blockTypeId);

  if (matches.length === 0) return false;
  if (matches.length > 1) {
    if (!warnedTagConflicts.has(blockTypeId)) {
      warnedTagConflicts.add(blockTypeId);
      console.warn(
        `[DoriosCore:IOInterface] ${blockTypeId} has multiple registered IO family tags: ${matches.join(", ")}`,
      );
    }
    return false;
  }

  const blockTag = matches[0];
  return registerIOInterfaceDefinition(blockTypeId, blockTagDefinitions.get(blockTag), blockTag);
}

/** Namespace-style export for callers that prefer `IOInterface.registerIOInterface`. */
export const IOInterface = {
  ensureBlockIOInterface,
  hasRegisteredIOInterface,
  registerIOInterface,
  registerIOInterfaceForBlockTag,
};

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

const FACES = RELATIVE_IO_FACES;

/** @typedef {"top"|"left"|"front"|"right"|"bottom"|"back"} IOFace */
/** @typedef {import("./itemIO.js").ItemIOMode} ItemIOMode */
/** @typedef {import("./fluidIO.js").FluidIOMode} FluidIOMode */

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
export function registerIOInterface(blockTypeId, config = {}) {
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

  if (Object.keys(buttons).length > 0) {
    const buttonSlots = Object.values(buttons).map((button) => button.slot);
    if (new Set(buttonSlots).size !== buttonSlots.length) {
      throw new RangeError("Item and liquid IO buttons cannot share inventory slots");
    }

    const interfaceId = `${blockTypeId}:io_config`;
    InterfaceManager.registerInterface(interfaceId, { buttons });
    InterfaceManager.linkBlockInterface(blockTypeId, interfaceId);
  }

  return registered;
}

/** Namespace-style export for callers that prefer `IOInterface.registerIOInterface`. */
export const IOInterface = {
  registerIOInterface,
};

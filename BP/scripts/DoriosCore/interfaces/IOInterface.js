// @ts-check

import { InterfaceManager } from "./index.js";
import { RELATIVE_IO_FACES, resolveRelativeFaceDirection } from "../utils/directions.js";
import {
  DEFAULT_IO_MODE,
  ensureLiquidIOGroup,
  getLiquidIODirectionMode,
  readIOConfig,
  setLiquidIODirectionMode,
  writeIOConfig,
} from "./ioState.js";
import {
  cycleItemIODirectionMode,
  getItemIODirectionMode,
  registerItemIODefinition,
} from "./itemIO.js";

const FACES = RELATIVE_IO_FACES;

/** @typedef {"top"|"left"|"front"|"right"|"bottom"|"back"} IOFace */
/** @typedef {string} IOMode */
/** @typedef {import("./itemIO.js").ItemIOMode} ItemIOMode */

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
 * @property {{face: IOFace, modes: IOMode[]}} button
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
 * @property {number[]|[number, number]} buttonSlots Six face-button slots, explicit or inclusive range.
 * @property {IOMode[]} modes Liquid modes cycled by each face button.
 */

/**
 * @typedef {object} IOInterfaceConfig
 * @property {ItemIOGroupConfig} [items] Item policy and optional face buttons.
 * @property {LiquidIOGroupConfig} [liquids] Liquid IO buttons using the current liquid state format.
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
 * @param {unknown} value
 * @returns {IOMode[]}
 */
function normalizeLiquidModes(value) {
  const modes = Array.isArray(value)
    ? value
        .map((mode) => String(mode))
        .map((mode) => (mode === "input" ? "input_1" : mode === "output" ? "output_1" : mode))
        .filter((mode) => mode.length > 0)
    : [];

  const uniqueModes = [...new Set(modes)];
  return uniqueModes.includes(DEFAULT_IO_MODE) ? uniqueModes : [DEFAULT_IO_MODE, ...uniqueModes];
}

/**
 * @param {import("@minecraft/server").Entity|undefined} entity
 * @param {IOMode[]} modes
 */
function ensurePersistedLiquidGroup(entity, modes) {
  const config = readIOConfig(entity);
  const before = JSON.stringify(config.liquids ?? {});
  ensureLiquidIOGroup(config, modes);

  if (before !== JSON.stringify(config.liquids ?? {})) {
    writeIOConfig(entity, config);
  }
}

/**
 * @param {Record<string, any>} buttons
 * @param {string} blockTypeId
 * @param {ItemIOGroupConfig} definition
 * @param {import("./itemIO.js").ItemIODefinition} registeredDefinition
 * @returns {boolean} True when six visual buttons were added.
 */
function addItemButtons(buttons, blockTypeId, definition, registeredDefinition) {
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
        const direction = resolveRelativeFaceDirection(block, button.face);
        return getItemIODirectionMode(entity, button.blockTypeId, direction);
      },
      onPress: (/** @type {ItemButtonContext} */ { entity, block, button }) => {
        const direction = resolveRelativeFaceDirection(block, button.face);
        return cycleItemIODirectionMode(entity, button.blockTypeId, direction);
      },
    };
  }

  return true;
}

/**
 * Adds the unchanged liquid-mode buttons. Liquids continue to use the current
 * direction-to-mode document while item IO moves to slot-based DoriosContainers.
 *
 * @param {Record<string, any>} buttons
 * @param {LiquidIOGroupConfig} definition
 * @returns {boolean} True when six visual buttons were added.
 */
function addLiquidButtons(buttons, definition) {
  const slots = normalizeButtonSlots(definition.buttonSlots, "liquids.buttonSlots");
  const modes = normalizeLiquidModes(definition.modes);
  if (modes.length === 0) throw new RangeError("liquids.modes must contain at least one mode");

  for (const [index, face] of FACES.entries()) {
    buttons[`liquids_${face}`] = {
      slot: slots[index],
      face,
      modes,
      nameTag: (/** @type {LiquidButtonContext} */ { entity, block, button }) => {
        ensurePersistedLiquidGroup(entity, button.modes);
        const direction = resolveRelativeFaceDirection(block, button.face);
        const state = getLiquidIODirectionMode(entity, direction);
        return button.modes.includes(state) ? state : DEFAULT_IO_MODE;
      },
      onPress: (/** @type {LiquidButtonContext} */ { entity, block, button }) => {
        const direction = resolveRelativeFaceDirection(block, button.face);
        const current = getLiquidIODirectionMode(entity, direction);
        const currentIndex = button.modes.indexOf(current);
        const next = button.modes[(currentIndex + 1) % button.modes.length] ?? DEFAULT_IO_MODE;
        setLiquidIODirectionMode(entity, direction, next, button.modes);
        return next;
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

  if (config.items !== undefined) {
    const definition = registerItemIODefinition(blockTypeId, config.items);
    addItemButtons(buttons, blockTypeId, config.items, definition);
    registered = true;
  }

  if (config.liquids !== undefined) {
    addLiquidButtons(buttons, config.liquids);
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

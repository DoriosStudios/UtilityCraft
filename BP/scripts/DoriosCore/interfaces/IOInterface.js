import { InterfaceManager } from "./index.js";
import { RELATIVE_IO_FACES, resolveRelativeFaceDirection } from "../utils/directions.js";
import {
  DEFAULT_IO_MODE,
  ensureIOGroup,
  getIODirectionMode,
  readIOConfig,
  setIODirectionMode,
  writeIOConfig,
} from "./ioState.js";

const FACES = RELATIVE_IO_FACES;

/**
 * @typedef {"top"|"left"|"front"|"right"|"bottom"|"back"} IOFace
 * Machine face represented by an IO button.
 */

/**
 * @typedef {"items"|"liquids"} IOGroup
 * IO channel rendered by the shared machine IO UI.
 */

/**
 * @typedef {string} IOMode
 * Name tag stored on the button item and resolved by RP UI textures.
 */

/**
 * @typedef {Object} IOGroupConfig
 * @property {number[]|[number, number]} slots Six explicit face slots, or an inclusive start/end range.
 * @property {IOMode[]} modes Modes cycled by each button. `"disabled"` is added automatically when omitted.
 */

/**
 * @typedef {Object} IOInterfaceConfig
 * @property {IOGroupConfig} [items] Item IO buttons for the six machine faces.
 * @property {IOGroupConfig} [liquids] Liquid IO buttons for the six machine faces.
 */

/**
 * Resolves the current mode for a visual face.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {import("@minecraft/server").Block|undefined} block Machine block.
 * @param {IOGroup} group IO group.
 * @param {IOFace} face Visual machine face.
 * @param {IOMode[]} modes Allowed group modes.
 * @returns {IOMode} Current mode, defaulting to `"disabled"`.
 */
function getState(entity, block, group, face, modes) {
  const direction = resolveRelativeFaceDirection(block, face);
  const state = getIODirectionMode(entity, group, direction);
  return modes.includes(state) ? state : DEFAULT_IO_MODE;
}

/**
 * Stores the current mode for one IO button.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {import("@minecraft/server").Block|undefined} block Machine block.
 * @param {IOGroup} group IO group.
 * @param {IOFace} face Visual machine face.
 * @param {IOMode} state New mode.
 * @param {IOMode[]} modes Allowed group modes.
 * @returns {void}
 */
function setState(entity, block, group, face, state, modes) {
  const direction = resolveRelativeFaceDirection(block, face);
  setIODirectionMode(entity, group, direction, state, modes);
}

/**
 * Normalizes a face slot declaration into exactly the first six usable slots.
 *
 * @param {unknown} slots Slot list, or `[start, end]` range.
 * @returns {number[]} Slot indexes mapped in `FACES` order.
 */
function normalizeSlots(slots) {
  if (!Array.isArray(slots)) return [];

  if (slots.length === 2) {
    const start = Math.floor(Number(slots[0]));
    const end = Math.floor(Number(slots[1]));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

    return Array.from({ length: end - start + 1 }, (_, index) => start + index).slice(0, FACES.length);
  }

  return slots
    .map((slot) => Math.floor(Number(slot)))
    .filter((slot) => Number.isFinite(slot))
    .slice(0, FACES.length);
}

/**
 * Normalizes the modes cycled by an IO button.
 *
 * @param {unknown} modes Raw mode list.
 * @returns {IOMode[]} Valid mode names with `"disabled"` included.
 */
function normalizeModes(modes) {
  const normalized = Array.isArray(modes)
    ? modes
        .map((mode) => String(mode))
        .map((mode) => (mode === "input" ? "input_1" : mode === "output" ? "output_1" : mode))
        .filter((mode) => mode.length > 0)
    : [];

  const uniqueModes = [...new Set(normalized)];
  return uniqueModes.includes(DEFAULT_IO_MODE) ? uniqueModes : [DEFAULT_IO_MODE, ...uniqueModes];
}

/**
 * Writes the default six-direction state for a group when the entity has none.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {IOGroup} group IO group name.
 * @param {IOMode[]} modes Allowed modes for this group.
 * @returns {void}
 */
function ensurePersistedGroup(entity, group, modes) {
  const config = readIOConfig(entity);
  const before = JSON.stringify(config[group] ?? {});
  ensureIOGroup(config, group, modes);

  if (before !== JSON.stringify(config[group] ?? {})) {
    writeIOConfig(entity, config);
  }
}

/**
 * Adds one group of six face buttons to an InterfaceManager button map.
 *
 * @param {Record<string, object>} buttons Mutable button map.
 * @param {IOGroup} group IO group name.
 * @param {IOGroupConfig|undefined} definition Group configuration.
 * @returns {void}
 */
function addButtons(buttons, group, definition) {
  const slots = normalizeSlots(definition?.slots);
  const modes = normalizeModes(definition?.modes);
  if (slots.length !== FACES.length || modes.length === 0) return;

  for (const [index, face] of FACES.entries()) {
    buttons[`${group}_${face}`] = {
      slot: slots[index],
      group,
      face,
      modes,
      nameTag: ({ entity, block, button }) => {
        ensurePersistedGroup(entity, button.group, button.modes);
        return getState(entity, block, button.group, button.face, button.modes);
      },
      onPress: ({ entity, block, button }) => {
        const current = getState(entity, block, button.group, button.face, button.modes);
        const currentIndex = button.modes.indexOf(current);
        const next = button.modes[(currentIndex + 1) % button.modes.length] ?? DEFAULT_IO_MODE;
        setState(entity, block, button.group, button.face, next, button.modes);
        return next;
      },
    };
  }
}

/**
 * Registers and links the shared IO button interface for a machine block.
 *
 * The generated interface owns six buttons per configured group. Button name
 * tags are the selected IO modes, allowing the RP UI to swap face outlines by
 * mode while the buttons remain normal `ui_filler` interface items.
 *
 * @param {string} blockTypeId Block identifier, e.g. `"utilitycraft:infuser"`.
 * @param {IOInterfaceConfig} [config={}] Item/liquid IO declaration.
 * @returns {boolean} True when at least one IO group was registered.
 */
export function registerIOInterface(blockTypeId, config = {}) {
  if (typeof blockTypeId !== "string" || blockTypeId.length === 0) return false;

  const buttons = {};
  addButtons(buttons, "items", config.items);
  addButtons(buttons, "liquids", config.liquids);

  if (Object.keys(buttons).length === 0) return false;

  const interfaceId = `${blockTypeId}:io_config`;
  InterfaceManager.registerInterface(interfaceId, { buttons });
  InterfaceManager.linkBlockInterface(blockTypeId, interfaceId);
  return true;
}

/**
 * Namespace-style export for callers that prefer `IOInterface.registerIOInterface`.
 */
export const IOInterface = {
  registerIOInterface,
};

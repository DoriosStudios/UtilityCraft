import { DIRECTIONS } from "../utils/directions.js";

export const IO_CONFIG_PROPERTY = "utilitycraft:io_config";
export const DEFAULT_IO_MODE = "disabled";

/**
 * @typedef {Record<string, string>} IOGroupState
 * Per-direction IO mode map.
 */

/**
 * @typedef {Record<string, unknown> & {liquids?: IOGroupState}} IOConfigState
 * Shared resource document with the current liquid direction modes.
 */

/**
 * Reads the persisted absolute-direction IO config from an entity.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @returns {IOConfigState} Parsed IO state.
 */
export function readIOConfig(entity) {
  const raw = entity?.getDynamicProperty?.(IO_CONFIG_PROPERTY);
  if (typeof raw !== "string" || raw.length === 0) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Stores the absolute-direction IO config on an entity.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {IOConfigState} config IO state to persist.
 * @returns {void}
 */
export function writeIOConfig(entity, config) {
  entity?.setDynamicProperty?.(IO_CONFIG_PROPERTY, JSON.stringify(config ?? {}));
}

/**
 * Ensures the liquid group contains all six absolute directions.
 *
 * Unknown or disallowed modes are normalized back to `"disabled"`.
 *
 * @param {IOConfigState} config Mutable IO config.
 * @param {string[]} [modes] Modes allowed for this group.
 * @returns {IOGroupState} Normalized group state.
 */
export function ensureLiquidIOGroup(config, modes = []) {
  const allowedModes = new Set(modes.length > 0 ? modes : [DEFAULT_IO_MODE]);
  allowedModes.add(DEFAULT_IO_MODE);

  config.liquids = config.liquids && typeof config.liquids === "object" ? config.liquids : {};

  for (const direction of DIRECTIONS) {
    if (!allowedModes.has(config.liquids[direction])) {
      config.liquids[direction] = DEFAULT_IO_MODE;
    }
  }

  return config.liquids;
}

/**
 * Reads the liquid mode for one absolute direction.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {string} direction Absolute direction.
 * @returns {string} Stored mode, defaulting to `"disabled"`.
 */
export function getLiquidIODirectionMode(entity, direction) {
  return readIOConfig(entity).liquids?.[direction] ?? DEFAULT_IO_MODE;
}

/**
 * Updates one absolute direction in the liquid IO config.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {string} direction Absolute direction.
 * @param {string} mode New IO mode.
 * @param {string[]} [modes] Modes allowed for this group.
 * @returns {void}
 */
export function setLiquidIODirectionMode(entity, direction, mode, modes = []) {
  if (!DIRECTIONS.includes(direction)) return;

  const config = readIOConfig(entity);
  const groupState = ensureLiquidIOGroup(config, modes);
  groupState[direction] = modes.includes(mode) || mode === DEFAULT_IO_MODE ? mode : DEFAULT_IO_MODE;
  writeIOConfig(entity, config);
}

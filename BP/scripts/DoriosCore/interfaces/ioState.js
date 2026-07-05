import { DIRECTIONS } from "../utils/directions.js";

export const IO_CONFIG_PROPERTY = "utilitycraft:io_config";
export const DEFAULT_IO_MODE = "disabled";

/**
 * @typedef {"items"|"liquids"} IOGroup
 * IO channel stored in the machine dynamic property.
 */

/**
 * @typedef {Record<string, string>} IOGroupState
 * Per-direction IO mode map.
 */

/**
 * @typedef {Partial<Record<IOGroup, IOGroupState>>} IOConfigState
 * Persisted IO configuration by channel and absolute direction.
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
    return parsed && typeof parsed === "object" ? parsed : {};
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
 * Ensures one IO group contains all six absolute directions.
 *
 * Unknown or disallowed modes are normalized back to `"disabled"`.
 *
 * @param {IOConfigState} config Mutable IO config.
 * @param {IOGroup} group IO channel.
 * @param {string[]} [modes] Modes allowed for this group.
 * @returns {IOGroupState} Normalized group state.
 */
export function ensureIOGroup(config, group, modes = []) {
  const allowedModes = new Set(modes.length > 0 ? modes : [DEFAULT_IO_MODE]);
  allowedModes.add(DEFAULT_IO_MODE);

  config[group] = config[group] && typeof config[group] === "object" ? config[group] : {};

  for (const direction of DIRECTIONS) {
    if (!allowedModes.has(config[group][direction])) {
      config[group][direction] = DEFAULT_IO_MODE;
    }
  }

  return config[group];
}

/**
 * Reads the mode for one absolute direction from a group.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {IOGroup} group IO channel.
 * @param {string} direction Absolute direction.
 * @returns {string} Stored mode, defaulting to `"disabled"`.
 */
export function getIODirectionMode(entity, group, direction) {
  return readIOConfig(entity)?.[group]?.[direction] ?? DEFAULT_IO_MODE;
}

/**
 * Updates one absolute direction in a machine IO config.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {IOGroup} group IO channel.
 * @param {string} direction Absolute direction.
 * @param {string} mode New IO mode.
 * @param {string[]} [modes] Modes allowed for this group.
 * @returns {void}
 */
export function setIODirectionMode(entity, group, direction, mode, modes = []) {
  if (!DIRECTIONS.includes(direction)) return;

  const config = readIOConfig(entity);
  const groupState = ensureIOGroup(config, group, modes);
  groupState[direction] = modes.includes(mode) || mode === DEFAULT_IO_MODE ? mode : DEFAULT_IO_MODE;
  writeIOConfig(entity, config);
}

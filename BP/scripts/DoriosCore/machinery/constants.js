/**
 * Shared UtilityCraft text colors used by machine status labels.
 */
export const MACHINE_TEXT_COLORS = DoriosAPI.constants.textColors;

/**
 * Placeholder item used to render text labels inside machine inventories.
 */
export const LABEL_ITEM_ID = "utilitycraft:arrow_indicator_90";

/**
 * Blocker item used to reserve inventory slots in machine UIs.
 */
export const BLOCKED_SLOT_ITEM_ID = "utilitycraft:arrow_right_0";

/**
 * Dynamic property prefix used to store machine progress values.
 */
export const MACHINE_PROGRESS_PROPERTY_PREFIX = "dorios:progress_";

/**
 * Dynamic property prefix used to store machine energy cost values.
 */
export const MACHINE_ENERGY_COST_PROPERTY_PREFIX = "dorios:energy_cost_";

/**
 * Default maximum progress value used by machines.
 */
export const DEFAULT_PROGRESS_MAX = 800;

/**
 * Default inventory slot used by machine progress displays.
 */
export const DEFAULT_PROGRESS_SLOT = 2;

/**
 * Default progress item type for the modern progress UI.
 */
export const DEFAULT_PROGRESS_TYPE = "progress_right_big_bar";

/**
 * Default progress item type for the legacy progress UI.
 */
export const LEGACY_PROGRESS_TYPE = "arrow_right";

/**
 * Legacy progress display scale.
 */
export const LEGACY_PROGRESS_SCALE = 16;

/**
 * Modern progress display scale.
 */
export const MODERN_PROGRESS_SCALE = 22;

/**
 * Total amount of visual frames available for energy bar items.
 */
export const ENERGY_BAR_FRAME_COUNT = 48;

/**
 * Item id prefix used by UtilityCraft energy bars.
 */
export const ENERGY_BAR_ITEM_PREFIX = "utilitycraft:energy_";

/**
 * Tag used by entities that should bypass normal resource consumption.
 */
export const CREATIVE_TAG = "creative";

/**
 * Objective definitions required by the energy storage system.
 */
export const ENERGY_OBJECTIVE_DEFINITIONS = [
  ["energy", "Energy"],
  ["energyExp", "EnergyExp"],
  ["energyCap", "Energy Max Capacity"],
  ["energyCapExp", "Energy Max Capacity Exp"],
];

/**
 * Empty item shown when a fluid tank has no stored content.
 */
export const EMPTY_FLUID_BAR_ITEM_ID = "utilitycraft:empty_fluid_bar";

/**
 * Reserved type marker used by empty fluid tanks.
 */
export const EMPTY_FLUID_TYPE = "empty";

/**
 * Tag used by entities that must keep a fixed fluid type even when empty.
 */
export const CONSTANT_FLUID_TYPE_TAG = "dorios:constant_fluid_type";

/**
 * Names of shared scoreboard objectives used by the fluid system.
 */
export const FLUID_OBJECTIVE_NAMES = {
  maxLiquids: "maxLiquids",
};

/**
 * Command used to bootstrap the base fluid scoreboard identity.
 */
export const INITIAL_FLUID_SCORE_COMMAND = "scoreboard players set @s fluid_0 0";

/**
 * Default inventory slot used to display fluid bars.
 */
export const DEFAULT_FLUID_DISPLAY_SLOT = 4;

/**
 * Total amount of visual frames available for fluid bar items.
 */
export const FLUID_BAR_FRAME_COUNT = 48;

/**
 * Base capacities for UtilityCraft fluid tank blocks.
 */
export const FLUID_TANK_CAPACITIES = {
  "utilitycraft:basic_fluid_tank": 8000,
  "utilitycraft:advanced_fluid_tank": 32000,
  "utilitycraft:expert_fluid_tank": 128000,
  "utilitycraft:ultimate_fluid_tank": 512000,
};

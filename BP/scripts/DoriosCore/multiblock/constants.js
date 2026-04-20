/**
 * Maximum scan radius used while searching for multiblock casing bounds.
 *
 * This caps how far the detection logic may expand from the controller.
 */
export const MAX_SIZE = 99;

/**
 * Scan pacing value used to yield periodically during structure validation.
 *
 * Higher values reduce yielding frequency, lower values spread the scan across
 * more ticks.
 */
export const SCAN_SPEED = 64;

/**
 * Energy contribution per multiblock component unit.
 *
 * Keys must match multiblock component ids detected during structure scanning.
 */
export const ENERGY_PER_UNIT = {
  energy_cell: 4e6,
  basic_power_condenser_unit: 40e6,
  advanced_power_condenser_unit: 320e6,
  expert_power_condenser_unit: 2.56e9,
  ultimate_power_condenser_unit: 64e9,
};

/**
 * Script event used to show the controller entity when the multiblock activates.
 */
export const SHOW_EVENT_ID = "utilitycraft:show";

/**
 * Script event used to hide the controller entity when the multiblock deactivates.
 */
export const HIDE_EVENT_ID = "utilitycraft:hide";

/**
 * Block state used to mark active multiblock ports.
 */
export const ACTIVE_STATE_ID = "utilitycraft:active";

/**
 * Block tag that identifies multiblock ports.
 */
export const MULTIBLOCK_PORT_TAG = "dorios:multiblock.port";

/**
 * Block tag prefix used by multiblock casing blocks.
 */
export const MULTIBLOCK_CASE_TAG_PREFIX = "dorios:multiblock.case";

/**
 * Block tag used by internal multiblock component blocks.
 */
export const MULTIBLOCK_COMPONENT_TAG = "dorios:multiblock_component";

/**
 * Entity family used by multiblock controller entities.
 */
export const MULTIBLOCK_FAMILY = "dorios:multiblock";

/**
 * Block tag used by multiblock vent blocks.
 */
export const VENT_BLOCK_TAG = "dorios:vent_block";

/**
 * Block tag used by energy-capable multiblock ports.
 */
export const ENERGY_BLOCK_TAG = "dorios:energy";

/**
 * Block tag used by fluid-capable multiblock ports.
 */
export const FLUID_BLOCK_TAG = "dorios:fluid";

/**
 * Block tag used by item-capable multiblock ports.
 */
export const ITEM_BLOCK_TAG = "dorios:item";

/**
 * Prefix used by serialized input port location tags.
 */
export const INPUT_TAG_PREFIX = "input:[";

/**
 * Dynamic property used to store detected multiblock bounds.
 */
export const BOUNDS_PROPERTY_ID = "dorios:bounds";

/**
 * Dynamic property used to store multiblock active state.
 */
export const STATE_PROPERTY_ID = "dorios:state";

/**
 * Serialized value used when a multiblock is active.
 */
export const ACTIVE_STATE_VALUE = "on";

/**
 * Serialized value used when a multiblock is inactive.
 */
export const INACTIVE_STATE_VALUE = "off";

/**
 * Dynamic property used to store multiblock processing speed.
 */
export const RATE_SPEED_PROPERTY_ID = "dorios:rateSpeed";

/**
 * Dynamic property used to store the resulting multiblock energy capacity.
 */
export const ENERGY_CAP_PROPERTY_ID = "dorios:energyCap";

/**
 * Dynamic property used to store vent block positions.
 */
export const VENT_BLOCKS_PROPERTY_ID = "ventBlocks";

/**
 * Legacy dynamic property used by reactor-like multiblocks.
 */
export const LEGACY_REACTOR_STATS_PROPERTY_ID = "reactorStats";

/**
 * Script event used to refresh adjacent pipe networks.
 */
export const UPDATE_PIPES_EVENT_ID = "dorios:updatePipes";

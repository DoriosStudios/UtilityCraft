
/**
 * Default entity identifier used by machines.
 *
 * Machines spawn this entity to handle storage, processing,
 * and internal machine logic.
 *
 * @constant
 */
export const DEFAULT_ENTITY_ID = "utilitycraft:machine_entity";

/**
 * Dynamic property used to persist which block a machine helper entity
 * currently represents.
 */
export const MACHINE_BLOCK_ID_PROPERTY_ID = "dorios:machine_block_id";

/**
 * Default machine processing interval.
 *
 * Represents the number of ticks between machine updates.
 * Minecraft runs at 20 ticks per second.
 *
 * @constant
 */
export const DEFAULT_TICK_SPEED = 20;

/**
 * Global key used to store the world-loaded flag in `globalThis`.
 */
export const GLOBAL_WORLD_LOADED_KEY = "worldLoaded";

/**
 * Global key used to store the shared tick counter in `globalThis`.
 */
export const GLOBAL_TICK_COUNT_KEY = "tickCount";

/**
 * Global key used to store the shared tick speed in `globalThis`.
 */
export const GLOBAL_TICK_SPEED_KEY = "tickSpeed";

/**
 * Dynamic property used to persist the configured machine tick speed.
 */
export const TICK_SPEED_PROPERTY_ID = "utilitycraft:tickSpeed";

/**
 * Script event used to destroy a UtilityCraft machine from a helper entity.
 */
export const DESTROY_MACHINE_EVENT_ID = "dorios:destroyMachine";

/**
 * Script event used to destroy a UtilityCraft generator from a helper entity.
 */
export const DESTROY_GENERATOR_EVENT_ID = "dorios:destroyGenerator";

/**
 * Script event used to destroy a UtilityCraft fluid tank from a helper entity.
 */
export const DESTROY_TANK_EVENT_ID = "dorios:destroyTank";

/**
 * Script event used to register fluid container items at runtime.
 */
export const REGISTER_FLUID_ITEM_EVENT_ID = "utilitycraft:register_fluid_item";

/**
 * Script event used to register fluid holder items at runtime.
 */
export const REGISTER_FLUID_HOLDER_EVENT_ID = "utilitycraft:register_fluid_holder";

/**
 * Script event used to update the shared machinery tick speed.
 */
export const SET_TICK_SPEED_EVENT_ID = "utilitycraft:set_tick_speed";

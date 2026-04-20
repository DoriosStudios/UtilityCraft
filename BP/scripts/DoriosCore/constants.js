
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
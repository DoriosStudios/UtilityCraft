/**
 * Default button item identifier used to fill UI button slots.
 *
 * This item is loaded once during initialization and reused by the button
 * watcher to restore pressed slots.
 */
export const DEFAULT_BUTTON_ITEM_ID = "utilitycraft:ui_filler";

/**
 * Blank display name assigned to the shared button item.
 */
export const DEFAULT_BUTTON_NAME_TAG = " ";

/**
 * Fallback slot state used when a watched slot has no item.
 */
export const EMPTY_SLOT_STATE = "empty";

/**
 * Tick interval used by the global button watcher loop.
 */
export const BUTTON_WATCH_INTERVAL = 1;

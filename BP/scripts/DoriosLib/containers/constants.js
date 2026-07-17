// @ts-check

/** Entity type family that opts an inventory into DoriosContainers. */
export const CONTAINER_FAMILY = "dorios:container";

/** Shared, resource-oriented IO document stored on compatible entities. */
export const IO_CONFIG_PROPERTY = "utilitycraft:io_config";

/** Root key owned by DoriosContainers inside {@link IO_CONFIG_PROPERTY}. */
export const ITEM_CONFIG_KEY = "items";

/** Current persisted item-config schema version. */
export const ITEM_CONFIG_VERSION = 1;

/** Dedicated script-event namespace for the DoriosContainers protocol. */
export const SCRIPT_EVENT_NAMESPACE = "dorios_container";

/** Cross-addon event used to replace one entity's complete item configuration. */
export const SET_CONFIG_EVENT_ID = `${SCRIPT_EVENT_NAMESPACE}:set_config`;

/** Canonical absolute directions used by complex item configurations. */
export const DIRECTIONS = ["north", "south", "east", "west", "up", "down"];

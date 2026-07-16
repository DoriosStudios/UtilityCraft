// @ts-check

/**
 * DoriosLib public entry point.
 *
 * Importing this module does not register events, mutate Minecraft prototypes,
 * or expose globals. Modules that need initialization provide an explicit
 * method for it.
 *
 * @module DoriosLib
 */

/** Current DoriosLib semantic version. */
export const VERSION = "2.0.0";

export * as block from "./block/index.js";
export * as constants from "./constants/index.js";
export * as containers from "./containers/index.js";
export * as dependencies from "./dependencies/index.js";
export * as entity from "./entity/index.js";
export * as item from "./item/index.js";
export * as math from "./math/index.js";
export * as messages from "./messages/index.js";
export * as player from "./player/index.js";
export * as registry from "./registry/index.js";
export * as text from "./text/index.js";
export * as time from "./time/index.js";
export * as utils from "./utils/index.js";

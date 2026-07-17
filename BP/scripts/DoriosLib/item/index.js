// @ts-check

import { ItemStack, ItemTypes } from "@minecraft/server";

/**
 * @typedef {object} CreateItemOptions
 * @property {string} typeId
 * @property {number} [amount=1]
 * @property {string} [nameTag]
 * @property {(import("@minecraft/server").RawMessage|string)[]} [lore]
 */

export * as durability from "./durability.js";

/**
 * Creates and configures an ItemStack.
 *
 * Invalid item identifiers, amounts, names, or lore are reported through the
 * native Script API errors instead of being silently ignored.
 *
 * @param {CreateItemOptions} options
 * @returns {ItemStack}
 */
export function create(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("Item creation options are required");
  }
  if (!options.typeId || typeof options.typeId !== "string") {
    throw new TypeError("A valid item typeId is required");
  }

  const item = new ItemStack(options.typeId, options.amount ?? 1);
  if (options.nameTag !== undefined) item.nameTag = options.nameTag;
  if (options.lore !== undefined) item.setLore([...options.lore]);
  return item;
}

/**
 * Checks whether an item type identifier is registered.
 *
 * @param {string} typeId
 * @returns {boolean}
 */
export function isType(typeId) {
  return ItemTypes.get(typeId) !== undefined;
}

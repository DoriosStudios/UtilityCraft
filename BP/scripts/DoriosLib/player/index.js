// @ts-check

import { GameMode } from "@minecraft/server";
import { getEquipment, getInventory, setEquipment } from "../entity/index.js";
import { create as createItem } from "../item/index.js";

/** @typedef {import("@minecraft/server").ItemStack} ItemStack */

/**
 * @typedef {object} GiveItemResult
 * @property {number} added Amount inserted into the inventory.
 * @property {ItemStack|undefined} remainder Items that did not fit.
 * @property {boolean} dropped Whether the remainder was dropped in the world.
 */

/**
 * @typedef {object} GiveItemOptions
 * @property {string|ItemStack} item Item identifier or stack.
 * @property {number} [amount=1] Used only when `item` is an identifier.
 * @property {boolean} [dropRemainder=true]
 * @property {import("@minecraft/server").Vector3} [dropLocation]
 */

/**
 * Checks whether a player is in creative mode.
 *
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isCreative(player) {
  return player.getGameMode() === GameMode.Creative;
}

/**
 * Checks whether a player is in survival mode.
 *
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
export function isSurvival(player) {
  return player.getGameMode() === GameMode.Survival;
}

/**
 * Gives an item to a player and optionally drops any remainder.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {GiveItemOptions} options
 * @returns {GiveItemResult}
 */
export function giveItem(player, options) {
  const stack = typeof options.item === "string"
    ? createItem({ typeId: options.item, amount: options.amount })
    : options.item.clone();
  const container = getInventory(player);
  if (!container) return { added: 0, remainder: stack, dropped: false };

  const remainder = container.addItem(stack);
  const added = stack.amount - (remainder?.amount ?? 0);
  const shouldDrop = options.dropRemainder ?? true;

  if (remainder && shouldDrop) {
    const location = options.dropLocation ?? {
      x: player.location.x,
      y: player.location.y + 1,
      z: player.location.z,
    };
    player.dimension.spawnItem(remainder, location);
    return { added, remainder: undefined, dropped: true };
  }

  return { added, remainder, dropped: false };
}

export { getEquipment, setEquipment };

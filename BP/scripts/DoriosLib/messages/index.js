// @ts-check

import { system, world } from "@minecraft/server";
import { tryStringify } from "../utils/json.js";

/**
 * Sends a message to every player in the world.
 *
 * @param {import("@minecraft/server").RawMessage|string} message
 */
export function broadcast(message) {
  world.sendMessage(message);
}

/**
 * Safely sends a message to a player. If the current execution context is
 * restricted, the operation is deferred to the next tick.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").RawMessage|string} message
 */
export function send(player, message) {
  try {
    player.sendMessage(message);
  } catch {
    system.run(() => player.sendMessage(message));
  }
}

/**
 * Safely updates a player's action bar.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").RawMessage|string} message
 */
export function actionBar(player, message) {
  try {
    player.onScreenDisplay.setActionBar(message);
  } catch {
    system.run(() => player.onScreenDisplay.setActionBar(message));
  }
}

/**
 * Sends formatted JSON to a player, one line per message.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {string} title
 * @param {unknown} value
 */
export function printJson(player, title, value) {
  send(player, `§6${title}:`);
  const result = tryStringify(value, { indent: 2 });
  const formatted = result.ok
    ? result.value
    : `[Unserializable value: ${result.error.message}]`;
  for (const line of formatted.split("\n")) send(player, `§7${line}`);
}

// @ts-check

import { system } from "@minecraft/server";

/** Number of Minecraft ticks in one second. */
export const TICKS_PER_SECOND = 20;

/** Common tick durations. */
export const TICKS = {
  second: TICKS_PER_SECOND,
  minute: TICKS_PER_SECOND * 60,
  hour: TICKS_PER_SECOND * 60 * 60,
  day: TICKS_PER_SECOND * 60 * 60 * 24,
};

/**
 * Formats seconds as `m:ss` or `h:mm:ss`.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * Formats seconds using the two largest relevant units.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (days > 0) return `${days} d${hours > 0 ? ` ${hours} h` : ""}`;
  if (hours > 0) return `${hours} h${minutes > 0 ? ` ${minutes} m` : ""}`;
  if (minutes > 0) return `${minutes} m${remainingSeconds > 0 ? ` ${remainingSeconds} s` : ""}`;
  return `${remainingSeconds} s`;
}

/**
 * Schedules a callback after a number of ticks.
 *
 * @param {number} ticks
 * @param {() => void} callback
 * @returns {number} System run identifier.
 */
export function runAfterTicks(ticks, callback) {
  return system.runTimeout(callback, Math.max(0, Math.floor(ticks)));
}

/**
 * Schedules a callback after a number of seconds.
 *
 * @param {number} seconds
 * @param {() => void} callback
 * @returns {number} System run identifier.
 */
export function runAfterSeconds(seconds, callback) {
  return runAfterTicks(seconds * TICKS_PER_SECOND, callback);
}

/**
 * Schedules a callback after a number of minutes.
 *
 * @param {number} minutes
 * @param {() => void} callback
 * @returns {number} System run identifier.
 */
export function runAfterMinutes(minutes, callback) {
  return runAfterSeconds(minutes * 60, callback);
}

/**
 * Waits asynchronously for a number of ticks using the native Script API.
 *
 * @param {number} ticks
 * @returns {Promise<void>}
 */
export function waitTicks(ticks) {
  return system.waitTicks(Math.max(1, Math.floor(ticks)));
}

/**
 * Waits asynchronously for a number of seconds.
 *
 * @param {number} seconds
 * @returns {Promise<void>}
 */
export function waitSeconds(seconds) {
  return waitTicks(seconds * TICKS_PER_SECOND);
}

/**
 * Waits asynchronously for a number of minutes.
 *
 * @param {number} minutes
 * @returns {Promise<void>}
 */
export function waitMinutes(minutes) {
  return waitSeconds(minutes * 60);
}

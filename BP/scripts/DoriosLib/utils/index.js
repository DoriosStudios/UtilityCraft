// @ts-check

export * as json from "./json.js";

/**
 * Normalizes one value or an array into an array.
 *
 * @template T
 * @param {T|T[]} value
 * @returns {T[]}
 */
export function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * Checks whether a value is a plain object rather than an array or class
 * instance.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

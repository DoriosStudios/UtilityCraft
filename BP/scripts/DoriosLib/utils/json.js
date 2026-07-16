// @ts-check

/**
 * @template T
 * @typedef {{ok: true, value: T}|{ok: false, error: Error}} JsonResult
 */

/**
 * Attempts to parse JSON without hiding parsing failures.
 *
 * @template T
 * @param {string} source
 * @param {(this: unknown, key: string, value: unknown) => unknown} [reviver]
 * @returns {JsonResult<T>}
 */
export function tryParse(source, reviver) {
  try {
    return { ok: true, value: /** @type {T} */ (JSON.parse(source, reviver)) };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

/**
 * Parses JSON or returns a caller-provided fallback.
 *
 * @template T
 * @param {string} source
 * @param {T} fallback
 * @param {(this: unknown, key: string, value: unknown) => unknown} [reviver]
 * @returns {T}
 */
export function parseOr(source, fallback, reviver) {
  const result = tryParse(source, reviver);
  return result.ok ? result.value : fallback;
}

/**
 * Attempts to serialize a value as JSON.
 *
 * @param {unknown} value
 * @param {{indent?: number|string}} [options]
 * @returns {JsonResult<string>}
 */
export function tryStringify(value, options = {}) {
  try {
    const serialized = JSON.stringify(value, null, options.indent ?? 0);
    if (serialized === undefined) {
      return { ok: false, error: new TypeError("Value cannot be represented as JSON") };
    }
    return { ok: true, value: serialized };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

/**
 * Serializes a value and throws when it cannot be represented as JSON.
 *
 * @param {unknown} value
 * @param {{indent?: number|string}} [options]
 * @returns {string}
 */
export function stringify(value, options = {}) {
  const result = tryStringify(value, options);
  if (!result.ok) throw result.error;
  return result.value;
}

/**
 * Creates a JSON-compatible deep clone.
 *
 * This intentionally supports only data that can be represented by JSON.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clone(value) {
  return /** @type {T} */ (JSON.parse(stringify(value)));
}

/** @param {unknown} error */
function normalizeError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

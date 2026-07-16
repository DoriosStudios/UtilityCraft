// @ts-check

/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * Restricts a number to an inclusive range.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  assertFiniteNumber(value, "value");
  assertFiniteNumber(min, "min");
  assertFiniteNumber(max, "max");
  if (min > max) throw new RangeError("min cannot be greater than max");

  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to a fixed number of decimal places.
 *
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {number}
 */
export function roundTo(value, decimals = 0) {
  assertFiniteNumber(value, "value");
  if (!Number.isInteger(decimals)) throw new TypeError("decimals must be an integer");

  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Maps a value from `[0, max]` into `[0, scale]`.
 *
 * @param {number} current
 * @param {number} max
 * @param {number} scale
 * @param {"floor"|"ceil"|"round"|"none"} [mode="floor"]
 * @returns {number}
 */
export function scaleTo(current, max, scale, mode = "floor") {
  assertFiniteNumber(current, "current");
  assertFiniteNumber(max, "max");
  assertFiniteNumber(scale, "scale");
  if (max <= 0 || scale <= 0) return 0;

  const scaled = clamp((current / max) * scale, 0, scale);
  switch (mode) {
    case "ceil": return Math.ceil(scaled);
    case "round": return Math.round(scaled);
    case "none": return scaled;
    case "floor": return Math.floor(scaled);
    default: throw new RangeError(`Unknown scale mode: ${mode}`);
  }
}

/**
 * Returns a random integer within an inclusive range.
 *
 * @param {number} min
 * @param {number} max
 * @param {() => number} [random=Math.random] Injectable random source for tests.
 * @returns {number}
 */
export function randomInt(min, max, random = Math.random) {
  assertFiniteNumber(min, "min");
  assertFiniteNumber(max, "max");

  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  if (lower > upper) throw new RangeError("The interval contains no integers");

  return Math.floor(random() * (upper - lower + 1)) + lower;
}

/**
 * Returns a random number within `[min, max)`.
 *
 * @param {number} min
 * @param {number} max
 * @param {() => number} [random=Math.random] Injectable random source for tests.
 * @returns {number}
 */
export function randomFloat(min, max, random = Math.random) {
  assertFiniteNumber(min, "min");
  assertFiniteNumber(max, "max");
  if (min > max) throw new RangeError("min cannot be greater than max");
  if (min === max) return min;

  return random() * (max - min) + min;
}

/**
 * Calculates the Euclidean distance between two positions.
 *
 * @param {Vector3} a
 * @param {Vector3} b
 * @returns {number}
 */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Offsets a position by a scaled vector without mutating either argument.
 *
 * @param {Vector3} position
 * @param {Vector3} vector
 * @param {number} [amount=1]
 * @returns {Vector3}
 */
export function offset(position, vector, amount = 1) {
  assertFiniteNumber(amount, "amount");
  return {
    x: position.x + vector.x * amount,
    y: position.y + vector.y * amount,
    z: position.z + vector.z * amount,
  };
}

/**
 * Converts a Roman numeral to an integer.
 *
 * @param {string} numeral
 * @returns {number}
 */
export function romanToInteger(numeral) {
  const normalized = String(numeral).trim().toUpperCase();
  if (!/^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(normalized)) {
    return 0;
  }

  const values = /** @type {const} */ ({ I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 });
  let result = 0;
  let previous = 0;

  for (let index = normalized.length - 1; index >= 0; index--) {
    const value = values[/** @type {keyof typeof values} */ (normalized[index])];
    result += value < previous ? -value : value;
    previous = value;
  }

  return result;
}

/**
 * Converts an integer from 1 to 3999 into a Roman numeral.
 *
 * @param {number} value
 * @returns {string}
 */
export function integerToRoman(value) {
  if (!Number.isInteger(value) || value <= 0 || value >= 4000) return "";

  /** @type {Array<readonly [number, string]>} */
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let result = "";

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }

  return result;
}

/**
 * @param {number} value
 * @param {string} name
 */
function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
}

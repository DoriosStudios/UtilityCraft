// @ts-check

/** Minecraft formatting codes. */
export const FORMAT = {
  black: "§0",
  darkBlue: "§1",
  darkGreen: "§2",
  darkAqua: "§3",
  darkRed: "§4",
  darkPurple: "§5",
  gold: "§6",
  gray: "§7",
  darkGray: "§8",
  blue: "§9",
  green: "§a",
  aqua: "§b",
  red: "§c",
  lightPurple: "§d",
  yellow: "§e",
  white: "§f",
  obfuscated: "§k",
  bold: "§l",
  strikethrough: "§m",
  underline: "§n",
  italic: "§o",
  reset: "§r",
};

/**
 * Uppercases the first character without altering the remainder.
 *
 * @param {string} value
 * @returns {string}
 */
export function capitalizeFirst(value) {
  const text = String(value);
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * Converts an identifier such as `minecraft:diamond_sword` into `Diamond Sword`.
 *
 * @param {string} identifier
 * @returns {string}
 */
export function formatIdentifier(identifier) {
  const separator = identifier.indexOf(":");
  const path = separator === -1 ? identifier : identifier.slice(separator + 1);

  return path
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => capitalizeFirst(word.toLowerCase()))
    .join(" ");
}

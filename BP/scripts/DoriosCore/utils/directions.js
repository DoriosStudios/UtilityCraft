export const DIRECTIONS = ["north", "south", "east", "west", "up", "down"];

export const HORIZONTAL_DIRECTIONS = ["north", "east", "south", "west"];

export const DIRECTION_OFFSETS = {
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

export const OPPOSITE_DIRECTIONS = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
};

export const RELATIVE_IO_FACES = ["top", "left", "front", "right", "bottom", "back"];

const HORIZONTAL_RELATIVES = {
  north: { front: "south", back: "north", left: "east", right: "west", top: "up", bottom: "down" },
  south: { front: "north", back: "south", left: "west", right: "east", top: "up", bottom: "down" },
  east: { front: "east", back: "west", left: "north", right: "south", top: "up", bottom: "down" },
  west: { front: "west", back: "east", left: "south", right: "north", top: "up", bottom: "down" },
};

const VERTICAL_RELATIVES = {
  up: { front: "up", back: "down", left: "west", right: "east", top: "north", bottom: "south" },
  down: { front: "down", back: "up", left: "west", right: "east", top: "south", bottom: "north" },
};

/**
 * Returns a new location offset by a direction vector.
 *
 * @param {{x:number, y:number, z:number}} location Source location.
 * @param {keyof DIRECTION_OFFSETS|{x:number, y:number, z:number}} direction Direction name or raw offset.
 * @param {number} [amount=1] Offset multiplier.
 * @returns {{x:number, y:number, z:number}} Offset location.
 */
export function offsetLocation(location, direction, amount = 1) {
  const offset = typeof direction === "string" ? DIRECTION_OFFSETS[direction] : direction;

  return {
    x: location.x + offset.x * amount,
    y: location.y + offset.y * amount,
    z: location.z + offset.z * amount,
  };
}

/**
 * Reads the best available vanilla or legacy facing state from a block.
 *
 * @param {import("@minecraft/server").Block|undefined} block Block to inspect.
 * @returns {string} Absolute direction the visual front face points to.
 */
export function getBlockFacingDirection(block) {
  const vanillaFacing = block?.getState?.("minecraft:facing_direction")
    ?? block?.getState?.("minecraft:cardinal_direction");
  if (DIRECTIONS.includes(vanillaFacing)) return vanillaFacing;

  const legacyOutputAxis = block?.getState?.("utilitycraft:axis");
  return OPPOSITE_DIRECTIONS[legacyOutputAxis] ?? "north";
}

/**
 * Resolves a visual IO face into an absolute world direction.
 *
 * @param {import("@minecraft/server").Block|undefined} block Machine block.
 * @param {string} face Visual IO face, such as `"front"` or `"top"`.
 * @returns {string} Absolute direction represented by the visual face.
 */
export function resolveRelativeFaceDirection(block, face) {
  const facing = getBlockFacingDirection(block);
  const map = HORIZONTAL_RELATIVES[facing] ?? VERTICAL_RELATIVES[facing] ?? HORIZONTAL_RELATIVES.north;
  return map[face] ?? "north";
}

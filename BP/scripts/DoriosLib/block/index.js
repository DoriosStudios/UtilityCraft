// @ts-check

import { BlockTypes } from "@minecraft/server";
import { DIRECTION_VECTORS } from "../constants/index.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {boolean|number|string} BlockStateValue */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * Reads a state from a block's current permutation.
 *
 * @param {Block} block
 * @param {string} stateId
 * @returns {boolean|number|string|undefined}
 */
export function getState(block, stateId) {
  return /** @type {boolean|number|string|undefined} */ (
    /** @type {any} */ (block?.permutation)?.getState(stateId)
  );
}

/**
 * Applies one state to a block.
 *
 * @param {Block} block
 * @param {string} stateId
 * @param {BlockStateValue} value
 * @returns {boolean} Whether the state was applied successfully.
 */
export function setState(block, stateId, value) {
  if (!block?.permutation) return false;

  try {
    block.setPermutation(/** @type {any} */ (block.permutation).withState(stateId, value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies several states in a single permutation update.
 *
 * @param {Block} block
 * @param {Record<string, BlockStateValue>} states
 * @returns {boolean} Whether every state was applied successfully.
 */
export function setStates(block, states) {
  if (!block?.permutation) return false;

  try {
    let permutation = block.permutation;
    for (const [stateId, value] of Object.entries(states)) {
      permutation = /** @type {any} */ (permutation).withState(stateId, value);
    }
    block.setPermutation(permutation);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the vector represented by a direction block state.
 *
 * @param {Block} block
 * @param {string} [stateId="minecraft:facing_direction"]
 * @returns {Vector3|undefined}
 */
export function getFacingVector(block, stateId = "minecraft:facing_direction") {
  let direction = getState(block, stateId);
  if (direction === undefined && stateId === "minecraft:facing_direction") {
    const axis = getState(block, "utilitycraft:axis");
    const opposite = {
      up: "down",
      down: "up",
      north: "south",
      south: "north",
      east: "west",
      west: "east",
    };
    direction = typeof axis === "string"
      ? opposite[/** @type {keyof typeof opposite} */ (axis)]
      : undefined;
  }
  if (typeof direction !== "string") return undefined;
  return DIRECTION_VECTORS[/** @type {keyof typeof DIRECTION_VECTORS} */ (direction)];
}

/**
 * Gets the neighboring block in the direction represented by a block state.
 *
 * @param {Block} block
 * @param {string} [stateId="minecraft:facing_direction"]
 * @returns {Block|undefined}
 */
export function getFacingBlock(block, stateId = "minecraft:facing_direction") {
  const vector = getFacingVector(block, stateId);
  if (!vector) return undefined;

  const { x, y, z } = block.location;
  return block.dimension.getBlock({ x: x + vector.x, y: y + vector.y, z: z + vector.z });
}

/**
 * Gets every currently available block adjacent to a block.
 *
 * @param {Block} block
 * @returns {Block[]}
 */
export function getAdjacentBlocks(block) {
  const { x, y, z } = block.location;
  const dimension = block.dimension;
  const positions = [
    { x: x + 1, y, z }, { x: x - 1, y, z },
    { x, y: y + 1, z }, { x, y: y - 1, z },
    { x, y, z: z + 1 }, { x, y, z: z - 1 },
  ];

  return positions
    .map((position) => dimension.getBlock(position))
    .filter((neighbor) => neighbor !== undefined);
}

/**
 * Gets the first entity occupying a block location.
 *
 * @param {Block} block
 * @returns {import("@minecraft/server").Entity|undefined}
 */
export function getEntity(block) {
  return block.dimension.getEntitiesAtBlockLocation(block.location)[0];
}

/**
 * Checks whether a block type identifier is registered.
 *
 * @param {string} typeId
 * @returns {boolean}
 */
export function isType(typeId) {
  return BlockTypes.get(typeId) !== undefined;
}

import * as DoriosLib from "DoriosLib/index.js";

const OPPOSITE_FACES = Object.freeze({
    up: "down",
    down: "up",
    north: "south",
    south: "north",
    east: "west",
    west: "east"
});

/**
 * Resolves the working face used by machines whose visible front is opposite
 * to their vanilla `minecraft:facing_direction` state.
 */
export function getOppositeFacingDirection(block) {
    const facingDirection = DoriosLib.block.getState(block, "minecraft:facing_direction");
    return OPPOSITE_FACES[facingDirection];
}

/** Returns the adjacent block touching the machine's visible front. */
export function getOppositeFacingBlock(block) {
    const direction = getOppositeFacingDirection(block);
    const vector = DoriosLib.constants.DIRECTION_VECTORS[direction];
    if (!vector) return undefined;

    const { x, y, z } = block.location;
    return block.dimension.getBlock({
        x: x + vector.x,
        y: y + vector.y,
        z: z + vector.z
    });
}

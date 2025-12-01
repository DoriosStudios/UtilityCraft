import { Block } from '@minecraft/server';

/**
 * Block utility methods for Dorios API.
 *
 * Extends Block.prototype with helper functions for state manipulation,
 * directional checks, and adjacency lookups.
 */
const BlockHandler = {
    /**
     * Gets the value of a given state from this block's permutation.
     * 
     * @param {string} state The name of the state to get.
     * @returns {*} The value of the state, or undefined if block is null.
     */
    getState(state) {
        return this?.permutation.getState(state);
    },

    /**
     * Sets a given state on this block's permutation.
     * 
     * @param {string} state The name of the state to set.
     * @param {*} value The value to assign to the state.
     * @returns {boolean} True if the state was successfully set, false otherwise.
     */
    setState(state, value) {
        if (!this || !this.permutation) return false;

        try {
            this.setPermutation(this.permutation.withState(state, value));
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Returns the block in the direction this block is facing.
     * 
     * @returns {Block | null} The facing block, or null if facing direction is invalid.
     */
    getFacingBlock() {
        const facingOffsets = {
            up: [0, 1, 0],
            down: [0, -1, 0],
            north: [0, 0, -1],
            south: [0, 0, 1],
            west: [-1, 0, 0],
            east: [1, 0, 0]
        };
        const opposite = {
            up: "down", down: "up",
            north: "south", south: "north",
            east: "west", west: "east"
        };
        const facing = this.permutation.getState('minecraft:facing_direction') ?? opposite[this.permutation.getState('utilitycraft:axis')];
        const offset = facingOffsets[facing];

        if (!offset) return null;

        const { x, y, z } = this.location;
        const targetLocation = {
            x: x + offset[0],
            y: y + offset[1],
            z: z + offset[2]
        };

        return this.dimension.getBlock(targetLocation);
    },

    /**
     * Returns an array of blocks adjacent to this block (6 directions).
     *
     * @returns {Block[]} Array of neighboring blocks.
     */
    getAdjacentBlocks() {
        const { x, y, z } = this.location;
        const dim = this.dimension;

        return [
            dim.getBlock({ x: x + 1, y, z }),
            dim.getBlock({ x: x - 1, y, z }),
            dim.getBlock({ x, y: y + 1, z }),
            dim.getBlock({ x, y: y - 1, z }),
            dim.getBlock({ x, y, z: z + 1 }),
            dim.getBlock({ x, y, z: z - 1 })
        ];
    },
    /**
     * Gets the first entity found at this object's current block location.
     *
     * ## Behavior
     * - Uses `Dimension.getEntitiesAtBlockLocation` to query all entities
     *   at the block position of this object.
     * - Returns the first entity in the list, or `undefined` if none are found.
     *
     * @function getEntity
     * @memberof DoriosAPI
     * @returns {Entity | undefined} The first entity at the current block location, or `undefined` if none exist.
     */
    getEntity() {
        const entity = this.dimension.getEntitiesAtBlockLocation(this.location)[0]
        if (entity) return entity
        return undefined
    },
};

Object.keys(BlockHandler).forEach(fn => {
    Object.defineProperty(Block.prototype, fn, {
        value: BlockHandler[fn],
        enumerable: false
    });
});

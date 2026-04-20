import { system } from "@minecraft/server";
import * as Constants from "./constants.js";

/**
 * ==================================================
 * UtilityCraft - Rotation Utility
 * ==================================================
 * Handles manual block placement with facing logic.
 * Supports axis-based orientation (6 directions),
 * ready to be extended to full 24-rotation control.
 *
 * Example:
 *   Rotation.facing(player, block, "utilitycraft:crusher");
 * ==================================================
 */
export class Rotation {
    /**
     * Places a block manually with its `utilitycraft:axis` state,
     * oriented to the player’s look direction.
     *
     * Equivalent to:
     *   /setblock ~~~ <typeId> ["utilitycraft:axis"="north"]
     *
     * @param {Player} player The player placing the block.
     * @param {Block} block The block reference (for position).
     * @param {BlockPermutation} perm The block perm to place.
     */
    static facing(player, block, perm) {
        const { x, y, z } = block.location;
        const dim = block.dimension;

        // ───── Determine axis (6 possible directions)
        const view = player.getViewDirection();
        let axis = "north";

        if (
            Math.abs(view.y) > Math.abs(view.x) &&
            Math.abs(view.y) > Math.abs(view.z)
        ) {
            axis = view.y > 0 ? "up" : "down";
        } else if (Math.abs(view.z) > Math.abs(view.x)) {
            axis = view.z > 0 ? "south" : "north";
        } else {
            axis = view.x > 0 ? "east" : "west";
        }
        // ───── Place the block manually with the axis applied
        system.run(() => {
            player.playSound("place.iron");
            dim.runCommand(
                `setblock ${x} ${y} ${z} ${perm.type.id} ["utilitycraft:axis"="${axis}"]`,
            );
            system.run(() => {
                if (perm.hasTag(Constants.ENERGY_BLOCK_TAG)) {
                    player.runCommand(
                        `scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} energy|[${x},${y},${z}]`,
                    );
                }

                if (perm.hasTag(Constants.ITEM_BLOCK_TAG)) {
                    player.runCommand(
                        `scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} item|[${x},${y},${z}]`,
                    );
                }

                if (perm.hasTag(Constants.FLUID_BLOCK_TAG)) {
                    player.runCommand(
                        `scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} fluid|[${x},${y},${z}]`,
                    );
                }
            });
        });
    }

    /**
     * Rotates a block when the wrench is used on it.
     *
     * - Supports both vanilla and UtilityCraft’s 24-axis rotation.
     * - Plays a click sound after successful rotation.
     *
     * @param {Block} block The block being interacted with.
     * @param {string} blockFace The face of the block that was clicked.
     */
    static handleRotation(block, blockFace) {
        // --- Handle UtilityCraft 24-axis rotation ---
        if (
            block.getState("utilitycraft:axis") != undefined &&
            block.getState("utilitycraft:rotation") != undefined
        ) {
            Rotation.rotate_24(block, blockFace);
            return;
        }

        // --- Handle vanilla facing_direction rotation ---
        try {
            const facingDir = block.permutation.getState(
                "minecraft:facing_direction",
            );
            if (facingDir !== undefined) {
                const index = Constants.FACING_DIRECTIONS.indexOf(facingDir);
                const next = (index + 1) % Constants.FACING_DIRECTIONS.length;
                block.setPermutation(
                    block.permutation.withState(
                        "minecraft:facing_direction",
                        Constants.FACING_DIRECTIONS[next],
                    ),
                );
                return;
            }
        } catch { }

        // --- Handle cardinal_direction rotation ---
        try {
            const cardDir = block.permutation.getState(
                "minecraft:cardinal_direction",
            );
            if (cardDir !== undefined) {
                const index = Constants.CARDINAL_DIRECTIONS.indexOf(cardDir);
                const next = (index + 1) % Constants.CARDINAL_DIRECTIONS.length;
                block.setPermutation(
                    block.permutation.withState(
                        "minecraft:cardinal_direction",
                        Constants.CARDINAL_DIRECTIONS[next],
                    ),
                );
                return;
            }
        } catch { }
    }

    /**
     * Handles full 24-direction rotation logic for blocks using `axis` and `rotation` states.
     *
     * ## Rules
     * 1. Clicking the same axis line (front/back) → rotates `rotation` (0–3).
     * 2. Clicking any other face → changes only `axis`, cycling clockwise
     *    through the 4 lateral directions relative to the clicked face,
     *    and resets rotation to 0 for a clean orientation.
     *
     * @param {Block} block The block being rotated.
     * @param {string} blockFace The clicked face (e.g. "north", "up").
     */
    static rotate_24(block, blockFace) {
        const perm = block.permutation;
        const axis = perm.getState("utilitycraft:axis");
        const rotation = perm.getState("utilitycraft:rotation") ?? 0;
        const face = blockFace.toLowerCase();

        // Same-axis rotation (works fine)
        const opposite = {
            up: "down",
            down: "up",
            north: "south",
            south: "north",
            east: "west",
            west: "east",
        };

        if (face === axis || face === opposite[axis]) {
            const nextRot = (rotation + 1) % 4;
            block.setPermutation(perm.withState("utilitycraft:rotation", nextRot));
            return;
        }

        // Axis change using precomputed mapping table
        const nextData = Constants.ROTATION_MAP[face]?.[axis]?.[rotation];
        if (!nextData) return;

        const { axis: nextAxis, rotation: nextRotation } = nextData;

        block.setPermutation(
            perm
                .withState("utilitycraft:axis", nextAxis)
                .withState("utilitycraft:rotation", nextRotation),
        );
    }
}

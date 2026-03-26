/**
* Dimension Y-limits for elevator scanning.
* @type {Record<string, { ymin: number, ymax: number }>}}
*/
const DIMENSION_LIMITS = {
    "minecraft:overworld": { ymin: -64, ymax: 320 },
    "minecraft:nether": { ymin: 0, ymax: 129 },
    "minecraft:the_end": { ymin: 0, ymax: 257 }
};

const ELEVATOR_BLOCK_IDS = new Set([
    "utilitycraft:elevator",
    "utilitycraft:orange_elevator",
    "utilitycraft:magenta_elevator",
    "utilitycraft:light_blue_elevator",
    "utilitycraft:yellow_elevator",
    "utilitycraft:lime_elevator",
    "utilitycraft:pink_elevator",
    "utilitycraft:gray_elevator",
    "utilitycraft:light_gray_elevator",
    "utilitycraft:cyan_elevator",
    "utilitycraft:purple_elevator",
    "utilitycraft:blue_elevator",
    "utilitycraft:brown_elevator",
    "utilitycraft:green_elevator",
    "utilitycraft:red_elevator",
    "utilitycraft:black_elevator"
]);

/**
 * @param {import("@minecraft/server").Block} block
 */
function isElevatorBlock(block) {
    return ELEVATOR_BLOCK_IDS.has(block?.typeId ?? "");
}

/**
 * @param {import("@minecraft/server").Block} block
 */
function shouldIgnoreColors(block) {
    return block?.permutation?.getState?.("utilitycraft:ignore_colors") === true;
}

/**
 * @param {import("@minecraft/server").Block} sourceBlock
 * @param {import("@minecraft/server").Block | undefined} targetBlock
 */
function canTeleportBetween(sourceBlock, targetBlock) {
    if (!isElevatorBlock(targetBlock)) return false;
    if (shouldIgnoreColors(sourceBlock)) return true;
    return targetBlock.typeId === sourceBlock.typeId;
}

/**
 * @param {object} params
 * @param {import("@minecraft/server").Block} params.block
 * @param {import("@minecraft/server").Player} params.player
 * @param {number} params.startY
 * @param {number} params.endY
 * @param {number} params.step
 * @param {string} params.soundId
 */
function tryTeleportToMatchingElevator({ block, player, startY, endY, step, soundId }) {
    const dim = block.dimension;
    const { x: bx, z: bz } = block.location;
    const x = bx + 0.5;
    const z = bz + 0.5;

    for (let yi = startY; step > 0 ? yi < endY : yi >= endY; yi += step) {
        const checkBlock = dim.getBlock({ x: bx, y: yi, z: bz });
        if (!canTeleportBetween(block, checkBlock)) continue;

        const success = player.tryTeleport(
            { x, y: yi + 1, z },
            {
                dimension: dim,
                checkForBlocks: true
            }
        );

        if (success) {
            player.playSound(soundId);
        }
        break;
    }
}

DoriosAPI.register.blockComponent("elevator", {
    onStepOff(e) {
        const { block } = e;
        const dim = block.dimension;

        const limits = DIMENSION_LIMITS[dim.id];
        if (!limits) return;

        let { x, y, z } = block.location; x += 0.5; z += 0.5
        const player = dim.getPlayers({ location: { x, y: y + 1, z } })[0];
        if (!player) return;

        // Jump = go up
        if (player.isJumping && !player.isSneaking) {
            tryTeleportToMatchingElevator({
                block,
                player,
                startY: y + 1,
                endY: limits.ymax,
                step: 1,
                soundId: "tile.elevator.up"
            });
        }
    },
    onStepOn(e) {
        const { block } = e;
        const dim = block.dimension;

        const limits = DIMENSION_LIMITS[dim.id];
        if (!limits) return;

        let { x, y, z } = block.location; x += 0.5; z += 0.5
        const player = dim.getPlayers({ location: { x, y: y + 1, z } })[0];
        if (!player) return;

        // Sneak to go down
        if (player.isSneaking) {
            tryTeleportToMatchingElevator({
                block,
                player,
                startY: y - 1,
                endY: limits.ymin,
                step: -1,
                soundId: "tile.elevator.down"
            });
        }
    },

    onPlayerInteract(e) {
        const { block, player } = e;
        const dim = block.dimension;

        const limits = DIMENSION_LIMITS[dim.id];
        if (!limits) return;

        const { y } = block.location;

        // Sneak + click = go down
        if (player.isSneaking) {
            tryTeleportToMatchingElevator({
                block,
                player,
                startY: y - 1,
                endY: limits.ymin,
                step: -1,
                soundId: "tile.elevator.down"
            });
            return;
        }

        // Nether: 10% ignite chance
        if (dim.id === "minecraft:nether" && Math.random() < 0.1) {
            player.setOnFire(1);
        }

        // Go up
        tryTeleportToMatchingElevator({
            block,
            player,
            startY: y + 2,
            endY: limits.ymax,
            step: 1,
            soundId: "tile.elevator.up"
        });
    }
});

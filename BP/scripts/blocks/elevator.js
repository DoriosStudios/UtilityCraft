/**
* Dimension Y-limits for elevator scanning.
* @type {Record<string, { ymin: number, ymax: number }>}}
*/
const DIMENSION_LIMITS = {
    "minecraft:overworld": { ymin: -64, ymax: 320 },
    "minecraft:nether": { ymin: 0, ymax: 129 },
    "minecraft:the_end": { ymin: 0, ymax: 257 }
};

DoriosAPI.register.blockComponent("elevator", {
    onStepOff(e) {
        const { block } = e;
        const dim = block.dimension;

        const limits = DIMENSION_LIMITS[dim.id];
        if (!limits) return;

        let { x, y, z } = block.location; x += 0.5; z += 0.5
        const player = dim.getPlayers({ location: { x, y: y + 1, z } })[0];
        if (!player) return;

        // Jump = subir
        if (player.isJumping && !player.isSneaking) {
            for (let yi = y + 1; yi < limits.ymax; yi++) {
                const checkBlock = dim.getBlock({ x, y: yi, z });
                if (checkBlock?.typeId === block.typeId) {

                    const success = player.tryTeleport(
                        { x, y: yi + 1, z },
                        {
                            dimension: dim,
                            checkForBlocks: true
                        }
                    );

                    if (success) {
                        player.playSound("tile.elevator.up");
                    }
                    break;
                }
            }
        }
    },

    onPlayerInteract(e) {
        const { block, player } = e;
        const dim = block.dimension;

        const limits = DIMENSION_LIMITS[dim.id];
        if (!limits) return;

        let { x, y, z } = block.location; x += 0.5; z += 0.5

        // Sneak = bajar
        if (player.isSneaking) {
            for (let yi = y - 1; yi >= limits.ymin; yi--) {
                const checkBlock = dim.getBlock({ x, y: yi, z });
                if (checkBlock?.typeId === block.typeId) {

                    const success = player.tryTeleport(
                        { x, y: yi + 1, z },
                        {
                            dimension: dim,
                            checkForBlocks: true
                        }
                    );

                    if (success) {
                        player.playSound("tile.elevator.down");
                    }
                    break;
                }
            }
            return;
        }

        // Nether: 10% de ignición (igual que antes)
        if (dim.id === "minecraft:nether" && Math.random() < 0.1) {
            player.setOnFire(1);
        }

        // Subir
        for (let yi = y + 2; yi < limits.ymax; yi++) {
            const checkBlock = dim.getBlock({ x, y: yi, z });
            if (checkBlock?.typeId === block.typeId) {

                const success = player.tryTeleport(
                    { x, y: yi + 1, z },
                    {
                        dimension: dim,
                        checkForBlocks: true
                    }
                );

                if (success) {
                    player.playSound("tile.elevator.up");
                }
                break;
            }
        }
    }
});

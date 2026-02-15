/**
 * Shovel component for UtilityCraft AIOTs.
 * 
 * Converts pathable blocks (dirt, grass, podzol, mycelium, rooted dirt) to grass paths
 * and clears snow in the area.
 * 
 * Parameters:
 * - size: Area size (default: 1 = 3x3 area)
 * - sneakingMode: Activation behavior (default: true)
 *   - false: Only activates when NOT sneaking
 *   - true: Only activates when sneaking
 * 
 * This ensures mutual exclusion with the hoe component on AIOTs.
 */
DoriosAPI.register.itemComponent("shovel", {
    onUseOn({ block, source }, { params }) {
        if (!block || !source) return;

        const sneakingMode = params?.sneakingMode ?? true;
        const isSneaking = source.isSneaking ?? false;

        // Mutual exclusion logic:
        // - sneakingMode false: only process when NOT sneaking
        // - sneakingMode true: only process when sneaking
        if (sneakingMode !== isSneaking) return;

        const { x, y, z } = block.location;
        const size = params?.size ?? 1;

        const pathableBlocks = [
            "minecraft:dirt",
            "minecraft:grass",
            "minecraft:grass_block",
            "minecraft:podzol",
            "minecraft:mycelium",
            "minecraft:dirt_with_roots"
        ];

        // Convert pathable blocks to grass paths in area
        for (const blockId of pathableBlocks) {
            block.dimension.runCommand(
                `fill ${x - size} ${y} ${z - size} ${x + size} ${y} ${z + size} grass_path replace ${blockId}`
            );
        }

        // Break snow blocks in area (drops items)
        for (let dx = -size; dx <= size; dx++) {
            for (let dz = -size; dz <= size; dz++) {
                const checkX = x + dx;
                const checkZ = z + dz;
                
                // Check block at current position and one above
                for (let dy = 0; dy <= 1; dy++) {
                    const checkY = y + dy;
                    block.dimension.runCommand(
                        `execute if block ${checkX} ${checkY} ${checkZ} snow run setblock ${checkX} ${checkY} ${checkZ} air destroy`
                    );
                    block.dimension.runCommand(
                        `execute if block ${checkX} ${checkY} ${checkZ} snow_layer run setblock ${checkX} ${checkY} ${checkZ} air destroy`
                    );
                }
            }
        }
    }
});

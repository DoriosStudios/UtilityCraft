/**
 * Hoe component for UtilityCraft AIOTs.
 * 
 * Converts tillable blocks (dirt, grass, podzol, mycelium, rooted dirt) to farmland.
 * 
 * Parameters:
 * - size: Area size (default: 1 = 3x3 area)
 * - runTractor: Whether to execute tractor function for auto-harvest (default: false)
 * - sneakingMode: Activation behavior (default: false)
 *   - false: Only activates when NOT sneaking
 *   - true: Only activates when sneaking
 * 
 * This ensures mutual exclusion with the shovel component on AIOTs.
 */
DoriosAPI.register.itemComponent("hoe", {
    onUseOn({ block, source }, { params }) {
        if (!block || !source) return;

        const sneakingMode = params?.sneakingMode ?? false;
        const isSneaking = source.isSneaking ?? false;

        // Mutual exclusion logic:
        // - sneakingMode false: only process when NOT sneaking
        // - sneakingMode true: only process when sneaking
        if (sneakingMode !== isSneaking) return;

        const { x, y, z } = block.location;
        const size = params?.size ?? 1;
        const runTractor = params?.runTractor ?? false;

        const tillableBlocks = [
            "minecraft:dirt",
            "minecraft:grass",
            "minecraft:grass_block",
            "minecraft:podzol",
            "minecraft:mycelium",
            "minecraft:dirt_with_roots"
        ];

        // Convert tillable blocks to farmland in area
        for (const blockId of tillableBlocks) {
            block.dimension.runCommand(
                `fill ${x - size} ${y} ${z - size} ${x + size} ${y} ${z + size} farmland replace ${blockId}`
            );
        }

        // Optional: auto-harvest crops in area
        if (runTractor) {
            block.dimension.runCommand(
                `execute positioned ${x} ${y} ${z} run function tractor`
            );
        }
    }
});

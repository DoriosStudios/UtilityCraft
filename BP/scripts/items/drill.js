/**
* Runs a cubic drill operation, skipping unbreakable, air, and liquid blocks.
*
* The cube is centered on the mined block's X and Z, and Y is offset by -1
* so the drill digs just below the mined block.
*
* @param {{x:number, y:number, z:number}} location The mined block location.
* @param {number} size The cube size (edge length).
* @param {import("@minecraft/server").Dimension} dimension The target dimension.
*/
function runCubicDrill(location, size, dimension) {
    const radius = Math.floor(size / 2)

    const { x, y, z } = location
    const minX = x - radius
    const maxX = x + radius
    const minY = (y - 1)
    const maxY = (y - 1) + 2 * radius
    const minZ = z - radius
    const maxZ = z + radius

    const unbreakables = Array.isArray(DoriosAPI?.constants?.unbreakableBlocks)
        ? DoriosAPI.constants.unbreakableBlocks
        : []

    for (let dx = minX; dx <= maxX; dx++) {
        for (let dy = minY; dy <= maxY; dy++) {
            for (let dz = minZ; dz <= maxZ; dz++) {
                let targetBlock
                try {
                    targetBlock = dimension.getBlock({ x: dx, y: dy, z: dz })
                } catch {
                    continue
                }

                if (!targetBlock || targetBlock.isAir || targetBlock.isLiquid) continue
                if (unbreakables.includes(targetBlock.typeId)) continue

                dimension.runCommand(`fill ${dx} ${dy} ${dz} ${dx} ${dy} ${dz} air destroy`)
            }
        }
    }
}

DoriosAPI.register.itemComponent("drill", {
    /**
     * Custom drill behavior when mining a block.
     */
    onMineBlock({ block }, { params }) {
        const shape = params?.shape ?? "cubic"

        if (shape === "cubic") {
            const size = params?.size ?? 3
            runCubicDrill(block.location, size, block.dimension)
        }
    }
})
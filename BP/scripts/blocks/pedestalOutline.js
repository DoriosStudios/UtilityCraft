export const PEDESTAL_OUTLINE_ENTITY_ID = "utilitycraft:pedestal_area_outline"

function getOutlineLocation(block) {
    const { x, y, z } = block.location
    return { x: x + 0.5, y, z: z + 0.5 }
}

export function removePedestalAreaOutline(block) {
    try {
        const location = getOutlineLocation(block)
        const outlines = block.dimension.getEntities({
            type: PEDESTAL_OUTLINE_ENTITY_ID,
            location,
            maxDistance: 0.75
        })

        for (const outline of outlines) outline.remove()
    } catch (error) {
        console.warn(`[Pedestal] Could not remove effective area outline: ${error}`)
    }
}

export function showPedestalAreaOutline(block) {
    // Prevent overlapping previews if the clock is replaced before an older timer finishes.
    removePedestalAreaOutline(block)

    try {
        block.dimension.spawnEntity(PEDESTAL_OUTLINE_ENTITY_ID, getOutlineLocation(block))
    } catch (error) {
        console.warn(`[Pedestal] Could not display effective area: ${error}`)
    }
}

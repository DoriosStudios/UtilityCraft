import * as Constants from './constants.js'

/**
 * Changes the waterlogged state of tagged blocks in one horizontal layer.
 */
export function setTaggedBlocksWaterlogged(bounds, dimension, y, waterlogged) {
    const xMinimum = Math.min(bounds.min.x, bounds.max.x)
    const xMaximum = Math.max(bounds.min.x, bounds.max.x)
    const zMinimum = Math.min(bounds.min.z, bounds.max.z)
    const zMaximum = Math.max(bounds.min.z, bounds.max.z)

    for (let x = xMinimum; x <= xMaximum; x++) {
        for (let z = zMinimum; z <= zMaximum; z++) {
            const block = dimension.getBlock({ x, y, z })
            if (!block?.hasTag(Constants.WATERLOGGABLE_BLOCK_TAG)) continue

            try {
                block.setWaterlogged(waterlogged)
            } catch { }
        }
    }
}

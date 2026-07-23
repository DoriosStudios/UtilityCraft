import * as DoriosLib from "DoriosLib/index.js"
import { getOppositeFacingDirection } from "./oppositeFacing.js"

export const HARVESTER_MAX_AREA_LEVEL = 3
export const HARVESTER_COLLECTION_LEVEL = 4

export function getHarvesterAreaLevel(rangeUpgrades) {
    return Math.max(0, Math.min(
        HARVESTER_MAX_AREA_LEVEL,
        Math.floor(Number(rangeUpgrades) || 0)
    ))
}

export function getHarvesterSide(rangeUpgrades) {
    return 3 + getHarvesterAreaLevel(rangeUpgrades) * 2
}

export function hasHarvesterCollection(rangeUpgrades) {
    return Number(rangeUpgrades) >= HARVESTER_COLLECTION_LEVEL
}

/**
 * Matches the current harvesting loop's exact square and layer.
 * Offsets are measured in whole blocks from the Harvester block.
 */
export function getHarvesterOutlineTransform(block, rangeUpgrades) {
    const side = getHarvesterSide(rangeUpgrades)
    const forwardCenter = (side + 1) / 2
    const direction = getOppositeFacingDirection(block)
        ?? DoriosLib.block.getState(block, "utilitycraft:axis")

    const offsets = {
        north: { x: 0, y: 0, z: forwardCenter },
        south: { x: 0, y: 0, z: -forwardCenter },
        west: { x: forwardCenter, y: 0, z: 0 },
        east: { x: -forwardCenter, y: 0, z: 0 },
        up: { x: 0, y: -1, z: 0 },
        down: { x: 0, y: 2, z: 0 }
    }

    return {
        size: side,
        offset: offsets[direction] ?? { x: 0, y: 0, z: 0 }
    }
}

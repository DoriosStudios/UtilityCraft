import { system, world } from '@minecraft/server'

/**
 * Tracked light sources registered from placement events.
 * Key format: dimension|x|y|z
 *
 * @type {Map<string, {dimensionId: string, x: number, y: number, z: number, typeId: string}>}
 */
const trackedLights = new Map()

/**
 * Lighting projection anchors by source block type.
 */
const LIGHT_CONFIG = {
    'utilitycraft:big_torch': {
        anchors: [{ x: 0, z: 0 }]
    },
    'utilitycraft:lantern': {
        anchors: [
            { x: 19, z: 0 },
            { x: -19, z: 0 },
            { x: 0, z: 19 },
            { x: 0, z: -19 }
        ]
    }
}

/**
 * Builds a stable key for a tracked light source.
 */
function makeKey(dimensionId, x, y, z) {
    return `${dimensionId}|${x}|${y}|${z}`
}

/**
 * Resolves a dimension safely from its ID.
 */
function getDimensionSafe(dimensionId) {
    try {
        return world.getDimension(dimensionId)
    } catch {
        const plainId = String(dimensionId).replace('minecraft:', '')
        try {
            return world.getDimension(plainId)
        } catch {
            return undefined
        }
    }
}

/**
 * Executes the illumination function for one source location.
 */
function runLightFunction(dimension, typeId, location, mode = 'place') {
    const config = LIGHT_CONFIG[typeId]
    if (!config) return

    const functionId = mode === 'break' ? 'ilumination/big_torch_break' : 'ilumination/big_torch'
    const { x, y, z } = location

    for (const anchor of config.anchors) {
        const px = x + anchor.x
        const pz = z + anchor.z

        try {
            dimension.runCommand(`execute positioned ${px} ${y} ${pz} run function ${functionId}`)
        } catch { }
    }
}

/**
 * Registers a placed light source for future periodic reloads.
 */
function trackLight(block, typeId = block.typeId) {
    const { x, y, z } = block.location
    const key = makeKey(block.dimension.id, x, y, z)

    trackedLights.set(key, {
        dimensionId: block.dimension.id,
        x,
        y,
        z,
        typeId
    })
}

/**
 * Removes one tracked light source.
 */
function untrackLight(dimensionId, x, y, z) {
    trackedLights.delete(makeKey(dimensionId, x, y, z))
}

/**
 * Handle placement and seed initial illumination.
 */
world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    const config = LIGHT_CONFIG[block.typeId]
    if (!config) return

    runLightFunction(block.dimension, block.typeId, block.location, 'place')
    trackLight(block)
})

/**
 * Handle player break and cleanup tracked illumination.
 */
world.afterEvents.playerBreakBlock.subscribe(({ brokenBlockPermutation, block }) => {
    const typeId = brokenBlockPermutation.type.id
    const config = LIGHT_CONFIG[typeId]
    if (!config) return

    const { x, y, z } = block.location
    runLightFunction(block.dimension, typeId, { x, y, z }, 'break')
    untrackLight(block.dimension.id, x, y, z)
})

/**
 * Periodically re-applies illumination for tracked sources.
 * Current interval: every 300 ticks (15 seconds) - can be adjusted as needed.
 */
system.runInterval(() => {
    for (const [key, entry] of trackedLights) {
        const dimension = getDimensionSafe(entry.dimensionId)
        if (!dimension) {
            trackedLights.delete(key)
            continue
        }

        const block = dimension.getBlock({ x: entry.x, y: entry.y, z: entry.z })
        if (!block) continue

        if (block.typeId !== entry.typeId) {
            runLightFunction(dimension, entry.typeId, entry, 'break')
            trackedLights.delete(key)
            continue
        }

        runLightFunction(dimension, entry.typeId, entry, 'place')
    }
}, 300) // 15 seconds in ticks

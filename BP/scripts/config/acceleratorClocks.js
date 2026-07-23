export const ACCELERATOR_CLOCK_DEFINITIONS = Object.freeze([
    Object.freeze({
        itemId: "utilitycraft:accelerator_clock",
        entityId: "utilitycraft:accelerator_clock",
        baseChance: 0.1875,
        bonusStepChance: 0
    }),
    Object.freeze({
        itemId: "utilitycraft:diamond_accelerator_clock",
        entityId: "utilitycraft:diamond_accelerator_clock",
        baseChance: 0.5,
        bonusStepChance: 0
    }),
    Object.freeze({
        itemId: "utilitycraft:nether_star_accelerator_clock",
        entityId: "utilitycraft:nether_star_accelerator_clock",
        baseChance: 1,
        bonusStepChance: 0.25
    })
])

export const ACCELERATOR_CLOCKS_BY_ITEM = Object.freeze(Object.fromEntries(
    ACCELERATOR_CLOCK_DEFINITIONS.map(definition => [definition.itemId, definition])
))

export const ACCELERATOR_CLOCKS_BY_ENTITY = Object.freeze(Object.fromEntries(
    ACCELERATOR_CLOCK_DEFINITIONS.map(definition => [definition.entityId, definition])
))

/** Finds the clock-display entity associated with a pedestal. */
export function findAcceleratorClock(dimension, location, maxDistance = 1.5) {
    return dimension.getEntities({ location, maxDistance }).find(entity =>
        ACCELERATOR_CLOCKS_BY_ENTITY[entity.typeId]
    ) ?? null
}

/** Returns the static clock definition represented by an entity. */
export function getAcceleratorClockFromEntity(entity) {
    return entity ? ACCELERATOR_CLOCKS_BY_ENTITY[entity.typeId] ?? null : null
}

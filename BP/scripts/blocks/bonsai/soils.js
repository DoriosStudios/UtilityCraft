const soilByTypeId = new Map([
    ["minecraft:dirt", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:grass_block", {
        speedMultiplier: 1.2,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:sand", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:red_sand", {
        speedMultiplier: 1.2,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:crimson_nylium", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:warped_nylium", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:soul_sand", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["minecraft:end_stone", {
        speedMultiplier: 1,
        yieldMultiplier: 1,
        tillable: true
    }],
    ["utilitycraft:yellow_soil", {
        speedMultiplier: 1.2,
        yieldMultiplier: 1,
        tillable: false,
        universal: true
    }],
    ["utilitycraft:red_soil", {
        speedMultiplier: 2,
        yieldMultiplier: 1,
        tillable: false,
        universal: true
    }],
    ["utilitycraft:blue_soil", {
        speedMultiplier: 2,
        yieldMultiplier: 2,
        tillable: false,
        universal: true
    }],
    ["utilitycraft:black_soil", {
        speedMultiplier: 2,
        yieldMultiplier: 4,
        tillable: false,
        universal: true
    }]
])

export function getBonsaiSoil(typeId) {
    return soilByTypeId.get(typeId) ?? null
}

export function isBonsaiSoil(typeId) {
    return soilByTypeId.has(typeId)
}

export function canPlantOnSoil(definition, soilTypeId) {
    const soil = getBonsaiSoil(soilTypeId)
    if (!soil || !definition) return false
    return soil.universal === true || definition.allowedSoilTypeIds.has(soilTypeId)
}

export function getEffectiveBonsaiStats(definition, block) {
    const soil = getBonsaiSoil(block.getState("utilitycraft:soil"))
    if (!definition || !soil) return null

    let speedMultiplier = definition.speedMultiplier
    if (definition.modifiers.soilSpeed) speedMultiplier *= soil.speedMultiplier

    let durationSteps = Math.max(
        1,
        Math.min(
            definition.maxDurationSteps,
            Math.ceil(definition.durationSteps / speedMultiplier)
        )
    )

    if (
        block.getState("utilitycraft:isFarm") &&
        soil.tillable &&
        definition.modifiers.tillingSpeed
    ) {
        durationSteps = Math.max(1, durationSteps - 1)
    }

    let yieldMultiplier = definition.yieldMultiplier
    if (definition.modifiers.soilYield) yieldMultiplier *= soil.yieldMultiplier

    return {
        durationSteps,
        yieldMultiplier,
        soil
    }
}

import { ItemStack } from "@minecraft/server"
import { BOUNTIFUL_CROPS_BY_BLOCK } from "../config/recipes/bountifulCrops.generated.js"

const MAX_FORTUNE_LEVEL = 3
const FORTUNE_MULTIPLIERS = Object.freeze([1, 1.2, 1.4, 1.6])

/** Returns the canonical definition for a custom crop block. */
export function getCropDefinition(blockOrTypeId) {
    const typeId = typeof blockOrTypeId === "string" ? blockOrTypeId : blockOrTypeId?.typeId
    return typeId ? BOUNTIFUL_CROPS_BY_BLOCK[typeId] ?? null : null
}

/** Returns a normalized Fortune level from the supplied tool. */
export function getFortuneLevel(tool) {
    const level = tool
        ?.getComponent("minecraft:enchantable")
        ?.getEnchantment("minecraft:fortune")
        ?.level ?? 0
    return normalizeFortuneLevel(level)
}

/** True when the block is a registered, fully grown Bountiful Crop. */
export function isMatureCrop(block) {
    return Boolean(
        getCropDefinition(block) &&
        block?.permutation?.getState("utilitycraft:age") === 5
    )
}

/**
 * Harvests a mature crop through script and optionally preserves the plant.
 * This path is used by right-click harvesting, Area Harvest, and machines.
 */
export function harvestCrop(block, options = {}) {
    const definition = getCropDefinition(block)
    if (!definition || block.permutation.getState("utilitycraft:age") !== 5) return false

    const fortuneLevel = options.automated
        ? 0
        : normalizeFortuneLevel(options.fortuneLevel ?? getFortuneLevel(options.tool))

    spawnResourceDrops(
        definition,
        block.dimension,
        block.location,
        FORTUNE_MULTIPLIERS[fortuneLevel] ?? 1
    )
    spawnAdditionalSeed(definition, block.dimension, block.location)

    if (options.preserveCrop !== false) {
        block.setPermutation(block.permutation.withState("utilitycraft:age", 0))
    }
    return true
}

/** Harvests every mature Bountiful Crop in a square around the center block. */
export function harvestCropArea(centerBlock, options = {}, radius = 1) {
    const { x, y, z } = centerBlock.location
    let harvested = 0

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const crop = centerBlock.dimension.getBlock({ x: x + dx, y, z: z + dz })
            if (crop && harvestCrop(crop, options)) harvested++
        }
    }
    return harvested
}

/** Machine-facing harvest path: base yield, seed chance, no Fortune. */
export function harvestAutomatedCrop(block) {
    return harvestCrop(block, { automated: true, preserveCrop: true })
}

/**
 * Adds only the Fortune bonus when a player breaks a mature crop.
 * The block loot table supplies the base resources and additional-seed roll.
 */
export function spawnBrokenCropFortuneBonus(definition, dimension, location, tool) {
    const fortuneLevel = getFortuneLevel(tool)
    if (!definition || fortuneLevel <= 0) return

    const bonusMultiplier = (FORTUNE_MULTIPLIERS[fortuneLevel] ?? 1) - 1
    for (const drop of definition.drops) {
        if (Math.random() >= drop.chance) continue
        const baseAmount = rollAmount(drop.amount)
        const bonusAmount = stochasticRound(baseAmount * bonusMultiplier)
        spawnItem(dimension, location, drop.item, bonusAmount)
    }
}

function spawnResourceDrops(definition, dimension, location, multiplier) {
    for (const drop of definition.drops) {
        if (Math.random() >= drop.chance) continue
        const amount = stochasticRound(rollAmount(drop.amount) * multiplier)
        spawnItem(dimension, location, drop.item, amount)
    }
}

function spawnAdditionalSeed(definition, dimension, location) {
    if (Math.random() < definition.seedChance) {
        spawnItem(dimension, location, definition.seedId, 1)
    }
}

function rollAmount(amount) {
    if (!Array.isArray(amount)) return amount
    const [min, max] = amount
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function stochasticRound(value) {
    const whole = Math.floor(value)
    return whole + (Math.random() < value - whole ? 1 : 0)
}

function normalizeFortuneLevel(level) {
    const numericLevel = Number.isFinite(level) ? Math.trunc(level) : 0
    return Math.max(0, Math.min(MAX_FORTUNE_LEVEL, numericLevel))
}

function spawnItem(dimension, location, typeId, amount) {
    if (!Number.isInteger(amount) || amount <= 0) return
    dimension.spawnItem(new ItemStack(typeId, amount), location)
}

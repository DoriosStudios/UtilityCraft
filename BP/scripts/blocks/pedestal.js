import * as DoriosLib from "DoriosLib/index.js"
import { ItemStack, system } from "@minecraft/server"
import { BOUNTIFUL_CROPS_BY_BLOCK } from "../config/recipes/bountifulCrops.generated.js"
import {
    findAcceleratorClock,
    getAcceleratorClockFromEntity
} from "../config/acceleratorClocks.js"
import { removePedestalAreaOutline } from "./pedestalOutline.js"

const PEDESTAL_SETTINGS = Object.freeze({
    radius: 4,
    cropsPerCycle: 27,
    particleChance: 0.25
})

// Keeps each clock's acceleration proportional across the four natural grow times.
const CROP_TIER_MULTIPLIERS = Object.freeze({
    1: 1,
    2: 4 / 7,
    3: 4 / 11,
    4: 1 / 4
})

function getRandomPosition(x, y, z, radius) {
    const dx = Math.floor(Math.random() * (radius * 2 + 1)) - radius
    const dz = Math.floor(Math.random() * (radius * 2 + 1)) - radius
    return { x: x + dx, y, z: z + dz }
}

function getClockLocation(block) {
    const { x, y, z } = block.location
    // Display entities are spawned at the pedestal block's own coordinates.
    return { x, y, z }
}

function getCropTierMultiplier(block) {
    const tier = BOUNTIFUL_CROPS_BY_BLOCK[block.typeId]?.tier ?? 1
    return CROP_TIER_MULTIPLIERS[tier] ?? 1
}

function getMaxState(block, key, maxTry = 16) {
    const permutation = block.permutation
    const current = permutation.getState(key)
    if (typeof current !== "number") return null

    let lastValid = current
    for (let value = current + 1; value <= maxTry; value++) {
        try {
            permutation.withState(key, value)
            lastValid = value
        } catch {
            break
        }
    }
    return lastValid
}

function tryAdvanceState(block, key, current, maximum, chance, bonusStepChance) {
    // A recognized mature crop is terminal. Never pass it to generic state detection.
    if (current >= maximum || Math.random() >= chance) return false

    let steps = 1
    if (current + steps < maximum && Math.random() < bonusStepChance) steps++

    const next = Math.min(maximum, current + steps)
    block.setPermutation(block.permutation.withState(key, next))

    if (Math.random() <= PEDESTAL_SETTINGS.particleChance) {
        block.dimension.spawnParticle("minecraft:crop_growth_emitter", block.center())
    }
    return true
}

function tryGrowCrop(block, clock) {
    if (!block || !clock) return false

    const permutation = block.permutation
    const chance = Math.min(1, clock.baseChance * getCropTierMultiplier(block))
    const bonusStepChance = clock.bonusStepChance ?? 0

    const utilityAge = permutation.getState("utilitycraft:age")
    if (typeof utilityAge === "number") {
        return tryAdvanceState(block, "utilitycraft:age", utilityAge, 5, chance, bonusStepChance)
    }

    const vanillaGrowth = permutation.getState("growth")
    if (typeof vanillaGrowth === "number") {
        const maximum = getMaxState(block, "growth")
        return maximum === null
            ? false
            : tryAdvanceState(block, "growth", vanillaGrowth, maximum, chance, bonusStepChance)
    }

    const namespace = block.typeId.split(":")[0]
    const candidates = new Set([
        `${namespace}:growth`,
        `${namespace}:crop`,
        `${namespace}:age`,
        "crop",
        "age"
    ])

    for (const key of candidates) {
        const value = permutation.getState(key)
        if (typeof value !== "number") continue

        const maximum = getMaxState(block, key)
        if (maximum === null) return false
        return tryAdvanceState(block, key, value, maximum, chance, bonusStepChance)
    }

    return false
}

DoriosLib.registry.blockComponent("utilitycraft:pedestal", {
    async onTick({ block }) {
        if (block.permutation.getState("utilitycraft:hasItem") !== 1) return

        const clockEntity = findAcceleratorClock(block.dimension, getClockLocation(block))
        const clock = getAcceleratorClockFromEntity(clockEntity)
        if (!clock) return

        const { radius, cropsPerCycle } = PEDESTAL_SETTINGS
        const { x, y, z } = block.location

        for (let attempt = 0; attempt < cropsPerCycle; attempt++) {
            if (
                block.typeId !== "utilitycraft:pedestal" ||
                block.permutation.getState("utilitycraft:hasItem") !== 1
            ) return

            const position = getRandomPosition(x, y, z, radius)
            tryGrowCrop(block.dimension.getBlock(position), clock)
            await system.waitTicks(1)
        }
    },

    onPlayerBreak({ block, brokenBlockPermutation }) {
        removePedestalAreaOutline(block)
        if (brokenBlockPermutation.getState("utilitycraft:hasItem") !== 1) return

        const clockEntity = findAcceleratorClock(block.dimension, getClockLocation(block), 2)
        const clock = getAcceleratorClockFromEntity(clockEntity)
        if (clockEntity) clockEntity.addTag("despawn")

        // Gold is a safe fallback for legacy/orphaned pedestal states.
        const itemId = clock?.itemId ?? "utilitycraft:accelerator_clock"
        block.dimension.spawnItem(new ItemStack(itemId, 1), block.location)
    }
})

import { ItemStack, world } from "@minecraft/server"
import {
    BONSAI_HEARTBEAT_TICKS,
    getBonsaiDefinitionByInput,
    isRegisteredBonsaiEntity
} from "../../config/recipes/plantRegistry.js"
import { resolveItemContainerAt } from "../../DoriosCore/machinery/itemContainers.js"
import * as DoriosContainer from "../../DoriosLib/containers/index.js"
import { getEffectiveBonsaiStats } from "./soils.js"

export const BONSAI_HEARTBEAT_EVENT = "utilitycraft:bonsai_heartbeat"
export const LEGACY_BONSAI_LOOT_EVENT = "dorios:bonsai_loot"

const INPUT_DYNAMIC_PROPERTY = "plant"
const PROGRESS_DYNAMIC_PROPERTY = "utilitycraft:bonsai_progress_steps"
const TARGET_DYNAMIC_PROPERTY = "utilitycraft:bonsai_target_steps"
const GROWTH_DURATION_PROPERTY = "utilitycraft:growth_duration"
const ANIMATION_RESET_PROPERTY = "utilitycraft:animation_reset"
const DECORATIVE_PAUSED_PROPERTY = "dorios:is_slimed"
const BONSAI_ENTITY_TAG = "bonsai"
const BONSAI_ENTITY_OFFSET_Y = 0.172
const BONSAI_SEARCH_DISTANCE = 0.25
const TICKS_PER_SECOND = 20

function asFiniteNumber(value, fallback = 0) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

function setEntityProperty(entity, propertyId, value) {
    try {
        if (entity.getProperty(propertyId) !== value) entity.setProperty(propertyId, value)
    } catch { }
}

function hasEntityProperty(entity, propertyId) {
    try {
        return entity.getProperty(propertyId) !== undefined
    } catch {
        return false
    }
}

function setDynamicNumber(entity, propertyId, value) {
    try {
        entity.setDynamicProperty(propertyId, value)
    } catch { }
}

function getDynamicNumber(entity, propertyId, fallback = 0) {
    try {
        return asFiniteNumber(entity.getDynamicProperty(propertyId), fallback)
    } catch {
        return fallback
    }
}

function resetAnimation(entity) {
    try {
        const current = entity.getProperty(ANIMATION_RESET_PROPERTY) === true
        entity.setProperty(ANIMATION_RESET_PROPERTY, !current)
    } catch { }
}

function setAnimationForRemainingSteps(entity, remainingSteps) {
    const durationSeconds = Math.max(
        BONSAI_HEARTBEAT_TICKS / TICKS_PER_SECOND,
        remainingSteps * BONSAI_HEARTBEAT_TICKS / TICKS_PER_SECOND
    )

    if (!hasEntityProperty(entity, GROWTH_DURATION_PROPERTY)) {
        try {
            entity.triggerEvent(`grow_${durationSeconds}`)
            setEntityProperty(entity, "dorios:time", durationSeconds)
        } catch { }
        return
    }

    setEntityProperty(entity, GROWTH_DURATION_PROPERTY, durationSeconds)
    resetAnimation(entity)
}

function getBonsaiBlockForEntity(entity) {
    try {
        const { x, y, z } = entity.location
        const block = entity.dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        })
        return block?.typeId === "utilitycraft:bonsai" ? block : null
    } catch {
        return null
    }
}

export function getBonsaiInputTypeId(entity) {
    try {
        const inputTypeId = entity.getDynamicProperty(INPUT_DYNAMIC_PROPERTY)
        return typeof inputTypeId === "string" ? inputTypeId : null
    } catch {
        return null
    }
}

export function findBonsaiEntityAtBlock(block) {
    if (!block) return null
    const { x, y, z } = block.location
    const location = {
        x: x + 0.5,
        y: y + BONSAI_ENTITY_OFFSET_Y,
        z: z + 0.5
    }

    try {
        return block.dimension.getEntities({
            location,
            maxDistance: BONSAI_SEARCH_DISTANCE,
            tags: [BONSAI_ENTITY_TAG]
        }).find(entity => isRegisteredBonsaiEntity(entity.typeId)) ?? null
    } catch {
        return null
    }
}

export function despawnBonsaiEntity(entity) {
    if (!entity) return
    try {
        entity.triggerEvent("despawn")
    } catch {
        try {
            entity.addTag("despawn")
        } catch { }
    }
}

export function initializeBonsaiEntity(entity, block, inputTypeId) {
    const definition = getBonsaiDefinitionByInput(inputTypeId)
    const stats = getEffectiveBonsaiStats(definition, block)
    if (!definition || !stats) return false

    entity.addTag(BONSAI_ENTITY_TAG)
    entity.setDynamicProperty(INPUT_DYNAMIC_PROPERTY, inputTypeId)
    setDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, 0)
    setDynamicNumber(entity, TARGET_DYNAMIC_PROPERTY, stats.durationSteps)
    setEntityProperty(entity, DECORATIVE_PAUSED_PROPERTY, false)
    setEntityProperty(entity, ANIMATION_RESET_PROPERTY, false)
    setAnimationForRemainingSteps(entity, stats.durationSteps)
    return true
}

export function resyncBonsaiCycle(entity, block, preserveRatio = true) {
    if (!entity || !block) return false
    const inputTypeId = getBonsaiInputTypeId(entity)
    const definition = getBonsaiDefinitionByInput(inputTypeId)
    const stats = getEffectiveBonsaiStats(definition, block)
    if (!definition || !stats) return false

    const oldTarget = Math.max(1, getDynamicNumber(entity, TARGET_DYNAMIC_PROPERTY, stats.durationSteps))
    const oldProgress = Math.max(0, getDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, 0))
    const ratio = Math.min(1, oldProgress / oldTarget)
    const progress = preserveRatio
        ? Math.min(stats.durationSteps - 1, Math.floor(ratio * stats.durationSteps))
        : 0

    setDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, progress)
    setDynamicNumber(entity, TARGET_DYNAMIC_PROPERTY, stats.durationSteps)

    const remainingSteps = Math.max(1, stats.durationSteps - progress)
    setAnimationForRemainingSteps(entity, remainingSteps)
    return true
}

export function setBonsaiDecorativePaused(entity, block, paused) {
    if (!entity) return
    setEntityProperty(entity, DECORATIVE_PAUSED_PROPERTY, paused)

    try {
        entity.triggerEvent(paused ? "normal" : "small")
    } catch { }

    if (paused) return

    resyncBonsaiCycle(entity, block, true)
}

function randomAmount(amount) {
    if (!Array.isArray(amount)) return Math.max(0, Math.floor(asFiniteNumber(amount, 0)))
    const min = Math.ceil(asFiniteNumber(amount[0], 0))
    const max = Math.floor(asFiniteNumber(amount[1], min))
    if (max <= min) return Math.max(0, min)
    return DoriosAPI.math.randomInterval(min, max)
}

function scaleAmount(amount, multiplier) {
    const scaled = amount * multiplier
    const guaranteed = Math.floor(scaled)
    return guaranteed + (Math.random() < scaled - guaranteed ? 1 : 0)
}

export function produceBonsaiDrops(entity, block, definition, yieldMultiplier) {
    if (!entity || !block || !definition) return false

    const dropLocation = {
        x: block.location.x,
        y: block.location.y - 1,
        z: block.location.z
    }
    const target = resolveItemContainerAt(entity.dimension, dropLocation)
    if (!target) return true

    for (const drop of definition.drops) {
        if (Math.random() > asFiniteNumber(drop.chance, 0)) continue

        const baseAmount = randomAmount(drop.amount)
        const amount = scaleAmount(
            baseAmount,
            drop.scaleWithYield === false ? 1 : yieldMultiplier
        )
        if (amount <= 0) continue

        try {
            const prototype = new ItemStack(drop.item)
            let remaining = amount

            while (remaining > 0) {
                const stack = new ItemStack(drop.item, Math.min(remaining, prototype.maxAmount))
                const moved = DoriosContainer.insert(target, { item: stack, face: "up" })
                if (moved <= 0) break
                remaining -= moved
                if (moved < stack.amount) break
            }
        } catch { }
    }

    return true
}

export function processBonsaiHeartbeat(entity) {
    if (!entity || !isRegisteredBonsaiEntity(entity.typeId)) return

    const block = getBonsaiBlockForEntity(entity)
    if (!block || !block.getState("utilitycraft:hasBonsai")) {
        despawnBonsaiEntity(entity)
        return
    }

    const inputTypeId = getBonsaiInputTypeId(entity)
    const definition = getBonsaiDefinitionByInput(inputTypeId)
    const stats = getEffectiveBonsaiStats(definition, block)
    if (!definition || !stats) return

    if (block.getState("utilitycraft:isSlimed")) {
        let alreadyPaused = false
        try {
            alreadyPaused = entity.getProperty(DECORATIVE_PAUSED_PROPERTY) === true
        } catch { }

        if (!alreadyPaused) setBonsaiDecorativePaused(entity, block, true)
        return
    }

    setEntityProperty(entity, DECORATIVE_PAUSED_PROPERTY, false)

    const storedTarget = getDynamicNumber(entity, TARGET_DYNAMIC_PROPERTY, 0)
    if (storedTarget <= 0 || storedTarget !== stats.durationSteps) {
        resyncBonsaiCycle(entity, block, storedTarget > 0)
    }

    const target = stats.durationSteps
    const progress = getDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, 0) + 1
    if (progress < target) {
        setDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, progress)
        return
    }

    setDynamicNumber(entity, PROGRESS_DYNAMIC_PROPERTY, progress % target)
    setDynamicNumber(entity, TARGET_DYNAMIC_PROPERTY, target)
    produceBonsaiDrops(entity, block, definition, stats.yieldMultiplier)
    setAnimationForRemainingSteps(entity, target)
}

export function processLegacyBonsaiLoot(entity) {
    if (!entity) return
    const block = getBonsaiBlockForEntity(entity)
    const inputTypeId = getBonsaiInputTypeId(entity)
    const definition = getBonsaiDefinitionByInput(inputTypeId)
    const stats = block ? getEffectiveBonsaiStats(definition, block) : null
    if (!block || !definition || !stats) return
    if (block.getState("utilitycraft:isSlimed")) return

    produceBonsaiDrops(entity, block, definition, stats.yieldMultiplier)
    resetAnimation(entity)
}

export function refreshLoadedBonsais() {
    const result = {
        found: 0,
        updated: 0,
        orphaned: 0,
        invalid: 0
    }

    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let entities = []
        try {
            entities = world.getDimension(dimensionId).getEntities({
                tags: [BONSAI_ENTITY_TAG]
            })
        } catch {
            continue
        }

        for (const entity of entities) {
            if (!isRegisteredBonsaiEntity(entity.typeId)) continue
            result.found++

            const block = getBonsaiBlockForEntity(entity)
            if (!block || !block.getState("utilitycraft:hasBonsai")) {
                despawnBonsaiEntity(entity)
                result.orphaned++
                continue
            }

            const inputTypeId = getBonsaiInputTypeId(entity)
            const definition = getBonsaiDefinitionByInput(inputTypeId)
            const stats = getEffectiveBonsaiStats(definition, block)
            if (!definition || !stats || !resyncBonsaiCycle(entity, block, true)) {
                result.invalid++
                continue
            }

            const paused = block.getState("utilitycraft:isSlimed") === true
            setEntityProperty(entity, DECORATIVE_PAUSED_PROPERTY, paused)
            try {
                entity.triggerEvent(paused ? "normal" : "small")
            } catch { }

            result.updated++
        }
    }

    return result
}

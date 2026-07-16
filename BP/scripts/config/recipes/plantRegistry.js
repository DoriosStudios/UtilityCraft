import { system, world } from "@minecraft/server"
import { plantsData } from "./plants.js"

export const BONSAI_HEARTBEAT_TICKS = 10 * 20
export const MAX_BONSAI_DURATION_TICKS = 600 * 20

const DEFAULT_BONSAI_DURATION_TICKS = 60 * 20
const DEFAULT_ALLOWED_SOILS = Object.freeze([
    "minecraft:dirt",
    "minecraft:grass_block"
])

const bonsaiByInputTypeId = new Map()
const bonsaiEntityTypeIds = new Set()
const inputTypeIdsByEntityTypeId = new Map()

function asPositiveNumber(value, fallback) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : fallback
}

function normalizeSoilTypeId(typeId) {
    if (typeof typeId !== "string" || typeId.length === 0) return null
    return typeId.includes(":") ? typeId : `minecraft:${typeId}`
}

function normalizeAllowedSoils(allowedSoils) {
    const source = Array.isArray(allowedSoils) && allowedSoils.length > 0
        ? allowedSoils
        : DEFAULT_ALLOWED_SOILS

    return [...new Set(source.map(normalizeSoilTypeId).filter(Boolean))]
}

export function normalizeBonsaiDurationTicks(durationTicks, inputTypeId = "unknown") {
    const requested = asPositiveNumber(durationTicks, DEFAULT_BONSAI_DURATION_TICKS)
    const bounded = Math.min(requested, MAX_BONSAI_DURATION_TICKS)
    const normalized = Math.max(
        BONSAI_HEARTBEAT_TICKS,
        Math.ceil(bounded / BONSAI_HEARTBEAT_TICKS) * BONSAI_HEARTBEAT_TICKS
    )

    if (normalized !== requested) {
        console.warn(
            `[UtilityCraft] Bonsai duration for "${inputTypeId}" was normalized ` +
            `from ${requested} to ${normalized} ticks.`
        )
    }

    return normalized
}

function cloneDrops(drops) {
    if (!Array.isArray(drops)) return []
    return drops
        .filter(drop => drop && typeof drop.item === "string")
        .map(drop => ({
            ...drop,
            amount: Array.isArray(drop.amount) ? [...drop.amount] : drop.amount
        }))
}

function normalizeBonsaiDefinition(inputTypeId, plant, rawBonsai) {
    if (!rawBonsai || typeof rawBonsai !== "object") return null

    const entityTypeId = rawBonsai.entityTypeId ?? rawBonsai.entity
    if (typeof entityTypeId !== "string" || entityTypeId.length === 0) return null

    const durationTicks = normalizeBonsaiDurationTicks(
        rawBonsai.durationTicks ?? rawBonsai.durationSeconds * 20,
        inputTypeId
    )
    const allowedSoils = normalizeAllowedSoils(
        rawBonsai.allowedSoils ?? rawBonsai.allowed
    )
    const rawModifiers = rawBonsai.modifiers ?? {}

    return Object.freeze({
        inputTypeId,
        entityTypeId,
        allowedSoils: Object.freeze(allowedSoils),
        allowedSoilTypeIds: new Set(allowedSoils),
        durationTicks,
        durationSteps: durationTicks / BONSAI_HEARTBEAT_TICKS,
        maxDurationSteps: MAX_BONSAI_DURATION_TICKS / BONSAI_HEARTBEAT_TICKS,
        speedMultiplier: asPositiveNumber(rawBonsai.speedMultiplier, 1),
        yieldMultiplier: asPositiveNumber(rawBonsai.yieldMultiplier, 1),
        modifiers: Object.freeze({
            soilSpeed: rawModifiers.soilSpeed !== false,
            soilYield: rawModifiers.soilYield !== false,
            tillingSpeed: rawModifiers.tillingSpeed !== false
        }),
        drops: Object.freeze(cloneDrops(rawBonsai.drops ?? plant.drops))
    })
}

function removeIndexedInput(inputTypeId) {
    const previous = bonsaiByInputTypeId.get(inputTypeId)
    if (!previous) return

    bonsaiByInputTypeId.delete(inputTypeId)
    const inputs = inputTypeIdsByEntityTypeId.get(previous.entityTypeId)
    inputs?.delete(inputTypeId)
    if (inputs?.size) return

    inputTypeIdsByEntityTypeId.delete(previous.entityTypeId)
    bonsaiEntityTypeIds.delete(previous.entityTypeId)
}

function indexPlant(inputTypeId) {
    removeIndexedInput(inputTypeId)

    const plant = plantsData[inputTypeId]
    const definition = normalizeBonsaiDefinition(inputTypeId, plant, plant?.bonsai)
    if (!definition) return

    bonsaiByInputTypeId.set(inputTypeId, definition)
    bonsaiEntityTypeIds.add(definition.entityTypeId)

    let inputs = inputTypeIdsByEntityTypeId.get(definition.entityTypeId)
    if (!inputs) {
        inputs = new Set()
        inputTypeIdsByEntityTypeId.set(definition.entityTypeId, inputs)
    }
    inputs.add(inputTypeId)
}

export function rebuildPlantRegistry() {
    bonsaiByInputTypeId.clear()
    bonsaiEntityTypeIds.clear()
    inputTypeIdsByEntityTypeId.clear()

    for (const inputTypeId of Object.keys(plantsData)) indexPlant(inputTypeId)
}

export function getPlantDefinition(inputTypeId) {
    return plantsData[inputTypeId] ?? null
}

export function getBonsaiDefinitionByInput(inputTypeId) {
    return bonsaiByInputTypeId.get(inputTypeId) ?? null
}

export function isRegisteredBonsaiEntity(entityTypeId) {
    return bonsaiEntityTypeIds.has(entityTypeId)
}

export function getBonsaiInputsForEntity(entityTypeId) {
    return inputTypeIdsByEntityTypeId.get(entityTypeId) ?? new Set()
}

function mergePlantEntry(inputTypeId, incoming, rawBonsai) {
    if (typeof inputTypeId !== "string" || inputTypeId.length === 0) return false
    if (!incoming || typeof incoming !== "object") return false

    const current = plantsData[inputTypeId] ?? {}
    const drops = incoming.drops === undefined ? current.drops : cloneDrops(incoming.drops)
    if (!Array.isArray(drops) || drops.length === 0) return false

    const next = {
        ...current,
        ...incoming,
        cost: asPositiveNumber(incoming.cost, asPositiveNumber(current.cost, 8000)),
        drops
    }

    delete next.sapling
    delete next.entity
    delete next.allowed
    delete next.disableTimeBonus
    delete next.disableYieldBonus

    if (rawBonsai) {
        next.bonsai = {
            ...(current.bonsai ?? {}),
            ...rawBonsai
        }
    }

    plantsData[inputTypeId] = next
    indexPlant(inputTypeId)
    return true
}

function registerPlantPayload(payload) {
    if (!payload || typeof payload !== "object") return

    for (const [inputTypeId, plant] of Object.entries(payload)) {
        mergePlantEntry(inputTypeId, plant, plant?.bonsai)
    }
}

/**
 * Backwards-compatible adapter for addons that still send
 * `utilitycraft:register_bonsai` with top-level sapling/entity fields.
 * New integrations may put the same metadata in `bonsai` and send it
 * through `utilitycraft:register_plant`.
 */
function registerLegacyBonsaiPayload(payload) {
    if (!payload || typeof payload !== "object") return

    for (const bonsai of Object.values(payload)) {
        if (!bonsai || typeof bonsai !== "object") continue
        const inputTypeId = bonsai.sapling
        if (typeof inputTypeId !== "string" || inputTypeId.length === 0) continue

        const modifiers = {
            ...(bonsai.modifiers ?? {}),
            soilSpeed: bonsai.disableTimeBonus
                ? false
                : bonsai.modifiers?.soilSpeed !== false,
            soilYield: bonsai.disableYieldBonus
                ? false
                : bonsai.modifiers?.soilYield !== false
        }

        const rawBonsai = {
            entityTypeId: bonsai.entityTypeId ?? bonsai.entity,
            allowedSoils: bonsai.allowedSoils ?? bonsai.allowed,
            durationTicks: bonsai.durationTicks,
            durationSeconds: bonsai.durationSeconds,
            speedMultiplier: bonsai.speedMultiplier,
            yieldMultiplier: bonsai.yieldMultiplier,
            modifiers,
            drops: bonsai.bonsaiDrops
        }

        mergePlantEntry(inputTypeId, {
            cost: bonsai.cost,
            drops: bonsai.drops
        }, rawBonsai)
    }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_plant" && id !== "utilitycraft:register_bonsai") return

    try {
        const payload = JSON.parse(message)
        if (id === "utilitycraft:register_plant") registerPlantPayload(payload)
        else registerLegacyBonsaiPayload(payload)
    } catch (error) {
        console.warn(`[UtilityCraft] Failed to process plant registration "${id}": ${error}`)
    }
})

rebuildPlantRegistry()
world.afterEvents.worldLoad.subscribe(() => system.run(rebuildPlantRegistry))

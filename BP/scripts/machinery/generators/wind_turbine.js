import { WeatherType, world } from '@minecraft/server'
import { Generator, Energy } from '../DoriosMachinery/core.js'

const BASE_ALTITUDE = 63
const ALTITUDE_BONUS_STEP = 16
const ALTITUDE_PENALTY_STEP = 8
const ALTITUDE_STEP_RATIO = 0.125
const MIN_ALTITUDE = 20
const DEFAULT_MAX_ALTITUDE_MULTIPLIER = 4
const DEFAULT_ALTITUDE_OFFSET = 0
/**
 * @typedef {Object} AltitudeConfig
 * @property {number} baseAltitude     // Altitude where penalties/bonuses start
 * @property {number} minAltitude      // Minimum altitude required to run
 * @property {number | null} maxAltitude // Max altitude used for clamping (null = world max)
 * @property {number} offset           // Altitude offset applied before processing
 * @property {number} bonusStep        // Height interval that grants bonuses
 * @property {number} penaltyStep      // Height interval that applies penalties
 * @property {number} stepRatio        // Portion of base rate applied each step
 * @property {number} [bonusRatio]     // Optional ratio used for bonus steps
 * @property {number} [penaltyRatio]   // Optional ratio used for penalty steps
 * @property {number} maxMultiplier    // Cap relative to base rate
 * @property {boolean} unlimitedMultiplier // Skip max multiplier cap when true
 */

/** @type {AltitudeConfig} */
const DEFAULT_ALTITUDE_CONFIG = {
    baseAltitude: BASE_ALTITUDE,
    minAltitude: MIN_ALTITUDE,
    maxAltitude: null,
    offset: DEFAULT_ALTITUDE_OFFSET,
    bonusStep: ALTITUDE_BONUS_STEP,
    penaltyStep: ALTITUDE_PENALTY_STEP,
    stepRatio: ALTITUDE_STEP_RATIO,
    maxMultiplier: DEFAULT_MAX_ALTITUDE_MULTIPLIER,
    unlimitedMultiplier: false
}

const WEATHER_MULTIPLIERS = {
    [WeatherType.Clear]: 1,
    [WeatherType.Rain]: 1.5,
    [WeatherType.Thunder]: 2.25
}

const WEATHER_BY_DIMENSION = new Map()

const normalizeDimensionId = (dimensionId) =>
    `${dimensionId ?? ''}`.toLowerCase().replace(/^minecraft:/, '')

const getDimensionHeightRange = (dimension) => {
    try {
        return dimension?.heightRange
    } catch {
        return undefined
    }
}

world.afterEvents.weatherChange.subscribe((event) => {
    const dimensionId = normalizeDimensionId(event.dimension)
    if (!dimensionId) return
    WEATHER_BY_DIMENSION.set(dimensionId, event.newWeather ?? WeatherType.Clear)
})

DoriosAPI.register.blockComponent('wind_turbine', {
    /**
     * Initializes the passive generator entity on placement and restores stored energy.
     *
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnGeneratorEntity(e, settings)
    },

    /**
     * Produces energy each tick based on altitude and weather efficiency.
     *
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return

        const { block } = e
        const generator = new Generator(block, settings)
        if (!generator.valid) return

        generator.energy.transferToNetwork(generator.rate * 4)

        const { energy } = generator

        const baseRate = generator.rate
        const altitudeConfig = resolveAltitudeConfig(settings, block.dimension)
        const altitude = resolveAltitude(block, altitudeConfig)
        const weather = getWeatherForDimension(block.dimension)
        const altitudeRate = computeAltitudeRate(baseRate, altitude, altitudeConfig)
        const weatherMultiplier = getWeatherMultiplier(weather)
        const effectiveRate = altitudeRate * weatherMultiplier
        const efficiency = baseRate > 0 ? Math.max(0, Math.round((altitudeRate / baseRate) * 1000) / 10) : 0
        const realEfficiency = baseRate > 0 ? Math.max(0, Math.round((effectiveRate / baseRate) * 1000) / 10) : 0
        const belowMinAltitude = altitude < altitudeConfig.minAltitude

        if (belowMinAltitude) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Low Altitude', 'e', efficiency, realEfficiency, weatherMultiplier, energy.getPercent(), altitude, 0))
            return
        }

        if (effectiveRate <= 0) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Calm Winds', 'e', efficiency, realEfficiency, weatherMultiplier, energy.getPercent(), altitude, 0))
            return
        }

        if (energy.get() >= energy.cap) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Energy Full', 'e', efficiency, realEfficiency, weatherMultiplier, energy.getPercent(), altitude, 0))
            return
        }

        const produced = Math.min(effectiveRate, energy.getFreeSpace())
        energy.add(produced)
        generator.energy.transferToNetwork(produced * 4)

        generator.on()
        generator.displayEnergy()
        generator.setLabel(buildStatusLabel('Running', 'a', efficiency, realEfficiency, weatherMultiplier, energy.getPercent(), altitude, generator.baseRate * efficiency / 100))
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e)
    }
})

/**
 * Computes the energy production rate after applying altitude bonuses/penalties.
 *
 * @param {number} baseRate
 * @param {number} altitude
 * @param {AltitudeConfig} altitudeConfig
 * @returns {number}
 */
function computeAltitudeRate(baseRate, altitude, altitudeConfig = DEFAULT_ALTITUDE_CONFIG) {
    if (baseRate <= 0) return 0

    const {
        baseAltitude,
        minAltitude,
        maxAltitude,
        offset,
        bonusStep,
        penaltyStep,
        stepRatio,
        bonusRatio,
        penaltyRatio,
        maxMultiplier
    } = altitudeConfig

    const unlimitedMultiplier = altitudeConfig?.unlimitedMultiplier ?? false

    if (altitude < minAltitude) return 0

    const bonusInterval = Math.max(1, Math.round(bonusStep ?? ALTITUDE_BONUS_STEP))
    const penaltyInterval = Math.max(1, Math.round(penaltyStep ?? ALTITUDE_PENALTY_STEP))

    const effectiveAltitude = typeof maxAltitude === 'number'
        ? Math.min(altitude, maxAltitude)
        : altitude

    const bonusSteps = effectiveAltitude > baseAltitude
        ? Math.floor((effectiveAltitude - baseAltitude) / bonusInterval)
        : 0

    const penaltySteps = effectiveAltitude < baseAltitude
        ? Math.floor((baseAltitude - effectiveAltitude) / penaltyInterval)
        : 0

    const ratio = Math.max(0, stepRatio ?? ALTITUDE_STEP_RATIO)
    const resolvedBonusRatio = Math.max(0, bonusRatio ?? ratio)
    const resolvedPenaltyRatio = Math.max(0, penaltyRatio ?? ratio)
    const bonusPerStep = Math.max(1, Math.round(baseRate * resolvedBonusRatio))
    const penaltyPerStep = Math.max(1, Math.round(baseRate * resolvedPenaltyRatio))
    const adjusted = baseRate + (bonusPerStep * bonusSteps) - (penaltyPerStep * penaltySteps)

    if (unlimitedMultiplier || maxMultiplier === undefined || maxMultiplier === null || maxMultiplier <= 0) {
        return Math.max(0, Math.floor(adjusted))
    }

    const capped = Math.min(baseRate * Math.max(1, maxMultiplier ?? DEFAULT_MAX_ALTITUDE_MULTIPLIER), adjusted)
    return Math.max(0, Math.floor(capped))
}

/**
 * Applies weather multiplier to the altitude-adjusted rate.
 *
 * @param {number} rate
 * @param {string} weather
 * @returns {number}
 */
function getWeatherMultiplier(weather) {
    const key = typeof weather === 'string' ? weather : WeatherType.Clear
    return WEATHER_MULTIPLIERS[key] ?? 1
}

function resolveAltitude(block, altitudeConfig = DEFAULT_ALTITUDE_CONFIG) {
    const rawAltitude = Math.floor(block.location.y)
    const offset = altitudeConfig.offset ?? DEFAULT_ALTITUDE_OFFSET
    let altitude = rawAltitude + offset

    const minAltitude = altitudeConfig.minAltitude ?? MIN_ALTITUDE
    const maxAltitude = altitudeConfig.maxAltitude

    if (typeof maxAltitude === 'number') {
        const minClamp = Math.min(minAltitude, maxAltitude)
        altitude = Math.min(maxAltitude, Math.max(minClamp, altitude))
    } else {
        altitude = Math.max(minAltitude, altitude)
    }

    return altitude
}

function getWeatherForDimension(dimension) {
    const dimensionId = normalizeDimensionId(dimension?.id)
    return WEATHER_BY_DIMENSION.get(dimensionId) ?? WeatherType.Clear
}

/**
 * Builds the inventory label text shown to the player.
 *
 * @param {string} header
 * @param {number} altitude
 * @param {string} weather
 * @param {number} efficiency
 * @param {number} percent
 * @param {number} rate
 * @returns {string}
 */
function buildStatusLabel(status, color, efficiency, realEfficiency, weatherMultiplier, percent, altitude, transferRate = 0) {
    const clampedEfficiency = Math.max(0, efficiency)
    const formattedEfficiency = clampedEfficiency.toFixed(1).replace('.', ',')
    const formattedRealEfficiency = Math.max(0, realEfficiency ?? clampedEfficiency)
        .toFixed(1)
        .replace('.', ',')
    const formattedWeatherMultiplier = Math.max(0, weatherMultiplier ?? 1).toFixed(2).replace('.', ',')
    const transferText = transferRate > 0 ? Energy.formatEnergyToText(transferRate) : '0 DE'

    return `
§r§${color ?? 'e'}${status}

 §r§eAltitude §f${altitude}
 §r§aEfficiency §f${formattedEfficiency}%% §8(${formattedRealEfficiency}%%)
 §r§bWeather Multiplier §f${formattedWeatherMultiplier}x
 
§r§bEnergy at ${Math.floor(percent)}%%
§r§cRate ${transferText}/t
    `
}

/**
 * Resolves altitude configuration using defaults plus block overrides.
 *
 * @param {GeneratorSettings} [settings]
 * @returns {AltitudeConfig}
 */
function resolveAltitudeConfig(settings, dimension) {
    const altitude = settings?.altitude ?? {}
    const heightRange = getDimensionHeightRange(dimension)
    const heightMin = heightRange?.min ?? MIN_ALTITUDE
    const heightMax = heightRange?.max

    const maxAltitudeRaw = altitude.max ?? altitude.max_altitude ?? altitude.maxAltitude
    const resolvedMaxAltitude = (maxAltitudeRaw === undefined || maxAltitudeRaw === null || maxAltitudeRaw <= 0)
        ? heightMax
        : maxAltitudeRaw

    return {
        baseAltitude: altitude.base ?? altitude.base_altitude ?? altitude.baseAltitude ?? BASE_ALTITUDE,
        minAltitude: Math.max(heightMin, altitude.min ?? altitude.min_altitude ?? altitude.minAltitude ?? MIN_ALTITUDE),
        maxAltitude: resolvedMaxAltitude,
        offset: altitude.offset ?? altitude.altitude_offset ?? DEFAULT_ALTITUDE_OFFSET,
        bonusStep: altitude.bonus_step ?? altitude.bonusStep ?? altitude.step_bonus ?? ALTITUDE_BONUS_STEP,
        penaltyStep: altitude.penalty_step ?? altitude.penaltyStep ?? altitude.step_penalty ?? ALTITUDE_PENALTY_STEP,
        stepRatio: altitude.step_ratio ?? altitude.stepRatio ?? ALTITUDE_STEP_RATIO,
        bonusRatio: altitude.bonus_ratio ?? altitude.bonusRatio,
        penaltyRatio: altitude.penalty_ratio ?? altitude.penaltyRatio,
        maxMultiplier: altitude.max_multiplier ?? altitude.maxMultiplier ?? settings?.max_altitude_multiplier ?? DEFAULT_MAX_ALTITUDE_MULTIPLIER,
        unlimitedMultiplier: altitude.unlimited_multiplier ?? altitude.no_max_multiplier ?? false
    }
}


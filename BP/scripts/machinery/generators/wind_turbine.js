import { WeatherType, world } from '@minecraft/server'
import { Generator, EnergyStorage } from "DoriosCore/machinery/index.js"

const wind = {
    altitude: {
        base: 63,
        bonus_step: 16,
        penalty_step: 8,
        step_ratio: 0.125,
        min: 20,
        default_max_multiplier: 4,
        default_offset: 0
    },
    weather_multiplier: {
        [WeatherType.Clear]: 1,
        [WeatherType.Rain]: 1.5,
        [WeatherType.Thunder]: 2.25
    }
}
/**
 * @typedef {Object} AltitudeConfig
 * @property {number} baseAltitude         // Altitude where penalties/bonuses start
 * @property {number} minAltitude          // Minimum altitude required to run
 * @property {number | null} maxAltitude   // Max altitude used for clamping (null = world max)
 * @property {number} offset               // Altitude offset applied before processing
 * @property {number} bonusStep            // Height interval that grants bonuses
 * @property {number} penaltyStep          // Height interval that applies penalties
 * @property {number} stepRatio            // Portion of base rate applied each step
 * @property {number} [bonusRatio]         // Optional ratio used for bonus steps
 * @property {number} [penaltyRatio]       // Optional ratio used for penalty steps
 * @property {number} maxMultiplier        // Cap relative to base rate
 * @property {boolean} unlimitedMultiplier // Skip max multiplier cap when true
 */

/**
 * Creates the default altitude config from the wind object.
 *
 * @returns {AltitudeConfig}
 */
function getDefaultAltitudeConfig() {
    return {
        baseAltitude: wind.altitude.base,
        minAltitude: wind.altitude.min,
        maxAltitude: null,
        offset: wind.altitude.default_offset,
        bonusStep: wind.altitude.bonus_step,
        penaltyStep: wind.altitude.penalty_step,
        stepRatio: wind.altitude.step_ratio,
        maxMultiplier: wind.altitude.default_max_multiplier,
        unlimitedMultiplier: false
    }
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
        Generator.spawnEntity(e, settings)
    },

    /**
     * Produces energy each tick based on altitude and weather efficiency.
     *
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
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
function computeAltitudeRate(baseRate, altitude, altitudeConfig = getDefaultAltitudeConfig()) {
    if (baseRate <= 0) return 0

    const {
        baseAltitude,
        minAltitude,
        maxAltitude,
        bonusStep,
        penaltyStep,
        stepRatio,
        bonusRatio,
        penaltyRatio,
        maxMultiplier
    } = altitudeConfig

    const unlimitedMultiplier = altitudeConfig?.unlimitedMultiplier ?? false

    if (altitude < minAltitude) return 0

    const bonusInterval = Math.max(1, Math.round(bonusStep ?? wind.altitude.bonus_step))
    const penaltyInterval = Math.max(1, Math.round(penaltyStep ?? wind.altitude.penalty_step))

    const effectiveAltitude = typeof maxAltitude === 'number'
        ? Math.min(altitude, maxAltitude)
        : altitude

    const bonusSteps = effectiveAltitude > baseAltitude
        ? Math.floor((effectiveAltitude - baseAltitude) / bonusInterval)
        : 0

    const penaltySteps = effectiveAltitude < baseAltitude
        ? Math.floor((baseAltitude - effectiveAltitude) / penaltyInterval)
        : 0

    const ratio = Math.max(0, stepRatio ?? wind.altitude.step_ratio)
    const resolvedBonusRatio = Math.max(0, bonusRatio ?? ratio)
    const resolvedPenaltyRatio = Math.max(0, penaltyRatio ?? ratio)
    const bonusPerStep = Math.max(1, Math.round(baseRate * resolvedBonusRatio))
    const penaltyPerStep = Math.max(1, Math.round(baseRate * resolvedPenaltyRatio))
    const adjusted = baseRate + (bonusPerStep * bonusSteps) - (penaltyPerStep * penaltySteps)

    if (unlimitedMultiplier || maxMultiplier === undefined || maxMultiplier === null || maxMultiplier <= 0) {
        return Math.max(0, Math.floor(adjusted))
    }

    const capped = Math.min(baseRate * Math.max(1, maxMultiplier ?? wind.altitude.default_max_multiplier), adjusted)
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
    return wind.weather_multiplier[key] ?? 1
}

function resolveAltitude(block, altitudeConfig = getDefaultAltitudeConfig()) {
    const rawAltitude = Math.floor(block.location.y)
    const offset = altitudeConfig.offset ?? wind.altitude.default_offset
    let altitude = rawAltitude + offset

    const maxAltitude = altitudeConfig.maxAltitude

    if (typeof maxAltitude === 'number') {
        altitude = Math.min(maxAltitude, altitude)
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
    const transferText = transferRate > 0 ? EnergyStorage.formatEnergyToText(transferRate) : '0 DE'

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
    const defaults = getDefaultAltitudeConfig()
    const altitude = settings?.altitude ?? {}
    const heightRange = getDimensionHeightRange(dimension)
    const heightMin = heightRange?.min ?? defaults.minAltitude
    const heightMax = heightRange?.max

    const maxAltitudeRaw = altitude.max ?? altitude.max_altitude ?? altitude.maxAltitude
    const resolvedMaxAltitude = (maxAltitudeRaw === undefined || maxAltitudeRaw === null || maxAltitudeRaw <= 0)
        ? heightMax
        : maxAltitudeRaw

    return {
        baseAltitude: altitude.base ?? altitude.base_altitude ?? altitude.baseAltitude ?? defaults.baseAltitude,
        minAltitude: Math.max(heightMin, altitude.min ?? altitude.min_altitude ?? altitude.minAltitude ?? defaults.minAltitude),
        maxAltitude: resolvedMaxAltitude,
        offset: altitude.offset ?? altitude.altitude_offset ?? defaults.offset,
        bonusStep: altitude.bonus_step ?? altitude.bonusStep ?? altitude.step_bonus ?? defaults.bonusStep,
        penaltyStep: altitude.penalty_step ?? altitude.penaltyStep ?? altitude.step_penalty ?? defaults.penaltyStep,
        stepRatio: altitude.step_ratio ?? altitude.stepRatio ?? defaults.stepRatio,
        bonusRatio: altitude.bonus_ratio ?? altitude.bonusRatio,
        penaltyRatio: altitude.penalty_ratio ?? altitude.penaltyRatio,
        maxMultiplier: altitude.max_multiplier ?? altitude.maxMultiplier ?? settings?.max_altitude_multiplier ?? defaults.maxMultiplier,
        unlimitedMultiplier: altitude.unlimited_multiplier ?? altitude.no_max_multiplier ?? false
    }
}


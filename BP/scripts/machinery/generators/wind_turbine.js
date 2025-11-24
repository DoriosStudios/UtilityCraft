import { Generator, Energy } from '../managers.js'

const BASE_ALTITUDE = 63
const ALTITUDE_BONUS_STEP = 16
const ALTITUDE_PENALTY_STEP = 8
const ALTITUDE_STEP_RATIO = 0.125
const MIN_ALTITUDE = 20
const DEFAULT_MAX_ALTITUDE_MULTIPLIER = 4
/**
 * @typedef {Object} AltitudeConfig
 * @property {number} baseAltitude     // Altitude where penalties/bonuses start
 * @property {number} minAltitude      // Minimum altitude required to run
 * @property {number} bonusStep        // Height interval that grants bonuses
 * @property {number} penaltyStep      // Height interval that applies penalties
 * @property {number} stepRatio        // Portion of base rate applied each step
 * @property {number} maxMultiplier    // Cap relative to base rate
 */

/** @type {AltitudeConfig} */
const DEFAULT_ALTITUDE_CONFIG = {
    baseAltitude: BASE_ALTITUDE,
    minAltitude: MIN_ALTITUDE,
    bonusStep: ALTITUDE_BONUS_STEP,
    penaltyStep: ALTITUDE_PENALTY_STEP,
    stepRatio: ALTITUDE_STEP_RATIO,
    maxMultiplier: DEFAULT_MAX_ALTITUDE_MULTIPLIER
}

const WEATHER_MULTIPLIERS = {
    rain: 1.5,
    thunder: 2.25
}

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

        const altitude = block.location.y
        const weather = block.dimension.weather ?? 'clear'
        const baseRate = generator.rate
        const altitudeConfig = resolveAltitudeConfig(settings)
        const altitudeRate = computeAltitudeRate(baseRate, altitude, altitudeConfig)
        const effectiveRate = applyWeather(altitudeRate, weather)
        const efficiency = baseRate > 0 ? Math.max(0, Math.round((effectiveRate / baseRate) * 1000) / 10) : 0
        const belowMinAltitude = altitude < altitudeConfig.minAltitude

        if (belowMinAltitude) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Low Altitude', 'e', efficiency, energy.getPercent(), altitude, 0))
            return
        }

        if (effectiveRate <= 0) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Calm Winds', 'e', efficiency, energy.getPercent(), altitude, 0))
            return
        }

        if (energy.get() >= energy.cap) {
            generator.off()
            generator.displayEnergy()
            generator.energy.transferToNetwork(0)
            generator.setLabel(buildStatusLabel('Energy Full', 'e', efficiency, energy.getPercent(), altitude, 0))
            return
        }

        const produced = Math.min(effectiveRate, energy.getFreeSpace())
        energy.add(produced)
        generator.energy.transferToNetwork(produced * 4)

        generator.on()
        generator.displayEnergy()
        generator.setLabel(buildStatusLabel('Running', 'a', efficiency, energy.getPercent(), altitude, generator.baseRate * efficiency / 100))
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
        bonusStep,
        penaltyStep,
        stepRatio,
        maxMultiplier
    } = altitudeConfig

    if (altitude < minAltitude) return 0

    const bonusInterval = Math.max(1, Math.round(bonusStep ?? ALTITUDE_BONUS_STEP))
    const penaltyInterval = Math.max(1, Math.round(penaltyStep ?? ALTITUDE_PENALTY_STEP))

    const bonusSteps = altitude > baseAltitude
        ? Math.max(0, Math.floor((altitude - baseAltitude + bonusInterval) / bonusInterval) - 1)
        : 0

    const penaltySteps = altitude < baseAltitude
        ? Math.floor((baseAltitude - altitude) / penaltyInterval)
        : 0

    const ratio = Math.max(0, stepRatio ?? ALTITUDE_STEP_RATIO)
    const perStep = Math.max(1, Math.round(baseRate * ratio))
    const adjusted = baseRate + perStep * (bonusSteps - penaltySteps)
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
function applyWeather(rate, weather) {
    const multiplier = WEATHER_MULTIPLIERS[weather] ?? 1
    return rate * multiplier
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
function buildStatusLabel(status, color, efficiency, percent, altitude, transferRate = 0) {
    const clampedEfficiency = Math.max(0, efficiency)
    const formattedEfficiency = clampedEfficiency.toFixed(1).replace('.', ',')
    const transferText = transferRate > 0 ? Energy.formatEnergyToText(transferRate) : '0 DE'

    return `
§r§${color ?? 'e'}${status}

§r§eInformation
 §r§eAltitude §f${altitude}
 §r§aEfficiency §f${formattedEfficiency}%%
 
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
function resolveAltitudeConfig(settings) {
    const altitude = settings?.altitude ?? {}

    return {
        baseAltitude: altitude.base ?? BASE_ALTITUDE,
        minAltitude: altitude.min ?? MIN_ALTITUDE,
        bonusStep: altitude.bonus_step ?? ALTITUDE_BONUS_STEP,
        penaltyStep: altitude.penalty_step ?? ALTITUDE_PENALTY_STEP,
        stepRatio: altitude.step_ratio ?? ALTITUDE_STEP_RATIO,
        maxMultiplier: altitude.max_multiplier ?? settings?.max_altitude_multiplier ?? DEFAULT_MAX_ALTITUDE_MULTIPLIER
    }
}


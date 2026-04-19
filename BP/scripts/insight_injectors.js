import { system, world } from "@minecraft/server";
import { EnergyStorage, FluidStorage } from "DoriosCore/index.js"

const REGISTRATION_MARKER = "__insightInjectorsUtilityCraftRegistered";
const REGISTRATION_RETRY_TICKS = 20;
const MAX_REGISTRATION_ATTEMPTS = 180;
const INSIGHT_PROVIDER_NAME = "UtilityCraft";
const INSIGHT_CUSTOM_COMPONENT_KEYS = Object.freeze([
    "customEnergyInfo",
    "customFluidInfo",
    "customRotationInfo",
    "customMachineProgress",
    "customCobblestoneCount",
    "customVariantPreview"
]);

const ENERGY_SCOREBOARD_OBJECTIVES = Object.freeze({
    stored: Object.freeze([
        "dorios:energy",
        "utilitycraft:energy",
        "energy"
    ]),
    cap: Object.freeze([
        "dorios:energy_cap",
        "utilitycraft:energy_cap",
        "energy_cap",
        "max_energy"
    ])
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeGetBlockStates(block) {
    try {
        return block?.permutation?.getAllStates?.() ?? {};
    } catch {
        return {};
    }
}

function safeGetMachineEntity(block) {
    try {
        return block?.dimension?.getEntitiesAtBlockLocation?.(block.location)?.[0];
    } catch {
        return undefined;
    }
}

function formatEnergy(value) {
    try {
        if (typeof EnergyStorage?.formatEnergyToText === "function") {
            return EnergyStorage.formatEnergyToText(value);
        }
    } catch {
        // Ignore formatter failures and fallback below.
    }

    return `${Math.max(0, Math.floor(Number(value) || 0))}`;
}

function formatPercent(current, max) {
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return "";
    const ratio = Math.max(0, Math.min(1, current / max));
    return ` (${(ratio * 100).toFixed(1)}%)`;
}

function formatFluid(value) {
    try {
        if (typeof FluidStorage?.formatFluid === "function") {
            return FluidStorage.formatFluid(value);
        }
    } catch { /* fallback */ }
    return `${Math.max(0, Math.floor(Number(value) || 0))} mB`;
}

function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function resolveInsightComponentKeys(api, preferredKeys) {
    const keys = Array.isArray(preferredKeys)
        ? preferredKeys.filter((key) => typeof key === "string" && key.trim().length > 0)
        : [];

    if (!api || typeof api.getSupportedComponentKeys !== "function") {
        return keys;
    }

    try {
        const supportedKeys = new Set(api.getSupportedComponentKeys());
        return keys.filter((key) => supportedKeys.has(key));
    } catch {
        return keys;
    }
}

function getObjectiveScoreFromCandidates(scoreboardIdentity, objectiveIds) {
    if (!scoreboardIdentity || !Array.isArray(objectiveIds)) {
        return undefined;
    }

    for (const objectiveId of objectiveIds) {
        if (typeof objectiveId !== "string" || !objectiveId.length) {
            continue;
        }

        try {
            const objective = world.scoreboard.getObjective(objectiveId);
            if (!objective) {
                continue;
            }

            const score = Number(objective.getScore(scoreboardIdentity));
            if (Number.isFinite(score)) {
                return score;
            }
        } catch {
            // Ignore missing objective/score errors and continue scanning candidates.
        }
    }

    return undefined;
}

function getScoreboardEnergyData(machineEntity) {
    const scoreboardIdentity = machineEntity?.scoreboardIdentity;
    if (!scoreboardIdentity) {
        return undefined;
    }

    const stored = getObjectiveScoreFromCandidates(scoreboardIdentity, ENERGY_SCOREBOARD_OBJECTIVES.stored);
    if (!Number.isFinite(stored)) {
        return undefined;
    }

    const cap = getObjectiveScoreFromCandidates(scoreboardIdentity, ENERGY_SCOREBOARD_OBJECTIVES.cap);

    return {
        stored: Math.max(0, stored),
        cap: Number.isFinite(cap) ? Math.max(0, cap) : undefined
    };
}

// ---------------------------------------------------------------------------
// Field producers
// ---------------------------------------------------------------------------

function getEnergyLine(context) {
    if (!context.playerSettings?.showCustomEnergyInfo) {
        return undefined;
    }

    if (!context.block?.hasTag?.("dorios:energy")) {
        return undefined;
    }

    const machineEntity = safeGetMachineEntity(context.block);
    if (!machineEntity) {
        return undefined;
    }

    try {
        const energy = new EnergyStorage(machineEntity);
        const stored = Number(energy.get?.() ?? 0);
        const cap = Number(energy.getCap?.() ?? 0);

        if (!Number.isFinite(stored) || !Number.isFinite(cap) || cap <= 0) {
            throw new Error("Invalid machine energy values");
        }

        return `Energy: ${formatEnergy(stored)} / ${formatEnergy(cap)}${formatPercent(stored, cap)}`;
    } catch {
        const scoreboardEnergy = getScoreboardEnergyData(machineEntity);
        if (!scoreboardEnergy) {
            return undefined;
        }

        if (Number.isFinite(scoreboardEnergy.cap) && scoreboardEnergy.cap > 0) {
            return `Energy: ${formatEnergy(scoreboardEnergy.stored)} / ${formatEnergy(scoreboardEnergy.cap)}${formatPercent(scoreboardEnergy.stored, scoreboardEnergy.cap)}`;
        }

        return `Energy: ${formatEnergy(scoreboardEnergy.stored)}`;
    }
}

function getFluidLines(context, machineEntity) {
    if (!context.playerSettings?.showCustomFluidInfo || !machineEntity) {
        return [];
    }

    if (!context.block?.hasTag?.("dorios:fluid")) {
        return [];
    }

    const lines = [];

    try {
        const maxTanks = typeof FluidStorage?.getMaxLiquids === "function"
            ? FluidStorage.getMaxLiquids(machineEntity)
            : 1;

        for (let i = 0; i < maxTanks; i++) {
            try {
                const fm = new FluidStorage(machineEntity, i);
                const stored = fm.get();
                const cap = fm.getCap();
                const type = fm.getType();

                if (cap <= 0) continue;

                const typeLabel = (!type || type === "empty") ? "Empty" : capitalize(type);
                const prefix = maxTanks > 1 ? `Fluid [${i}]` : "Fluid";

                lines.push(`${prefix} (${typeLabel}): ${formatFluid(stored)} / ${formatFluid(cap)}${formatPercent(stored, cap)}`);
            } catch {
                continue;
            }
        }
    } catch {
        // FluidStorage unavailable or entity incompatible — skip silently.
    }

    return lines;
}

function getRotationLine(context, states) {
    if (!context.playerSettings?.showCustomRotationInfo) {
        return undefined;
    }

    const axis = states["utilitycraft:axis"]
        ?? states["minecraft:cardinal_direction"]
        ?? states["minecraft:facing_direction"];

    const rotation = states["utilitycraft:rotation"];

    if (axis === undefined && rotation === undefined) {
        return undefined;
    }

    if (rotation === undefined) {
        return `Facing: ${context.toMessageText(axis)}`;
    }

    return `Facing: ${context.toMessageText(axis)} | Rotation: ${context.toMessageText(rotation)}`;
}

function getMachineProgressLine(context, machineEntity) {
    if (!context.playerSettings?.showCustomMachineProgress || !machineEntity) {
        return undefined;
    }

    const progressCandidates = [
        Number(machineEntity.getDynamicProperty?.("dorios:progress_0")),
        Number(machineEntity.getDynamicProperty?.("dorios:progress"))
    ];

    const costCandidates = [
        Number(machineEntity.getDynamicProperty?.("dorios:energy_cost_0")),
        Number(machineEntity.getDynamicProperty?.("dorios:energy_cost"))
    ];

    const progress = progressCandidates.find(Number.isFinite);
    const cost = costCandidates.find(Number.isFinite);

    if (!Number.isFinite(progress) || !Number.isFinite(cost) || cost <= 0) {
        return undefined;
    }

    const ratio = Math.max(0, Math.min(1, progress / cost));
    const percent = Math.floor(ratio * 1000) / 10;

    return `Progress: ${percent}%`;
}

function getCobblestoneCountLine(context, states) {
    if (!context.playerSettings?.showCustomCobblestoneCount) {
        return undefined;
    }

    const e0 = Number(states["utilitycraft:e0"]);
    const e1 = Number(states["utilitycraft:e1"]);

    if (!Number.isFinite(e0) || !Number.isFinite(e1)) {
        return undefined;
    }

    const quantity = e1 * 10 + e0;
    return `Cobblestone: ${quantity}`;
}

function getVariantLine(context, states) {
    if (!context.playerSettings?.showCustomVariantPreview) {
        return undefined;
    }

    const variantEntry = Object.entries(states).find(([key, value]) => {
        const isNumeric = Number.isFinite(Number(value));
        return isNumeric && key.toLowerCase().includes("variant");
    });

    if (!variantEntry) {
        return undefined;
    }

    const [variantKey, rawVariant] = variantEntry;
    const currentVariant = Math.floor(Number(rawVariant));

    const countKeyCandidates = [
        `${variantKey}_count`,
        `${variantKey}_max`,
        variantKey.replace("index", "count"),
        variantKey.replace("variant", "variant_count"),
        variantKey.replace("variant", "count")
    ];

    let totalVariants;
    for (const candidate of countKeyCandidates) {
        const value = Number(states[candidate]);
        if (Number.isFinite(value) && value > 0) {
            totalVariants = Math.floor(value);
            break;
        }
    }

    if (Number.isFinite(totalVariants) && totalVariants > 0) {
        const normalizedCurrent = Math.max(0, currentVariant);
        const nextVariant = (normalizedCurrent + 1) % totalVariants;
        return `Next Variant: ${nextVariant + 1}/${totalVariants}`;
    }

    return `Variant: ${Math.max(0, currentVariant)}`;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

function collectUtilityCraftBlockFields(context) {
    if (!context?.playerSettings?.showCustomFields || !context.block) {
        return undefined;
    }

    const states = safeGetBlockStates(context.block);
    const machineEntity = safeGetMachineEntity(context.block);

    const lines = [];

    const energyLine = getEnergyLine(context);
    if (energyLine) lines.push(energyLine);

    const fluidLines = getFluidLines(context, machineEntity);
    for (const fl of fluidLines) lines.push(fl);

    const rotationLine = getRotationLine(context, states);
    if (rotationLine) lines.push(rotationLine);

    const progressLine = getMachineProgressLine(context, machineEntity);
    if (progressLine) lines.push(progressLine);

    const cobbleLine = getCobblestoneCountLine(context, states);
    if (cobbleLine) lines.push(cobbleLine);

    const variantLine = getVariantLine(context, states);
    if (variantLine) lines.push(variantLine);

    return lines.length ? lines : undefined;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function tryRegisterInjectors() {
    if (globalThis[REGISTRATION_MARKER]) {
        return true;
    }

    const api = globalThis.InsightCustomFields;
    if (!api || typeof api.registerBlockFieldInjector !== "function") {
        return false;
    }

    const componentKeys = resolveInsightComponentKeys(api, INSIGHT_CUSTOM_COMPONENT_KEYS);

    api.registerBlockFieldInjector(collectUtilityCraftBlockFields, {
        provider: INSIGHT_PROVIDER_NAME,
        components: componentKeys
    });

    // State merge: combine E0 (units) + E1 (tens) into a single "Cobblestone" row
    const stateApi = globalThis.InsightStateTraits;
    if (stateApi && typeof stateApi.registerStateMerge === "function") {
        stateApi.registerStateMerge({
            key: "utilitycraft:cobblestone_count",
            label: "Cobblestone",
            stateKeys: ["utilitycraft:e1", "utilitycraft:e0"],
            formatter(values) {
                const e1 = Number(values[0]) || 0;
                const e0 = Number(values[1]) || 0;
                return `${e1 * 10 + e0}`;
            },
            hideOriginal: true,
            options: {
                namespaces: ["utilitycraft"]
            }
        });
    }

    globalThis[REGISTRATION_MARKER] = true;
    return true;
}

function registerInjectorsWithRetry(attempt = 0) {
    if (tryRegisterInjectors() || attempt >= MAX_REGISTRATION_ATTEMPTS) {
        return;
    }

    system.runTimeout(() => {
        registerInjectorsWithRetry(attempt + 1);
    }, REGISTRATION_RETRY_TICKS);
}

registerInjectorsWithRetry();

import { system, world } from "@minecraft/server";
import { Energy } from "./machinery/DoriosMachinery/core.js";

const REGISTRATION_MARKER = "__insightInjectorsUtilityCraftRegistered";
const REGISTRATION_RETRY_TICKS = 20;
const MAX_REGISTRATION_ATTEMPTS = 180;
const INSIGHT_PROVIDER_NAME = "UtilityCraft";
const INSIGHT_CUSTOM_COMPONENT_KEYS = Object.freeze([
    "customEnergyInfo",
    "customRotationInfo",
    "customMachineProgress",
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
        if (typeof Energy?.formatEnergyToText === "function") {
            return Energy.formatEnergyToText(value);
        }
    } catch {
        // Ignore formatter failures and fallback below.
    }

    return `${Math.max(0, Math.floor(Number(value) || 0))}`;
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
        const energy = new Energy(machineEntity);
        const stored = Number(energy.get?.() ?? 0);
        const cap = Number(energy.getCap?.() ?? 0);

        if (!Number.isFinite(stored) || !Number.isFinite(cap) || cap <= 0) {
            throw new Error("Invalid machine energy values");
        }

        return `Energy: ${formatEnergy(stored)} / ${formatEnergy(cap)}`;
    } catch {
        const scoreboardEnergy = getScoreboardEnergyData(machineEntity);
        if (!scoreboardEnergy) {
            return undefined;
        }

        if (Number.isFinite(scoreboardEnergy.cap) && scoreboardEnergy.cap > 0) {
            return `Energy: ${formatEnergy(scoreboardEnergy.stored)} / ${formatEnergy(scoreboardEnergy.cap)}`;
        }

        return `Energy: ${formatEnergy(scoreboardEnergy.stored)}`;
    }
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

function collectUtilityCraftBlockFields(context) {
    if (!context?.playerSettings?.showCustomFields || !context.block) {
        return undefined;
    }

    const states = safeGetBlockStates(context.block);
    const machineEntity = safeGetMachineEntity(context.block);

    const lines = [];

    const energyLine = getEnergyLine(context);
    if (energyLine) lines.push(energyLine);

    const rotationLine = getRotationLine(context, states);
    if (rotationLine) lines.push(rotationLine);

    const progressLine = getMachineProgressLine(context, machineEntity);
    if (progressLine) lines.push(progressLine);

    const variantLine = getVariantLine(context, states);
    if (variantLine) lines.push(variantLine);

    return lines.length ? lines : undefined;
}

function tryRegisterInjectors() {
    if (globalThis[REGISTRATION_MARKER]) {
        return true;
    }

    const api = globalThis.InsightCustomFields;
    if (!api || typeof api.registerBlockFieldInjector !== "function") {
        return false;
    }

    api.registerBlockFieldInjector(collectUtilityCraftBlockFields, {
        provider: INSIGHT_PROVIDER_NAME,
        components: INSIGHT_CUSTOM_COMPONENT_KEYS
    });
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

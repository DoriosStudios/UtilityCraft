import { system } from "@minecraft/server";

/**
 * @typedef {Object} FluidAmountRange
 * @property {number} min Minimum amount accepted for the operation (in mB).
 * @property {number} max Maximum amount accepted for the operation (in mB).
 */

/**
 * @typedef {Object} FluidContainerDefinition
 * @property {number | FluidAmountRange | [number, number] | Record<string, number>} amount Amount transferred in millibuckets (mB).
 * @property {string} type Fluid type identifier (e.g. "water", "lava").
 * @property {string} [output] Optional item identifier returned after insertion (e.g. empty bucket).
 * @property {FluidAmountRange} [amountRange] Normalized min/max data (auto-populated at runtime).
 */

/**
 * @typedef {Object} FluidOutputDefinition
 * @property {number} amount Amount drained from the tank per fill action (in mB).
 * @property {Record<string, string>} fills Map of liquid type → filled item identifier.
 */

/** @type {Record<string, FluidContainerDefinition>} */
const fluidContainerRegistry = Object.create(null);
/** @type {Record<string, FluidOutputDefinition>} */
const fluidOutputRegistry = Object.create(null);

const SCRIPT_EVENT_ID = "utilitycraft:register_fluid_container";
const OUTPUT_SCRIPT_EVENT_ID = "utilitycraft:register_fluid_output";

const sanitizeType = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const clampAmount = (value) => {
    const amount = Math.floor(Number(value) || 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const normalizeAmountRange = (value) => {
    if (typeof value === "number") {
        const amount = clampAmount(value);
        return amount ? { min: amount, max: amount } : null;
    }

    if (Array.isArray(value)) {
        const [rawMin, rawMax] = value;
        const max = clampAmount(rawMax ?? rawMin);
        if (!max) return null;
        const min = clampAmount(rawMin) || max;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return { min: low, max: high };
    }

    if (typeof value === "object" && value) {
        const rawMin = value.min ?? value.minimum ?? value[0];
        const rawMax = value.max ?? value.maximum ?? value[1] ?? rawMin;
        const max = clampAmount(rawMax);
        if (!max) return null;
        const min = clampAmount(rawMin) || max;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return { min: low, max: high };
    }

    return null;
};

function normalizeDefinition(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount);
    const type = sanitizeType(definition.type);

    if (!amountRange || !type) return null;

    const normalized = {
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        type
    };

    if (typeof definition.output === "string" && definition.output.length > 0) {
        normalized.output = definition.output;
    }

    return normalized;
}

function assignDefinition(id, normalized) {
    fluidContainerRegistry[id] = Object.freeze({ ...normalized });
}

function assignOutputDefinition(id, normalized) {
    fluidOutputRegistry[id] = Object.freeze({ ...normalized });
}

export function getFluidContainerRegistry() {
    return fluidContainerRegistry;
}

export function getFluidContainerDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return fluidContainerRegistry[id] ?? null;
}

export function getFluidOutputRegistry() {
    return fluidOutputRegistry;
}

export function getFluidOutputDefinition(id) {
    if (typeof id !== "string" || id.length === 0) return null;
    return fluidOutputRegistry[id] ?? null;
}

export function registerFluidContainer(id, definition) {
    if (typeof id !== "string" || id.length === 0) return false;
    const normalized = normalizeDefinition(definition);
    if (!normalized) return false;

    assignDefinition(id, normalized);
    return true;
}

function normalizeOutputDefinition(definition) {
    if (!definition) return null;

    const amountRange = normalizeAmountRange(definition.amount ?? definition.requirement);
    if (!amountRange) return null;

    const rawFills = definition.fills || definition.outputs || definition.types;
    if (!rawFills || typeof rawFills !== 'object') return null;

    const fills = {};
    for (const [rawType, itemId] of Object.entries(rawFills)) {
        const typeKey = sanitizeType(rawType);
        if (!typeKey) continue;
        if (typeof itemId !== 'string' || itemId.length === 0) continue;
        fills[typeKey] = itemId;
    }

    if (Object.keys(fills).length === 0) return null;

    return {
        amount: amountRange.max,
        amountRange,
        minAmount: amountRange.min,
        fills
    };
}

export function registerFluidOutput(id, definition) {
    if (typeof id !== 'string' || id.length === 0) return false;
    const normalized = normalizeOutputDefinition(definition);
    if (!normalized) return false;

    assignOutputDefinition(id, normalized);
    return true;
}

export function registerFluidContainerBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === "object") {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === "object") {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== "object") continue;

        const normalized = normalizeDefinition(entry);
        if (!normalized) continue;

        const ids = [];
        if (Array.isArray(entry.ids)) {
            ids.push(...entry.ids.filter(id => typeof id === "string" && id.length > 0));
        }
        if (typeof entry.id === "string" && entry.id.length > 0) {
            ids.push(entry.id);
        }
        if (!ids.length) continue;

        for (const targetId of ids) {
            assignDefinition(targetId, normalized);
            registered++;
        }
    }

    return registered;
}

export function registerFluidOutputBatch(entries) {
    if (!entries) return 0;

    const queue = [];

    if (Array.isArray(entries)) {
        queue.push(...entries);
    } else if (typeof entries === 'object') {
        for (const [id, definition] of Object.entries(entries)) {
            if (definition && typeof definition === 'object') {
                queue.push({ id, ...definition });
            }
        }
    } else {
        return 0;
    }

    let registered = 0;

    for (const entry of queue) {
        if (!entry || typeof entry !== 'object') continue;

        const normalized = normalizeOutputDefinition(entry);
        if (!normalized) continue;

        const ids = [];
        if (Array.isArray(entry.ids)) {
            ids.push(...entry.ids.filter(id => typeof id === 'string' && id.length > 0));
        }
        if (typeof entry.id === 'string' && entry.id.length > 0) {
            ids.push(entry.id);
        }
        if (!ids.length) continue;

        for (const targetId of ids) {
            assignOutputDefinition(targetId, normalized);
            registered++;
        }
    }

    return registered;
}

registerFluidContainerBatch([
    { id: "minecraft:lava_bucket", amount: 1000, type: "lava", output: "minecraft:bucket" },
    { id: "utilitycraft:lava_ball", amount: 1000, type: "lava" },
    { id: "minecraft:water_bucket", amount: 1000, type: "water", output: "minecraft:bucket" },
    { id: "utilitycraft:water_ball", amount: 1000, type: "water" },
    { id: "minecraft:milk_bucket", amount: 1000, type: "milk", output: "minecraft:bucket" },
    { id: "minecraft:experience_bottle", amount: 8, type: "xp", output: "minecraft:glass_bottle" },
    // Cloud's Fluid Cells
    { id: "fluidcells:water_cell", amount: 4000, type: "water", output: "fluidcells:empty_cell" },
    { id: "fluidcells:water_cell_2", amount: 3000, type: "water", output: "fluidcells:empty_cell" },
    { id: "fluidcells:water_cell_3", amount: 2000, type: "water", output: "fluidcells:empty_cell" },
    { id: "fluidcells:water_cell_4", amount: 1000, type: "water", output: "fluidcells:empty_cell" },
    { id: "fluidcells:lava_cell", amount: 4000, type: "lava", output: "fluidcells:empty_cell" },
    { id: "fluidcells:lava_cell_2", amount: 3000, type: "lava", output: "fluidcells:empty_cell" },
    { id: "fluidcells:lava_cell_3", amount: 2000, type: "lava", output: "fluidcells:empty_cell" },
    { id: "fluidcells:lava_cell_4", amount: 1000, type: "lava", output: "fluidcells:empty_cell" }
]);

registerFluidOutputBatch([
    {
        id: "minecraft:bucket",
        amount: 1000,
        fills: {
            water: "minecraft:water_bucket",
            lava: "minecraft:lava_bucket",
            milk: "minecraft:milk_bucket"
        }
    },
    {
        id: "fluidcells:empty_cell",
        amount: { min: 1000, max: 4000 },
        fills: {
            water: "fluidcells:water_cell",
            lava: "fluidcells:lava_cell"
        }
    }
]);

export const REGISTER_FLUID_CONTAINER_EVENT = SCRIPT_EVENT_ID;
export const REGISTER_FLUID_OUTPUT_EVENT = OUTPUT_SCRIPT_EVENT_ID;

system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== SCRIPT_EVENT_ID && event.id !== OUTPUT_SCRIPT_EVENT_ID) return;

    const payload = event.message?.trim();
    if (!payload) return;

    try {
        const parsed = JSON.parse(payload);
        if (event.id === SCRIPT_EVENT_ID) {
            const added = registerFluidContainerBatch(parsed);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} fluid container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        } else {
            const added = registerFluidOutputBatch(parsed);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} fluid output container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        }
    } catch (error) {
        const id = event.id === SCRIPT_EVENT_ID ? SCRIPT_EVENT_ID : OUTPUT_SCRIPT_EVENT_ID;
        console.warn(`[UtilityCraft] Failed to process ${id}:`, error);
    }
});

import { system, ItemStack } from "@minecraft/server";

/**
 * Global pedestal configuration
 */
const pedestalSettings = {
    radius: 4,            // Radio de acción (4 = 9x9)
    cropsPerCycle: 27,    // Cuántos cultivos intenta procesar por ciclo
    baseChance: 0.80,     // Probabilidad base de crecimiento
};

/**
 * Modifiers based on crop tier (rarer = harder to grow)
 * Key = tier value (from permutation), Value = chance multiplier
 */
const cropTierChances = {
    0: 1.0,  // Normal crops
    1: 0.80,  // Slightly slower
    2: 0.60, // Noticeably slower
    3: 0.10,  // Hard to grow
    4: 0.05,  // Very slow growth (top-tier / rare)
};

/**
 * Returns a random position within a square area centered on the pedestal.
 */
function getRandomPosition(x, y, z, radius) {
    const dx = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    const dz = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    return { x: x + dx, y, z: z + dz };
}

/**
 * Tries to get an add-on's namespace from a crop block.
 */
function getCropNamespace(block) {
    if (!block) return null;   
    const namespace = block.typeId.split(":")[0];
    return namespace
}


/**
 * Attempts to grow a crop based on its type, tier, and chance.
 */
function getMaxState(block, key, maxTry = 16) {
    const perm = block.permutation;
    const current = perm.getState(key);
    if (current === undefined) return 0;

    let lastValid = current;
    for (let i = current + 1; i <= maxTry; i++) {
        try {
            perm.withState(key, i);
            lastValid = i;
        } catch {
            break;
        }
    }
    return lastValid;
}

function tryGrowCrop(block, baseChance, globalMultiplier) {
    if (!block) return;

    const perm = block.permutation;
    const utilitycrop = perm.getState("utilitycraft:age"); // Age for UtilityCraft crops
    const vanilla = perm.getState("growth");               // Age for vanilla crops

    const tier = perm.getState("utilitycraft:tier") ?? 0;
    const tierMult = cropTierChances[tier] ?? 1;

    const finalChance = baseChance * globalMultiplier * tierMult;

    // UtilityCraft-specific crops
    if (typeof utilitycrop === "number" && utilitycrop < 5) {
        if (Math.random() < finalChance) {
            block.setPermutation(perm.withState("utilitycraft:age", utilitycrop + 1));
            if (Math.random() <= 0.25) block.dimension.spawnParticle('minecraft:crop_growth_emitter', block.center());
        }
        return;
    }

    // Vanilla crops
    if (typeof vanilla === "number" && vanilla < 7) {
        if (Math.random() < finalChance) {
            block.setPermutation(perm.withState("growth", vanilla + 1));
            if (Math.random() <= 0.25) block.dimension.spawnParticle('minecraft:crop_growth_emitter', block.center());
        }
        return;
    }

    // Generic namespace-aware attempt: try common state names with/without namespace
    const namespace = getCropNamespace(block);
    const candidates = [
        // Prioritize namespaced forms if we have a namespace
        ...(namespace ? [
            `${namespace}:growth`,
            `${namespace}:crop`,
            `${namespace}:age`
        ] : []),
        // Fallback / common property names
        'growth',
        'crop',
        'age'
    ];

    for (const key of candidates) {
        const value = perm.getState(key);
        if (typeof value !== 'number') continue;

        const max = getMaxState(block, key);
        if (value < max) {
            if (Math.random() < finalChance) {
                block.setPermutation(perm.withState(key, value + 1));
                if (Math.random() <= 0.25) block.dimension.spawnParticle('minecraft:crop_growth_emitter', block.center());
            }
            break; // only grow one recognized state per tick
        }
    }
}

/**
 * Pedestal block logic
 */
DoriosAPI.register.blockComponent("pedestal", {
    /**
     * Handles the ticking of the pedestal
     * @param {import("@minecraft/server").BlockComponentTickEvent} e
     * @param {{ params: { multiplier: number } }} ctx
     */
    async onTick(e, { params }) {
        const { block } = e;
        const { multiplier = 1 } = params;

        if (block.permutation.getState("utilitycraft:hasItem") !== 1) return;

        const dim = block.dimension;
        const { radius, baseChance, cropsPerCycle } = pedestalSettings;
        const { x, y, z } = block.location;

        for (let i = 0; i < cropsPerCycle; i++) {
            const pos = getRandomPosition(x, y, z, radius);
            const crop = dim.getBlock(pos);
            tryGrowCrop(crop, baseChance, multiplier);

            await system.waitTicks(1);
        }
    },

    /**
     * Drops the clock if the pedestal is destroyed.
     * @param {import("@minecraft/server").BlockComponentPlayerDestroyEvent} e
     */
    onPlayerDestroy(e) {
        const { block, destroyedBlockPermutation } = e;
        if (destroyedBlockPermutation.getState("utilitycraft:hasItem") === 1) {
            block.dimension.spawnItem(new ItemStack("utilitycraft:accelerator_clock", 1), block.location);
        }
    },
});

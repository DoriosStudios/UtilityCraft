import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system, world } from "@minecraft/server";
import { crusherRecipes } from "../config/recipes/crusher.js";

const HAMMER_EVENT_IDS = new Set(["dorios:hammerblock"]);
const DROP_SEARCH_RADIUS = 3;
const pendingBreaks = new Map();
const BLOCK_ALIASES = {
    "minecraft:lit_redstone_ore": "minecraft:redstone_ore",
    "minecraft:lit_deepslate_redstone_ore": "minecraft:deepslate_redstone_ore"
};
const BLOCK_DROP_OVERRIDES = {
    "minecraft:iron_ore": ["minecraft:raw_iron"],
    "minecraft:deepslate_iron_ore": ["minecraft:raw_iron"],
    "minecraft:gold_ore": ["minecraft:raw_gold"],
    "minecraft:deepslate_gold_ore": ["minecraft:raw_gold"],
    "minecraft:copper_ore": ["minecraft:raw_copper"],
    "minecraft:deepslate_copper_ore": ["minecraft:raw_copper"],
    "minecraft:coal_ore": ["minecraft:coal"],
    "minecraft:deepslate_coal_ore": ["minecraft:coal"],
    "minecraft:diamond_ore": ["minecraft:diamond"],
    "minecraft:deepslate_diamond_ore": ["minecraft:diamond"],
    "minecraft:emerald_ore": ["minecraft:emerald"],
    "minecraft:deepslate_emerald_ore": ["minecraft:emerald"],
    "minecraft:lapis_ore": ["minecraft:lapis_lazuli"],
    "minecraft:deepslate_lapis_ore": ["minecraft:lapis_lazuli"],
    "minecraft:redstone_ore": ["minecraft:redstone"],
    "minecraft:deepslate_redstone_ore": ["minecraft:redstone"],
    "minecraft:quartz_ore": ["minecraft:quartz"],
    "minecraft:nether_gold_ore": ["minecraft:gold_nugget"],
    "minecraft:gilded_blackstone": ["minecraft:gold_nugget"],
    "utilitycraft:lead_ore": ["utilitycraft:raw_lead"],
    "utilitycraft:deepslate_lead_ore": ["utilitycraft:raw_lead"],
    "utilitycraft:deepslate_uranium_ore": ["utilitycraft:raw_uranium"],
    "minecraft:gravel": ["minecraft:flint"],
    "minecraft:clay": ["minecraft:clay_ball"],
    "minecraft:glowstone": ["minecraft:glowstone_dust"],
    "minecraft:melon_block": ["minecraft:melon_slice"],
    "minecraft:snow": ["minecraft:snowball"]
};

function getRecipeForBlock(block, minedBlockPermutation) {
    const blockId = minedBlockPermutation?.type?.id ?? block?.typeId;
    if (!blockId) return null;
    return crusherRecipes[blockId] ?? crusherRecipes[BLOCK_ALIASES[blockId]] ?? null;
}

function getBreakKey(source, block) {
    const { x, y, z } = block.location;
    return `${source.id}|${block.dimension.id}|${x},${y},${z}`;
}

function getNearbyDrops(dimension, center, expectedIds) {
    const drops = [];
    for (const entity of dimension.getEntities({
        type: "minecraft:item", location: center, maxDistance: DROP_SEARCH_RADIUS
    })) {
        const stack = entity.getComponent("minecraft:item")?.itemStack;
        if (stack && expectedIds.has(stack.typeId)) drops.push({ entity, stack });
    }
    return drops;
}

function countDrops(drops) {
    const totals = new Map();
    for (const { stack } of drops) {
        totals.set(stack.typeId, (totals.get(stack.typeId) ?? 0) + stack.amount);
    }
    return totals;
}

// Observe only eligible hammer breaks. Leave vanilla mining, durability and
// loot generation intact; this snapshot prevents consuming existing drops.
world.beforeEvents.playerBreakBlock.subscribe(event => {
    const { block, itemStack, player } = event;
    if (event.cancel || !itemStack) return;
    if (!itemStack.hasTag("utilitycraft:is_hammer")
        && !itemStack.hasComponent("utilitycraft:hammer")) return;
    const recipe = getRecipeForBlock(block);
    if (!recipe || !hasRequiredTier(getHammerTierFromItem(itemStack), recipe.tier)) return;

    const blockId = block.typeId;
    const canonicalId = BLOCK_ALIASES[blockId] ?? blockId;
    const expectedIds = new Set([blockId, canonicalId, ...(BLOCK_DROP_OVERRIDES[canonicalId] ?? [])]);
    const { x, y, z } = block.location;
    const center = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    const drops = getNearbyDrops(block.dimension, center, expectedIds);
    const key = getBreakKey(player, block);
    const snapshot = {
        blockId, center, expectedIds,
        totals: countDrops(drops),
        amounts: new Map(drops.map(({ entity, stack }) => [entity.id, stack.amount]))
    };
    pendingBreaks.set(key, snapshot);
    // Also release snapshots when another handler cancels the break.
    system.runTimeout(() => {
        if (pendingBreaks.get(key) === snapshot) pendingBreaks.delete(key);
    }, 2);
});

function replaceMinedDrops(block, snapshot, recipe) {
    const drops = getNearbyDrops(block.dimension, snapshot.center, snapshot.expectedIds);
    const totals = countDrops(drops);
    const replacements = [];
    for (const [typeId, total] of totals) {
        // Compare quantities as well as entity IDs: vanilla may merge the new
        // loot into an existing stack, or merge an old stack into the new one.
        let remaining = total - (snapshot.totals.get(typeId) ?? 0);
        if (remaining <= 0) continue;
        for (const { entity, stack } of drops) {
            if (stack.typeId !== typeId) continue;
            const oldAmount = snapshot.amounts.get(entity.id);
            const location = entity.location;
            const insideBlock = Math.floor(location.x) === block.location.x
                && Math.floor(location.y) === block.location.y
                && Math.floor(location.z) === block.location.z;
            // New entities must originate at this block. Existing entities
            // qualify only when their stack grew since the snapshot.
            const available = oldAmount === undefined
                ? (insideBlock ? stack.amount : 0)
                : Math.max(0, stack.amount - oldAmount);
            const consumed = Math.min(remaining, available);
            if (!consumed) continue;
            const remainder = stack.amount > consumed ? stack.clone() : undefined;
            if (remainder) remainder.amount = stack.amount - consumed;
            replacements.push({ entity, location, remainder });
            remaining -= consumed;
            if (!remaining) break;
        }
        // Ambiguous or moved loot: leave it intact rather than consume nearby
        // items or produce a crusher result alongside unremoved vanilla loot.
        if (remaining) return;
    }
    if (!replacements.length) return;

    // Validate the output before removing anything. Fortune affects vanilla
    // loot only; the crusher recipe is applied exactly once per mined block.
    const output = new ItemStack(recipe.output, recipe.amount ?? 1);
    for (const { entity } of replacements) entity.remove();
    for (const { location, remainder } of replacements) {
        if (remainder) block.dimension.spawnItem(remainder, location);
    }
    block.dimension.spawnItem(output, snapshot.center);
}

function parseTier(value) {
    const tier = Number(value);
    return Number.isFinite(tier) ? tier : null;
}

function getTierFromComponent(component) {
    if (!component) return null;
    return parseTier(
        component?.customComponentParameters?.params?.tier ??
        component?.params?.tier
    );
}

function getHammerTierFromItem(itemStack) {
    if (!itemStack) return null;

    const namespaces = new Set(["utilitycraft"]);
    const itemNamespace = itemStack?.typeId?.split(":")?.[0];
    if (itemNamespace) namespaces.add(itemNamespace);

    for (const namespace of namespaces) {
        const component = itemStack.getComponent?.(`${namespace}:hammer`);
        const tier = getTierFromComponent(component);
        if (tier !== null) return tier;
    }

    const allComponents = itemStack.getComponents?.() ?? [];
    for (const component of allComponents) {
        const componentId = component?.typeId ?? component?.id;
        if (!componentId?.endsWith?.(":hammer")) continue;

        const tier = getTierFromComponent(component);
        if (tier !== null) return tier;
    }

    return null;
}

function hasRequiredTier(hammerTier, recipeTier) {
    const requiredTier = parseTier(recipeTier);
    if (requiredTier === null) return true;

    // If tier cannot be resolved from item in this runtime context,
    // keep compatibility and allow the recipe instead of silently failing.
    if (hammerTier === null) return true;

    return hammerTier >= requiredTier;
}

DoriosLib.registry.itemComponent("utilitycraft:hammer", {
    onMineBlock({ block, minedBlockPermutation, source }, { params }) {
        if (!block || !source) return;
        const key = getBreakKey(source, block);
        const snapshot = pendingBreaks.get(key);
        pendingBreaks.delete(key);
        if (!snapshot) return;
        const minedBlockId = minedBlockPermutation.type.id;
        if ((BLOCK_ALIASES[snapshot.blockId] ?? snapshot.blockId)
            !== (BLOCK_ALIASES[minedBlockId] ?? minedBlockId)) return;

        const recipe = getRecipeForBlock(block, minedBlockPermutation);
        if (!recipe || !hasRequiredTier(parseTier(params?.tier), recipe.tier)) return;

        // Wait for vanilla drops, retaining coordinates rather than a live block.
        const minedBlock = { location: { ...block.location }, dimension: block.dimension };
        system.run(() => {
            if (!minedBlock.dimension.isChunkLoaded(minedBlock.location)) return;
            replaceMinedDrops(minedBlock, snapshot, recipe);
        });
    }
});

/**
 * ScriptEvent handler to hammer a block at given coordinates.
 * Uses hammer tier from the player's main hand component, breaks the block, and drops the recipe output.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e
    const normalizedId = String(id ?? "").toLowerCase();

    if (HAMMER_EVENT_IDS.has(normalizedId)) {
        try {
            if (!sourceEntity?.dimension) return;

            const [x, y, z] = message.split(',').map(Number)
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const perm = block.permutation
            const recipe = crusherRecipes[perm?.type?.id]
            if (!recipe) return

            // Get hammer tier from custom item component
            const eq = sourceEntity.getComponent('equippable')
            const main = eq?.getEquipment('Mainhand')
            const hammerTier = getHammerTierFromItem(main)

            // Check required tier
            if (!hasRequiredTier(hammerTier, recipe.tier)) return

            const dropPos = { x: x + 0.5, y: y + 0.2, z: z + 0.5 }

            // Replace block with air and drop result
            system.run(() => {
                const currentBlock = dim.getBlock({ x, y, z });
                if (!currentBlock || currentBlock.typeId === 'minecraft:air') return;

                dim.setBlockType(block.location, 'minecraft:air')
                dim.spawnItem(new ItemStack(recipe.output, recipe.amount ?? 1), dropPos)
            })
        } catch (err) {
            console.warn(`[hammerBlock] Error: ${err}`)
        }
    }
})

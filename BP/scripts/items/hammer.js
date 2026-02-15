import { ItemStack, system } from "@minecraft/server";
import { crusherRecipes } from "../config/recipes/crusher.js";

const HAMMER_EVENT_IDS = new Set(["dorios:hammerblock"]);

function getRecipeForBlock(block, minedBlockPermutation) {
    const blockId = minedBlockPermutation?.type?.id ?? block?.typeId;
    if (!blockId) return null;
    return crusherRecipes[blockId] ?? null;
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

DoriosAPI.register.itemComponent("hammer", {
    onMineBlock({ block, minedBlockPermutation }, { params }) {
        if (!block) return;

        let { x, y, z } = block.location;
        x += 0.5;
        z += 0.5;
        y += 0.2;

        // Get recipe for the mined block
        const recipe = getRecipeForBlock(block, minedBlockPermutation);
        if (!recipe) return;

        // Check if tool tier is sufficient
        const hammerTier = parseTier(params?.tier);
        if (!hasRequiredTier(hammerTier, recipe.tier)) return;

        const minedBlockId = minedBlockPermutation?.type?.id ?? block.typeId;

        // Find the mined item entity near the block
        const closest = block.dimension.getEntities({
            type: "item",
            maxDistance: 3,
            location: { x, y, z }
        }).find(entity =>
            entity?.getComponent("minecraft:item")?.itemStack.typeId === minedBlockId
        );

        if (!closest) return;

        // Remove original drop and spawn the crusher result
        closest.remove();
        block.dimension.spawnItem(new ItemStack(recipe.output, recipe.amount ?? 1), { x, y, z });
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

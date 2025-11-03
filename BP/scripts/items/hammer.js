import { ItemStack } from "@minecraft/server";
import { crusherRecipes } from "../config/recipes/crusher.js";

DoriosAPI.register.itemComponent("hammer", {
    onMineBlock({ block, minedBlockPermutation }, { params }) {
        let { x, y, z } = block.location;
        x += 0.5;
        z += 0.5;
        y += 0.2;

        // Get recipe for the mined block
        const recipe = crusherRecipes[minedBlockPermutation.type.id];
        if (!recipe) return;

        // Check if tool tier is sufficient
        const hammerTier = params?.tier ?? 0
        if (hammerTier < recipe.tier) return;

        // Find the mined item entity near the block
        const closest = block.dimension.getEntities({
            type: "item",
            maxDistance: 3,
            location: { x, y, z }
        }).find(entity =>
            entity?.getComponent("minecraft:item")?.itemStack.typeId === minedBlockPermutation.type.id
        );

        if (!closest) return;

        // Remove original drop and spawn the crusher result
        closest.remove();
        block.dimension.spawnItem(new ItemStack(recipe.output, recipe.amount), { x, y, z });
    }
});

/**
 * ScriptEvent handler to hammer a block at given coordinates.
 * Uses hammer tier from the player's main hand component, breaks the block, and drops the recipe output.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id === 'dorios:hammerBlock') {
        try {
            const [x, y, z] = message.split(',').map(Number)
            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const perm = block.permutation
            const recipe = hammerRecipes[perm.type.id]
            if (!recipe) return

            // Get hammer tier from custom item component
            const eq = sourceEntity.getComponent('equippable')
            const main = eq?.getEquipment('Mainhand')
            const hammerComp = main?.getComponent('utilitycraft:hammer')
            const hammerTier = hammerComp?.customParams?.params?.tier ?? 0

            // Check required tier
            if (hammerTier < (recipe.tier ?? 0)) return

            const dropPos = { x: x + 0.5, y: y + 0.2, z: z + 0.5 }

            // Replace block with air and drop result
            system.run(() => {
                dim.setBlockType(block.location, 'minecraft:air')
                dim.spawnItem(new ItemStack(recipe.output, recipe.amount ?? 1), dropPos)
            })
        } catch (err) {
            console.warn(`[hammerBlock] Error: ${err}`)
        }
    }
})

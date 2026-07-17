import * as DoriosLib from "DoriosLib/index.js";
/**
 * Maps item identifiers to their corresponding texture state for the asphalt block.
 * Safer as a hardcoded map.
 */
const textureMap = {
    "utilitycraft:asphalt": 0,
    "minecraft:grass_path": 1,
    "minecraft:grass_block": 2,
    "minecraft:dirt": 3,
    "minecraft:cobblestone": 4,
    "minecraft:stone": 5,
    "minecraft:gravel": 6
};

DoriosLib.registry.blockComponent('utilitycraft:asphalt', {
    onPlayerInteract({ block, player }) {
        const mainHandItem = player.getComponent('equippable').getEquipment('Mainhand');
        if (!mainHandItem) return;

        const textureValue = textureMap[mainHandItem.typeId];

        // If the item is not in the map, do nothing.
        if (textureValue === undefined) return;

        try {
            block.setPermutation(block.permutation.withState('utilitycraft:texture', textureValue));
        } catch (err) {
            console.warn(`[UtilityCraft] Failed to set asphalt texture for ${mainHandItem.typeId}:`, err);
        }
    },
    onStepOn({ entity }) {
        if (entity) entity.runCommand('effect @s speed 2 3 true')
    }
})

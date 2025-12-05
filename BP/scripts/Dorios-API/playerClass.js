import { ItemStack, Player } from '@minecraft/server'


/**
 * Extend Player prototype with custom methods.
 * then attached to Player.prototype for direct usage.
 */
const playerExtensions = {
    /**
     * Gives an item to the player.
     * - If inventory is full → spawns the item above the block.
     * - Else → adds the item directly to the player.
     * 
     * @param {string} itemId The item identifier (e.g. "minecraft:lava_bucket").
     * @param {number} [amount=1] Number of items to insert.
     */
    giveItem(itemId, amount = 1) {
        const { x, y, z } = this.location
        const pos = { x: x + 0.5, y: y + 1, z: z + 0.5 }

        const container = this.getComponent('inventory').container
        if (container.emptySlotsCount === 0) {
            this.dimension.spawnItem(new ItemStack(itemId, amount), pos)
        } else {
            container.addItem(new ItemStack(itemId, amount))
        }
    },

    /**
     * Checks if the player is currently in Creative mode.
     * 
     * @returns {boolean} true if the player is in Creative, false otherwise.
     */
    isInCreative() {
        return this.getGameMode().toLowerCase() === "creative";
    },

    /**
     * Checks if the player is currently in Survival mode.
     * 
     * @returns {boolean} true if the player is in Survival, false otherwise.
     */
    isInSurvival() {
        return this.getGameMode().toLowerCase() === "survival";
    }
}

// Attach all extensions to Player.prototype
Object.entries(playerExtensions).forEach(([name, fn]) => {
    if (!Player.prototype[name]) {
        Player.prototype[name] = fn
    }
})

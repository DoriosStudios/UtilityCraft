import { ItemStack } from "@minecraft/server";

/**
 * @typedef {Object} DurabilityHandler
 * @property {(amount: number, chance?: number) => boolean} damage
 * @property {() => number} getDamage
 * @property {() => number} getMax
 * @property {() => number} getRemaining
 */

/**
 * Durability manager for Minecraft ItemStacks.
 *
 * Accessible via `item.durability`, this object handles
 * applying damage with support for Unbreaking enchantment.
 */
const DurabilityHandler = {
    /**
     * Repairs the item by decreasing its damage value.
     * Returns the modified item.
     * @param {number} amount Amount of durability to restore.
     * @returns {ItemStack|null}
     */
    repair(amount) {
        const durability = this.item.getComponent("minecraft:durability");
        if (!durability) return null;

        durability.damage = Math.max(durability.damage - amount, 0);
        return
    },
    /**
     * Apply durability damage to the item.
     *
     * @param {number} amount How many "damage attempts" to apply.
     * @param {number} chance Probability [0-1] that each attempt consumes durability.
     * @returns {boolean} True if the item broke, false otherwise.
     */
    damage(amount = 1, chance = 1) {
        if (!this.item || !this.item.getComponent("durability")) return false;

        const durability = this.item.getComponent("durability");
        let unbreaking = 0;

        // Detect Unbreaking enchantment
        const enchComp = this.item.getComponent("enchantments");
        if (enchComp) {
            const unbreakingData = enchComp.enchantments.get("unbreaking");
            if (unbreakingData) {
                unbreaking = unbreakingData.level;
            }
        }

        let damageApplied = 0;

        for (let i = 0; i < amount; i++) {
            // Roll chance for this attempt
            if (Math.random() > chance) continue;

            // Roll Unbreaking avoidance
            if (unbreaking > 0) {
                const avoidChance = 1 / (unbreaking + 1);
                if (Math.random() > avoidChance) {
                    continue;
                }
            }

            damageApplied++;
        }

        if (damageApplied > 0) {
            const totalDamage = durability.damage + damageApplied;

            if (totalDamage > durability.maxDurability) {
                return false;
            }

            durability.damage = totalDamage;
            return true;
        }

        return true;
    },

    /**
     * @returns {number} Current damage applied (0 = new item).
     */
    getDamage() {
        const durability = this.item.getComponent("durability");
        return durability ? durability.damage : 0;
    },

    /**
     * @returns {number} Maximum durability of this item.
     */
    getMax() {
        const durability = this.item.getComponent("durability");
        return durability ? durability.maxDurability : 0;
    },

    /**
     * @returns {number} Remaining durability (max - current).
     */
    getRemaining() {
        const durability = this.item.getComponent("durability");
        return durability ? (durability.maxDurability - durability.damage) : 0;
    }
};

Object.defineProperty(ItemStack.prototype, "durability", {
    get() {
        const instance = Object.create(DurabilityHandler);
        instance.item = this;
        return instance;
    },
    enumerable: false
});

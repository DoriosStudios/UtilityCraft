import { Entity, ItemStack } from '@minecraft/server'

/**
 * Extend Entity prototype with custom methods for DoriosAPI.
 * Includes inventory management, health control, equipment handling,
 * and item durability operations.
 */
const entityExtensions = {
    /**
     * Adds an item to the entity's inventory or drops it at the entity's location if the inventory is full.
     *
     * @param {ItemStack|string} item The item to add. Can be an ItemStack or an item identifier string.
     * @param {number} [amount=1] Amount of the item if a string is provided. Ignored if item is an ItemStack.
     * @param {boolean} [shouldSpawn=false]
     */
    addItem(item, amount = 1, shouldSpawn) {
        if (!this?.getComponent || !this.getComponent('inventory')) return;

        const inventory = this.getComponent('inventory');
        const invContainer = inventory.container;

        const itemStack = typeof item === 'string'
            ? new ItemStack(item, amount)
            : item;

        if (this.isInventoryFull() && shouldSpawn) {
            this.dimension.spawnItem(itemStack, this.location);
        } else {
            invContainer.addItem(itemStack);
        }
    },

    /**
     * Changes the amount of items in a specific inventory slot of an entity.
     *
     * - Positive `amount` adds items.
     * - Negative `amount` removes items.
     * - Fails if the slot is empty, exceeds the stack limit, or goes below zero.
     *
     * @param {number} slot The inventory slot index to modify.
     * @param {number} amount The amount to add (positive) or remove (negative).
     * @returns {boolean} Whether the operation was successful.
     */
    changeItemAmount(slot, amount) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return false;

        const inv = inventory.container;
        const item = inv.getItem(slot);
        if (!item) return false;

        const newAmount = item.amount + amount;

        if (newAmount > item.maxAmount || newAmount < 0) return false;

        if (newAmount === 0) {
            inv.setItem(slot, undefined);
        } else {
            item.amount = newAmount;
            inv.setItem(slot, item);
        }

        return true;
    },

    /**
     * Sets an item in a specific inventory slot of an entity.
     *
     * - Accepts either an ItemStack or a string with amount.
     * - Overwrites any existing item in the slot.
     *
     * @param {number} slot The inventory slot index to set.
     * @param {ItemStack|string} item The item to place (ItemStack or item ID string).
     * @param {number} [amount=1] Amount if item is a string. Ignored for ItemStack.
     * @param {string} [name] Name for the itemStack.
     * @returns {boolean} Whether the operation was successful.
     */
    setItem(slot, item, amount = 1, name) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return false;

        const inv = inventory.container;

        const itemStack = typeof item === 'string'
            ? new ItemStack(item, amount)
            : item;
        if (name) itemStack.nameTag = name
        try {
            inv.setItem(slot, itemStack);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Returns all items in the entity's inventory container as an array.
     * 
     * - Skips empty slots.
     * - Returns an empty array if the entity has no inventory.
     *
     * @returns {ItemStack[]} Array of items present in the inventory.
     */
    getItems() {
        const inventory = this.getComponent('inventory');
        if (!inventory) return [];

        const container = inventory.container;
        const items = [];

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item) items.push(item);
        }

        return items;
    },

    /**
     * Searches for an item in the entity's inventory.
     * 
     * - If a string is provided, searches by item identifier.
     * - If an ItemStack is provided, uses container.find to locate it.
     * 
     * @param {string|ItemStack} item Item identifier or ItemStack to search for.
     * @returns {{ slot: number, item: ItemStack }|undefined} Found item with slot, or undefined.
     */
    findItem(item) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return;

        const container = inventory.container;

        if (typeof item === 'string') {
            for (let i = 0; i < container.size; i++) {
                const slotItem = container.getItem(i);
                if (slotItem?.typeId === item) {
                    return { slot: i, item: slotItem };
                }
            }
        } else {
            try {
                const slot = container.find(item);
                if (slot !== -1) {
                    const found = container.getItem(slot);
                    return { slot, item: found };
                }
            } catch {
                return;
            }
        }

        return;
    },

    /**
     * Drops all items from the entity's inventory at its current location,
     * excluding any item with a typeId present in the optional exclude list.
     * 
     * @param {string[]} [excludeIds=[]] Optional array of item identifiers to exclude.
     */
    dropAllItems(excludeIds = []) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return;

        const container = inventory.container;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && !excludeIds.includes(item.typeId)) {
                this.dimension.spawnItem(item, this.location);
                container.setItem(i, undefined);
            }
        }
    },

    /**
     * Gets the item in the specified inventory slot of an entity.
     * 
     * @param {number} slot The inventory slot index to read.
     * @returns {ItemStack|undefined} The item in the slot, or undefined if empty or invalid.
     */
    getItem(slot) {
        const inventory = this.getComponent('inventory');
        return inventory?.container.getItem(slot);
    },

    /**
     * Checks if the entity has a specific item in its inventory.
     * 
     * @param {string} id The item identifier to look for.
     * @param {number} [amount=1] Minimum amount required.
     * @returns {boolean} Whether the item exists in sufficient quantity.
     */
    hasItem(id, amount = 1) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return false;

        const container = inventory.container;
        let total = 0;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item?.typeId === id) total += item.amount;
            if (total >= amount) return true;
        }

        return false;
    },

    /**
     * Clears the entity's inventory, optionally skipping certain item IDs.
     * 
     * @param {string[]} [excludeIds=[]] - Item IDs to keep.
     */
    clearInventory(excludeIds = []) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return;

        const container = inventory.container;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && !excludeIds.includes(item.typeId)) {
                container.setItem(i, undefined);
            }
        }
    },

    /**
     * Removes a specific amount of items from the entity's inventory.
     * 
     * @param {string} id - The item identifier to remove.
     * @param {number} [amount=1] - The quantity to remove.
     * @returns {boolean} Whether the removal was successful.
     */
    removeItem(id, amount = 1) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return false;

        const container = inventory.container;
        let remaining = amount;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item || item.typeId !== id) continue;

            if (item.amount > remaining) {
                item.amount -= remaining;
                container.setItem(i, item);
                return true;
            } else {
                remaining -= item.amount;
                container.setItem(i, undefined);
                if (remaining === 0) return true;
            }
        }

        return false;
    },

    /**
     * Counts the total number of items with a specific identifier in the entity's inventory.
     * 
     * @param {string} id The item identifier to count.
     * @returns {number} Total amount found in the inventory.
     */
    countItem(id) {
        const inventory = this.getComponent('inventory');
        if (!inventory) return 0;

        const container = inventory.container;
        let total = 0;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item?.typeId === id) total += item.amount;
        }

        return total;
    },

    /**
     * Returns the current health of the entity.
     * 
     * @returns {number|undefined} The current health, or undefined if not available.
     */
    getHealth() {
        const health = this.getComponent('health');
        return health?.current;
    },

    /**
     * Sets the current health of the entity.
     * 
     * @param {number} value The health value to set.
     * @returns {boolean} Whether the operation was successful.
     */
    setHealth(value) {
        try {
            const health = this.getComponent('health');
            if (!health) return false;
            health.setCurrentValue(value);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Adds or subtracts health from the entity.
     * 
     * @param {number} delta Positive to heal, negative to damage.
     * @returns {boolean} Whether the operation was successful.
     */
    addHealth(delta) {
        const health = this.getComponent('health');
        if (!health) return false;

        const newHealth = Math.max(0, Math.min(health.current + delta, health.max));
        health.setCurrent(newHealth);
        return true;
    },

    /**
     * Returns detailed health information of the entity.
     * 
     * @returns {{
     *   current: number,
     *   max: number,
     *   missing: number,
     *   percentage: number
     * }|undefined} Health data or undefined if not available.
     */
    getHealthInfo() {
        const health = this.getComponent('health');
        if (!health) return;

        const current = health.current;
        const max = health.max;
        const missing = max - current;
        const percentage = Math.floor((current / max) * 10000) / 100;

        return { current, max, missing, percentage };
    },

    /**
     * Returns equipped items from a specific slot or all equipment if no slot is given.
     * 
     * Works with any entity that has the "equippable" component.
     * 
     * @param {string} [slot] Optional slot to retrieve ("Mainhand", "Offhand", "Head", "Chest", "Legs", "Feet").
     * @returns {ItemStack|object|undefined} The item in the slot, or an object with all equipment.
     */
    getEquipment(slot) {
        const equip = this.getComponent('equippable');
        if (!equip) return;

        const validSlots = ['Mainhand', 'Offhand', 'Head', 'Chest', 'Legs', 'Feet'];

        if (slot) {
            if (!validSlots.includes(slot)) return;
            return equip.getEquipment(slot) ?? undefined;
        }

        const result = {};
        for (const s of validSlots) {
            result[s] = equip.getEquipment(s) ?? undefined;
        }
        return result;
    },

    /**
     * Sets an item in a specific equipment slot of an entity.
     * 
     * @param {string} slot Slot name to set ("Mainhand", "Offhand", "Head", "Chest", "Legs", "Feet").
     * @param {ItemStack} item The item to equip.
     * @returns {boolean} Whether the operation was successful.
     */
    setEquipment(slot, item) {
        const equip = this.getComponent('equippable');
        if (!equip) return false;

        const validSlots = ['Mainhand', 'Offhand', 'Head', 'Chest', 'Legs', 'Feet'];
        if (!validSlots.includes(slot)) return false;

        try {
            equip.setEquipment(slot, item);
            return true;
        } catch {
            return false;
        }
    },

    /*
     * Finds the first empty slot in an entity's inventory.
     *
     * @returns {number} The index of the first empty slot, or -1 if none.
     */
    findFirstEmptySlot() {
        const invComp = this.getComponent("minecraft:inventory");
        if (!invComp) return -1;

        const container = invComp.container;
        for (let i = 0; i < container.size; i++) {
            if (!container.getItem(i)) return i;
        }
        return -1;
    },

    /**
     * Finds the first empty slot in an entity's inventory and inserts the given item.
     *
     * @param {ItemStack} itemStack - The item to insert.
     * @returns {number} The slot index where the item was inserted, or -1 if none found.
     */
    setInFirstEmptySlot(itemStack) {
        const invComp = this.getComponent("minecraft:inventory");
        if (!invComp) return -1;

        const container = invComp.container;

        for (let i = 0; i < container.size; i++) {
            if (!container.getItem(i)) {
                container.setItem(i, itemStack);
                return i;
            }
        }

        return -1;
    },

    /**
     * Checks if an entity's inventory is completely full.
     *
     * @returns {boolean} True if the inventory has no empty slots, false otherwise.
     */
    isInventoryFull() {
        const invComp = this.getComponent("minecraft:inventory");
        if (!invComp) return false;

        const container = invComp.container;
        return container.emptySlotsCount === 0;
    },

    /**
     * Repairs the item and returns it.
     * @param {ItemStack} item The item to repair.
     * @param {number} amount Amount of durability to restore.
     * @param {number} [slot] Optional slot to apply item into.
     * @returns {ItemStack|null}
     */
    repairItemInSlot(item, amount, slot) {
        const durability = item?.getComponent("minecraft:durability");
        if (!durability) return null;

        durability.damage = Math.max(durability.damage - amount, 0);

        if (typeof slot === "number") {
            const container = this.getComponent("minecraft:inventory")?.container;
            container?.setItem(slot, item);
        }

        return item;
    },

    /**
     * Damages the item and returns it.
     * @param {ItemStack} item The item to damage.
     * @param {number} amount Amount of durability to subtract.
     * @param {number} [slot] Optional slot to apply item into.
     * @returns {ItemStack|null}
     */
    damageItemInSlot(item, amount, slot) {
        const durability = item?.getComponent("minecraft:durability");
        if (!durability) return null;

        durability.damage = Math.min(durability.damage + amount, durability.maxDurability);

        if (typeof slot === "number") {
            const container = this.getComponent("minecraft:inventory")?.container;
            container?.setItem(slot, item);
        }

        return item;
    }
};

// Attach all extensions to Entity.prototype
Object.entries(entityExtensions).forEach(([name, fn]) => {
    if (!Entity.prototype[name]) {
        Entity.prototype[name] = fn
    }
});

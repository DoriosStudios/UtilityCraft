import { system, world, ItemStack, Player, Block, Entity, Container, CommandPermissionLevel, CustomCommandParamType, Dimension } from '@minecraft/server';
const NAMESPACE = 'utilitycraft'

/**
 * ==================================================
 * DoriosAPI - Official Library by Dorios Studios
 * ==================================================
 *
 * This is the official API of **Dorios Studios**, created by Milo504.
 *
 * It serves as the foundation of the UtilityCraft addon and other projects,
 * centralizing common logic and utilities in one place.
 *
 * ## Purpose
 * - Simplifies the registration of custom **block** and **item components**.
 * - Provides **utility functions** (random ranges, string formatting, etc.).
 * - Stores **constants** used across multiple systems (e.g., unbreakable blocks).
 *
 * ## Extensions
 * In addition to this core file, DoriosAPI includes multiple modules
 * where default Minecraft classes are extended with new methods:
 *
 * - **Entity** → extra methods for data handling and interaction.
 * - **Player** → inventory helpers, item giving, stat handling, etc.
 * - **Block** → additional logic for machines and block utilities.
 * - **ItemStack** → simplified manipulation and checks.
 *
 * All extensions were created by **Milo504** with the goal of making
 * development **faster, cleaner, and more consistent**.
 *
 * Contributors are welcome to build upon this API, but credits to
 * **Dorios Studios** and **Milo504** should always remain.
 *
 * ----------------------------------------------------
 * @namespace DoriosAPI
 * @version 1.0.0
 * @author Milo504
 * @studio Dorios Studios
 * @license All Rights Reserved
 * @repository 
 * @docs 
 * @lastUpdate 2025-09-27
 * -----------------------------------------------------
 */
globalThis.DoriosAPI = {
    /**
     * Functions to register custom components into Minecraft registries.
     *
     * Provides helpers to simplify the registration of
     * block and item components, automatically prefixing
     * the identifier with the `"utilitycraft"` namespace.
     *
     * @namespace DoriosAPI.register
     */
    register: {
        /**
         * Registers a custom block component into the block component registry.
         * 
         * Runs only after the world has loaded.
         * 
         * Automatically prefixes the component identifier with the namespace `"utilitycraft"`.
         *
         * @param {string} id Identifier for the component (e.g., "machine" → "utilitycraft:machine").
         * @param {BlockCustomComponent} handlers Lifecycle callbacks for the block.
         */
        blockComponent(id, handlers) {
            system.beforeEvents.startup.subscribe(e => {
                const { blockComponentRegistry } = e;

                blockComponentRegistry.registerCustomComponent(
                    NAMESPACE + ':' + id,
                    handlers
                );
            });
        },

        /**
         * Registers a custom item component into the item component registry.
         * 
         * Runs only after the world has loaded.
         * 
         * Automatically prefixes the component identifier with the namespace `"utilitycraft"`.
         *
         * @param {string} id Identifier for the component (e.g., "weapon" → "utilitycraft:weapon").
         * @param {ItemCustomComponent} handlers Lifecycle callbacks for the item.
         */
        itemComponent(id, handlers) {
            system.beforeEvents.startup.subscribe(e => {
                const { itemComponentRegistry } = e;

                itemComponentRegistry.registerCustomComponent(
                    NAMESPACE + ':' + id,
                    handlers
                );
            });
        }
    },

    /**
     * ==================================================
     * DoriosAPI.containers
     * ==================================================
     *
     * Category: Container & Inventory Compatibility System
     * 
     * This namespace provides a unified interface for all
     * container and inventory interactions in Dorios addons.
     * 
     * It ensures full cross-compatibility between:
     * - Vanilla containers (chests, barrels, furnaces, etc.)
     * - Dorios machines and generators
     * - Custom entities with inventories (e.g., UtilityCraft systems)
     * - Third-party containers (e.g., Dustveyn’s Storage Drawers)
     * 
     * ## Core Responsibilities
     * - Add or insert items into compatible containers.
     * - Transfer items between entities, blocks, or world locations.
     * - Enforce slot restrictions based on type families (avoiding UI or logic slots).
     * - Detect valid inventories at any given world position.
     * 
     * ## Design Notes
     * All inventory operations (transfer, add, range checking)
     * should go through this namespace to maintain consistency.
     * 
     * Functions within this category automatically handle:
     * - Entity vs Block detection.
     * - Family-based slot access rules.
     * - Safe transfers respecting storage limits.
     * - Future integration with fluid or energy container types.
     * 
     * @namespace DoriosAPI.containers
     */

    containers: {
        /**
         * This function was created by **Dorios Studios** to handle
         * item insertions into inventories with compatibility for
         * custom addons and containers.
         *
         * ## Features
         * - Works with **entities**, **blocks** and **containers** as parameters.
         * - Automatically extracts `minecraft:inventory.container` if an
         *   entity is passed instead of a container.
         * - Compatible with multiple addons:
         *   - **Storage Drawers (dustveyn:storage_drawers)**.
         *   - **Dorios containers** (custom entities with inventories).
         *   - **UtilityCraft machines** like Assemblers and Simple Inputs.
         * - Additional compatibility will be added in the future.
         *
         * @function addItem
         * @memberof DoriosAPI
         * @param {Block | Entity | Container} target Target entity, block, or container.
         * @param {ItemStack | String} itemStack Item to insert. Can be an ItemStack or an item identifier string.
         * @param {number} [amount=1] Number of items to insert when `itemStack` is a string. Ignored if an ItemStack is provided.
         * @returns {boolean|number} Whether the item was successfully added or the amount inserted.
         */
        addItem(target, itemStack, amount = 1) {
            if (itemStack == undefined || target == undefined) return false;

            // Normalize itemStack
            if (!(itemStack instanceof ItemStack) && typeof itemStack === 'string')
                itemStack = new ItemStack(itemStack, amount);
            const itemId = itemStack.typeId;

            // Direct container
            if (target.size) {
                target.addItem(itemStack);
                return true;
            }

            // Resolve target inventory
            /** @type {import("@minecraft/server").Container} */
            const targetInv = target?.getComponent?.("minecraft:inventory")?.container;
            if (!targetInv || !target) return false;

            // Vanilla containers
            if (target.permutation && DoriosAPI.constants.vanillaContainers.includes(target.typeId)) {
                targetInv.addItem(itemStack);
                return true;
            }

            // Storage Drawers by Dustveyn
            if (target?.typeId?.includes("dustveyn:storage_drawers")) {
                const targetEnt = target.dimension.getEntitiesAtBlockLocation(target.location)[0];
                if (!targetEnt?.hasTag(itemId)) return false;

                const targetId = targetEnt.scoreboardIdentity;
                let capacity = world.scoreboard.getObjective("capacity").getScore(targetId);
                let max_capacity = world.scoreboard.getObjective("max_capacity").getScore(targetId);

                if (capacity < max_capacity) {
                    const insertAmount = Math.min(itemStack.amount, max_capacity - capacity);
                    targetEnt.runCommandAsync(`scoreboard players add @s capacity ${insertAmount}`);
                    return insertAmount;
                }
                return false;
            }

            const tf = target.getComponent("minecraft:type_family");
            if (!tf) return false;

            const isMachine = tf.hasTypeFamily("dorios:machine");
            const blockedSlots = isMachine
                ? DoriosAPI.containers.getMachineBlockedSlots(target)
                : new Set();

            // ───────────────────────────────
            // Simple Input
            // ───────────────────────────────
            if (tf.hasTypeFamily("dorios:simple_input")) {
                const slotNext = targetInv.getItem(3);
                if (!slotNext) {
                    targetInv.setItem(3, itemStack);
                    return true;
                }
                if (slotNext.typeId === itemId && slotNext.amount < slotNext.maxAmount) {
                    const insertAmount = Math.min(itemStack.amount, slotNext.maxAmount - slotNext.amount);
                    slotNext.amount += insertAmount;
                    targetInv.setItem(3, slotNext);
                    return insertAmount;
                }
                return false;
            }

            // ───────────────────────────────
            // Complex Input (uses getAllowedSlots)
            // ───────────────────────────────
            if (tf.hasTypeFamily("dorios:complex_input")) {
                const [start, end] = DoriosAPI.containers.getAllowedInputRange(target);

                for (let i = start; i <= end; i++) {
                    if (blockedSlots.has(i)) continue;
                    const slotItem = targetInv.getItem(i);

                    // Empty slot → insert directly
                    if (!slotItem) {
                        targetInv.setItem(i, itemStack);
                        return true;
                    }

                    // Same item → try to merge
                    if (slotItem.typeId === itemId && slotItem.amount < slotItem.maxAmount) {
                        const insertAmount = Math.min(itemStack.amount, slotItem.maxAmount - slotItem.amount);
                        slotItem.amount += insertAmount;
                        targetInv.setItem(i, slotItem);
                        return insertAmount;
                    }
                }

                return false;
            }

            // ───────────────────────────────
            // Dorios Container fallback
            // ───────────────────────────────
            if (tf.hasTypeFamily("dorios:container")) {
                if (isMachine) {
                    return DoriosAPI.containers.insertIntoInventory(targetInv, itemStack, blockedSlots);
                }
                targetInv.addItem(itemStack);
                return true;
            }

            return false;
        },

        /**
         * This function was created by **Dorios Studios** to handle
         * item insertions at a specific location with compatibility for
         * custom addons and containers.
         *
         * ## Features
         * - Works with **entities**, **blocks** and **containers** as parameters.
         * - Automatically extracts `minecraft:inventory.container` if an
         *   entity is passed instead of a container.
         * - Compatible with multiple addons:
         *   - **Storage Drawers (dustveyn:storage_drawers)**.
         *   - **Dorios containers** (custom entities with inventories).
         *   - **UtilityCraft machines** like Assemblers and Simple Inputs.
         * - Additional compatibility will be added in the future.
         *
         * @function addItem
         * @memberof DoriosAPI
         * @param {Vector3} loc World coordinates of the target.
         * @param {Dimension} dim Dimension where the target exists.
         * @param {ItemStack | String} itemStack Item to insert. Can be an ItemStack or an item identifier string.
         * @param {number} [amount=1] Number of items to insert when `itemStack` is a string. Ignored if an ItemStack is provided.
         * @returns {boolean} Whether the item was successfully added.
         */
        addItemAt(loc, dim, itemStack, amount = 1) {
            if (!loc || !dim || !itemStack) return false

            let target = null
            try {
                const targetBlock = dim.getBlock(loc)
                if (DoriosAPI.constants.vanillaContainers.includes(targetBlock?.typeId)) {
                    target = targetBlock
                } else {
                    const targetEntity = dim.getEntitiesAtBlockLocation(loc)[0]
                    if (targetEntity) target = targetEntity
                }
            } catch {
                return false
            }

            if (!target) return false
            return this.addItem(target, itemStack, amount)
        },
        /**
         * This function was created by **Dorios Studios** to handle
         * item transfers between inventories in Minecraft Bedrock.
         *
         * ## Features
         * - Works with both **entities** and **containers** as parameters.
         * - Automatically extracts `minecraft:inventory.container` if an
         *   entity is passed instead of a container.
         * - Uses {@link addItemStack} for all target insertions, ensuring
         *   compatibility with Dorios containers, Storage Drawers, and
         *   UtilityCraft machines.
         *
         * ## Parameters
         * - `initial` → Source entity or container.
         * - `target` → Target entity or container.
         * - `range` → Required. Either:
         *   - A single slot number (e.g. `5`)
         *   - An array with `[start, end]` indices (e.g. `[0, 5]`)
         *
         * @function transferItems
         * @memberof DoriosAPI
         * @param {Entity | Block | Container} initial Source entity or container.
         * @param {Entity | Block | Container} target Target entity or container.
         * @param {number | [number, number]} range Slot index or range of slots to transfer.
         */
        transferItems(initial, target, range) {
            /** @type {Container} */
            const sourceInv = initial?.getComponent?.("minecraft:inventory")?.container ?? initial;
            if (!sourceInv) return;

            // Resolve range
            let start, end;
            if (typeof range === "number") {
                start = end = range;
            } else if (Array.isArray(range) && range.length === 2) {
                [start, end] = range;
            } else {
                return; // invalid
            }

            /** @type {EntityTypeFamilyComponent} */
            const tf = target?.getComponent("minecraft:type_family");
            const isMachineTarget = tf?.hasTypeFamily("dorios:machine");
            const isDoriosContainer =
                tf?.hasTypeFamily("dorios:container") &&
                !tf?.hasTypeFamily("dorios:complex_input") &&
                !tf?.hasTypeFamily("dorios:simple_input") &&
                !isMachineTarget;

            for (let slot = start; slot <= end; slot++) {
                let itemToTransfer = sourceInv.getItem(slot);
                if (!itemToTransfer) continue;

                // Vanilla or Dorios container → direct transfer
                if (DoriosAPI.constants.vanillaContainers.includes(target?.typeId) || isDoriosContainer) {
                    /** @type {Container} */
                    const targetInv = target.getComponent("inventory").container;
                    sourceInv.transferItem(slot, targetInv);
                    continue;
                }

                // Try to add to target using addItemStack
                const added = this.addItem(target, itemToTransfer);

                if (added === true) {
                    // Fully transferred → clear slot
                    sourceInv.setItem(slot, undefined);
                } else if (typeof added === "number") {
                    // Partially transferred → reduce stack amount
                    const newAmount = itemToTransfer.amount - added;
                    if (newAmount > 0) {
                        itemToTransfer.amount = newAmount;
                        sourceInv.setItem(slot, itemToTransfer);
                    } else {
                        sourceInv.setItem(slot, undefined);
                    }
                }
            }
        },

        /**
         * This function was created by **Dorios Studios** to handle
         * item transfers between inventories in Minecraft Bedrock.
         *
         * ## Features
         * - Works with both **entities** and **containers** as parameters.
         * - Automatically extracts `minecraft:inventory.container` if an
         *   entity is passed instead of a container.
         * - Uses {@link addItemStack} for all target insertions, ensuring
         *   compatibility with Dorios containers, Storage Drawers, and
         *   UtilityCraft machines.
         *
         * ## Parameters
         * - `initial` → Source entity or container.
         * - `target` → Target entity or container.
         * - `range` → Required. Either:
         *   - A single slot number (e.g. `5`)
         *   - An array with `[start, end]` indices (e.g. `[0, 5]`)
         *
         * @function transferItems
         * @memberof DoriosAPI
         * @param {Entity | Block | Container} initial Source entity or container.
         * @param {Vector3} loc World coordinates of the target.
         * @param {Dimension} dim Dimension where the target exists.
         * @param {number | [number, number]} range Slot index or range of slots to transfer.
         */
        transferItemsAt(initial, loc, dim, range) {
            /** @type {Container} */
            const sourceInv = initial?.getComponent?.("minecraft:inventory")?.container ?? initial;
            if (!sourceInv) return;

            let target = null
            try {
                const targetBlock = dim.getBlock(loc)
                if (DoriosAPI.constants.vanillaContainers.includes(targetBlock?.typeId)) {
                    target = targetBlock
                } else {
                    const targetEntity = dim.getEntitiesAtBlockLocation(loc)[0]
                    if (targetEntity) target = targetEntity
                }
            } catch {
                return false
            }

            if (!target) return false

            // Resolve range
            let start, end;
            if (typeof range === "number") {
                start = end = range;
            } else if (Array.isArray(range) && range.length === 2) {
                [start, end] = range;
            } else {
                return; // invalid
            }

            /** @type {EntityTypeFamilyComponent} */
            const tf = target?.getComponent("minecraft:type_family");
            const isMachineTarget = tf?.hasTypeFamily("dorios:machine");
            const isDoriosContainer = tf?.hasTypeFamily("dorios:container") && !tf?.hasTypeFamily("dorios:complex_input") && !tf?.hasTypeFamily("dorios:simple_input") && !isMachineTarget

            for (let slot = start; slot <= end; slot++) {
                let itemToTransfer = sourceInv.getItem(slot);
                if (!itemToTransfer) continue;

                if (DoriosAPI.constants.vanillaContainers.includes(target?.typeId) || isDoriosContainer) {
                    /** @type {Container} */
                    const targetInv = target.getComponent('inventory').container;
                    sourceInv.transferItem(slot, targetInv);
                    continue;
                }

                // Try to add to target using addItemStack
                const added = this.addItem(target, itemToTransfer);

                if (added === true) {
                    // Fully transferred → clear the slot
                    sourceInv.setItem(slot, undefined);
                } else if (typeof added === 'number') {
                    // Partially transferred → reduce stack amount
                    const newAmount = itemToTransfer.amount - added;
                    if (newAmount > 0) {
                        itemToTransfer.amount = newAmount;
                        sourceInv.setItem(slot, itemToTransfer);
                    } else {
                        sourceInv.setItem(slot, undefined);
                    }
                }
            }

        },
        /**
         * Transfers items between two world locations.
         *
         * ## Features
         * - Works with both blocks and entities at the given positions.
         * - Automatically detects valid inventories using `minecraft:inventory`.
         * - Uses DoriosAPI.containers.addItem() for full compatibility with Dorios containers and vanilla chests.
         *
         * @function transferItemsBetween
         * @memberof DoriosAPI
         * @param {Vector3} fromLoc The source location.
         * @param {Vector3} toLoc The target location.
         * @param {Dimension} dim The dimension where both locations exist.
         * @param {number | [number, number]} range Slot index or range of slots to transfer.
         * @returns {boolean} True if at least one item was transferred.
         */
        transferItemsBetween(fromLoc, toLoc, dim, range) {
            if (!fromLoc || !toLoc || !dim) return false;

            // --- Resolve source ---
            let source = null;
            try {
                const fromBlock = dim.getBlock(fromLoc);
                if (DoriosAPI.constants.vanillaContainers.includes(fromBlock?.typeId)) {
                    source = fromBlock;
                } else {
                    const fromEntity = dim.getEntitiesAtBlockLocation(fromLoc)[0];
                    if (fromEntity) source = fromEntity;
                }
            } catch {
                return false;
            }
            if (!source) return false;

            // --- Resolve target ---
            let target = null;
            try {
                const toBlock = dim.getBlock(toLoc);
                if (DoriosAPI.constants.vanillaContainers.includes(toBlock?.typeId)) {
                    target = toBlock;
                } else {
                    const toEntity = dim.getEntitiesAtBlockLocation(toLoc)[0];
                    if (toEntity) target = toEntity;
                }
            } catch {
                return false;
            }
            if (!target) return false;

            /** @type {Container} */
            const sourceInv = source?.getComponent?.("minecraft:inventory")?.container ?? source;
            if (!sourceInv) return false;

            // Resolve range
            let start, end;
            if (typeof range === "number") {
                start = end = range;
            } else if (Array.isArray(range) && range.length === 2) {
                [start, end] = range;
            } else {
                return false;
            }

            let transferred = false;

            /** @type {EntityTypeFamilyComponent} */
            const tf = target?.getComponent("minecraft:type_family");
            const isMachineTarget = tf?.hasTypeFamily("dorios:machine");
            const isDoriosContainer = tf?.hasTypeFamily("dorios:container")
                && !tf?.hasTypeFamily("dorios:complex_input")
                && !tf?.hasTypeFamily("dorios:simple_input")
                && !isMachineTarget;

            for (let slot = start; slot <= end; slot++) {
                const item = sourceInv.getItem(slot);
                if (!item) continue;

                if (DoriosAPI.constants.vanillaContainers.includes(target?.typeId) || isDoriosContainer) {
                    const targetInv = target.getComponent("minecraft:inventory")?.container;
                    if (targetInv) {
                        const added = sourceInv.transferItem(slot, targetInv);
                        transferred = item.amount - (added?.amount ?? 0);
                        continue;
                    }
                }

                // Fallback → use addItem for Dorios machines and others
                const added = this.addItem(target, item);
                if (added === true) {
                    sourceInv.setItem(slot, undefined);
                    transferred = item.maxAmount;
                } else if (typeof added === "number" && added > 0) {
                    if (item.amount - added <= 0) {
                        sourceInv.setItem(slot,);
                    } else {
                        item.amount -= added
                        sourceInv.setItem(slot, item);
                    }
                    transferred = added;
                }
            }

            return transferred;
        },
        /**
         * Returns a valid container at a specific world location.
         *
         * - Checks both blocks and entities at the given coordinates.
         * - Works with vanilla containers, Dorios machines, and custom entities.
         * - Returns the inventory container (`Container`) if found, otherwise `null`.
         *
         * @function getContainerAt
         * @memberof DoriosAPI.containers
         * @param {Vector3} loc World coordinates to check.
         * @param {Dimension} dim Dimension where the location exists.
         * @returns {import('@minecraft/server').Container|null} The container if found, or null.
         */
        getContainerAt(loc, dim) {
            // Try block container
            const block = dim.getBlock(loc);
            const blockInv = block?.getComponent("minecraft:inventory")?.container;
            if (blockInv) return blockInv;

            // Try entity container
            const ent = dim.getEntitiesAtBlockLocation(loc)[0];
            const tf = ent?.getComponent?.("minecraft:type_family");
            if (!tf?.hasTypeFamily("dorios:container")) return null

            const entInv = ent?.getComponent("minecraft:inventory")?.container;
            if (entInv) return entInv;

            return null;
        },
        /**
         * Returns the allowed slot range for a container entity or block,
         * based on its Dorios family classification.
         *
         * The function ensures transfer systems do not touch UI-only,
         * energy, or progress slots of machines.
         *
         * Combinaciones soportadas explícitamente:
         * - dorios:simple_input      → Only slot 3
         * - dorios:simple_output     → Last slot
         * - dorios:complex_input     → Last 9 slots before output slots
         * - dorios:complex_output    → Last 9 slots
         * - dorios:container         → All
         *
         * @function getAllowedInputRange
         * @memberof DoriosAPI.containers
         * @param {Entity|Block} target Entity or block to analyze.
         * @returns {[number, number]} The [start, end] slot range allowed for transfers.
         */
        getAllowedInputRange(target) {
            if (!target) return [0, 0];
            if (target.size) return [0, target.size - 1];

            const inv = target?.getComponent?.("minecraft:inventory")?.container;
            if (!inv) return [0, 0];

            const tf = target?.getComponent?.("minecraft:type_family");
            const size = inv.size;

            if (!tf) return [0, size - 1];

            const isSimpleInput = tf.hasTypeFamily("dorios:simple_input");
            const isSimpleOutput = tf.hasTypeFamily("dorios:simple_output");
            const isComplexInput = tf.hasTypeFamily("dorios:complex_input");
            const isComplexOutput = tf.hasTypeFamily("dorios:complex_output");
            const isContainer = tf.hasTypeFamily("dorios:container");

            let start = 0;
            let end = size - 1;

            if (isSimpleInput && isSimpleOutput) {
                start = 3;
                end = 3;
            } else if (isSimpleInput && isComplexOutput) {
                start = 3;
                end = Math.max(0, size - 9 - 1);
            } else if (isComplexInput && isSimpleOutput) {
                start = Math.max(0, size - 10);
                end = Math.max(0, size - 2);
            } else if (isComplexInput && isComplexOutput) {
                start = Math.max(0, size - 18);
                end = Math.max(0, size - 10);
            } else if (isContainer) {
                start = 0;
                end = size - 1;
            }

            return [start, end];
        },
        /**
         * Returns the allowed output slot range for a container entity or block,
         * based on its Dorios family classification.
         *
         * The function defines which slots can be extracted by pipes or hoppers.
         *
         * Combinaciones soportadas explícitamente:
         * - dorios:simple_output     → Last slot
         * - dorios:complex_output    → Last 9 slots
         * - dorios:container         → All
         *
         * @function getAllowedOutputRange
         * @memberof DoriosAPI.containers
         * @param {Entity|Block} target Entity or block to analyze.
         * @returns {[number, number]} The [start, end] slot range allowed for output.
         */
        getAllowedOutputRange(target) {
            if (!target) return [0, 0];
            if (target.size) return [0, target.size - 1];

            const inv = target?.getComponent?.("minecraft:inventory")?.container;
            if (!inv) return [0, 0];

            const tf = target?.getComponent?.("minecraft:type_family");
            const size = inv.size;

            if (!tf) return [0, size - 1];

            const isSimpleOutput = tf.hasTypeFamily("dorios:simple_output");
            const isComplexOutput = tf.hasTypeFamily("dorios:complex_output");
            const isContainer = tf.hasTypeFamily("dorios:container");

            let start = 0;
            let end = size - 1;

            if (isSimpleOutput) {
                start = size - 1;
                end = size - 1;
            } else if (isComplexOutput) {
                start = Math.max(0, size - 9);
                end = size - 1;
            } else if (isContainer) {
                start = 0;
                end = size - 1;
            }

            return [start, end];
        },

        /**
         * Builds the slot list that machines must protect from external insertions.
         *
         * Includes:
         * - Upgrade slots (default [4,5])
         * - Output slots (simple or complex) so inputs never clog outputs
         *
         * @param {Entity|Block} target
         * @returns {Set<number>} Slots that cannot accept incoming items.
         */
        getMachineBlockedSlots(target) {
            const blocked = new Set();
            if (!target) return blocked;

            const inv = target?.getComponent?.("minecraft:inventory")?.container;
            if (!inv) return blocked;

            const size = inv.size ?? 0;
            const tf = target?.getComponent?.("minecraft:type_family");
            if (!tf || !tf.hasTypeFamily("dorios:machine")) return blocked;

            const upgradeSlots = DoriosAPI.constants.machineUpgradeSlots ?? [4, 5];
            for (const slot of upgradeSlots) {
                if (typeof slot !== "number") continue;
                if (slot < 0 || slot >= size) continue;
                blocked.add(slot);
            }

            if (tf.hasTypeFamily("dorios:simple_output") || tf.hasTypeFamily("dorios:complex_output")) {
                const [start, end] = DoriosAPI.containers.getAllowedOutputRange(target);
                for (let i = start; i <= end; i++) {
                    if (i < 0 || i >= size) continue;
                    blocked.add(i);
                }
            }

            return blocked;
        },

        /**
         * Inserts an item into the first available slot that is not blocked.
         *
         * Returns `true` for full insertions, `false` when no slot is free,
         * or the amount merged when partially stacked.
         *
         * @param {Container} targetInv
         * @param {ItemStack} itemStack
         * @param {Set<number>} blockedSlots
         * @returns {boolean|number}
         */
        insertIntoInventory(targetInv, itemStack, blockedSlots = new Set()) {
            if (!targetInv || !itemStack) return false;
            const slotsToSkip = blockedSlots ?? new Set();

            for (let i = 0; i < targetInv.size; i++) {
                if (slotsToSkip.has(i)) continue;
                const slotItem = targetInv.getItem(i);
                if (!slotItem) continue;
                if (slotItem.typeId !== itemStack.typeId) continue;
                const space = slotItem.maxAmount - slotItem.amount;
                if (space <= 0) continue;

                const insertAmount = Math.min(itemStack.amount, space);
                slotItem.amount += insertAmount;
                targetInv.setItem(i, slotItem);
                return insertAmount;
            }

            for (let i = 0; i < targetInv.size; i++) {
                if (slotsToSkip.has(i)) continue;
                if (!targetInv.getItem(i)) {
                    targetInv.setItem(i, itemStack);
                    return true;
                }
            }

            return false;
        },
    },


    /**
     * Utility functions provided by Dorios Studios
     * to simplify common development tasks within Minecraft addons.
     *
     * @namespace DoriosAPI.utils
     */
    utils: {
        /**
         * Converts a number of seconds into a formatted time string (mm:ss or hh:mm:ss).
         *
         * - Displays hours only when greater than zero.
         * - Pads minutes and seconds with leading zeros when needed.
         *
         * Example outputs:
         *   formatTimeFull(2083) → "34:43"
         *   formatTimeFull(7265) → "2:01:05"
         *
         * @param {number} seconds Total seconds to convert.
         * @returns {string} Time string formatted as "mm:ss" or "hh:mm:ss".
         */
        formatTimeFull(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        },

        /**
         * Converts seconds into a compact, human-readable duration string.
         *
         * Rules:
         * - Shows at most 2 time units.
         * - Example outputs:
         *   45 s → "45 s"
         *   323 s → "5 m 23 s"
         *   8108 s → "2 h 15 m"
         *   98640 s → "1 d 3 h"
         *
         * @param {number} seconds Total seconds to convert.
         * @returns {string} Compact time string.
         */
        formatTime(seconds) {
            const d = Math.floor(seconds / 86400);
            const h = Math.floor((seconds % 86400) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);

            if (d > 0) {
                return `${d} d${h > 0 ? ` ${h} h` : ''}`; // only days + hours
            }
            if (h > 0) {
                return `${h} h${m > 0 ? ` ${m} m` : ''}`; // only hours + minutes
            }
            if (m > 0) {
                return `${m} m${s > 0 ? ` ${s} s` : ''}`; // only minutes + seconds
            }
            return `${s} s`; // only seconds
        },

        /**
        * Capitalizes the first letter of a string and lowers the rest.
        * 
        * Example:
        *   capitalizeFirst("lava") → "Lava"
        *   capitalizeFirst("LIQUID") → "Liquid"
        * 
        * @param {string} text The text to format.
        * @returns {string} The formatted string with only the first letter capitalized.
        */
        capitalizeFirst(text) {
            return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        },
        /**
         * Wait for a specified number of ticks before executing a callback.
         *
         * @param {number} ticks The number of ticks to wait (20 ticks = 1 second).
         * @param {() => void} callback The function to execute after the delay.
         */
        waitTicks(ticks, callback) {
            system.runTimeout(callback, ticks);
        },

        /**
         * Wait for a specified number of seconds before executing a callback.
         *
         * @param {number} seconds The number of seconds to wait.
         * @param {() => void} callback The function to execute after the delay.
         */
        waitSeconds(seconds, callback) {
            const ticks = Math.floor(seconds * 20);
            system.runTimeout(callback, ticks);
        },
        /**
         * Sends a message to all players in the world.
         * 
         * @param {string} str The message to send.
         */
        msg(str) {
            world.sendMessage(`${str}`);
        },

        /**
         * Sends an action bar message to a player.
         * 
         * @param {Player} player The player to show the message to.
         * @param {string} msg The message to display.
         */
        actionBar(player, msg) {
            if (!player?.onScreenDisplay || typeof msg !== 'string') return;
            try {
                player.onScreenDisplay.setActionBar(msg);
            } catch {
                system.runTimeout(() => {
                    player.onScreenDisplay.setActionBar(msg);
                })
            }
        },
        /**
         * Sends a chat message directly to a player.
         * 
         * @param {Player} player The player to send the message to.
         * @param {string} msg The message to display.
         */
        playerMessage(player, msg) {
            if (!player || typeof msg !== 'string') return;
            try {
                player.sendMessage(msg);
            } catch {
                system.runTimeout(() => {
                    player.sendMessage(msg);
                });
            }
        },

        /**
         * Returns a random integer between min and max, inclusive.
         * 
         * @param {number} min The minimum value (inclusive).
         * @param {number} max The maximum value (inclusive).
         * @returns {number} A random integer between min and max.
         */
        randomInterval(min, max) {
            const minCeiled = Math.ceil(min);
            const maxFloored = Math.floor(max);
            return Math.floor(Math.random() * (maxFloored - minCeiled + 1)) + minCeiled;
        },
        /**
         * Checks if an itemStack is a placeable block by attempting to set it at a dummy location.
         * It uses y = -64 to avoid affecting real structures.
         * 
         * @param {ItemStack} itemStack The item to test.
         * @param {BlockLocation} location Any location (x and z will be used).
         * @param {Dimension} dimension The dimension where the test happens.
         * @returns {boolean} True if the itemStack can be placed as a block, false otherwise.
         */
        isBlock(itemStack, location, dimension) {
            try {
                const testLoc = { x: location.x, y: -64, z: location.z };
                const testBlock = dimension.getBlock(testLoc);
                const originalType = testBlock.typeId;

                testBlock.setType(itemStack.typeId);
                testBlock.setType(originalType); // Restore the original block

                return true;
            } catch {
                return false;
            }
        },

        /**
         * Checks if an itemStack is *not* a block (i.e., is a regular item).
         * It does this by trying to place the item at a dummy location (y = -64).
         * 
         * @param {ItemStack} itemStack The item to test.
         * @param {BlockLocation} location Any location (x and z will be used).
         * @param {Dimension} dimension The dimension where the test happens.
         * @returns {boolean} True if the item is not a block, false if it's placeable.
         */
        isItem(itemStack, location, dimension) {
            try {
                const testLoc = { x: location.x, y: -64, z: location.z };
                const testBlock = dimension.getBlock(testLoc);
                const originalType = testBlock.typeId;

                testBlock.setType(itemStack.typeId);
                testBlock.setType(originalType); // Restore the original block

                return false; // If it can be placed, it's a block
            } catch {
                return true; // If it throws, it's an item
            }
        },
        /**
         * Transforms a namespaced or snake_case identifier into a human-readable title.
         * 
         * Examples:
         *   "minecraft:iron_sword" → "Iron Sword"
         *   "custom_item_name"     → "Custom Item Name"
         * 
         * @param {string} text The identifier to format.
         * @returns {string} The formatted title string.
         */
        formatIdToText(text) {
            const rawName = text.includes(":") ? text.split(":")[1] : text;
            return rawName
                .split("_")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
        },
        /**
         * Prints a formatted JSON object to the player's chat.
         *
         * @param {Entity} player The player to send the message to.
         * @param {string} title A title to show before the JSON.
         * @param {Object} obj The object to stringify and print.
         */
        printJSON(player, title, obj) {
            const formatted = JSON.stringify(obj, null, 2).split("\n");
            player.sendMessage(`§6${title}:`);
            for (const line of formatted) {
                player.sendMessage(`§7${line}`);
            }
        }

    },
    /**
     * Mathematical helper functions provided by Dorios Studios.
     *
     * Includes common math utilities, number formatting,
     * vector calculations, proportional scaling, and
     * Roman numeral conversions.
     *
     * @namespace DoriosAPI.math
     */
    math: {
        /**
         * Clamps a value within a given range.
         *
         * @param {number} val The value to clamp.
         * @param {number} min The minimum allowed value.
         * @param {number} max The maximum allowed value.
         * @returns {number} Clamped value.
         */
        clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        },

        /**
         * Rounds a number to a specified number of decimal places.
         *
         * @param {number} val The value to round.
         * @param {number} decimals Number of decimal places.
         * @returns {number} Rounded number.
         */
        roundTo(val, decimals) {
            const factor = Math.pow(10, decimals);
            return Math.round(val * factor) / factor;
        },

        /**
         * Calculates a clamped proportional value from 0 to the given scale.
         *
         * Useful for visual indicators like progress bars, energy levels, or tiered icons.
         * Converts a current value within a maximum range to a fixed-scale number.
         *
         * Example:
         *   scaleToSetNumber(45, 100, 5, 'floor') → 2
         *   scaleToSetNumber(45, 100, 5, 'normal') → 2.25
         *   scaleToSetNumber(45, 100, 5, 'ceil') → 3
         *
         * @param {number} current The current value (e.g. progress, energy).
         * @param {number} max The maximum possible value (e.g. capacity).
         * @param {number} scale The scale to map to (e.g. 6 for 0–6 icons).
         * @param {'floor' | 'ceil' | 'normal'} [mode='floor'] Rounding mode to apply to the result.
         * @returns {number} A clamped number from 0 to `scale`, rounded according to mode.
         */
        scaleToSetNumber(current, max, scale, mode = 'floor') {
            if (max <= 0) return 0;

            let value = (scale * current) / max;
            if (mode === 'floor') value = Math.floor(value);
            else if (mode === 'ceil') value = Math.ceil(value);

            return Math.max(0, Math.min(scale, value));
        },

        /**
         * Returns a directional vector [x, y, z] based on the block's facing direction.
         * @param {Block} block 
         * @returns {[number, number, number] | null}
         */
        getFacingVector(block) {
            const facing = block.permutation.getState('minecraft:facing_direction');
            switch (facing) {
                case 'up': return [0, 1, 0];
                case 'down': return [0, -1, 0];
                case 'north': return [0, 0, -1];
                case 'south': return [0, 0, 1];
                case 'west': return [-1, 0, 0];
                case 'east': return [1, 0, 0];
                default: return null;
            }
        },
        /**
        * Converts a Roman numeral string to its integer equivalent.
        * 
        * @param {string} str The Roman numeral to convert (e.g., "XIV").
        * @returns {number} The integer representation of the Roman numeral.
        */
        romanToInteger(str) {
            const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
            let total = 0, prev = 0;
            for (let i = str.length - 1; i >= 0; i--) {
                const val = map[str[i]];
                if (val < prev) total -= val;
                else total += val;
                prev = val;
            }
            return total;
        },

        /**
         * Converts an integer to its Roman numeral representation.
         * 
         * @param {number} num The number to convert (must be between 1 and 3999).
         * @returns {string} The Roman numeral string, or an empty string if invalid input.
         */
        integerToRoman(num) {
            if (typeof num !== "number" || num <= 0 || num >= 4000) return "";
            const map = [
                { value: 1000, numeral: "M" },
                { value: 900, numeral: "CM" },
                { value: 500, numeral: "D" },
                { value: 400, numeral: "CD" },
                { value: 100, numeral: "C" },
                { value: 90, numeral: "XC" },
                { value: 50, numeral: "L" },
                { value: 40, numeral: "XL" },
                { value: 10, numeral: "X" },
                { value: 9, numeral: "IX" },
                { value: 5, numeral: "V" },
                { value: 4, numeral: "IV" },
                { value: 1, numeral: "I" },
            ];
            let result = "";
            for (const { value, numeral } of map) {
                while (num >= value) {
                    result += numeral;
                    num -= value;
                }
            }
            return result;
        },

        /**
         * Calculates the distance between two vectors using the Pythagorean theorem.
         * 
         * @param {{ x: number, y: number, z: number }} a First vector.
         * @param {{ x: number, y: number, z: number }} b Second vector.
         * @returns {number} The distance between the two vectors.
         */
        distanceBetween(a, b) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dz = a.z - b.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },

        /**
         * Returns a random number between [min, max], inclusive if mode = "floor".
        * 
        * @param {number} min Minimum value.
        * @param {number} max Maximum value.
        * @param {string} [mode="floor"] How to handle decimals:
        *   - "floor": round down (inclusive of max)
        *   - "round": round to nearest
        *   - "float": return raw decimal
        * @returns {number} Random value
        */
        randomInterval(min, max, mode = "floor") {
            let value;
            if (mode === "floor") {
                value = Math.random() * (max - min + 1) + min; // inclusive max
                return Math.floor(value);
            }

            value = Math.random() * (max - min) + min; // [min, max)
            switch (mode) {
                case "round": return Math.round(value);
                case "float": return value;
                default: return Math.floor(value);
            }
        },
    },
    /**
     * Constants used across Dorios Studios addons.
     *
     * Includes both general Minecraft constants and
     * specific constants defined by Dorios Studios.
     *
     * @namespace DoriosAPI.constants
     */
    constants: {
        /**
            * List of blocks that cannot be broken or replaced by machines.
            * 
            * These blocks are considered unbreakable for safety reasons,
            * game logic, or to avoid exploits. 
            * 
            * Use this array to check against when validating block-breaking
            * operations (e.g., Block Breaker, custom mining systems).
            */
        unbreakableBlocks: [
            "minecraft:allow",
            "minecraft:barrier",
            "minecraft:bedrock",
            "minecraft:border_block",
            "minecraft:deny",
            "minecraft:end_portal_frame",
            "minecraft:end_portal",
            "minecraft:portal",
            "minecraft:reinforced_deepslate",
            "minecraft:command_block",
            "minecraft:chain_command_block",
            "minecraft:repeating_command_block"
        ],
        /**
         * Default inventory slots reserved for UtilityCraft machine upgrades.
         */
        machineUpgradeSlots: [4, 5],
        /**
         * Permission map for custom command registration.
         * 
         * Provides shortcuts for mapping string keys to 
         * CommandPermissionLevel values.
         * 
         * @constant
         */
        permissionMap: {
            any: CommandPermissionLevel.Any,
            host: CommandPermissionLevel.Host,
            owner: CommandPermissionLevel.Owner,
            admin: CommandPermissionLevel.Admin,
            gamedirector: CommandPermissionLevel.GameDirectors,
        },

        /**
         * Type map for custom command parameter definitions.
         * 
         * Provides shortcuts for mapping string keys to 
         * CustomCommandParamType values.
         * 
         * @constant
         */
        typeMap: {
            string: CustomCommandParamType.String,
            int: CustomCommandParamType.Integer,
            float: CustomCommandParamType.Float,
            bool: CustomCommandParamType.Boolean,
            enum: CustomCommandParamType.Enum,
            block: CustomCommandParamType.BlockType,
            item: CustomCommandParamType.ItemType,
            location: CustomCommandParamType.Location,
            target: CustomCommandParamType.EntitySelector,
            entityType: CustomCommandParamType.EntityType,
            player: CustomCommandParamType.PlayerSelector,
        },

        /**
         * Minecraft text formatting codes.
         * 
         * Includes all color codes and style modifiers
         * that can be used in chat, action bar, and UI text.
         * 
         * @constant
         */
        textColors: {
            // Colors
            black: "§0",
            darkBlue: "§1",
            darkGreen: "§2",
            darkAqua: "§3",
            darkRed: "§4",
            darkPurple: "§5",
            gold: "§6",
            gray: "§7",
            darkGray: "§8",
            blue: "§9",
            green: "§a",
            aqua: "§b",
            red: "§c",
            lightPurple: "§d",
            yellow: "§e",
            white: "§f",

            // Styles
            obfuscated: "§k",
            bold: "§l",
            strikethrough: "§m",
            underline: "§n",
            italic: "§o",
            reset: "§r"
        },

        /**
         * Common dimension identifiers with metadata.
         * 
         * @constant
         */
        dimensions: {
            overworld: {
                id: "minecraft:overworld",
                maxY: 320,
                minY: -64
            },
            nether: {
                id: "minecraft:nether",
                maxY: 128,
                minY: 0
            },
            end: {
                id: "minecraft:the_end",
                maxY: 256,
                minY: 0
            }
        },

        /**
         * Time conversion constants in game ticks.
         * 
         * @constant
         */
        time: {
            tick: 1,
            second: 20,
            minute: 1200,
            hour: 72000,
            day: 172800
        },

        /**
         * Equipment slot identifiers for entities/players.
         * Useful with Equippable component.
         * 
         * @constant
         */
        equipmentSlots: {
            mainhand: "Mainhand",
            offhand: "Offhand",
            head: "Head",
            chest: "Chest",
            legs: "Legs",
            feet: "Feet"
        },

        /**
         * List of vanilla container block identifiers.
         * 
         * These represent the default Minecraft blocks
         * that have inventories and can be used as containers.
         * 
         * @constant
         */
        vanillaContainers: [
            "minecraft:chest",
            "minecraft:trapped_chest",
            "minecraft:barrel",
            "minecraft:furnace",
            "minecraft:blast_furnace",
            "minecraft:hopper",
            "minecraft:smoker",
            "minecraft:shulker",
            "minecraft:dropper"
        ],
    }
}


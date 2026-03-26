import { system, world } from "@minecraft/server";
import { FluidStorage, Generator } from "DoriosCore/index.js"

export const scriptEventHandler = {
    /**
     * ScriptEvent handler to destroy a machine at given coordinates.
     * Removes the machine entity, drops stored items, and replaces the block with air.
     */
    "dorios:destroyMachine": ({ message, sourceEntity }) => {
        try {
            const [x, y, z] = message.split(",").map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim,
            };

            const broken = Machine.onDestroy(fakeEvent);

            // Remove block after destruction
            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, "minecraft:air");
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                }
            }, 1);
        } catch (err) {
            console.warn(`[destroyMachine] Error: ${err}`);
        }
    },
    /**
     * Registers input and output slots for special containers
     */
    "dorios:special_container": ({ message, sourceEntity }) => {
        let slots;
        try {
            slots = JSON.parse(message)
        } catch { return }
        if (!slots) return
        if (!slots.input && !slots.output) return
        sourceEntity.setDynamicProperty("dorios:special_container", JSON.stringify(slots))
    },
    /**
     * ScriptEvent handler to destroy a generator at given coordinates.
     * Removes the generator entity, drops stored items, and replaces the block with air.
     */
    "dorios:destroyGenerator": ({ message, sourceEntity }) => {
        try {
            const [x, y, z] = message.split(",").map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim,
            };

            const broken = Generator.onDestroy(fakeEvent);

            // Remove block after destruction
            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, "minecraft:air");
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                }
            }, 1);
        } catch (err) {
            console.warn(`[destroyGenerator] Error: ${err}`);
        }
    },
    /**
     * ScriptEvent handler to destroy a fluid tank at given coordinates.
     * Builds the tank item with fluid lore, removes the entity, sets the block to air, and drops the item.
     */
    "dorios:destroyTank": ({ message, sourceEntity }) => {
        try {
            const [x, y, z] = message.split(",").map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const entity = dim
                .getEntitiesAtBlockLocation(block.location)
                .find((e) => e.typeId.includes("tank"));
            if (!entity) {
                dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                return;
            }

            const fluid = new FluidStorage(entity);
            const blockItemId = block.typeId;
            const blockItem = new ItemStack(blockItemId);
            const lore = [];

            // Fluid lore
            if (fluid.type !== "empty" && fluid.get() > 0) {
                const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
                lore.push(
                    `§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`,
                );
            }
            if (lore.length > 0) blockItem.setLore(lore);

            const dropPos = block.center();

            // Remove entity, clear block, then drop the item
            system.run(() => {
                entity.remove();
                dim.setBlockType(block.location, "minecraft:air");
                dim.spawnItem(blockItem, dropPos);
            });
        } catch (err) {
            console.warn(`[destroyTank] Error: ${err}`);
        }
    },
    /**
     * ScriptEvent receiver: "utilitycraft:register_fluid_item"
     *
     * Allows other addons or scripts to dynamically add or replace
     * fluid-item mappings used by LiquidManager.liquidItem().
     *
     * Expected payload format (JSON):
     * ```json
     * {
     *   "minecraft:lava_bucket": { "amount": 1000, "type": "lava", "output": "minecraft:bucket" },
     *   "custom:water_cell": { "amount": 4000, "type": "water", "output": "custom:empty_cell" }
     * }
     * ```
     *
     * Behavior:
     * - New items are created automatically if missing.
     * - Existing items are replaced and logged individually.
     * - Only a summary log is printed when finished.
     */
    "utilitycraft:register_fluid_item": ({ message }) => {
        try {
            const payload = JSON.parse(message);
            if (!payload || typeof payload !== "object") return;

            let added = 0;
            let replaced = 0;

            for (const [itemId, data] of Object.entries(payload)) {
                if (typeof data.amount !== "number" || typeof data.type !== "string")
                    continue;

                if (FluidStorage.itemFluidStorages[itemId]) {
                    replaced++;
                } else {
                    added++;
                }

                // Direct assignment; LiquidManager uses this data
                FluidStorage.itemFluidStorages[itemId] = data;
            }
        } catch (err) {
            console.warn(
                "[UtilityCraft] Failed to parse fluid-item registration payload:",
                err,
            );
        }
    },
    /**
     * ScriptEvent handler: "utilitycraft:register_fluid_holder"
     *
     * Allows addons or scripts to register or extend fluid extraction holders.
     *
     * Behavior:
     * - If the holder does not exist, it is created.
     * - If the holder already exists, its `types` map is merged.
     * - Existing types are preserved.
     * - `required` is only overwritten if explicitly provided.
     *
     * Expected payload format:
     * {
     *   "item:id": {
     *     types: { fluidType: outputItemId, ... },
     *     required?: number
     *   }
     * }
     */
    "utilitycraft:register_fluid_holder": ({ message }) => {
        try {
            const payload = JSON.parse(message);
            if (!payload || typeof payload !== "object") return;

            for (const [itemId, data] of Object.entries(payload)) {
                if (!data.types || typeof data.types !== "object") continue;

                const existing = FluidStorage.itemFluidHolders[itemId];

                if (existing) {
                    existing.types = {
                        ...existing.types,
                        ...data.types
                    };

                    if (typeof data.required === "number") {
                        existing.required = data.required;
                    }
                } else {
                    if (typeof data.required !== "number") continue;

                    FluidStorage.itemFluidHolders[itemId] = {
                        types: { ...data.types },
                        required: data.required
                    };
                }
            }
        } catch (err) {
            console.warn(
                "[UtilityCraft] Failed to parse fluid-holder registration payload:",
                err
            );
        }
    },
    /**
     * ScriptEvent: "utilitycraft:set_tick_speed"
     *
     * Updates the global tickSpeed value used by UtilityCraft machinery.
     * The payload must be a JSON number (e.g., 1, 5, 10, 20).
     *
     * Behavior:
     * - Replaces the tickSpeed value immediately.
     * - Ignores invalid or non-numeric payloads.
     */
    "utilitycraft:set_tick_speed": ({ message }) => {
        try {
            const value = JSON.parse(message);

            if (typeof value !== "number" || value <= 0) {
                console.warn(`[UtilityCraft] Invalid tickSpeed received: ${message}`);
                return;
            }

            world.setDynamicProperty("utilitycraft:tickSpeed", value);
            globalThis.tickSpeed = value;
        } catch {
            console.warn("[UtilityCraft] Failed to parse tickSpeed payload.");
        }
    }
}
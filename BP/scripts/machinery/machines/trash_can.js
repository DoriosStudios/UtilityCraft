// trash_can.js
import { system, ItemStack, world } from "@minecraft/server";

DoriosAPI.register.blockComponent("trash_can", {
    /**
     * Before placing the block:
     * Spawns the machine entity manually without using the Machine class.
     */
    onPlace(e, { params }) {
        const { block } = e;
        const dim = block.dimension;
        const entityInfo = params.entity;

        // Spawn position (same style as your machines)
        let { x, y, z } = block.center();
        y -= 0.25;

        // Spawn the entity
        const entity = dim.spawnEntity("utilitycraft:machine", { x, y, z });

        // Trigger correct inventory size event
        const invSize = entityInfo.inventory_size ?? 27;
        entity.triggerEvent(`utilitycraft:inventory_${invSize}`);
        entity.triggerEvent(`utilitycraft:simple_container`);

        // Set name
        const name = entityInfo.name ?? "Trash Can";
        entity.nameTag = name;
    },

    /**
     * Every tick: clear the entity inventory completely.
     */
    onTick(e) {
        if (!worldLoaded) return;

        const { block } = e;
        const dim = block.dimension;
        // Get the entity stored in this block location
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (!entity) return;

        const inv = entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        // Clear all items
        for (let i = 0; i < inv.size; i++) {
            inv.setItem(i, undefined);
        }
    },

    /**
     * On break:
     * Remove the entity and do NOT drop contents.
     */
    onPlayerBreak(e) {
        const { block, dimension } = e;
        const entity = dimension.getEntitiesAtBlockLocation(block.location)[0];
        if (entity) entity.remove();
    }
});

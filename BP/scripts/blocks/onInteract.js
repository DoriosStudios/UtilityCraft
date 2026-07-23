import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack } from '@minecraft/server'
import {
    ACCELERATOR_CLOCKS_BY_ENTITY,
    ACCELERATOR_CLOCKS_BY_ITEM,
    findAcceleratorClock,
    getAcceleratorClockFromEntity
} from "../config/acceleratorClocks.js"
import {
    removePedestalAreaOutline,
    showPedestalAreaOutline
} from "./pedestalOutline.js"

/**
 * List of interactable block IDs mapped to custom behavior.
 * Each entry has a `handler` that will run when the player interacts.
 *
 * @type {Record<string, Function>}
 */
const interactHandlers = {
    /**
     * Pedestal interaction handler.
     * - If pedestal has an item → removes the accelerator clock and spawns it as an item.
     * - If pedestal is empty and player holds an accelerator clock → places it on the pedestal.
     * - Uses a custom block state `utilitycraft:hasItem` to track pedestal contents.
     *
     * @param {import("@minecraft/server").Block} block The interacted block
     * @param {import("@minecraft/server").Player} player The player who interacted
     */
    'utilitycraft:pedestal': (block, player) => {
        let { x, y, z } = block.location
        y += 1.2
        x += 0.5
        z += 0.5

        const state = block.permutation.getState('utilitycraft:hasItem')
        const dimension = block.dimension
        const invSlot = player.getComponent('equippable').getEquipment('Mainhand')

        // Remove item from pedestal
        if (state === 1) {
            const clockEntity = findAcceleratorClock(dimension, { x, y, z }, 2)
            const clock = getAcceleratorClockFromEntity(clockEntity)

            if (clockEntity) clockEntity.addTag('despawn')
            removePedestalAreaOutline(block)

            // Gold preserves legacy pedestals whose display entity was lost.
            const itemId = clock?.itemId ?? 'utilitycraft:accelerator_clock'
            dimension.spawnItem(new ItemStack(itemId, 1), { x, y, z })
            block.setPermutation(block.permutation.withState('utilitycraft:hasItem', 0))
            return
        }

        // Add item to pedestal
        const clock = invSlot ? ACCELERATOR_CLOCKS_BY_ITEM[invSlot.typeId] : null
        if (!clock || state !== 0) return

        const existsNearby = dimension.getEntities({
            maxDistance: 5,
            location: { x, y, z }
        }).some(entity => ACCELERATOR_CLOCKS_BY_ENTITY[entity.typeId])

        if (existsNearby) return

        dimension.spawnEntity(clock.entityId, { x, y, z })
        player.runCommand(`clear @s ${clock.itemId} 0 1`)
        block.setPermutation(block.permutation.withState('utilitycraft:hasItem', 1))
        showPedestalAreaOutline(block)
    }
}

/**
 * Register global interact component
 */
DoriosLib.registry.blockComponent('utilitycraft:interact', {
    /**
     * Central interaction handler for all interactable blocks.
     * Delegates behavior to the matching entry in `interactHandlers`.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerInteractEvent} e
     */
    onPlayerInteract(e) {
        const { block, player } = e
        const handler = interactHandlers[block.typeId]
        if (handler) handler(block, player)
    }
})

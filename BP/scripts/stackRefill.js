import { world } from '@minecraft/server'

function findMatchingStack(container, typeId, selectedSlot) {
    for (let slot = 0; slot < container.size; slot++) {
        if (slot === selectedSlot) continue

        const item = container.getItem(slot)
        if (item?.typeId === typeId) return slot
    }

    return -1
}

function refillStack(player, typeId) {
    const selectedSlot = player.selectedSlotIndex
    const container = player.getComponent('minecraft:inventory').container
    const mainhand = container.getItem(selectedSlot)

    if (mainhand) return

    const refillSlot = findMatchingStack(container, typeId, selectedSlot)
    if (refillSlot === -1) return

    container.swapItems(selectedSlot, refillSlot, container)
}

export function stackRefillUse(player, itemId) {
    refillStack(player, itemId)
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
    refillStack(player, block.typeId)
})

world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    refillStack(source, itemStack.typeId)
})

world.afterEvents.itemCompleteUse.subscribe(({ itemStack, source }) => {
    refillStack(source, itemStack.typeId)
})
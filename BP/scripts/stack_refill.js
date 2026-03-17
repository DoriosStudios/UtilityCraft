import { world } from '@minecraft/server'

const STACK_REFILL_PROPERTY = 'utilitycraft:stackRefillEnabled'

function isStackRefillEnabled(player) {
    const storedValue = player?.getDynamicProperty?.(STACK_REFILL_PROPERTY)
    return typeof storedValue === 'boolean' ? storedValue : true
}

function refillMainhandFromInventory(player, itemId) {
    if (!player || !itemId || !isStackRefillEnabled(player)) return

    const mainhandSlot = player.selectedSlotIndex
    const inv = player.getComponent?.('minecraft:inventory')
    if (!inv?.container || typeof mainhandSlot !== 'number') return

    const inventorySize = inv.inventorySize ?? inv.container.size ?? 0

    for (let i = 0; i < inventorySize; i++) {
        const slotItem = inv.container.getItem(i)
        if (!slotItem) continue

        if (slotItem.typeId === itemId) {
            inv.container.swapItems(i, mainhandSlot, inv.container)
            break
        }
    }
}


world.afterEvents.playerPlaceBlock.subscribe((e) => {
    const { player, block } = e
    if (!player || !block) return

    const mainhand = player.getComponent('equippable')?.getEquipment('Mainhand')

    if (mainhand) return

    refillMainhandFromInventory(player, block.typeId)

})

world.afterEvents.itemUse.subscribe((e) => {
    const { source, itemStack } = e
    if (!source || source.typeId !== 'minecraft:player' || !itemStack) return

    const mainhand = source.getComponent('equippable')?.getEquipment('Mainhand')

    if (mainhand) return

    stackRefillUse(source, itemStack.typeId)
})

export function stackRefillUse(player, itemId) {
    refillMainhandFromInventory(player, itemId)
}

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { source, itemStack } = e

    if (!source || source.typeId !== 'minecraft:player' || !itemStack) return

    const mainhand = source.getComponent('equippable')?.getEquipment('Mainhand')

    if (mainhand) return

    refillMainhandFromInventory(source, itemStack.typeId)
})

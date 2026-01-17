import { world } from '@minecraft/server'


world.afterEvents.playerPlaceBlock.subscribe((e) => {
    const { player, block } = e
    const mainhandSlot = player.selectedSlotIndex
    const mainhand = player.getComponent('equippable').getEquipment('Mainhand');
    const inv = player.getComponent('minecraft:inventory')

    if (mainhand) return

    for (let i = 0; i < inv.inventorySize; i++) {
        if (inv.container.getItem(i)) {
            if (inv.container.getItem(i).typeId == block.typeId) {
                inv.container.swapItems(i, mainhandSlot, inv.container)
                break
            }
        }
    }

})

world.afterEvents.itemUse.subscribe((e) => {
    const { source, itemStack } = e
    const mainhand = source.getComponent('equippable').getEquipment('Mainhand');
    if (mainhand) return
    stackRefillUse(source, itemStack.typeId)
})

export function stackRefillUse(player, itemId) {
    const mainhandSlot = player.selectedSlotIndex
    const inv = player.getComponent('minecraft:inventory')
    for (let i = 0; i < inv.inventorySize; i++) {
        if (inv.container.getItem(i)) {
            if (inv.container.getItem(i).typeId == itemId) {
                inv.container.swapItems(i, mainhandSlot, inv.container)
                break
            }
        }
    }
}

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { source, itemStack } = e

    const mainhandSlot = source.selectedSlotIndex
    const mainhand = source.getComponent('equippable').getEquipment('Mainhand');
    const inv = source.getComponent('minecraft:inventory')

    if (mainhand) return

    for (let i = 0; i < inv.inventorySize; i++) {
        if (inv.container.getItem(i)) {
            if (inv.container.getItem(i).typeId == itemStack.typeId) {
                inv.container.swapItems(i, mainhandSlot, inv.container)
                break
            }
        }
    }
})

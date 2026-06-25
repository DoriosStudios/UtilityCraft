import { world, ItemStack, system } from '@minecraft/server'

function getConcreteId(typeId) {
    return typeId?.endsWith('_concrete_powder')
        ? typeId.replace('_concrete_powder', '_concrete')
        : undefined
}

function getMaxConvertible(fillLevel) {
    return fillLevel === 2 || fillLevel === 4 || fillLevel === 6
        ? 2 ** (fillLevel / 2 + 3)
        : 0
}

function getLevelsConsumed(amount) {
    if (amount <= 16) return 2
    if (amount <= 32) return 4
    return 6
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, itemStack, player } = event

    if (block?.typeId !== 'minecraft:cauldron' || !itemStack || !player) return

    const fillLevel = block.permutation.getState('fill_level')
    if (typeof fillLevel !== 'number' || fillLevel < 2) return

    const concreteId = getConcreteId(itemStack.typeId)
    if (!concreteId) return

    const maxConvertible = getMaxConvertible(fillLevel)
    if (!maxConvertible) return

    event.cancel = true

    const selectedSlot = player.selectedSlotIndex
    const location = block.location

    system.run(() => {
        const inventory = player.getComponent('minecraft:inventory')?.container
        const currentItem = inventory?.getItem(selectedSlot)

        if (!inventory || !currentItem || currentItem.typeId !== itemStack.typeId) return

        const toConvert = Math.min(currentItem.amount, maxConvertible)
        if (toConvert <= 0) return

        const leftover = currentItem.amount - toConvert

        inventory.setItem(
            selectedSlot,
            leftover > 0 ? new ItemStack(currentItem.typeId, leftover) : undefined
        )

        const overflow = inventory.addItem(new ItemStack(concreteId, toConvert))
        if (overflow) {
            player.dimension.spawnItem(overflow, {
                x: location.x + 0.5,
                y: location.y + 1,
                z: location.z + 0.5
            })
        }

        player.dimension.playSound('cauldron.adddye', location)

        const cauldronBlock = player.dimension.getBlock(location)
        if (!cauldronBlock || cauldronBlock.typeId !== 'minecraft:cauldron') return

        const nextLevel = Math.max(0, fillLevel - getLevelsConsumed(toConvert))
        cauldronBlock.setPermutation(cauldronBlock.permutation.withState('fill_level', nextLevel))
    })
})
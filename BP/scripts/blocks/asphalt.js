DoriosAPI.register.blockComponent('asphalt', {
    onPlayerInteract({ block, player }) {
        const hand = player.getComponent('equippable').getEquipment('Mainhand')

        if (!hand) return
        try {
            block.setPermutation(block.permutation.withState('utilitycraft:texture', hand.typeId))
        } catch { }
    },
    onStepOn({ entity }) {
        if (entity) entity.runCommand('effect @s speed 2 3 true')
    }
})

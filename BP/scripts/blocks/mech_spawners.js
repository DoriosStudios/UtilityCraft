
import { ModalFormData } from '@minecraft/server-ui'

const mobs = [
    'blaze', 'chicken', 'cow', 'creeper', 'enderman',
    'hoglin', 'magma_cube', 'mooshroom', 'pig', 'sheep',
    'skeleton', 'slime', 'spider', 'wither_skeleton', 'zombie'
]

const essences = [
    'utilitycraft:essence_vessel',
    'utilitycraft:blaze_essence',
    'utilitycraft:chicken_essence',
    'utilitycraft:cow_essence',
    'utilitycraft:creeper_essence',
    'utilitycraft:enderman_essence',
    'utilitycraft:hoglin_essence',
    'utilitycraft:magma_cube_essence',
    'utilitycraft:mooshroom_essence',
    'utilitycraft:pig_essence',
    'utilitycraft:sheep_essence',
    'utilitycraft:skeleton_essence',
    'utilitycraft:slime_essence',
    'utilitycraft:spider_essence',
    'utilitycraft:wither_skeleton_essence',
    'utilitycraft:zombie_essence'
]

const spawnerEntities = [
    'utilitycraft:mechanical_spawner',
    'utilitycraft:mechanical_spawner_blaze',
    'utilitycraft:mechanical_spawner_chicken',
    'utilitycraft:mechanical_spawner_cow',
    'utilitycraft:mechanical_spawner_creeper',
    'utilitycraft:mechanical_spawner_enderman',
    'utilitycraft:mechanical_spawner_hoglin',
    'utilitycraft:mechanical_spawner_magma_cube',
    'utilitycraft:mechanical_spawner_mooshroom',
    'utilitycraft:mechanical_spawner_pig',
    'utilitycraft:mechanical_spawner_sheep',
    'utilitycraft:mechanical_spawner_skeleton',
    'utilitycraft:mechanical_spawner_slime',
    'utilitycraft:mechanical_spawner_spider',
    'utilitycraft:mechanical_spawner_wither_skeleton',
    'utilitycraft:mechanical_spawner_zombie'
]

// ─────────────────────────────
// Mechanical Spawner Component
// ─────────────────────────────
DoriosAPI.register.blockComponent('mech_spawner', {
    /**
     * Handles mob spawning while active
     */
    onTick({ block }) {
        if (!globalThis.worldLoaded) return
        if (!block.getState('utilitycraft:isOn')) return

        const typeIndex = block.getState('utilitycraft:spawnerTypes')
        if (!typeIndex || typeIndex <= 0) return // no essence assigned

        const mobType = mobs[typeIndex - 1]
        if (!mobType) return

        const quantityState = block.getState('utilitycraft:quantity')
        const multiplier = quantityState === 4 ? 3 : quantityState
        const bonusChance = quantityState === 4 ? 25 : 0

        const { x, y, z } = block.location
        const dim = block.dimension
        for (let i = 0; i < multiplier + 1; i++) {
            if (Math.random() * 100 < 60 + bonusChance) {
                const offsetX = Math.random() * 2 - 1
                const offsetZ = Math.random() * 2 - 1
                dim.spawnEntity(`minecraft:${mobType}`, { x: x + offsetX, y: y + 1, z: z + offsetZ })
            }
        }
    },

    /**
     * Handles both essence selection and visual toggle
     */
    onPlayerInteract({ block, player }) {
        const dim = block.dimension
        const typeIndex = block.getState('utilitycraft:spawnerTypes') ?? 0
        const hand = player.getComponent('equippable')?.getEquipment('Mainhand')

        // ────────────────
        // Essence Selection
        // ────────────────
        if (typeIndex === 0) {
            if (!hand) return

            const itemId = hand.typeId
            const index = essences.indexOf(itemId)
            if (index <= 0) return

            const newSpawner = spawnerEntities[index]
            if (!newSpawner) return

            player.runCommand(`clear @s ${itemId} 0 1`)
            block.setState('utilitycraft:spawnerTypes', index)

            const { x, y, z } = block.location
            dim.runCommand(`summon ${newSpawner} ${x + 0.5} ${y + 0.367} ${z + 0.5}`)
            player.sendMessage(`§aAssigned ${mobs[index - 1]} Essence!`)
            return
        }

        // ────────────────
        // Visual Toggle Menu
        // ────────────────
        const isOn = block.getState('utilitycraft:isOn')
        const mobName = mobs[typeIndex - 1] ?? 'Unknown'
        if (hand) return
        const form = new ModalFormData()
            .title(`⚙ Mechanical Spawner`)
            .toggle(`§lPower: ${isOn ? '§aON' : '§cOFF'}`, { defaultValue: isOn })
            .label(`§7Mob Type: §f${mobName}\n§7Click confirm to save changes.`)

        form.show(player).then(result => {
            if (result.canceled || !result.formValues) return
            const [toggleState] = result.formValues
            block.setState('utilitycraft:isOn', toggleState)

            player.sendMessage(toggleState ? '§aSpawner On' : '§cSpawner Off')
        })
    }
})

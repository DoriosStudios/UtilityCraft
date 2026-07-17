import * as DoriosLib from "DoriosLib/index.js";
import { ModalFormData } from '@minecraft/server-ui'

DoriosLib.registry.blockComponent('utilitycraft:fan', {
    /**
     * Opens a modal form when the player interacts with the Fan.
     * Allows toggling the fan state and adjusting its range.
     */
    onPlayerInteract(e) {
        const { block, player } = e
        const hand = player.getComponent('equippable').getEquipment('Mainhand')

        // Only open menu with empty hand and not sneaking
        if (hand || player.isSneaking) return

        const currentRange = DoriosLib.block.getState(block, 'utilitycraft:range')
        const currentState = DoriosLib.block.getState(block, 'utilitycraft:state')
        const currentRangeSel = DoriosLib.block.getState(block, 'utilitycraft:rangeSelected')

        const modal = new ModalFormData()
            .title('Fan Settings')
            .toggle('Off / On', { defaultValue: currentState })
            .slider('Range', 0, 3 + currentRange * 2, { defaultValue: currentRangeSel })

        modal.show(player).then(res => {
            if (!res.formValues) return
            const [state, rangeSelected] = res.formValues
            DoriosLib.block.setState(block, 'utilitycraft:state', state)
            DoriosLib.block.setState(block, 'utilitycraft:rangeSelected', rangeSelected)
        })
    },

    /**
     * Executes every tick.
     * Applies directional knockback to nearby entities within range.
     */
    onTick(e) {
        const { block } = e
        if (!DoriosLib.block.getState(block, 'utilitycraft:state')) return

        const range = DoriosLib.block.getState(block, 'utilitycraft:rangeSelected')
        const maxRange = 3 + DoriosLib.block.getState(block, 'utilitycraft:range') * 2

        if (range > maxRange) {
            DoriosLib.block.setState(block, 'utilitycraft:rangeSelected', 3)
            return
        }

        const dim = block.dimension
        let { x, y, z } = block.location
        let dir = { x: 0, z: 0 }
        let vertical = 0

        switch (DoriosLib.block.getState(block, 'minecraft:facing_direction')) {
            case 'up':
                y -= 1; x += 0.5; z += 0.5
                vertical = -0.25
                break
            case 'down':
                y += 1; x += 0.5; z += 0.5
                vertical = 0.25
                break
            case 'north':
                x += 0.5; z += 1
                dir = { x: 0, z: 0.25 }
                break
            case 'south':
                x += 0.5; z -= 0.5
                dir = { x: 0, z: -0.25 }
                break
            case 'west':
                z += 0.5; x += 1
                dir = { x: 0.25, z: 0 }
                break
            case 'east':
                z += 0.5; x -= 0.5
                dir = { x: -0.25, z: 0 }
                break
        }

        for (let i = 0; i < range; i++) {
            const loc = { x: x + i * Math.sign(dir.x), y: y + i * (vertical !== 0 ? Math.sign(vertical) : 0), z: z + i * Math.sign(dir.z) }
            const targetBlock = dim.getBlock(loc)
            if (targetBlock && targetBlock.typeId !== 'minecraft:air') break

            const entities = dim.getEntitiesAtBlockLocation(loc)
            for (const ent of entities) {
                if (ent.typeId !== 'minecraft:item') {
                    ent.applyKnockback(dir, vertical)
                }
            }
        }
    }
})

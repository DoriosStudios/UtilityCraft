import { world } from '@minecraft/server'

world.afterEvents.entityContainerOpened.subscribe(e => {
    world.sendMessage(`${e.entity.typeId}`)
})
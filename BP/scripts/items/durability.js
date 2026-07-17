import * as DoriosLib from "DoriosLib/index.js";
import { world, ItemStack } from '@minecraft/server'

world.afterEvents.playerBreakBlock.subscribe(({ itemStackAfterBreak, player }) => {
    if (!itemStackAfterBreak) return
    if (!itemStackAfterBreak.typeId.startsWith('utilitycraft:') || itemStackAfterBreak.typeId.includes('mesh')) return
    if (!itemStackAfterBreak.getComponent('durability')) return
    const result = DoriosLib.item.durability.damage(itemStackAfterBreak);
    if (!result.broken) {
        DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: itemStackAfterBreak })
    } else {
        DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: undefined })
        player.playSound('random.break')
    }
})

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
    if (damagingEntity.typeId != 'minecraft:player') return
    const player = damagingEntity
    /** @type {ItemStack} */
    const itemStack = DoriosLib.entity.getEquipment(player, "Mainhand")
    if (!itemStack) return
    if (!itemStack.typeId.startsWith('utilitycraft:') || itemStack.typeId.includes('mesh')) return
    if (!itemStack.getComponent('durability')) return
    const result = DoriosLib.item.durability.damage(itemStack);
    if (!result.broken) {
        DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: itemStack })
    } else {
        DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: undefined })
        player.playSound('random.break')
    }
})


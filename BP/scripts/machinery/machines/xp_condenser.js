import { world, ItemStack } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'
import { FluidManager } from '../DoriosMachinery/core.js'

const tankCaps = {
    'utilitycraft:basic_fluid_tank': 8000,
    'utilitycraft:advanced_fluid_tank': 32000,
    'utilitycraft:expert_fluid_tank': 128000,
    'utilitycraft:ultimate_fluid_tank': 512000
};

function levelToXp(level) {
    let totalXp = 0
    if (level <= 16) {
        totalXp = Math.pow(level, 2) + 6 * level
    } else if (level <= 31) {
        totalXp = (2.5 * Math.pow(level, 2)) - (40.5 * level) + 360
    } else {
        totalXp = (4.5 * Math.pow(level, 2)) - (162.5 * level) + 2220
    }
    if (totalXp < 0) totalXp = 0
    return totalXp;
}

function xpRemove(player, xp) {
    let currentXp = player.getTotalXp()
    currentXp = currentXp - xp
    player.resetLevel()
    player.addExperience(currentXp)
}

function fillTank(entity, pos, xpAmount) {
    let entityInv = entity.getComponent('inventory').container
    let item = entityInv.getItem(pos)
    if (!item) return 0;
    let capacity = tankCaps[item.typeId];

    if (item.getLore().length == 0) {
        if (xpAmount < capacity) {
            item.setLore([
                `§r§7  Xp: ${FluidManager.formatFluid(xpAmount)}/${FluidManager.formatFluid(capacity)}`
            ])
            entityInv.setItem(pos, item)
            return xpAmount;
        } else {
            item.setLore([
                `§r§7  Xp: ${FluidManager.formatFluid(capacity)}/${FluidManager.formatFluid(capacity)}`
            ])
            entityInv.setItem(pos, item)
            return capacity;
        }
    } else {
        let storedXp = parseInt(item.getLore()[0].split(': ')[1].split('mB')[0])
        if (storedXp == capacity) {
            return 0;
        }
        if (xpAmount <= capacity - storedXp) {
            item.setLore([
                `§r§7  Xp: ${FluidManager.formatFluid(xpAmount + storedXp)}/${FluidManager.formatFluid(capacity)}`
            ])
            entityInv.setItem(pos, item)
            return xpAmount;
        } else {
            item.setLore([
                `§r§7  Xp: ${FluidManager.formatFluid(capacity)}/${FluidManager.formatFluid(capacity)}`
            ])
            entityInv.setItem(pos, item)
            return capacity - storedXp;
        }
    }
}

function emptyTank(entity, pos, xpAmount) {
    let entityInv = entity.getComponent('inventory').container
    let item = entityInv.getItem(pos)
    if (!item || item.getLore().length == 0) return 0;
    let capacity = tankCaps[item.typeId];
    let storedXp = parseInt(item.getLore()[0]?.split(': ')[1].split('mB')[0])
    if (storedXp == 0) return 0;
    if (storedXp < xpAmount) {
        item.setLore([
            `§r§7  Xp: ${FluidManager.formatFluid(0)}/${FluidManager.formatFluid(capacity)}`
        ])
        entityInv.setItem(pos, item)
        return storedXp;
    } else {
        item.setLore([
            `§r§7  Xp: ${FluidManager.formatFluid(storedXp - xpAmount)}/${FluidManager.formatFluid(capacity)}`
        ])
        entityInv.setItem(pos, item)
        return xpAmount;
    }


}

function openMenu(player, entity) {
    let menu = new ActionFormData()
    let entityInv = entity.getComponent('inventory').container
    let capacity = 0;
    let storedXp = 0;
    for (let i = 0; i < entityInv.size; i++) {
        capacity += tankCaps[entityInv.getItem(i)?.typeId] || 0
        storedXp += FluidManager.getFluidFromText(entityInv.getItem(i)?.getLore()?.[0] ?? "").amount
    }
    menu.title('Xp Storage')
    menu.body(`${storedXp} `)
    //+ user takes experience points to the machine
    //- user gives experience points to the machine
    menu.button('+Max')
    menu.button('+10')
    menu.button('+1')
    menu.button('-1')
    menu.button('-10')
    menu.button('-Max')
    menu.show(player)
        .then(result => {
            let selection = result.selection
            if (selection == undefined) return;
            let playerLevel = player.level
            let xpGiven = 0;
            let xpRecived = 0;
            switch (selection) {
                case 0:
                    for (let i = 0; i < entityInv.size; i++) {
                        if (entityInv.getItem(i)?.getLore()[0]) {
                            let item = entityInv.getItem(i)
                            player.runCommand(`xp ${FluidManager.getFluidFromText(entityInv.getItem(i)?.getLore()?.[0] ?? "").amount}`)
                            entityInv.setItem(i, new ItemStack(item.typeId))
                        }
                    }
                    break;

                case 1:
                    xpRecived = Math.min(
                        storedXp,
                        levelToXp(playerLevel + 10) - levelToXp(playerLevel)
                    )
                    player.runCommand(`xp ${xpRecived}`)
                    for (let i = 0; i < entityInv.size && xpRecived != 0; i++) {
                        xpRecived -= emptyTank(entity, i, xpRecived)
                    }
                    break;

                case 2:
                    xpRecived = Math.min(
                        storedXp,
                        levelToXp(playerLevel + 1) - levelToXp(playerLevel)
                    )
                    player.runCommand(`xp ${xpRecived}`)
                    for (let i = 0; i < entityInv.size && xpRecived != 0; i++) {
                        xpRecived -= emptyTank(entity, i, xpRecived)
                    }
                    break;

                case 3:
                    xpGiven = Math.min(
                        player.getTotalXp(),
                        (levelToXp(playerLevel) - levelToXp(playerLevel - 1)) >= 0 ? (levelToXp(playerLevel) - levelToXp(playerLevel - 1)) : Infinity,
                        capacity - storedXp
                    )
                    xpRemove(player, xpGiven)
                    for (let i = 0; i < entityInv.size && xpGiven != 0; i++) {
                        xpGiven -= fillTank(entity, i, xpGiven)
                    }
                    break;

                case 4:
                    xpGiven = Math.min(
                        player.getTotalXp(),
                        (levelToXp(playerLevel) - levelToXp(playerLevel - 10)) >= 0 ? (levelToXp(playerLevel) - levelToXp(playerLevel - 10)) : Infinity,
                        capacity - storedXp
                    )
                    xpRemove(player, xpGiven)
                    for (let i = 0; i < entityInv.size && xpGiven != 0; i++) {
                        xpGiven -= fillTank(entity, i, xpGiven)
                    }
                    break;

                case 5:
                    xpGiven = Math.min(
                        player.getTotalXp(),
                        capacity - storedXp
                    )
                    xpRemove(player, xpGiven)
                    for (let i = 0; i < entityInv.size && xpGiven != 0; i++) {
                        xpGiven -= fillTank(entity, i, xpGiven)
                    }
                    break;

                default:
                    player.onScreenDisplay.setActionBar('§4Something Went Wrong')
            }
            openMenu(player, entity)
        })
}

function tankMenu(player, entity) {
    let menu = new ActionFormData()
    let entityInv = entity.getComponent('inventory').container
    menu.title('Tanks')
    for (let i = 0; i < entityInv.size; i++) {
        if (entityInv.getItem(i)) {
            menu.button(`Amount: ${FluidManager.getFluidFromText(entityInv.getItem(i)?.getLore()?.[0] ?? "").amount}`/*, 'textures/ui/milo.png'*/)
        } else {
            menu.button('Empty')
        }
    }
    menu.show(player)
        .then(result => {
            let selection = result.selection
            if (selection == undefined) return;
            let item = entityInv.getItem(selection)
            entity.getComponent('inventory').container.setItem(selection,)
            player.getComponent('inventory').container.addItem(item || new ItemStack('air'))

            tankMenu(player, entity)
        })
}


DoriosAPI.register.blockComponent('xp_condenser', {
    onPlayerInteract(e) {
        const { player, block } = e
        let { x, y, z } = block.location
        const item = player.getComponent('equippable').getEquipment('Mainhand')
        let entity = block.dimension.getEntities({
            tags: [`${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)} `]
        })[0]
        if (player.isSneaking) {
            tankMenu(player, entity)
            return;
        }
        if (item?.typeId.endsWith('fluid_tank')) {
            let item = player.getComponent('equippable').getEquipment('Mainhand')
            let lores = item.getLore()
            const fluid = FluidManager.getFluidFromText(item?.getLore()?.[0] ?? "")
            if (fluid.type == 'xp') {
                let newItem = player.getComponent('equippable').getEquipment('Mainhand')
                newItem.amount = 1
                for (let i = 0; i < entity.getComponent('inventory').container.size; i++) {
                    if (!entity.getComponent('inventory').container.getItem(i)) {
                        entity.getComponent('inventory').container.setItem(i, newItem)
                        if (item.amount == 1) {
                            player.getComponent('equippable').setEquipment('Mainhand',)
                        } else {
                            item.amount--
                            player.getComponent('equippable').setEquipment('Mainhand', item)
                        }
                        break;
                    }
                }

            }
            return;
        }
        openMenu(player, entity)
    },
    onPlace(e) {
        const { block } = e
        let { x, y, z } = block.location
        x += 0.5; y += 0.25; z += 0.5
        let entity = block.dimension.spawnEntity('utilitycraft:xp_condenser', { x, y, z })
        entity.addTag(`${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)} `)
    },
    onPlayerBreak(e) {
        const { block } = e
        let { x, y, z } = block.location
        let entity = block.dimension.getEntities({
            tags: [`${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)} `]
        })[0]
        let entityInv = entity.getComponent('inventory').container
        for (let i = 0; i < entityInv.size; i++) {
            let item = entityInv.getItem(i);
            if (!item) continue;
            block.dimension.spawnItem(item, block.location)
        }
        entity.remove()
    }
})


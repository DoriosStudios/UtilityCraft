import * as DoriosLib from "DoriosLib/index.js";
import { world, system, ItemStack } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'

let basesDimension

world.afterEvents.worldLoad.subscribe(() => {
    basesDimension = world.getDimension('overworld')
    world.getDimension('overworld').runCommand('tickingarea add 0 0 0 0 0 0 dorios')
})


DoriosLib.registry.blockComponent('utilitycraft:computer', {
    onPlayerInteract(e) {
        const { player, block } = e
        let mainHand = player.getComponent('equippable').getEquipment('Mainhand')
        let entity = basesDimension.getEntities({ tags: [`id: @${block.location.x} ${block.location.y} ${block.location.z}@ ${block.dimension.id}`] })[0]
        let discountLevel = block.permutation.getState('utilitycraft:price')
        let discount = discountLevel * (5 + (5 * (-3 + discountLevel) * discountLevel) / (-1 + 2 * discountLevel))
        if (entity == undefined) {
            return;
        }
        if (mainHand == undefined) {
            computerMenu(player, entity, discount)
            return;
        }
        let item = mainHand.typeId
        if (item != 'utilitycraft:way_chip') {
            computerMenu(player, entity, discount)
        } else {
            let loreArray = mainHand.getLore()
            if (loreArray.length == 0) {
                player.onScreenDisplay.setActionBar('§4This chip does not have a carpet')
                return;
            }
            let maxDistance = (block.permutation.getState('utilitycraft:range') != 5) ? (-5000 * (block.permutation.getState('utilitycraft:range') + 1)) / ((block.permutation.getState('utilitycraft:range') + 1) - 6) : Infinity
            if (findCarpet(loreArray[1], loreArray[2]) || maxDistance < getDistance(mainHand.getLore(), block)) {
                if (maxDistance < getDistance(mainHand.getLore(), block)) {
                    player.onScreenDisplay.setActionBar('§4Not within range')
                } else {
                    player.onScreenDisplay.setActionBar('§4Way carpet already registered')
                }
                return;
            } else {
                player.runCommand(`clear @s ${item} 0 1`)
                player.onScreenDisplay.setActionBar('§2Successfully registered')
                entity.addTag(`${loreArray}`)
            }
        }

    },
    onPlace(e) {
        const { block } = e
        let location = block.location
        block.dimension.runCommand(`summon utilitycraft:waycenter ${location.x} ${location.y} ${location.z}`)
        let entity = block.dimension.getEntitiesAtBlockLocation(location)[0]
        entity.addTag(`id: @${block.location.x} ${block.location.y} ${block.location.z}@ ${block.dimension.id}`)
        entity.runCommand('execute in overworld run tp @s 0 0 0')
    },
    onPlayerBreak(e) {
        const { block } = e
        let entity = basesDimension.getEntities({ tags: [`id: @${block.location.x} ${block.location.y} ${block.location.z}@ ${block.dimension.id}`] })[0]
        let tags = entity.getTags()
        for (let i = 1; i < tags.length; i++) {
            let tagsArr = tags[i];
            let data = tagsArr.split(',')
            let item = new ItemStack('utilitycraft:way_chip', 1)
            item.setLore([
                `${data[0]}`,
                `${data[1]}`,
                `${data[2]}`
            ])
            block.dimension.spawnItem(item, block.location)
        }
        entity.remove()
    }
})

DoriosLib.registry.blockComponent('utilitycraft:carpet', {
    onPlayerInteract(e) {
        const { player, block } = e
        let mainHand = player.getComponent('equippable').getEquipment('Mainhand')
        if (mainHand == undefined) {
            tpToComputer(block, player)
            return;
        }
        mainHand = mainHand.typeId
        if (mainHand != 'utilitycraft:way_chip') {
            tpToComputer(block, player)
            return;
        } else {
            chipName(player, block)
        }
    },
    onPlayerBreak(e) {
        const { block } = e
        deleteCarpet(block.location)
    }
})

function getDistance(itemLore, block) {
    let pcLocation = `${block.location.x} ${block.location.y} ${block.location.z}`.split(' ')
    let pcDimension = block.dimension.id
    let carpetLocation = itemLore[1].split(' ')
    let carpetDimension = itemLore[2]

    let x1 = pcLocation[0]; let y1 = pcLocation[1]; let z1 = pcLocation[2]
    let x2 = carpetLocation[0]; let y2 = carpetLocation[1]; let z2 = carpetLocation[2]
    let distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2) + Math.pow((z2 - z1), 2))

    if (pcDimension == carpetDimension) {
        return distance
    } else {
        distance *= 8
        return distance
    }
}

function deleteCarpet(location) {
    let entities = basesDimension.getEntities({ type: 'utilitycraft:waycenter' })
    let { x, y, z } = location
    for (let entity of entities) {
        for (let i = 1; i < entity.getTags().length; i++) {
            let tags = entity.getTags()[i].split(',')
            if (`${x} ${y} ${z}` == tags[1]) {
                entity.removeTag(entity.getTags()[i])
                return;
            }
        }
    }
    return false;
}

function findCarpet(itemCoord, itemDimension) {
    let entities = basesDimension.getEntities({ type: 'utilitycraft:waycenter' })
    for (let entity of entities) {
        for (let i = 1; i < entity.getTags().length; i++) {
            let tags = entity.getTags()[i].split(',')
            if (tags[1] == itemCoord && tags[2] == itemDimension) {
                return true;
            }
        }
    }
    return false;
}

function tpToComputer(block, player) {
    let entities = basesDimension.getEntities({ type: 'utilitycraft:waycenter' })
    let { x, y, z } = block.location
    for (let entity of entities) {
        for (let i = 1; i < entity.getTags().length; i++) {
            let tags = entity.getTags()[i].split(',')
            if (`${x} ${y} ${z}` == tags[1]) {
                let tag = entity.getTags()[0]
                let pcLocation = tag.split('@')[1]
                let pcDimension = tag.split('@')[2].slice(11)
                let coordsArray = pcLocation.split(' ')
                let coords = `${parseInt(coordsArray[0]) - 1} ${parseInt(coordsArray[1]) + 1} ${coordsArray[2]}`
                player.runCommand(`execute in ${pcDimension} run tp @s ${coords}`)
                return;
            }
        }
    }
    return false;
}

function chipName(player, block) {
    const modalForm = new ModalFormData().title('Chip Title')
    let mainHand = player.getComponent('equippable').getEquipment('Mainhand')
    if (mainHand == undefined) {
        return;
    } else {
        let itemLore = mainHand.getLore()
        if (itemLore.length == 0) {
            modalForm.textField('Chip title', 'Way Carpet Name')
        } else {
            modalForm.textField('Chip title', 'Way Carpet Name', `${itemLore[0]}`)
        }
    }
    modalForm.show(player)
        .then(data => {
            if (data.formValues != undefined) {
                if (data.formValues[0].includes(',')) {
                    player.onScreenDisplay.setActionBar('§4Commas are not allowed')
                    return;
                }
                if (data.formValues[0] == '') {
                    let item = player.getComponent('equippable').getEquipment('Mainhand')
                    item.setLore([
                        `Way Carpet`,
                        `${block.location.x + ' ' + (block.location.y) + ' ' + block.location.z}`,
                        `${block.dimension.id}`
                    ])
                    player.getComponent('minecraft:inventory').container.setItem(player.selectedSlotIndex, item)
                } else {
                    let item = player.getComponent('equippable').getEquipment('Mainhand')
                    item.setLore([
                        `${data.formValues[0]}`,
                        `${block.location.x + ' ' + (block.location.y) + ' ' + block.location.z}`,
                        `${block.dimension.id}`
                    ])
                    player.getComponent('minecraft:inventory').container.setItem(player.selectedSlotIndex, item)
                }
            }
        })
}

function computerMenu(player, entity, discount) {
    const actionForm = new ActionFormData().title('Way Computer')
    if (entity.getTags().length == 1) {
        actionForm.body('You dont have way chips')
        actionForm.button('submit')
        actionForm.show(player)
        return;
    }
    for (let i = 1; i < entity.getTags().length; i++) {
        let tags = entity.getTags()[i].split(',')
        actionForm.button(`${tags[0]} ${getPrice(entity, i, discount)}`, `textures/ui/${tags[2].slice(10)}`)
    }
    actionForm.show(player)
        .then(data => {
            if (data.selection == undefined) {
                return;
            }
            let tag = entity.getTags()[data.selection + 1]
            let tagArray = tag.split(',')
            let tpLocation = tagArray[1]
            let tpDimension = tagArray[2]
            let tpCoordsArray = tpLocation.split(' ')
            let tpCoords = `${tpCoordsArray[0]} ${parseInt(tpCoordsArray[1]) + 0.125} ${tpCoordsArray[2]}`
            let price = getPrice(entity, data.selection + 1, discount)
            if (player.level < price) {
                player.onScreenDisplay.setActionBar(`§4Not enough level`)
            } else {
                player.addLevels(parseInt(`-${price}`))
                player.runCommand(`execute in ${tpDimension.slice(10)} run tp @s ${tpCoords}`)
                let playerLocation = player.location
                system.runTimeout(() => {
                    let block = world.getDimension(`${tpDimension}`).getBlock(playerLocation)
                    if (block == undefined) {
                        return;
                    }
                    if (block.typeId != 'utilitycraft:way_carpet') {
                        (block.location)
                    }
                }, 100)
            }
        })
}

function getPrice(entity, selection, discount) {
    let tag = entity.getTags()[selection]
    let tagArray = tag.split(',')
    let tpLocation = tagArray[1]
    let tpDimension = tagArray[2]
    let originCoords = entity.getTags()[0].split('@')[1].split(' ')
    let originDimension = entity.getTags()[0].split('@')[2].slice(1)
    let destinationCoords = tpLocation.split(' ')
    let x1 = originCoords[0]; let y1 = originCoords[1]; let z1 = originCoords[2]
    let x2 = destinationCoords[0]; let y2 = destinationCoords[1]; let z2 = destinationCoords[2]
    let distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2) + Math.pow((z2 - z1), 2))
    if (originDimension != tpDimension) {
        distance *= 8
    }
    let price = (((distance < 10000) ? Math.floor(distance / 1000) : 10 + Math.floor((distance) / 10000)) + (Number(tpDimension.includes('the_end')) * 5) + (Number(tpDimension.includes('nether')) * 2)) * ((100 - discount) / 100)
    return price;
}
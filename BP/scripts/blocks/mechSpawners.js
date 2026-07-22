import * as DoriosLib from "DoriosLib/index.js";

import { ItemStack, system, world } from '@minecraft/server'
import { ModalFormData } from '@minecraft/server-ui'

const SWAP_CONFIRM_WINDOW_TICKS = 50
const SPAWNER_STORAGE_PREFIX = 'utilitycraft:mechanical_spawner:'
const ESSENCE_LORE_PREFIX = '§r§7  Essence: '
const MESSAGE_USE_BOTTLE_KEY = 'message.utilitycraft.spawner.use_empty_bottle'
const MESSAGE_SWAP_CONFIRM_KEY = 'message.utilitycraft.spawner.swap_confirm'

const pendingSwapByPlayerAndBlock = new Map()
const pendingPlacementEssence = new Map()

const spawners = Object.freeze([
    { displayName: 'Blaze', essence: 'utilitycraft:blaze_essence', spawnTable: [{ typeId: 'minecraft:blaze', weight: 100 }] },
    { displayName: 'Chicken', essence: 'utilitycraft:chicken_essence', spawnTable: [{ typeId: 'minecraft:chicken', weight: 100 }] },
    { displayName: 'Cow', essence: 'utilitycraft:cow_essence', spawnTable: [{ typeId: 'minecraft:cow', weight: 100 }] },
    { displayName: 'Creeper', essence: 'utilitycraft:creeper_essence', spawnTable: [{ typeId: 'minecraft:creeper', weight: 100 }] },
    { displayName: 'Enderman', essence: 'utilitycraft:enderman_essence', spawnTable: [{ typeId: 'minecraft:enderman', weight: 100 }] },
    { displayName: 'Hoglin', essence: 'utilitycraft:hoglin_essence', spawnTable: [{ typeId: 'minecraft:hoglin', weight: 100 }] },
    { displayName: 'Magma Cube', essence: 'utilitycraft:magma_cube_essence', spawnTable: [{ typeId: 'minecraft:magma_cube', weight: 100 }] },
    { displayName: 'Mooshroom', essence: 'utilitycraft:mooshroom_essence', spawnTable: [{ typeId: 'minecraft:mooshroom', weight: 100 }] },
    { displayName: 'Pig', essence: 'utilitycraft:pig_essence', spawnTable: [{ typeId: 'minecraft:pig', weight: 100 }] },
    { displayName: 'Sheep', essence: 'utilitycraft:sheep_essence', spawnTable: [{ typeId: 'minecraft:sheep', weight: 100 }] },
    { displayName: 'Skeleton', essence: 'utilitycraft:skeleton_essence', spawnTable: [{ typeId: 'minecraft:skeleton', weight: 100 }] },
    { displayName: 'Slime', essence: 'utilitycraft:slime_essence', spawnTable: [{ typeId: 'minecraft:slime', weight: 100 }] },
    { displayName: 'Spider', essence: 'utilitycraft:spider_essence', spawnTable: [{ typeId: 'minecraft:spider', weight: 100 }] },
    { displayName: 'Wither Skeleton', essence: 'utilitycraft:wither_skeleton_essence', spawnTable: [{ typeId: 'minecraft:wither_skeleton', weight: 100 }] },
    { displayName: 'Zombie', essence: 'utilitycraft:zombie_essence', spawnTable: [{ typeId: 'minecraft:zombie', weight: 100 }] },
    { displayName: 'Guardian', essence: 'utilitycraft:guardian_essence', spawnTable: [{ typeId: 'minecraft:guardian', weight: 100 }] },
    { displayName: 'Piglin', essence: 'utilitycraft:piglin_essence', spawnTable: [{ typeId: 'minecraft:piglin', weight: 100 }] },
    {
        displayName: 'Illager',
        essence: 'utilitycraft:illager_essence',
        spawnTable: [
            { typeId: 'minecraft:pillager', weight: 45 },
            { typeId: 'minecraft:vindicator', weight: 35 },
            { typeId: 'minecraft:witch', weight: 15 },
            { typeId: 'minecraft:evoker', weight: 1 }
        ]
    }
])

const legacyFallback = Object.freeze([
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
    'utilitycraft:mechanical_spawner_witch',
    'utilitycraft:mechanical_spawner_wither_skeleton',
    'utilitycraft:mechanical_spawner_zombie'
])

const ESSENCE_TO_STATE_INDEX = new Map(
    spawners.map((variant, index) => [variant.essence, index + 1])
)

const SPAWNER_TYPE_SLOTS_PER_BANK = 9
const SPAWNER_TYPE_STATE = 'utilitycraft:spawner_type'
const SPAWNER_BANK_STATE = 'utilitycraft:spawner_bank'

function getCurrentTick() {
    const systemTick = Number(system.currentTick)
    if (Number.isFinite(systemTick)) return systemTick
    return Number(globalThis.tickCount ?? 0)
}

function getStorageKeyFromLocation(dimension, location) {
    const x = Math.floor(location.x)
    const y = Math.floor(location.y)
    const z = Math.floor(location.z)
    return `${SPAWNER_STORAGE_PREFIX}${dimension.id}:${x},${y},${z}`
}

function getStorageKey(block) {
    return getStorageKeyFromLocation(block.dimension, block.location)
}

function getStoredEssence(block) {
    const stored = world.getDynamicProperty(getStorageKey(block))
    if (typeof stored !== 'string') return undefined
    return ESSENCE_TO_STATE_INDEX.has(stored) ? stored : undefined
}

function setStoredEssence(block, essenceId) {
    const key = getStorageKey(block)
    if (!essenceId || !ESSENCE_TO_STATE_INDEX.has(essenceId)) {
        world.setDynamicProperty(key, undefined)
        return
    }

    world.setDynamicProperty(key, essenceId)
}

function getStoredOrLegacyEssence(block) {
    const stored = getStoredEssence(block)
    if (stored) return stored

    const legacyTypeIndex = getSpawnerTypeIndex(block)
    const legacyVariant = getVariantByState(legacyTypeIndex)
    if (!legacyVariant?.essence) return undefined

    setStoredEssence(block, legacyVariant.essence)
    return legacyVariant.essence
}

function syncTypeStatesFromEssence(block, essenceId) {
    const expectedTypeIndex = essenceId ? (ESSENCE_TO_STATE_INDEX.get(essenceId) ?? 0) : 0
    if (getSpawnerTypeIndex(block) !== expectedTypeIndex) {
        setSpawnerTypeIndex(block, expectedTypeIndex)
    }
    return expectedTypeIndex
}

function clearStoredEssence(block) {
    world.setDynamicProperty(getStorageKey(block), undefined)
}

function sendLocalizedMessage(player, key) {
    player.sendMessage({
        rawtext: [{ translate: key }]
    })
}

function consumeMainHandItem(player, expectedTypeId, amount = 1) {
    if (DoriosLib.player.isCreative(player)) return true

    const equippable = player.getComponent('equippable')
    const mainHand = equippable?.getEquipment('Mainhand')
    if (!mainHand || mainHand.typeId !== expectedTypeId || mainHand.amount < amount) return false

    if (mainHand.amount === amount) {
        equippable.setEquipment('Mainhand')
        return true
    }

    const nextStack = mainHand.clone()
    nextStack.amount -= amount
    equippable.setEquipment('Mainhand', nextStack)
    return true
}

function giveItemToPlayerOrDrop(player, itemStack, block) {
    const inventory = player.getComponent('inventory')?.container
    const leftover = inventory?.addItem(itemStack)
    if (leftover) {
        block.dimension.spawnItem(leftover, block.center())
    }
}

function clearSpawnerEssence(block) {
    clearStoredEssence(block)
    setSpawnerTypeIndex(block, 0)
    clearLegacySpawnerDisplayEntities(block.dimension, block.location)
}

function setSpawnerEssence(block, essenceId) {
    const typeIndex = ESSENCE_TO_STATE_INDEX.get(essenceId)
    if (!typeIndex) return false

    setStoredEssence(block, essenceId)
    setSpawnerTypeIndex(block, typeIndex)
    clearLegacySpawnerDisplayEntities(block.dimension, block.location)
    return true
}

function getEssenceFromLore(itemStack) {
    const lore = itemStack?.getLore?.() ?? []

    for (const line of lore) {
        const cleanLine = String(line).replace(/§./g, '')
        const match = cleanLine.match(/Essence:\s*([a-z0-9_:\-.]+)/i)
        if (!match) continue

        const essenceId = match[1]
        if (ESSENCE_TO_STATE_INDEX.has(essenceId)) return essenceId
    }

    return undefined
}

function cleanupSwapConfirmationForStorageKey(storageKey) {
    for (const confirmKey of pendingSwapByPlayerAndBlock.keys()) {
        if (confirmKey.endsWith(`|${storageKey}`)) {
            pendingSwapByPlayerAndBlock.delete(confirmKey)
        }
    }
}

function getVariantByState(typeIndex) {
    if (!typeIndex || typeIndex <= 0) return null
    return spawners[typeIndex - 1] ?? null
}

function getSpawnerTypeIndex(block) {
    const typeState = DoriosLib.block.getState(block, SPAWNER_TYPE_STATE)
    const bankState = DoriosLib.block.getState(block, SPAWNER_BANK_STATE)

    if (typeState !== undefined && bankState !== undefined) {
        const slot = Math.max(0, Math.min(SPAWNER_TYPE_SLOTS_PER_BANK, Math.floor(Number(typeState) || 0)))
        const bank = Math.max(0, Math.min(1, Math.floor(Number(bankState) || 0)))
        if (slot === 0) return 0

        const typeIndex = bank * SPAWNER_TYPE_SLOTS_PER_BANK + slot
        return typeIndex <= spawners.length ? typeIndex : 0
    }

    // Read the former state layout when running against a legacy permutation.
    const legacyType1 = Number(DoriosLib.block.getState(block, 'utilitycraft:spawnerTypes1') ?? 0)
    const legacyType2 = Number(DoriosLib.block.getState(block, 'utilitycraft:spawnerTypes2') ?? 0)
    if (legacyType2 > 0) return 15 + legacyType2
    if (legacyType1 > 0) return legacyType1
    return 0
}

function setSpawnerTypeIndex(block, typeIndex) {
    if (!typeIndex || typeIndex <= 0) {
        DoriosLib.block.setState(block, SPAWNER_BANK_STATE, 0)
        DoriosLib.block.setState(block, SPAWNER_TYPE_STATE, 0)
        return
    }

    const normalizedTypeIndex = Math.max(1, Math.min(spawners.length, Math.floor(Number(typeIndex) || 1)))
    const bank = normalizedTypeIndex > SPAWNER_TYPE_SLOTS_PER_BANK ? 1 : 0
    const slot = bank
        ? normalizedTypeIndex - SPAWNER_TYPE_SLOTS_PER_BANK
        : normalizedTypeIndex

    DoriosLib.block.setState(block, SPAWNER_BANK_STATE, bank)
    DoriosLib.block.setState(block, SPAWNER_TYPE_STATE, slot)
}

function chooseWeightedSpawn(spawnTable) {
    if (!spawnTable?.length) return null

    const totalWeight = spawnTable.reduce((sum, entry) => sum + (entry.weight ?? 0), 0)
    if (totalWeight <= 0) return null

    let roll = Math.random() * totalWeight
    for (const entry of spawnTable) {
        roll -= entry.weight ?? 0
        if (roll <= 0) return entry
    }

    return spawnTable[spawnTable.length - 1]
}

function clearLegacySpawnerDisplayEntities(dimension, location) {
    const center = {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5
    }

    for (const typeId of legacyFallback) {
        const legacyEntities = dimension.getEntities({
            type: typeId,
            location: center,
            maxDistance: 0.9
        })

        for (const entity of legacyEntities) {
            try { entity.remove() } catch { /* ignore removal failures */ }
        }
    }
}

// ─────────────────────────────
// Mechanical Spawner Component
// ─────────────────────────────
DoriosLib.registry.blockComponent('utilitycraft:mech_spawner', {
    beforeOnPlayerPlace({ block, player }) {
        const hand = player.getComponent('equippable')?.getEquipment('Mainhand')
        const storageKey = getStorageKeyFromLocation(block.dimension, block.location)
        const loreEssence = getEssenceFromLore(hand)

        if (loreEssence) {
            pendingPlacementEssence.set(storageKey, loreEssence)
            return
        }

        pendingPlacementEssence.delete(storageKey)
    },

    onPlace({ block }) {
        const storageKey = getStorageKey(block)
        const pendingEssence = pendingPlacementEssence.get(storageKey)
        pendingPlacementEssence.delete(storageKey)

        if (pendingEssence && ESSENCE_TO_STATE_INDEX.has(pendingEssence)) {
            setStoredEssence(block, pendingEssence)
            syncTypeStatesFromEssence(block, pendingEssence)
            return
        }

        const legacyStateIndex = getSpawnerTypeIndex(block)
        const legacyEssence = getVariantByState(legacyStateIndex)?.essence

        if (legacyEssence && ESSENCE_TO_STATE_INDEX.has(legacyEssence)) {
            setStoredEssence(block, legacyEssence)
            syncTypeStatesFromEssence(block, legacyEssence)
            return
        }

        clearStoredEssence(block)
        syncTypeStatesFromEssence(block)
    },

    /**
     * Handles mob spawning while active
     */
    onTick({ block }) {
        if (!globalThis.worldLoaded) return

        clearLegacySpawnerDisplayEntities(block.dimension, block.location)

        const storedEssence = getStoredOrLegacyEssence(block)
        const typeIndex = syncTypeStatesFromEssence(block, storedEssence)

        if (!DoriosLib.block.getState(block, 'utilitycraft:isOn')) return

        const variant = getVariantByState(typeIndex)
        if (!variant) return

        const quantityState = DoriosLib.block.getState(block, 'utilitycraft:quantity')
        const multiplier = quantityState === 4 ? 3 : quantityState
        const bonusChance = quantityState === 4 ? 25 : 0

        const { x, y, z } = block.location
        const dim = block.dimension
        for (let i = 0; i < multiplier + 1; i++) {
            if (Math.random() * 100 < 60 + bonusChance) {
                const spawnPick = chooseWeightedSpawn(variant.spawnTable)
                if (!spawnPick?.typeId) continue

                const offsetX = Math.random() * 2 - 1
                const offsetZ = Math.random() * 2 - 1
                try {
                    dim.spawnEntity(spawnPick.typeId, { x: x + offsetX, y: y + 1, z: z + offsetZ })
                } catch {
                    // ignore invalid or unavailable entity identifiers
                }
            }
        }
    },

    /**
     * Handles both essence selection and visual toggle
     */
    onPlayerInteract({ block, player }) {
        const dim = block.dimension
        const hand = player.getComponent('equippable')?.getEquipment('Mainhand')
        const storedEssence = getStoredOrLegacyEssence(block)
        const typeIndex = syncTypeStatesFromEssence(block, storedEssence)

        if (player.isSneaking) {
            if (!storedEssence) {
                if (!hand) return

                const stateIndex = ESSENCE_TO_STATE_INDEX.get(hand.typeId)
                if (!stateIndex) return
                if (!consumeMainHandItem(player, hand.typeId, 1)) return

                setSpawnerEssence(block, hand.typeId)
                const variant = getVariantByState(stateIndex)
                player.sendMessage(`§aAssigned ${variant?.displayName ?? 'Unknown'} Essence!`)
                return
            }

            if (!hand) {
                sendLocalizedMessage(player, MESSAGE_USE_BOTTLE_KEY)
                return
            }

            if (hand.typeId === 'minecraft:glass_bottle') {
                if (!consumeMainHandItem(player, hand.typeId, 1)) return

                giveItemToPlayerOrDrop(player, new ItemStack(storedEssence, 1), block)
                clearSpawnerEssence(block)

                player.sendMessage('§aRecovered essence from Mechanical Spawner.')
                return
            }

            const newStateIndex = ESSENCE_TO_STATE_INDEX.get(hand.typeId)
            if (!newStateIndex || hand.typeId === storedEssence) return

            const storageKey = getStorageKey(block)
            const now = getCurrentTick()
            const playerKey = player.id ?? player.nameTag
            const confirmKey = `${playerKey}|${storageKey}`
            const previous = pendingSwapByPlayerAndBlock.get(confirmKey)

            const withinWindow =
                previous &&
                previous.essenceId === hand.typeId &&
                now >= previous.tick &&
                (now - previous.tick) <= SWAP_CONFIRM_WINDOW_TICKS

            if (!withinWindow) {
                pendingSwapByPlayerAndBlock.set(confirmKey, {
                    essenceId: hand.typeId,
                    tick: now
                })
                sendLocalizedMessage(player, MESSAGE_SWAP_CONFIRM_KEY)
                return
            }

            if (!consumeMainHandItem(player, hand.typeId, 1)) return

            giveItemToPlayerOrDrop(player, new ItemStack(storedEssence, 1), block)
            setSpawnerEssence(block, hand.typeId)
            pendingSwapByPlayerAndBlock.delete(confirmKey)

            player.sendMessage('§aSpawner essence swapped successfully.')
            return
        }

        // ────────────────
        // Essence Selection
        // ────────────────
        if (typeIndex === 0) {
            if (!hand) return

            const stateIndex = ESSENCE_TO_STATE_INDEX.get(hand.typeId)
            if (!stateIndex) return

            if (!consumeMainHandItem(player, hand.typeId, 1)) return

            setSpawnerEssence(block, hand.typeId)

            const variant = getVariantByState(stateIndex)
            player.sendMessage(`§aAssigned ${variant?.displayName ?? 'Unknown'} Essence!`)
            return
        }

        // ────────────────
        // Visual Toggle Menu
        // ────────────────
        const isOn = DoriosLib.block.getState(block, 'utilitycraft:isOn')
        const mobName = getVariantByState(typeIndex)?.displayName ?? 'Unknown'
        if (hand) return
        const form = new ModalFormData()
            .title(`⚙ Mechanical Spawner`)
            .toggle(`§lPower: ${isOn ? '§aON' : '§cOFF'}`, { defaultValue: isOn })
            .label(`§7Mob Type: §f${mobName}\n§7Click confirm to save changes.`)

        form.show(player).then(result => {
            if (result.canceled || !result.formValues) return
            const [toggleState] = result.formValues
            DoriosLib.block.setState(block, 'utilitycraft:isOn', toggleState)

            player.sendMessage(toggleState ? '§aSpawner On' : '§cSpawner Off')
        })
    },

    onPlayerBreak({ block, dimension, player, brokenBlockPermutation }) {
        const storageKey = getStorageKey(block)
        const storedEssence = getStoredEssence(block) ?? getVariantByState(getSpawnerTypeIndex(block))?.essence

        clearStoredEssence(block)
        cleanupSwapConfirmationForStorageKey(storageKey)
        clearLegacySpawnerDisplayEntities(dimension, block.location)

        if (!storedEssence || !DoriosLib.player.isSurvival(player)) return

        const blockItemId = brokenBlockPermutation?.type?.id ?? 'utilitycraft:mechanical_spawner'
        const spawnerDrop = new ItemStack(blockItemId, 1)
        spawnerDrop.setLore([`${ESSENCE_LORE_PREFIX}${storedEssence}`])

        system.run(() => {
            const oldItemEntity = dimension
                .getEntities({
                    type: 'item',
                    maxDistance: 1.25,
                    location: block.center()
                })
                .find((item) => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId)

            oldItemEntity?.remove()
            dimension.spawnItem(spawnerDrop, block.center())
        })
    }
})

import { world, ItemStack } from '@minecraft/server'

const ESSENCE_TARGETS = Object.freeze([
    { displayName: 'Blaze', essenceItem: 'utilitycraft:blaze_essence', captureTypeIds: ['minecraft:blaze'] },
    { displayName: 'Chicken', essenceItem: 'utilitycraft:chicken_essence', captureTypeIds: ['minecraft:chicken'] },
    { displayName: 'Cow', essenceItem: 'utilitycraft:cow_essence', captureTypeIds: ['minecraft:cow'] },
    { displayName: 'Creeper', essenceItem: 'utilitycraft:creeper_essence', captureTypeIds: ['minecraft:creeper'] },
    { displayName: 'Enderman', essenceItem: 'utilitycraft:enderman_essence', captureTypeIds: ['minecraft:enderman'] },
    { displayName: 'Hoglin', essenceItem: 'utilitycraft:hoglin_essence', captureTypeIds: ['minecraft:hoglin'] },
    { displayName: 'Magma Cube', essenceItem: 'utilitycraft:magma_cube_essence', captureTypeIds: ['minecraft:magma_cube'] },
    { displayName: 'Mooshroom', essenceItem: 'utilitycraft:mooshroom_essence', captureTypeIds: ['minecraft:mooshroom'] },
    { displayName: 'Pig', essenceItem: 'utilitycraft:pig_essence', captureTypeIds: ['minecraft:pig'] },
    { displayName: 'Sheep', essenceItem: 'utilitycraft:sheep_essence', captureTypeIds: ['minecraft:sheep'] },
    { displayName: 'Skeleton', essenceItem: 'utilitycraft:skeleton_essence', captureTypeIds: ['minecraft:skeleton'] },
    { displayName: 'Slime', essenceItem: 'utilitycraft:slime_essence', captureTypeIds: ['minecraft:slime'] },
    { displayName: 'Spider', essenceItem: 'utilitycraft:spider_essence', captureTypeIds: ['minecraft:spider'] },
    { displayName: 'Wither Skeleton', essenceItem: 'utilitycraft:wither_skeleton_essence', captureTypeIds: ['minecraft:wither_skeleton'] },
    { displayName: 'Zombie', essenceItem: 'utilitycraft:zombie_essence', captureTypeIds: ['minecraft:zombie'] },
    { displayName: 'Guardian', essenceItem: 'utilitycraft:guardian_essence', captureTypeIds: ['minecraft:guardian', 'minecraft:elder_guardian'] },
    { displayName: 'Piglin', essenceItem: 'utilitycraft:piglin_essence', captureTypeIds: ['minecraft:piglin'] },
    {
        displayName: 'Illager',
        essenceItem: 'utilitycraft:illager_essence',
        captureTypeIds: ['minecraft:pillager', 'minecraft:vindicator', 'minecraft:evoker', 'minecraft:witch'],
        captureFamily: 'illager'
    }
])

const TARGET_BY_TYPE_ID = new Map()
const TARGET_BY_DISPLAY_NAME = new Map()

for (const target of ESSENCE_TARGETS) {
    TARGET_BY_DISPLAY_NAME.set(target.displayName.toLowerCase(), target)
    for (const typeId of target.captureTypeIds) {
        TARGET_BY_TYPE_ID.set(typeId, target)
    }
}

DoriosAPI.register.itemComponent("essence", {
    onUse(e) {
        const { source } = e
        const equippable = source.getComponent("equippable")

        const target = source.getEntitiesFromViewDirection({ maxDistance: 2 })?.[0]?.entity
        if (!target) return

        const essenceTarget = getEssenceTarget(target)
        if (essenceTarget) {
            const essenceItem = new ItemStack("utilitycraft:essence_vessel", 1)
            essenceItem.setLore([
                `§r§7  Mob: ${essenceTarget.displayName}`,
                "§r§7  0 %"
            ])

            target.remove()
            equippable.setEquipment("Mainhand", essenceItem)
        }
    }
})

world.afterEvents.entityDie.subscribe(e => {
    const { deadEntity, damageSource } = e

    if (!damageSource.damagingEntity || damageSource.damagingEntity.typeId !== "minecraft:player") return

    const player = damageSource.damagingEntity
    const equippable = player.getComponent("equippable")
    const offHand = equippable.getEquipment("Offhand")

    if (!offHand || offHand.typeId !== "utilitycraft:essence_vessel") return

    const lore = offHand.getLore()
    const essenceTarget = getEssenceTargetFromLore(lore?.[0])
    if (!essenceTarget) return

    if (!matchesEssenceTarget(deadEntity, essenceTarget)) return

    // Parse kills from lore and increment
    let kills = parseProgressValue(lore?.[1])
    kills += Math.floor(Math.random() * 5) + 1

    // Vessel is now complete → transform into actual essence item
    if (kills > 99) {
        const newEssence = new ItemStack(essenceTarget.essenceItem, 1)
        equippable.setEquipment("Offhand", newEssence)
        return
    }

    // Update lore and show progress
    player.runCommand(`title @s actionbar ${kills}%`)
    offHand.setLore([
        `${lore?.[0]}`,
        `§r§7  ${kills} %`
    ])
    equippable.setEquipment("Offhand", offHand)
})

/**
 * Resolves essence target from a viewed entity.
 *
 * @param {import('@minecraft/server').Entity} entity
 * @returns {{ displayName: string, essenceItem: string, captureTypeIds: string[], captureFamily?: string } | null}
 */
function getEssenceTarget(entity) {
    const direct = TARGET_BY_TYPE_ID.get(entity.typeId)
    if (direct) return direct

    const illagerTarget = TARGET_BY_DISPLAY_NAME.get('illager')
    if (!illagerTarget?.captureFamily) return null

    const typeFamily = entity.getComponent('minecraft:type_family')
    if (typeFamily?.hasTypeFamily?.(illagerTarget.captureFamily)) return illagerTarget

    return null
}

/**
 * Resolves essence target from vessel lore line.
 *
 * @param {string | undefined} loreLine
 * @returns {{ displayName: string, essenceItem: string, captureTypeIds: string[], captureFamily?: string } | null}
 */
function getEssenceTargetFromLore(loreLine) {
    if (!loreLine) return null

    const mobName = loreLine.split('Mob: ')[1]?.trim()?.toLowerCase()
    if (!mobName) return null

    return TARGET_BY_DISPLAY_NAME.get(mobName) ?? null
}

/**
 * Checks if a kill should progress a vessel for the target.
 *
 * @param {import('@minecraft/server').Entity} entity
 * @param {{ displayName: string, essenceItem: string, captureTypeIds: string[], captureFamily?: string }} target
 * @returns {boolean}
 */
function matchesEssenceTarget(entity, target) {
    if (target.captureTypeIds.includes(entity.typeId)) return true
    if (!target.captureFamily) return false

    const typeFamily = entity.getComponent('minecraft:type_family')
    return typeFamily?.hasTypeFamily?.(target.captureFamily) ?? false
}

/**
 * Parses progress value from vessel lore.
 *
 * @param {string | undefined} loreLine
 * @returns {number}
 */
function parseProgressValue(loreLine) {
    if (!loreLine) return 0

    const numberText = loreLine.replace(/[^0-9]/g, '')
    const parsed = parseInt(numberText, 10)
    return Number.isNaN(parsed) ? 0 : parsed
}

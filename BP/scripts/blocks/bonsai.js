import { ItemStack, world, system } from '@minecraft/server'
import { plantsData, bonsaiItems } from '../config/recipes/plants.js'

/**
 * Bonsai Block Component
 * ----------------------
 * This component powers UtilityCraft's Bonsai automation block.
 * - Players can insert/remove soils and saplings.
 * - Soils adjust growth speed and loot multiplier.
 * - Saplings spawn bonsai entities that grow and drop resources.
 * - Harvested drops are pushed into inventories below or nearby containers.
 * 
 * States used:
 * - utilitycraft:soil        (string: soil ID or 'empty')
 * - utilitycraft:hasBonsai   (boolean)
 * - utilitycraft:isFarm      (boolean, farmed with hoe for growth bonus)
 * - utilitycraft:isSlimed    (boolean, slows growth when true)
 */

/** Growth base time (in ticks) */
const BASETIMEGROWTH = 60

/** Soils hash map (ID → modifiers) */
const soils = {
    "minecraft:dirt": {},
    "minecraft:grass_block": { bonus: 10 },
    "minecraft:sand": {},
    "minecraft:red_sand": { bonus: 10 },
    "minecraft:crimson_nylium": {},
    "minecraft:warped_nylium": {},
    "minecraft:soul_sand": {},
    "minecraft:end_stone": {},
    "utilitycraft:yellow_soil": { bonus: 15 },
    "utilitycraft:red_soil": { bonus: 30 },
    "utilitycraft:blue_soil": { bonus: 30, multi: 2 },
    "utilitycraft:black_soil": { bonus: 50, multi: 4 }
}

/** Special soils cannot be farmed and apply stronger bonuses */
const specialSoils = [
    "utilitycraft:yellow_soil",
    "utilitycraft:red_soil",
    "utilitycraft:blue_soil",
    "utilitycraft:black_soil"
]



DoriosAPI.register.blockComponent('bonsai', {
    /**
     * Handles player interactions with the bonsai block.
     * Includes planting, removing, farming, shearing, and sliming.
     */
    onPlayerInteract({ player, block }) {
        const { x, y, z } = block.location
        const pos = { x: x + 0.5, y: y + 0.172, z: z + 0.5 }
        const equipment = player.getComponent('equippable')
        const equipmentItem = equipment.getEquipment('Mainhand')

        /* --- Sneak + empty hand → clear bonsai --- */
        if (player.isSneaking && !equipmentItem) {
            const entity = block.dimension.getEntities({ tags: ['bonsai'], maxDistance: 0.1, location: pos })[0]
            if (entity) {
                const bonsaiEntity = bonsaiItems.find(item => item.entity === entity.typeId)
                entity.addTag('despawn')
                block.dimension.spawnItem(new ItemStack(bonsaiEntity.sapling), pos)
            }
            if (block.getState('utilitycraft:soil') !== 'empty') {
                block.dimension.spawnItem(new ItemStack(block.getState('utilitycraft:soil')), pos)
                block.setState('utilitycraft:soil', 'empty')
                block.setState('utilitycraft:isFarm', false)
            }
            block.setState('utilitycraft:hasBonsai', false)
            block.setState('utilitycraft:isSlimed', false)
            return
        }

        if (!equipmentItem) return
        const itemId = equipmentItem.typeId

        /* --- Shears → remove sapling --- */
        if (itemId === 'minecraft:shears') {
            const entity = block.dimension.getEntities({ tags: ['bonsai'], maxDistance: 0.1, location: pos })[0]
            if (entity) {
                const bonsaiEntity = bonsaiItems.find(item => item.entity === entity.typeId)
                entity.addTag('despawn')
                block.dimension.spawnItem(new ItemStack(bonsaiEntity.sapling), pos)
                block.setState('utilitycraft:hasBonsai', false)
                block.setState('utilitycraft:isSlimed', false)
                player.playSound('mob.sheep.shear')
            }
            return
        }

        /* --- Slime ball → toggle slimed state --- */
        if (itemId === 'minecraft:slime_ball') {
            const entity = block.dimension.getEntities({ tags: ['bonsai'], maxDistance: 0.1, location: pos })[0]
            if (!entity) return

            const slimed = !block.getState('utilitycraft:isSlimed')
            block.setState('utilitycraft:isSlimed', slimed)
            entity.triggerEvent(slimed ? 'normal' : 'small')

            // Sync the property on the entity
            entity.setProperty('dorios:isSlimed', slimed)
            return
        }

        /* --- Hoe → farm bonsai (reduces time if valid soil) --- */
        if (itemId.includes('hoe')) {
            const enchantable = equipmentItem.getComponent('minecraft:enchantable')
            const unbreakingLvl = enchantable.hasEnchantment('unbreaking')
                ? enchantable.getEnchantment('unbreaking').level
                : 0

            if (!block.getState('utilitycraft:isFarm') && block.getState('utilitycraft:soil') !== 'empty') {
                block.setState('utilitycraft:isFarm', true)

                const durability = equipmentItem.getComponent('minecraft:durability')
                const shouldDamage = Math.random() <= 1 / (unbreakingLvl + 1)

                if (shouldDamage && durability.damage < durability.maxDurability) {
                    durability.damage++
                    equipment.setEquipment('Mainhand', equipmentItem)
                    block.dimension.playSound('step.gravel', pos)
                } else if (durability.damage === durability.maxDurability) {
                    equipment.setEquipment('Mainhand')
                    player.playSound('random.break')
                }

                // If a bonsai entity exists, update its growth time for normal soils
                const entity = block.dimension.getEntities({ tags: ['bonsai'], maxDistance: 0.1, location: pos })[0]
                if (entity) {
                    // Buscar su definición en bonsaiItems usando el typeId de la entidad
                    const bonsaiData = bonsaiItems.find(b => b.entity === entity.typeId)
                    const soilId = block.getState('utilitycraft:soil')
                    const soil = soils[soilId]

                    if (!specialSoils.includes(soilId) && !bonsaiData?.disableTimeBonus) {
                        let timeGrowth = BASETIMEGROWTH - (soil.bonus ?? 0)
                        timeGrowth -= 10 // Farming bonus
                        entity.setProperty('dorios:time', timeGrowth)
                    }
                }
            }
            return
        }


        /**
         * Spawns a bonsai entity when a valid sapling is planted on allowed soil.
         * Applies soil time and yield bonuses unless disabled via
         * `disableTimeBonus` or `disableYieldBonus`.
         * Supports growth debuffs via `growthDebuff` (multiplies total time).
         */
        const bonsai = bonsaiItems.find(item => item.sapling === itemId)
        if (bonsai) {
            const soilId = block.getState('utilitycraft:soil')
            const isValidSoil =
                specialSoils.includes(soilId) ||
                bonsai.allowed.includes(soilId.split(':')[1])

            if (isValidSoil && !block.getState('utilitycraft:hasBonsai')) {
                block.setState('utilitycraft:hasBonsai', true)

                const bonsaiEntity = block.dimension.spawnEntity(bonsai.entity, pos)
                bonsaiEntity.addTag('bonsai')
                bonsaiEntity.setDynamicProperty('plant', `${equipmentItem.typeId}`)

                // Growth & yield setup
                const soil = soils[soilId]
                const baseTime = BASETIMEGROWTH
                const timeBonus = soil.bonus ?? 0
                const yieldBase = soil.multi ?? 1

                let growthTime = bonsai.disableTimeBonus ? baseTime : baseTime - timeBonus
                const yieldMultiplier = bonsai.disableYieldBonus ? 1 : yieldBase

                // Apply optional debuff (e.g., bad soil, cursed bonsai, etc.)
                if (bonsai.growthDebuff && bonsai.growthDebuff > 1) {
                    growthTime *= bonsai.growthDebuff
                }

                bonsaiEntity.setProperty('dorios:time', growthTime)
                bonsaiEntity.setProperty('dorios:multi', yieldMultiplier)

                if (player.getGameMode() !== 'creative') {
                    player.runCommand(`clear @s ${bonsai.sapling} 0 1`)
                }
            }
            return
        }

        /* --- Soil → apply to bonsai pot --- */
        if (soils[itemId] && block.getState('utilitycraft:soil') === 'empty') {
            block.setState('utilitycraft:soil', itemId)
            if (player.getGameMode() !== 'creative') {
                player.runCommand(`clear @s ${itemId} 0 1`)
            }
        }
    },

    /**
     * Handles block destruction.
     * Drops the soil and sapling if present.
     */
    onPlayerDestroy({ destroyedBlockPermutation, block }) {
        const { x, y, z } = block.location
        const pos = { x: x + 0.5, y: y + 0.172, z: z + 0.5 }

        const soil = destroyedBlockPermutation.getState('utilitycraft:soil')
        if (soil !== 'empty') {
            block.dimension.spawnItem(new ItemStack(soil), pos)
        }

        if (destroyedBlockPermutation.getState('utilitycraft:hasBonsai')) {
            const entity = block.dimension.getEntities({ tags: ['bonsai'], maxDistance: 0.1, location: pos })[0]
            if (entity) {
                const bonsaiEntity = bonsaiItems.find(enty => enty.entity === entity.typeId)
                block.dimension.spawnItem(new ItemStack(bonsaiEntity.sapling), pos)
            }
        }
    }
})

/**
 * Handles the `dorios:bonsai_loot` script event.
 * 
 * Triggered when a bonsai tree finishes its growth cycle and generates drops.
 * 
 * ## Behavior:
 * - Reads the plant type from the entity’s `plant|` tag.
 * - Retrieves the plant’s loot data from `plantsData`.
 * - Rolls each possible drop based on its chance.
 * - Spawns the resulting items in the block directly below the bonsai entity.
 * 
 * ## Expected `plantsData` structure:
 * ```js
 * plantsData = {
 *   "utilitycraft:oak_sapling": {
 *     drops: [
 *       { item: "minecraft:oak_log", amount: [1, 3], chance: 0.8 },
 *       { item: "minecraft:oak_sapling", amount: 1, chance: 0.2 }
 *     ]
 *   }
 * }
 * ```
 * 
 * @event dorios:bonsai_loot
 * @param {ScriptEventCommandMessageAfterEvent} event The script event context.
 * @property {string} event.id The script event identifier.
 * @property {Entity} event.sourceEntity The bonsai entity triggering the event.
 */
system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id, sourceEntity } = event
    if (id !== "dorios:bonsai_loot") return

    // const plantTag = sourceEntity.getTags().find(tag => tag.startsWith('plant|'))
    const bonsaiPlant = sourceEntity.getDynamicProperty('plant')
    const plantInfo = plantsData[bonsaiPlant]
    if (!plantInfo) return

    const drops = plantInfo.drops
    const { x, y, z } = sourceEntity.location
    const dropPos = { x, y: y - 1, z }

    drops.forEach(loot => {
        if (Math.random() <= loot.chance) {
            let amount = Array.isArray(loot.amount)
                ? DoriosAPI.math.randomInterval(loot.amount[0], loot.amount[1])
                : loot.amount

            try {
                DoriosAPI.containers.addItemAt(dropPos, sourceEntity.dimension, loot.item, amount)
            } catch { }
        }
    })
})

import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack } from '@minecraft/server'

/**
 * Crucible Block Component
 * ------------------------
 * - Accepts cobblestone-like blocks to smelt into lava.
 * - Requires a heat source beneath the block.
 * - Produces lava in increments of 250mB.
 * - Interacts with buckets for inserting/removing lava.
 * 
 * States used:
 * - utilitycraft:cobble    (number, cobble units queued for smelting)
 * - utilitycraft:lava      (number, lava level in steps of 250mB, max 4)
 * - utilitycraft:smelting  (number, current heat progress)
 */


/** Items accepted by the crucible (ID → cobble units). */
const acceptedItems = {
    'minecraft:cobblestone': 1,
    'minecraft:stone': 1,
    'minecraft:diorite': 1,
    'minecraft:granite': 1,
    'minecraft:blackstone': 1,
    'minecraft:netherrack': 4
}

/** Heat sources (block ID → heat value per tick). */
const heatSources = {
    'utilitycraft:blaze_block': 6,
    'minecraft:lava': 4,
    'minecraft:flowing_lava': 4,
    'minecraft:soul_fire': 3,
    'minecraft:soul_torch': 3,
    'minecraft:soul_campfire': 3,
    'utilitycraft:big_torch': 2,
    'minecraft:fire': 2,
    'minecraft:campfire': 2,
    'minecraft:magma': 2,
    'minecraft:torch': 1
}

DoriosLib.registry.blockComponent('utilitycraft:crucible', {
    /**
     * Handles player interaction with the crucible.
     */
    onPlayerInteract({ player, block }) {
        const { x, y, z } = block.location
        const pos = { x: x + 0.5, y: y + 1, z: z + 0.5 }

        const mainhand = player.getComponent('equippable').getEquipment('Mainhand')
        let cobble = DoriosLib.block.getState(block, 'utilitycraft:cobble')
        let lava = DoriosLib.block.getState(block, 'utilitycraft:lava')

        // Add cobble-like blocks
        const cobbleUnits = acceptedItems[mainhand?.typeId]
        if (cobbleUnits) {
            const freeSpace = 4 - (cobble + lava)
            if (freeSpace >= cobbleUnits) {
                cobble += cobbleUnits
                player.runCommand(`clear @s ${mainhand.typeId} 0 1`)
            }
        } else {
            // Bucket interactions
            if (mainhand?.typeId === 'minecraft:bucket' && lava === 4) {
                // Collect lava
                player.runCommand(`clear @s ${mainhand.typeId} 0 1`)
                DoriosLib.player.giveItem(player, { item: 'minecraft:lava_bucket' })
                lava = 0
            } else if (mainhand?.typeId === 'minecraft:water_bucket' && lava === 4) {
                // Water + lava → obsidian
                player.runCommand(`clear @s ${mainhand.typeId} 0 1`)
                DoriosLib.player.giveItem(player, { item: 'minecraft:bucket' })
                block.dimension.spawnItem(new ItemStack('minecraft:obsidian', 1), pos)
                lava = 0
            } else if (mainhand?.typeId === 'minecraft:lava_bucket' && lava === 0 && cobble === 0) {
                // Insert lava
                player.runCommand(`clear @s ${mainhand.typeId} 0 1`)
                DoriosLib.player.giveItem(player, { item: 'minecraft:bucket' })
                lava = 4
            }
        }

        // Update action bar
        player.onScreenDisplay.setActionBar(`   Cobble: ${cobble * 1000}mB   Lava: ${lava * 250}mB   `)

        // Update states
        DoriosLib.block.setState(block, 'utilitycraft:cobble', cobble)
        DoriosLib.block.setState(block, 'utilitycraft:lava', lava)
    },

    /**
     * Smelting tick logic (turns cobble into lava if heated).
     */
    onTick({ block }) {
        const heat = heatSources[block.below(1)?.typeId]
        let smelt = DoriosLib.block.getState(block, 'utilitycraft:smelting')
        let cobble = DoriosLib.block.getState(block, 'utilitycraft:cobble')
        let lava = DoriosLib.block.getState(block, 'utilitycraft:lava')

        if (!heat || cobble === 0 || lava === 4) {
            DoriosLib.block.setState(block, 'utilitycraft:smelting', 0)
            return
        }

        smelt += heat

        if (smelt > 15) {
            cobble -= 1
            lava += 1
            smelt = 0
        }

        DoriosLib.block.setState(block, 'utilitycraft:cobble', cobble)
        DoriosLib.block.setState(block, 'utilitycraft:lava', lava)
        DoriosLib.block.setState(block, 'utilitycraft:smelting', smelt)
    }
})

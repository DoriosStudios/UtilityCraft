import * as DoriosLib from "DoriosLib/index.js"
import { ItemStack, system } from "@minecraft/server"
import {
    getCropDefinition,
    harvestCrop,
    harvestCropArea,
    spawnBrokenCropFortuneBonus
} from "../crops/harvest.js"

DoriosLib.registry.blockComponent("utilitycraft:crop", {
    onTick({ block }) {
        const age = DoriosLib.block.getState(block, "utilitycraft:age")
        if (age < 5) DoriosLib.block.setState(block, "utilitycraft:age", age + 1)
    },

    onPlayerInteract({ block, player }) {
        if (!getCropDefinition(block)) return

        const mainHand = player.getComponent("equippable")?.getEquipment("Mainhand")
        const areaHarvest = mainHand
            ?.getComponent("utilitycraft:hoe")
            ?.customComponentParameters
            ?.params
            ?.runAreaHarvest ?? false

        const harvested = areaHarvest
            ? harvestCropArea(block, { tool: mainHand })
            : Number(harvestCrop(block, { tool: mainHand }))

        if (harvested <= 0) return
        block.dimension.playSound("dig.grass", block.location)

        if (areaHarvest) {
            system.run(() => {
                const { x, y, z } = block.location
                block.dimension.runCommand(
                    `execute positioned ${x} ${y} ${z} run function area_harvest`
                )
            })
        }
    },

    onPlayerBreak({ brokenBlockPermutation, block, player }) {
        const definition = getCropDefinition(brokenBlockPermutation.type.id)
        if (!definition) return
        if (brokenBlockPermutation.getState("utilitycraft:age") !== 5) return

        const location = block.location
        const mainHand = player?.getComponent("equippable")?.getEquipment("Mainhand")

        // A mature plant always returns the seed required to replant it.
        block.dimension.spawnItem(new ItemStack(definition.seedId, 1), location)
        spawnBrokenCropFortuneBonus(definition, block.dimension, location, mainHand)
    }
})

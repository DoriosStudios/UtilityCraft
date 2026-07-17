import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system, world } from "@minecraft/server"
import {
  getBonsaiDefinitionByInput
} from "../../config/recipes/plantRegistry.js"
import {
  canPlantOnSoil,
  getBonsaiSoil,
  isBonsaiSoil
} from "./soils.js"
import {
  BONSAI_HEARTBEAT_EVENT,
  LEGACY_BONSAI_LOOT_EVENT,
  despawnBonsaiEntity,
  findBonsaiEntityAtBlock,
  getBonsaiInputTypeId,
  initializeBonsaiEntity,
  processBonsaiHeartbeat,
  processLegacyBonsaiLoot,
  refreshLoadedBonsais,
  resyncBonsaiCycle,
  setBonsaiDecorativePaused
} from "./runtime.js"

function getBonsaiItemLocation(block) {
  const { x, y, z } = block.location
  return { x: x + 0.5, y: y + 0.172, z: z + 0.5 }
}

function dropBonsaiItem(dimension, itemTypeId, location) {
  if (typeof itemTypeId !== "string" || itemTypeId === "empty") return
  try {
    dimension.spawnItem(new ItemStack(itemTypeId, 1), location)
  } catch (error) {
    console.warn(`[UtilityCraft] Failed to drop bonsai item "${itemTypeId}": ${error}`)
  }
}

function consumeHeldItem(player, itemStack, amount = 1) {
  if (player.getGameMode() === "Creative") return
  const equippable = player.getComponent("equippable")
  const remaining = itemStack.amount - amount

  if (remaining <= 0) {
    equippable.setEquipment("Mainhand", undefined)
    return
  }

  itemStack.amount = remaining
  equippable.setEquipment("Mainhand", itemStack)
}

function returnPlantedInput(block, entity, location) {
  const inputTypeId = getBonsaiInputTypeId(entity)
  dropBonsaiItem(block.dimension, inputTypeId, location)
}

function clearBonsaiPlant(block, location) {
  const entity = findBonsaiEntityAtBlock(block)
  if (entity) {
    returnPlantedInput(block, entity, location)
    despawnBonsaiEntity(entity)
  }

  DoriosLib.block.setState(block, "utilitycraft:hasBonsai", false)
  DoriosLib.block.setState(block, "utilitycraft:isSlimed", false)
}

function damageHoe(player, itemStack, location) {
  const equippable = player.getComponent("equippable")
  const enchantable = itemStack.getComponent("minecraft:enchantable")
  const unbreakingLevel = enchantable?.getEnchantment("unbreaking")?.level ?? 0
  const durability = itemStack.getComponent("minecraft:durability")
  if (!durability) return

  if (Math.random() > 1 / (unbreakingLevel + 1)) return
  if (durability.damage < durability.maxDurability) {
    durability.damage++
    equippable.setEquipment("Mainhand", itemStack)
    player.dimension.playSound("step.gravel", location)
    return
  }

  equippable.setEquipment("Mainhand", undefined)
  player.playSound("random.break")
}

DoriosLib.registry.blockComponent("utilitycraft:bonsai", {
  onPlayerInteract({ player, block }) {
    const location = getBonsaiItemLocation(block)
    const equippable = player.getComponent("equippable")
    const heldItem = equippable.getEquipment("Mainhand")

    if (player.isSneaking && !heldItem) {
      clearBonsaiPlant(block, location)

      const soilTypeId = DoriosLib.block.getState(block, "utilitycraft:soil")
      if (soilTypeId !== "empty") {
        dropBonsaiItem(block.dimension, soilTypeId, location)
        DoriosLib.block.setState(block, "utilitycraft:soil", "empty")
      }

      DoriosLib.block.setState(block, "utilitycraft:isFarm", false)
      return
    }

    if (!heldItem) return
    const itemTypeId = heldItem.typeId

    if (itemTypeId === "minecraft:shears") {
      const entity = findBonsaiEntityAtBlock(block)
      if (entity) {
        returnPlantedInput(block, entity, location)
        despawnBonsaiEntity(entity)
        DoriosLib.block.setState(block, "utilitycraft:hasBonsai", false)
        DoriosLib.block.setState(block, "utilitycraft:isSlimed", false)
        player.playSound("mob.sheep.shear")
      }
      return
    }

    if (itemTypeId === "minecraft:slime_ball") {
      const entity = findBonsaiEntityAtBlock(block)
      if (!entity) return

      const paused = !DoriosLib.block.getState(block, "utilitycraft:isSlimed")
      DoriosLib.block.setState(block, "utilitycraft:isSlimed", paused)
      setBonsaiDecorativePaused(entity, block, paused)
      return
    }

    if (itemTypeId.includes("hoe") || itemTypeId.includes("aiot")) {
      const soilTypeId = DoriosLib.block.getState(block, "utilitycraft:soil")
      const soil = getBonsaiSoil(soilTypeId)
      if (!soil?.tillable || DoriosLib.block.getState(block, "utilitycraft:isFarm")) return

      DoriosLib.block.setState(block, "utilitycraft:isFarm", true)
      damageHoe(player, heldItem, location)

      const entity = findBonsaiEntityAtBlock(block)
      if (entity) resyncBonsaiCycle(entity, block, true)
      return
    }

    const definition = getBonsaiDefinitionByInput(itemTypeId)
    if (definition) {
      const soilTypeId = DoriosLib.block.getState(block, "utilitycraft:soil")
      if (
        !DoriosLib.block.getState(block, "utilitycraft:hasBonsai") &&
        canPlantOnSoil(definition, soilTypeId)
      ) {
        const entity = block.dimension.spawnEntity(definition.entityTypeId, location)
        if (!initializeBonsaiEntity(entity, block, itemTypeId)) {
          despawnBonsaiEntity(entity)
          return
        }

        DoriosLib.block.setState(block, "utilitycraft:hasBonsai", true)
        consumeHeldItem(player, heldItem)
      }
      return
    }

    if (isBonsaiSoil(itemTypeId) && DoriosLib.block.getState(block, "utilitycraft:soil") === "empty") {
      DoriosLib.block.setState(block, "utilitycraft:soil", itemTypeId)
      consumeHeldItem(player, heldItem)
    }
  },

  onPlayerBreak({ brokenBlockPermutation, block }) {
    const location = {
      x: block.location.x + 0.5,
      y: block.location.y + 0.5,
      z: block.location.z + 0.5
    }

    dropBonsaiItem(
      block.dimension,
      brokenBlockPermutation.getState("utilitycraft:soil"),
      location
    )

    if (!brokenBlockPermutation.getState("utilitycraft:hasBonsai")) return
    const entity = findBonsaiEntityAtBlock(block)
    if (!entity) return

    returnPlantedInput(block, entity, location)
    despawnBonsaiEntity(entity)
  }
})

world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity, eventId }) => {
  if (eventId === BONSAI_HEARTBEAT_EVENT) processBonsaiHeartbeat(entity)
}, {
  eventTypes: [BONSAI_HEARTBEAT_EVENT]
})

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (!sourceEntity) return
  if (id === BONSAI_HEARTBEAT_EVENT) processBonsaiHeartbeat(sourceEntity)
  else if (id === LEGACY_BONSAI_LOOT_EVENT) processLegacyBonsaiLoot(sourceEntity)
})

DoriosLib.registry.customCommand({
  name: "utilitycraft:updatebonsais",
  description: "Recalculates loaded UtilityCraft bonsais",
  permissionLevel: "admin",
  cheatsRequired: true,
  callback(origin) {
    const result = refreshLoadedBonsais()
    const message = [
      `\u00a7aBonsais actualizados: \u00a7e${result.updated}`,
      `\u00a77Encontrados: \u00a7f${result.found}`,
      `\u00a77Huerfanos eliminados: \u00a7f${result.orphaned}`,
      `\u00a77Invalidos: \u00a7f${result.invalid}`
    ].join(" \u00a78| ")

    const source = origin.sourceEntity
    if (source?.sendMessage) source.sendMessage(message)
    else console.warn(`[UtilityCraft] ${message}`)
  }
})

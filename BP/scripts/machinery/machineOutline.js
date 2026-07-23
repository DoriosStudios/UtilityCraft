import * as DoriosLib from "DoriosLib/index.js"
import { system } from "@minecraft/server"
import { ModalFormData } from "@minecraft/server-ui"
import {
    getMachineUpgradeItemDefinition,
    getMachineUpgradeSlots
} from "../UtilityCore/machineUpgrades.js"
import { getOppositeFacingDirection } from "./machines/oppositeFacing.js"
import {
    getHarvesterOutlineTransform,
    getHarvesterSide
} from "./machines/harvesterArea.js"

export const MACHINE_OUTLINE_ENTITY_ID = "utilitycraft:machine_area_outline"

const MACHINE_ENTITY_ID = "utilitycraft:machine_entity"
const WRENCH_ITEM_ID = "utilitycraft:wrench"
const OUTLINE_ENABLED_PROPERTY = "utilitycraft:outline_enabled"
const OUTLINE_COLOR_PROPERTY = "utilitycraft:outline_color"
const OUTLINE_SIZE_PROPERTY = "utilitycraft:outline_size"
const OUTLINE_OFFSET_PROPERTIES = Object.freeze({
    x: "utilitycraft:outline_offset_x",
    y: "utilitycraft:outline_offset_y",
    z: "utilitycraft:outline_offset_z"
})

const MACHINE_OUTLINE_COLORS = Object.freeze({
    "utilitycraft:harvester": 0,
    "utilitycraft:block_placer": 0,
    "utilitycraft:block_breaker": 1
})

function translate(key) {
    return { translate: key }
}

function getOutlineLocation(block) {
    const { x, y, z } = block.location
    return { x: x + 0.5, y: y + 0.25, z: z + 0.5 }
}

function getOutlineEntities(block) {
    if (!block) return []
    return block.dimension
        .getEntitiesAtBlockLocation(block.location)
        .filter(entity => entity.typeId === MACHINE_OUTLINE_ENTITY_ID)
}

export function isMachineOutlineSupported(block) {
    return MACHINE_OUTLINE_COLORS[block?.typeId] !== undefined
}

export function findMachineOutlineEntity(block) {
    return getOutlineEntities(block)[0]
}

function findMachineEntity(block) {
    if (!block) return undefined
    return block.dimension
        .getEntitiesAtBlockLocation(block.location)
        .find(entity => entity.typeId === MACHINE_ENTITY_ID)
}

export function removeMachineOutline(block) {
    for (const outline of getOutlineEntities(block)) {
        try {
            outline.remove()
        } catch {}
    }
}

function setPropertyIfChanged(entity, property, value) {
    if (entity.getProperty(property) === value) return false
    entity.setProperty(property, value)
    return true
}

function getInstalledRangeLevel(block, machineEntity) {
    const rangeSlot = getMachineUpgradeSlots(block).find(slot => slot.type === "range")
    if (!rangeSlot) return 0

    const container = machineEntity.getComponent("minecraft:inventory")?.container
    const item = container?.getItem(rangeSlot.slot)
    const definition = getMachineUpgradeItemDefinition(item)
    if (!item || definition?.type !== "range") return 0

    return Math.min(rangeSlot.max, item.amount * definition.value)
}

function getFixedMachineTransform(block) {
    const direction = getOppositeFacingDirection(block)
    const worldOffset = DoriosLib.constants.DIRECTION_VECTORS[direction]
        ?? { x: 0, y: 0, z: 0 }

    // Entity model coordinates are inverted relative to block-world offsets.
    const offset = {
        x: -worldOffset.x,
        y: -worldOffset.y,
        z: -worldOffset.z
    }

    return { size: 1, offset }
}

function getMachineTransform(block, machineEntity, rangeUpgrades) {
    if (block.typeId === "utilitycraft:harvester") {
        const range = rangeUpgrades ?? getInstalledRangeLevel(block, machineEntity)
        return getHarvesterOutlineTransform(block, range)
    }
    return getFixedMachineTransform(block)
}

export function syncMachineOutline(
    block,
    outline = findMachineOutlineEntity(block),
    machineEntity = findMachineEntity(block),
    rangeUpgrades
) {
    if (!outline || !machineEntity || !isMachineOutlineSupported(block)) return false

    const transform = getMachineTransform(block, machineEntity, rangeUpgrades)
    const color = MACHINE_OUTLINE_COLORS[block.typeId]

    setPropertyIfChanged(outline, OUTLINE_ENABLED_PROPERTY, true)
    setPropertyIfChanged(outline, OUTLINE_COLOR_PROPERTY, color)
    setPropertyIfChanged(outline, OUTLINE_SIZE_PROPERTY, transform.size)
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.x, transform.offset.x)
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.y, transform.offset.y)
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.z, transform.offset.z)
    return true
}

function ensureMachineOutline(block, machineEntity) {
    let outline = findMachineOutlineEntity(block)

    if (!outline) {
        try {
            outline = block.dimension.spawnEntity(
                MACHINE_OUTLINE_ENTITY_ID,
                getOutlineLocation(block)
            )
        } catch (error) {
            console.warn(`[Machine Outline] Could not spawn outline: ${error?.message ?? error}`)
            return undefined
        }
    }

    syncMachineOutline(block, outline, machineEntity)
    return outline
}

export function initializeMachineOutline(block, _machineEntity, player) {
    if (!isMachineOutlineSupported(block)) return

    removeMachineOutline(block)
    player?.onScreenDisplay.setActionBar(
        translate("message.utilitycraft.machine_outline.wrench_hint")
    )
}

export function syncHarvesterOutlineIfNeeded(machine) {
    const outline = findMachineOutlineEntity(machine?.block)
    if (!outline || !machine?.entity) return

    const expectedSide = getHarvesterSide(machine.upgrades.range)
    if (outline.getProperty(OUTLINE_SIZE_PROPERTY) === expectedSide) return
    syncMachineOutline(machine.block, outline, machine.entity, machine.upgrades.range)
}

async function openMachineOutlineMenu(block, player, machineEntity) {
    const enabled = findMachineOutlineEntity(block) !== undefined
    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:machine_outline.title"))
        .toggle(translate("ui.utilitycraft:machine_outline.enabled"), {
            defaultValue: enabled
        })
        .submitButton(translate("ui.utilitycraft:machine_outline.save"))

    try {
        const result = await form.show(player)
        if (result.canceled) return
        if (!machineEntity.isValid || !isMachineOutlineSupported(block)) return

        const nextEnabled = result.formValues?.[0] === true
        if (nextEnabled) ensureMachineOutline(block, machineEntity)
        else removeMachineOutline(block)
    } catch (error) {
        console.warn(`[Machine Outline] Menu failed: ${error?.message ?? error}`)
    }
}

export function handleMachineOutlineInteract({ block, player }) {
    const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand")
    if (mainHand?.typeId !== WRENCH_ITEM_ID) return false

    const machineEntity = findMachineEntity(block)
    if (!machineEntity) return false

    if (player.isSneaking) {
        // The wrench rotates synchronously; defer one tick so we read the final facing.
        system.run(() => {
            const outline = findMachineOutlineEntity(block)
            if (outline?.isValid && machineEntity.isValid && isMachineOutlineSupported(block)) {
                syncMachineOutline(block, outline, machineEntity)
            }
        })
        return true
    }

    void openMachineOutlineMenu(block, player, machineEntity)
    return true
}

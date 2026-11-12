import * as DoriosLib from "DoriosLib/index.js"
import { system } from "@minecraft/server"
import { ModalFormData } from "@minecraft/server-ui"
import {
    getMachineUpgradeItemDefinition,
    getMachineUpgradeSlots
} from "../UtilityCore/machineUpgrades.js"
import { getOppositeFacingDirection } from "./machines/oppositeFacing.js"
import { getHarvesterOutlineTransform } from "./machines/harvesterArea.js"
import { getBlockOwner } from "../DoriosCore/utils/blockOwner.js"

export const MACHINE_OUTLINE_ENTITY_ID = "utilitycraft:machine_area_outline"

const WRENCH_ITEM_ID = "utilitycraft:wrench"
const OUTLINE_ENABLED_PROPERTY = "utilitycraft:outline_enabled"
const OUTLINE_COLOR_PROPERTY = "utilitycraft:outline_color"
const OUTLINE_SIZE_PROPERTY = "utilitycraft:outline_size"
const OUTLINE_DIMENSION_PROPERTIES = {
    width: "utilitycraft:outline_width",
    height: "utilitycraft:outline_height",
    depth: "utilitycraft:outline_depth"
}
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

/**
 * Resolves the block-backed machine owner used by outline settings.
 *
 * @param {import("@minecraft/server").Block|undefined} block Machine block.
 * @returns {object|undefined} Block owner, or undefined when no block exists.
 */
function findMachineEntity(block) {
    return block ? getBlockOwner(block) : undefined
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

    return Math.min(rangeSlot.max, definition.maxLevel, item.amount * definition.value)
}

function getFixedMachineTransform(block) {
    const direction = getOppositeFacingDirection(block)
    // Fixed-machine offsets are expressed in the outline entity's model space.
    // Vertical machines point to the adjacent block, unlike the Harvester crop plane.
    const offset = {
        north: { x: 0, y: 0, z: 1 },
        south: { x: 0, y: 0, z: -1 },
        west: { x: -1, y: 0, z: 0 },
        east: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        down: { x: 0, y: -1, z: 0 }
    }[direction] ?? { x: 0, y: 0, z: 0 }

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
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.width, transform.size)
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.height, 1)
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.depth, transform.size)
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

export function syncMachineOutlineIfNeeded(machine) {
    const outline = findMachineOutlineEntity(machine?.block)
    if (!outline || !machine?.entity) return

    const range = machine.block.typeId === "utilitycraft:harvester"
        ? Math.max(0, Math.floor(machine.boosts.range ?? 0))
        : undefined
    const expected = getMachineTransform(machine.block, machine.entity, range)
    if (
        outline.getProperty(OUTLINE_SIZE_PROPERTY) === expected.size
        && outline.getProperty(OUTLINE_DIMENSION_PROPERTIES.width) === expected.size
        && outline.getProperty(OUTLINE_DIMENSION_PROPERTIES.height) === 1
        && outline.getProperty(OUTLINE_DIMENSION_PROPERTIES.depth) === expected.size
        && outline.getProperty(OUTLINE_OFFSET_PROPERTIES.x) === expected.offset.x
        && outline.getProperty(OUTLINE_OFFSET_PROPERTIES.y) === expected.offset.y
        && outline.getProperty(OUTLINE_OFFSET_PROPERTIES.z) === expected.offset.z
    ) return
    syncMachineOutline(machine.block, outline, machine.entity, range)
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

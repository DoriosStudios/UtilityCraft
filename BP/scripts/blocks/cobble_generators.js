import { ItemStack } from "@minecraft/server"
import { resolveItemContainerAt } from "../DoriosCore/machinery/itemContainers.js"
import { getDirectionBetween, OPPOSITE_DIRECTIONS } from "../DoriosCore/utils/directions.js"
import * as DoriosContainer from "../DoriosLib/containers/index.js"

DoriosAPI.register.blockComponent("block_generator", {
    onTick({ block, dimension }, { params }) {
        let { x, y, z } = block.location

        const amount = Math.max(1, params?.amount ?? 1)
        const material = params?.material ?? "minecraft:cobblestone"

        // Facing direction offset
        const facing = block.getState("minecraft:facing_direction")
        const facingOffsets = {
            up: [0, -1, 0], down: [0, 1, 0],
            north: [0, 0, 1], south: [0, 0, -1],
            west: [1, 0, 0], east: [-1, 0, 0]
        }
        if (facingOffsets[facing]) {
            const [dx, dy, dz] = facingOffsets[facing]
            x += dx; y += dy; z += dz
        }

        // Progress stored in e0 / e1
        const e0 = block.getState("utilitycraft:e0")
        const e1 = block.getState("utilitycraft:e1")
        let quantity = e1 * 10 + e0

        // Insertar la produccion actual junto con el progreso acumulado.
        const insertAmount = Math.min(64, amount + quantity)

        let moved = 0
        try {
            const targetLocation = { x, y, z }
            const target = resolveItemContainerAt(dimension, targetLocation)
            if (target) {
                const direction = getDirectionBetween(block.location, targetLocation)
                moved = DoriosContainer.insert(target, {
                    item: new ItemStack(material, insertAmount),
                    face: OPPOSITE_DIRECTIONS[direction]
                })
            }
        } catch {
            moved = 0
        }

        quantity = Math.max(0, insertAmount - moved)

        const newE1 = Math.floor(quantity / 10)
        const newE0 = quantity % 10

        block.setState("utilitycraft:e0", newE0)
        block.setState("utilitycraft:e1", newE1)
    },
    onPlayerInteract({ block, player }, { params }) {
        const e0 = block.getState("utilitycraft:e0")
        const e1 = block.getState("utilitycraft:e1")
        const quantity = e1 * 10 + e0
        const material = params?.material ?? "minecraft:cobblestone"

        if (quantity > 0 && !player.getComponent("equippable")?.getEquipment("Mainhand")) {
            player.giveItem(material, quantity)
            block.setState("utilitycraft:e0", 0)
            block.setState("utilitycraft:e1", 0)
        }
    }
})


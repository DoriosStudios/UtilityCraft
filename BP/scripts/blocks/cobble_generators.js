DoriosAPI.register.blockComponent("cobble_generators", {
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

        // Intentar insertar usando amount + progreso acumulado
        const insertAmount = Math.min(64, amount + quantity)

        if (DoriosAPI.containers.addItemAt({ x, y, z }, dimension, material, insertAmount)) {
            block.setState("utilitycraft:e0", 0)
            block.setState("utilitycraft:e1", 0)
            return
        }

        quantity = Math.min(64, quantity + amount)

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

import { ItemStack, system, world } from "@minecraft/server";

DoriosAPI.register.itemComponent("block_loot", {
    onMineBlock({ minedBlockPermutation, block }, { params }) {
        // Normalize params → always an array
        const paramArray = Array.isArray(params) ? params : [params];

        const blockId = minedBlockPermutation.getItemStack(1).typeId;

        for (const cfg of paramArray) {
            const {
                blockTypes = [],
                blockEndsWith = "leaves",
                item = "minecraft:stick",
                chance = 1,
                amount = 1
            } = cfg;

            // Validate by suffix
            if (!blockId.endsWith(blockEndsWith)) continue;

            // Validate by whitelist (if provided)
            if (blockTypes.length > 0 && !blockTypes.includes(blockId)) continue;

            // Roll chance
            if (Math.random() > chance) continue;

            // Resolve quantity
            const qty = Array.isArray(amount)
                ? DoriosAPI.math.randomInterval(amount[0], amount[1])
                : amount;

            if (qty <= 0) continue;

            const { x, y, z } = block.location;
            block.dimension.spawnItem(new ItemStack(item, qty), { x, y, z });
        }
    }
});

/**
 * ScriptEvent handler to simulate block_loot mining at given coordinates.
 * Checks loot configuration, rolls chance, and spawns the configured item.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e

    if (id === 'dorios:blockLoot') {
        try {
            const [x, y, z] = message.split(',').map(Number)
            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const blockId = block.typeId

            // Get loot parameters from the item in main hand
            const eq = sourceEntity.getComponent('equippable')
            const main = eq?.getEquipment('Mainhand')

            const lootComp = main?.getComponent('utilitycraft:block_loot')
            const params = lootComp?.customComponentParameters.params ?? []
            const paramArray = Array.isArray(params) ? params : [params]

            for (const cfg of paramArray) {
                const {
                    blockTypes = [],
                    blockEndsWith = "leaves",
                    item = "minecraft:stick",
                    chance = 1,
                    amount = 1
                } = cfg

                // Validate suffix
                if (!blockId.endsWith(blockEndsWith)) {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                    continue
                }

                // Validate whitelist
                if (blockTypes.length > 0 && !blockTypes.includes(blockId)) {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                    continue
                }

                // Roll chance
                if (Math.random() > chance) {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                    continue
                }

                // Determine amount
                const qty = Array.isArray(amount)
                    ? DoriosAPI.math.randomInterval(amount[0], amount[1])
                    : amount

                if (qty <= 0) {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                    continue
                }

                const dropPos = { x: x + 0.5, y: y + 0.2, z: z + 0.5 }

                system.run(() => {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`)
                    dim.spawnItem(new ItemStack(item, qty), dropPos)
                })
            }
        } catch (err) {
            console.warn(`[blockLoot] Error: ${err}`)
        }
    }
})

import { ItemStack, system } from "@minecraft/server"
import { cropsDrops, data } from "../config/recipes/plants.js"

DoriosAPI.register.blockComponent("crop", {
    onTick({ block }) {
        const age = block.getState("utilitycraft:age")
        if (age < 5) {
            block.setState("utilitycraft:age", age + 1)
        }
    },

    onPlayerInteract({ block, player }) {
        const blockId = block.typeId
        const crop = data[blockId]
        if (!crop) return

        const mainHand = player.getComponent("equippable").getEquipment("Mainhand")
        const age = block.getState("utilitycraft:age")

        // Fully grown crop
        if (age === 5) {
            const enchantable = mainHand?.getComponent("minecraft:enchantable")
            const fortune = enchantable?.getEnchantment("minecraft:fortune")

            if (!fortune) {
                const { x, y, z } = block.location
                block.dimension.runCommand(`loot spawn ${x} ${y} ${z} loot "${crop.loot}"`)
            } else {
                const drops = cropsDrops[crop.seed]?.drops ?? []
                const fortuneLevel = fortune.level

                drops.forEach(drop => {
                    const randomChance = Math.random() * 100
                    if (randomChance <= drop.prob) {
                        if (drop.item.endsWith("_seeds")) {
                            player.giveItem(drop.item, block)
                        } else {
                            const amount = DoriosAPI.math.randomInterval(drop.min, drop.max * fortuneLevel)
                            block.dimension.spawnItem(new ItemStack(drop.item, amount), block.location)
                        }
                    }
                })
            }

            system.run(() => {
                let { x, y, z } = block.location;
                if (mainHand?.getComponent("utilitycraft:hoe")?.customComponentParameters?.params?.runTractor ?? false) {
                    block.dimension.runCommand(
                        `execute positioned ${x} ${y} ${z} run function tractor`
                    );
                }
            })


            block.dimension.playSound("dig.grass", block.location)
            block.setState("utilitycraft:age", 0)
        }
    },
    onPlayerBreak({ brokenBlockPermutation, block }) {
        const blockId = brokenBlockPermutation.type.id
        const crop = data[blockId]
        if (!crop) return

        const { x, y, z } = block.location
        const age = brokenBlockPermutation.getState("utilitycraft:age")
        if (age === 5) {
            block.dimension.spawnItem(new ItemStack(crop.seed, 1), { x, y, z })
        }
    },

})

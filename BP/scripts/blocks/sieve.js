import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, world } from "@minecraft/server"
import { sieveRecipes, acceptedBlocks } from "../config/recipes/sieve.js"
import { stackRefillUse } from "stackRefill.js"

const utility_meshes = new Set([
    "utilitycraft:string_mesh",
    "utilitycraft:flint_mesh",
    "utilitycraft:copper_mesh",
    "utilitycraft:iron_mesh",
    "utilitycraft:golden_mesh",
    "utilitycraft:emerald_mesh",
    "utilitycraft:diamond_mesh",
    "utilitycraft:netherite_mesh"
])

// The sieve block input is encoded as two decimal states because Bedrock only
// permits up to 16 values in a single block-state enum.
const sieveBlockTypes = [
    "empty",
    "minecraft:gravel",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:sand",
    "minecraft:soul_sand",
    "utilitycraft:compressed_gravel",
    "utilitycraft:compressed_dirt",
    "utilitycraft:compressed_sand",
    "utilitycraft:crushed_netherrack",
    "utilitycraft:crushed_blackstone",
    "utilitycraft:crushed_endstone",
    "utilitycraft:crushed_cobbled_deepslate",
    "utilitycraft:compressed_crushed_netherrack",
    "utilitycraft:compressed_crushed_blackstone",
    "utilitycraft:compressed_crushed_endstone",
    "utilitycraft:compressed_crushed_cobbled_deepslate"
]

const sieveBlockTypeCodes = new Map(sieveBlockTypes.map((typeId, index) => [typeId, index]))

/**
 * Represents a single sieve block with utility methods.
 */
class Sieve {
    /**
     * @param {import("@minecraft/server").Block} block 
     */
    constructor(block) {
        this.block = block
        this.perm = block.permutation
    }

    get mesh() { return this.perm.getState("utilitycraft:mesh") }
    get blockType() {
        const e0 = Number(this.perm.getState("utilitycraft:block_e0"))
        const e1 = Number(this.perm.getState("utilitycraft:block_e1"))
        return sieveBlockTypes[e1 * 10 + e0] ?? "empty"
    }
    get stage() { return this.perm.getState("utilitycraft:state") }

    setBlockType(typeId) {
        const code = sieveBlockTypeCodes.get(typeId)
        if (code === undefined) return false

        return DoriosLib.block.setStates(this.block, {
            "utilitycraft:block_e0": code % 10,
            "utilitycraft:block_e1": Math.floor(code / 10)
        })
    }

    insertMesh(player, itemId) {
        if (this.mesh !== "empty") return false
        DoriosLib.block.setState(this.block, "utilitycraft:mesh", itemId.split(":")[1])
        if (!DoriosLib.player.isCreative(player)) {
            player.runCommand(`clear @s ${itemId} 0 1`)
        }
        return true
    }

    removeMesh(player) {
        if (this.mesh === "empty" || this.blockType !== "empty" || this.stage !== 0) return false

        DoriosLib.player.giveItem(player, { item: "utilitycraft:" + this.mesh })

        DoriosLib.block.setState(this.block, "utilitycraft:mesh", "empty")
        DoriosLib.block.setState(this.block, "utilitycraft:state", 0)
        return true
    }

    /**
     * Swap the current mesh with a new one from player's hand.
     * Drops/returns the old mesh and equips the new one.
     * @param {import("@minecraft/server").Player} player
     * @param {string} newMeshId - e.g. "utilitycraft:iron_mesh"
     */
    swapMesh(player, newMeshId) {
        if (this.mesh === "empty") return false

        // Devuelve la malla vieja
        DoriosLib.player.giveItem(player, { item: "utilitycraft:" + this.mesh })

        // Coloca la nueva
        DoriosLib.block.setState(this.block, "utilitycraft:mesh", newMeshId.split(":")[1])
        if (!DoriosLib.player.isCreative(player)) {
            player.runCommand(`clear @s ${newMeshId} 0 1`)
        }

        this.block.dimension.playSound?.("item.armor.equip_chain", this.block.location)
        return true
    }

    insertBlock(player, mainHand) {
        if (this.mesh === "empty" || this.blockType !== "empty" || this.stage !== 0) return false
        if (!sieveRecipes[mainHand.typeId] || !acceptedBlocks.includes(mainHand.typeId)) return false
        const id = mainHand.typeId
        if (!this.setBlockType(mainHand.typeId)) return false
        DoriosLib.block.setState(this.block, "utilitycraft:state", 4)
        if (!DoriosLib.player.isCreative(player)) {
            player.runCommand(`clear @s ${mainHand.typeId} 0 1`)
            stackRefillUse(player, id)

        }
        this.block.dimension.playSound("dig.gravel", this.block.location)
        return true
    }

    processStage() {
        if (this.stage > 1 && this.blockType !== "empty" && this.mesh !== "empty") {
            DoriosLib.block.setState(this.block, "utilitycraft:state", this.stage - 1)
            this.block.dimension.playSound("dig.gravel", this.block.location)
            return true
        }
        return false
    }

    finishFiltering() {
        if (this.stage !== 1 || this.blockType === "empty" || this.mesh === "empty") return false

        const { x, y, z } = this.block.location
        const meshItem = Sieve.meshesItemStack["utilitycraft:" + this.mesh]
        if (!meshItem) return false
        const meshData = meshItem.getComponent('utilitycraft:mesh')?.customComponentParameters?.params
        if (!meshData) return false
        const multi = meshData.multiplier
        const tier = meshData.tier
        const amountMultiplier = Number(meshData.amount_multiplier ?? 1)
        const sievableBlock = sieveRecipes[this.blockType]
        if (!sievableBlock) return false
        sievableBlock.forEach(loot => {
            if (tier < (loot.tier ?? 0)) return
            if (loot.item == 'minecraft:flint' && tier >= 7) return
            if (Math.random() <= loot.chance * multi) {
                let qty = Array.isArray(loot.amount)
                    ? DoriosLib.math.randomInt(loot.amount[0], loot.amount[1])
                    : (typeof loot.amount === 'number' ? loot.amount : 1)

                if (Number.isFinite(amountMultiplier) && amountMultiplier > 0) {
                    qty *= amountMultiplier
                }

                qty = Math.max(1, Math.floor(qty))

                try {
                    this.block.dimension.spawnItem(new ItemStack(loot.item, qty), {
                        x: x + 0.25 + Math.random() / 2,
                        y: y + 0.75,
                        z: z + 0.25 + Math.random() / 2
                    })
                } catch { }
            }
        })

        this.setBlockType("empty")
        DoriosLib.block.setState(this.block, "utilitycraft:state", 0)
        this.block.dimension.playSound("dig.gravel", this.block.location)
        return true
    }
    /**
        * Hashmap of all sieve meshes.
        * Keys are mesh item identifiers,
        * values are plain ItemStack objects.
        * 
        * @type {ItemStack}
        */
    static meshesItemStack = {}
}

world.afterEvents.worldLoad.subscribe(() => {
    Sieve.meshesItemStack = {
        "utilitycraft:string_mesh": new ItemStack("utilitycraft:string_mesh"),
        "utilitycraft:flint_mesh": new ItemStack("utilitycraft:flint_mesh"),
        "utilitycraft:copper_mesh": new ItemStack("utilitycraft:copper_mesh"),
        "utilitycraft:iron_mesh": new ItemStack("utilitycraft:iron_mesh"),
        "utilitycraft:golden_mesh": new ItemStack("utilitycraft:golden_mesh"),
        "utilitycraft:emerald_mesh": new ItemStack("utilitycraft:emerald_mesh"),
        "utilitycraft:diamond_mesh": new ItemStack("utilitycraft:diamond_mesh"),
        "utilitycraft:netherite_mesh": new ItemStack("utilitycraft:netherite_mesh")
    }

})

DoriosLib.registry.blockComponent("utilitycraft:sieve", {
    onPlayerInteract(e) {
        const { block, player } = e
        const mainHand = player.getComponent("equippable").getEquipment("Mainhand")
        const sieve = new Sieve(block)

        // Sneak + empty hand → remove mesh
        if (!mainHand && player.isSneaking) {
            sieve.removeMesh(player)
            return
        }

        // Block non-UtilityCraft meshes from being inserted/swapped in manual sieve.
        if (mainHand?.hasComponent('utilitycraft:mesh') && !utility_meshes.has(mainHand.typeId)) {
            player.sendMessage({
                rawtext: [{ translate: "message.utilitycraft.invalid_mesh" }]
            })
            return
        }

        // Insert or swap mesh
        if (mainHand?.hasComponent('utilitycraft:mesh')) {
            if (sieve.mesh === "empty") {
                sieve.insertMesh(player, mainHand.typeId)
            } else {
                sieve.swapMesh(player, mainHand.typeId)
            }
            return
        }

        let remaining = mainHand?.amount ?? 0
        const radius = 2
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const sieveBlock = block.dimension.getBlock({
                    x: block.location.x + dx,
                    y: block.location.y,
                    z: block.location.z + dz
                })

                if (!sieveBlock) continue
                if (sieveBlock.typeId !== "utilitycraft:sieve") continue

                const sieve = new Sieve(sieveBlock)

                if (mainHand && remaining > 0 && sieve.insertBlock(player, mainHand)) {
                    remaining--
                }

                if (sieve.stage === 1) {
                    sieve.finishFiltering()
                } else {
                    sieve.processStage()
                }
            }
        }
    },
    onPlayerBreak(e) {
        const { brokenBlockPermutation, block } = e
        const mesh = brokenBlockPermutation.getState("utilitycraft:mesh")
        if (mesh !== "empty") {
            block.dimension.spawnItem(new ItemStack(`${"utilitycraft:" + mesh}`, 1), block.center())
        }
    }
})

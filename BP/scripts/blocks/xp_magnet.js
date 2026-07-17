import * as DoriosLib from "DoriosLib/index.js";
import { ModalFormData } from "@minecraft/server-ui"

/**
 * XP Magnet Block Component
 * - Pulls nearby XP orbs into its position.
 * - Allows players to configure radius and on/off state via UI.
 */
DoriosLib.registry.blockComponent("utilitycraft:xp_magnet", {
    onTick(e) {
        const { block } = e
        const { x, y, z } = block.location

        const isOn = block.permutation.getState("utilitycraft:isOn")
        const range = block.permutation.getState("utilitycraft:rangeSelected")

        if (isOn) {
            block.dimension.runCommand(
                `tp @e[type=xp_orb,r=${range},x=${x},y=${y},z=${z}] ${x} ${y + 0.1} ${z}`
            )
        }
    },
    onPlayerInteract(e) {
        const { block, player } = e
        const hand = player.getComponent("equippable").getEquipment("Mainhand")

        // Only open menu if empty-handed and not sneaking
        if (!hand && !player.isSneaking) {
            const isOn = block.permutation.getState("utilitycraft:isOn")
            const range = block.permutation.getState("utilitycraft:rangeSelected")

            const modalForm = new ModalFormData()
                .title("XP Magnet Settings")
                .toggle("Off/On", { defaultValue: isOn })
                .slider("Radius", 0, 11, { defaultValue: range })

            modalForm.show(player).then(formData => {
                if (!formData.canceled && formData.formValues) {
                    const [newOn, newRange] = formData.formValues
                    block.setPermutation(block.permutation.withState("utilitycraft:isOn", newOn))
                    block.setPermutation(block.permutation.withState("utilitycraft:rangeSelected", newRange))
                }
            })
        }
    }
})

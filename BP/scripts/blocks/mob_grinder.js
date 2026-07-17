import * as DoriosLib from "DoriosLib/index.js";
import { ModalFormData } from "@minecraft/server-ui";
import { world, system } from "@minecraft/server";

// --- Tick global --- //
// let GLOBAL_TICK = 0;
// system.runInterval(() => {
//     GLOBAL_TICK++;
//     if (GLOBAL_TICK >= 1000) GLOBAL_TICK = 0;
// }, 1);


/**
 * Mob Grinder Block Component
 * - Inflicts continuos damage on the entity within the block's effect radius
 * - Accepts range and (upcoming) damage upgrades
 * - Allows players to configure radius, damage and on/off state via UI.
 */
DoriosLib.registry.blockComponent("utilitycraft:mob_grinder", {
    onTick({ block: grinder, dimension }) {
        const { x, y, z } = grinder.location;
        const id = `mob_grinder_${x}_${y}_${z}`;

        // isOn pode vir como boolean ou string "true"
        const isOnState = DoriosLib.block.getState(grinder, 'utilitycraft:isOn');
        const isOn = isOnState === true || isOnState === "true";
        if (!isOn) return

        // Limit
        let rangeUpgrade = Number(grinder.permutation.getState("utilitycraft:range"));
        if (Number.isNaN(rangeUpgrade)) rangeUpgrade = 0;

        let damageUpgrade = Number(grinder.permutation.getState("utilitycraft:damage"));
        if (Number.isNaN(damageUpgrade)) damageUpgrade = 0;

        // níveis escolhidos pelo jogador (dentro do teto)
        let rangeSelected = Number(world.getDynamicProperty(`${id}_rangeSelected`));
        if (Number.isNaN(rangeSelected)) rangeSelected = rangeUpgrade;

        let damageSelected = Number(world.getDynamicProperty(`${id}_damageSelected`));
        if (Number.isNaN(damageSelected)) damageSelected = damageUpgrade;

        // mapa de alcance (index corresponde ao level)
        let rangeMap = [0.5, 1, 1.5, 2, 2.5]; // mantém o seu mapa original; index 0 já é válido
        const maxIndex = rangeMap.length - 1;

        // garante índice seguro dentro do array
        const clampIndex = (i) => Math.max(0, Math.min(Math.floor(i), maxIndex));

        const trueRange = rangeMap[clampIndex(rangeSelected)];

        // garante damage mínimo 0
        const damageAmount = Math.max(0, Math.floor(damageSelected));

        dimension.runCommand(
            `damage @e[r=${trueRange}, type=!item, type=!player, family=!inanimate, x=${x + 0.5}, y=${y}, z=${z + 0.5}] ${damageAmount} none entity @p`
        );
    },

    onPlayerInteract(e) {
        const { block, player } = e;
        const { x, y, z } = block.location;
        const id = `mob_grinder_${x}_${y}_${z}`;

        const hand = player.getComponent("equippable").getEquipment("Mainhand");

        // Only open menu if empty-handed and not sneaking
        if (!hand) {
            let isOn = DoriosLib.block.getState(block, 'utilitycraft:isOn')

            // teto (upgrades)
            let rangeUpgrade = Number(block.permutation.getState("utilitycraft:range"));
            if (Number.isNaN(rangeUpgrade)) rangeUpgrade = 0;

            let damageUpgrade = Number(block.permutation.getState("utilitycraft:damage"));
            if (Number.isNaN(damageUpgrade)) damageUpgrade = 0;

            // selecionados (nível atual do jogador)
            let rangeSelected = Number(world.getDynamicProperty(`${id}_rangeSelected`));
            if (Number.isNaN(rangeSelected)) rangeSelected = rangeUpgrade;

            let damageSelected = Number(world.getDynamicProperty(`${id}_damageSelected`));
            if (Number.isNaN(damageSelected)) damageSelected = damageUpgrade;

            // limites do design
            const RANGE_CAP = 4;
            const DAMAGE_CAP = 8;

            // limita o teto pelos caps do design e pelo tamanho do rangeMap (se necessário)
            const rangeMapLength = 5; // se você mudar rangeMap no onTick, mantenha o mesmo tamanho aqui
            const maxRange = Math.min(rangeUpgrade, RANGE_CAP, rangeMapLength - 1);
            const maxDamage = Math.min(damageUpgrade, DAMAGE_CAP);

            const modalForm = new ModalFormData()
                .title("Mob Grinder Settings")
                .toggle("Off/On", { defaultValue: isOn })
                // Range suporta 0 (conforme você comentou) -> slider de 0 a maxRange
                .slider("§9Range §rLevel", 0, maxRange, { defaultValue: Math.min(rangeSelected, maxRange) })
                .slider("§cDamage §rLevel", 1, maxDamage, { defaultValue: Math.min(damageSelected, maxDamage) });

            modalForm.show(player).then(formData => {
                if (!formData.canceled && formData.formValues) {
                    const [newOn, newRangeSelected, newDamageSelected] = formData.formValues;

                    // salva apenas os valores selecionados — não sobrescreve os tetos (upgrades)
                    DoriosLib.block.setState(block, 'utilitycraft:isOn', newOn)
                    world.setDynamicProperty(`${id}_rangeSelected`, newRangeSelected);
                    world.setDynamicProperty(`${id}_damageSelected`, newDamageSelected);
                }
            });
        }
    }
});
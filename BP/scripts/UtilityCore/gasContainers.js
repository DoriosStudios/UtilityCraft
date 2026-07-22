import * as DoriosLib from "DoriosLib/index.js";
import { GasStorage, Generator, Rotation } from "DoriosCore/index.js"
import { system, ItemStack, world } from '@minecraft/server'

DoriosLib.registry.blockComponent("utilitycraft:gas_container", {
    onPlayerInteract({ block, player, face }) {
        /** @type {ItemStack} */
        const mainHand = DoriosLib.entity.getEquipment(player, 'Mainhand');

        const dim = block.dimension;
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (mainHand?.typeId?.includes('wrench')) {
            if (!player.isSneaking) {
                if (entity && block.hasTag('dorios:generator')) Generator.openGeneratorTransferModeMenu(entity, player)
                return
            }
            Rotation.handleRotation(block, face)
            return
        }

        const isTank = block.typeId.includes('gas_tank');

        // ─── Sin ítem en mano ───────────────────────────────
        if (!mainHand) {
            if (isTank) {
                const tankEntity = dim.getEntitiesAtBlockLocation(block.location)[0];
                if (!tankEntity) {
                    player.onScreenDisplay.setActionBar('§7Tank: §fEmpty');
                    return;
                }

                const tank = new GasStorage(tankEntity, 0);
                const type = tank.getType();
                const amount = tank.get();
                const cap = tank.getCap();
                const percent = ((amount / cap) * 100).toFixed(2);

                if (type === 'empty' || amount === 0) {
                    player.onScreenDisplay.setActionBar('§7Tank: §fEmpty');
                    return;
                }

                player.onScreenDisplay.setActionBar(
                    `§b${DoriosLib.text.formatIdentifier(type)}: §f${GasStorage.formatGas(amount)}§7 / §f${GasStorage.formatGas(cap)} §7(${percent}%)`
                );
                return;
            }

            if (entity) {
                const gas = new GasStorage(entity, 0);
                const type = gas.getType();
                const amount = gas.get();
                const cap = gas.getCap();
                const percent = ((amount / cap) * 100).toFixed(2);

                if (type === 'empty' || amount === 0) {
                    player.onScreenDisplay.setActionBar('§7Gas: §fEmpty');
                    return;
                }

                player.onScreenDisplay.setActionBar(
                    `§b${DoriosLib.text.formatIdentifier(type)}: §f${GasStorage.formatGas(amount)}§7 / §f${GasStorage.formatGas(cap)} §7(${percent}%)`
                );
            }
            return;
        }

        // ─── Interacción con tanques ─────────────────────────
        if (isTank) {
            let tankEntity = dim.getEntitiesAtBlockLocation(block.location)[0];

            // Si no existe la entidad, obtener el tipo del ítem antes de spawnearla
            if (!tankEntity) {
                const insertData = GasStorage.getContainerData(mainHand.typeId);
                const gasType = insertData ? insertData.type : "empty";
                if (gasType == 'empty') return
                tankEntity = GasStorage.addGasToTank(block, gasType, 0);
            }

            const gas = new GasStorage(tankEntity, 0);
            const result = gas.gasItem(mainHand.typeId);
            if (result === false) return;

            const type = gas.getType();
            const amount = gas.get();
            const cap = gas.getCap();
            const percent = ((amount / cap) * 100).toFixed(2);

            player.onScreenDisplay.setActionBar(
                `§b${DoriosLib.text.formatIdentifier(type)}: §f${GasStorage.formatGas(amount)}§7 / §f${GasStorage.formatGas(cap)} §7(${percent}%)`
            );

            if (!DoriosLib.player.isCreative(player)) {
                GasStorage.replaceHeldGasItem(player, mainHand.typeId, result || undefined);
            }


            if (gas.get() <= 0) { tankEntity.remove() } else {
                DoriosLib.entity.setHealth(tankEntity, gas.get());
            }

            return;
        }

        // ─── Interacción con máquinas ─────────────────────────
        if (!entity) return;
        GasStorage.handleGasItemInteraction(player, entity, mainHand)
    },
    beforeOnPlayerPlace({ block, player }, { params }) {
        /** @type {ItemStack} */
        const mainHand = DoriosLib.entity.getEquipment(player, 'Mainhand')

        if (params.type == 'tank') {
            const itemInfo = mainHand.getLore()
            const gasLine = (itemInfo.includes('Energy')) ? itemInfo[1] : itemInfo[0]
            if (gasLine) {
                const { type, amount } = GasStorage.getGasFromText(gasLine)
                system.run(() => {
                    GasStorage.addGasToTank(block, type, amount)
                })
            }
        }
    },
    onPlayerBreak({ brokenBlockPermutation, block, player }, { params }) {
        if (params.type !== 'tank') return;

        const dim = block.dimension;
        const entity = dim.getEntitiesAtBlockLocation(block.location)
            .find(e => e.typeId.includes("tank"));
        if (!entity) return;

        const gas = new GasStorage(entity);
        const blockItemId = brokenBlockPermutation.type.id;
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        // Gas lore
        if (gas.type !== 'empty' && gas.get() > 0) {
            const gasName = DoriosLib.text.formatIdentifier(gas.type);
            lore.push(
                `§r§7  ${gasName}: ${GasStorage.formatGas(gas.get())}/${GasStorage.formatGas(gas.cap)}`
            );
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        // Drop item and cleanup
        system.run(() => {
            if (!DoriosLib.player.isCreative(player)) {
                dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId)
                    ?.remove();
            }

            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
    }
})

import { FluidStorage, Generator, Rotation } from "DoriosCore/index.js"
import { system, ItemStack, world } from '@minecraft/server'

DoriosAPI.register.blockComponent("fluid_container", {
    onPlayerInteract({ block, player, face }) {
        /** @type {ItemStack} */
        const mainHand = player.getEquipment('Mainhand');

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

        const isTank = block.typeId.includes('fluid_tank');

        // ─── Sin ítem en mano ───────────────────────────────
        if (!mainHand) {
            if (isTank) {
                const tankEntity = dim.getEntitiesAtBlockLocation(block.location)[0];
                if (!tankEntity) {
                    player.onScreenDisplay.setActionBar('§7Tank: §fEmpty');
                    return;
                }

                const tank = new FluidStorage(tankEntity, 0);
                const type = tank.getType();
                const amount = tank.get();
                const cap = tank.getCap();
                const percent = ((amount / cap) * 100).toFixed(2);

                if (type === 'empty' || amount === 0) {
                    player.onScreenDisplay.setActionBar('§7Tank: §fEmpty');
                    return;
                }

                player.onScreenDisplay.setActionBar(
                    `§b${DoriosAPI.utils.formatIdToText(type)}: §f${FluidStorage.formatFluid(amount)}§7 / §f${FluidStorage.formatFluid(cap)} §7(${percent}%)`
                );
                return;
            }

            if (entity) {
                const fluid = new FluidStorage(entity, 0);
                const type = fluid.getType();
                const amount = fluid.get();
                const cap = fluid.getCap();
                const percent = ((amount / cap) * 100).toFixed(2);

                if (type === 'empty' || amount === 0) {
                    player.onScreenDisplay.setActionBar('§7Fluid: §fEmpty');
                    return;
                }

                player.onScreenDisplay.setActionBar(
                    `§b${DoriosAPI.utils.formatIdToText(type)}: §f${FluidStorage.formatFluid(amount)}§7 / §f${FluidStorage.formatFluid(cap)} §7(${percent}%)`
                );
            }
            return;
        }

        // ─── Interacción con tanques ─────────────────────────
        if (isTank) {
            let tankEntity = dim.getEntitiesAtBlockLocation(block.location)[0];

            // Si no existe la entidad, obtener el tipo del ítem antes de spawnearla
            if (!tankEntity) {
                const insertData = FluidStorage.getContainerData(mainHand.typeId);
                const fluidType = insertData ? insertData.type : "empty";
                if (fluidType == 'empty') return
                tankEntity = FluidStorage.addfluidToTank(block, fluidType, 0);
            }

            const fluid = new FluidStorage(tankEntity, 0);
            const result = fluid.fluidItem(mainHand.typeId);
            if (result === false) return;

            const type = fluid.getType();
            const amount = fluid.get();
            const cap = fluid.getCap();
            const percent = ((amount / cap) * 100).toFixed(2);

            player.onScreenDisplay.setActionBar(
                `§b${DoriosAPI.utils.formatIdToText(type)}: §f${FluidStorage.formatFluid(amount)}§7 / §f${FluidStorage.formatFluid(cap)} §7(${percent}%)`
            );

            if (!player.isInCreative()) {
                player.changeItemAmount(player.selectedSlotIndex, -1);
                if (result) player.giveItem(result);
            }


            if (fluid.get() <= 0) { tankEntity.remove() } else {
                tankEntity.setHealth(fluid.get());
            }

            return;
        }

        // ─── Interacción con máquinas ─────────────────────────
        if (!entity) return;
        FluidStorage.handleFluidItemInteraction(player, entity, mainHand)
    },
    beforeOnPlayerPlace({ block, player }, { params }) {
        /** @type {ItemStack} */
        const mainHand = player.getEquipment('Mainhand')

        if (params.type == 'tank') {
            const itemInfo = mainHand.getLore()
            const fluidLine = (itemInfo.includes('Energy')) ? itemInfo[1] : itemInfo[0]
            if (fluidLine) {
                const { type, amount } = FluidStorage.getFluidFromText(fluidLine)
                system.run(() => {
                    FluidStorage.addfluidToTank(block, type, amount)
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

        const fluid = new FluidStorage(entity);
        const blockItemId = brokenBlockPermutation.type.id;
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        // Fluid lore
        if (fluid.type !== 'empty' && fluid.get() > 0) {
            const liquidName = DoriosAPI.utils.formatIdToText(fluid.type);
            lore.push(
                `§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`
            );
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        // Drop item and cleanup
        system.run(() => {
            if (!player.isInCreative()) {
                dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId)
                    ?.remove();
            }

            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
    }
})

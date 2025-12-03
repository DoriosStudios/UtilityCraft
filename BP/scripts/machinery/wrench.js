import { world, ItemStack, system, BlockType } from "@minecraft/server";
import { Rotation, Generator } from './DoriosMachinery/core.js'


// Nombres de entidades removibles
const REMOVABLE_ENTITIES = [
    "utilitycraft:tractor",
    "utilitycraft:drill"
];

// --- REGISTRO DEL COMPONENTE ---
DoriosAPI.register.itemComponent("wrench", {
    /**
     * Se ejecuta cuando el jugador usa la wrench sobre un bloque.
     * Soporta tanto rotaciones vanilla como el sistema de 24 rotaciones de UtilityCraft.
     */
    onUseOn(e) {
        const { source, block, blockFace } = e;
        if (!source.isSneaking) {
            if (!block.hasTag('dorios:energy')) return
            const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
            if (!entity || !entity.getComponent('type_family').hasTypeFamily('dorios:energy_source')) return
            Generator.openGeneratorTransferModeMenu(entity, source)
            return
        }
        Rotation.handleRotation(block, blockFace)
    },
});

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, itemStack }) => {
    if (!itemStack || itemStack.typeId != 'utilitycraft:wrench') return
    if (!player.isSneaking) {
        // if (!target.getComponent('type_family').hasTypeFamily('dorios:energy_source')) return
        // Generator.openGeneratorTransferModeMenu(target, player)
        // return
    }
    const dim = player.dimension
    if (target && REMOVABLE_ENTITIES.includes(target.typeId)) {
        // --- DROPEAR INVENTARIO ---
        target.dropAllItems();
        // --- SPAWNEAR EL ITEM DEL MISMO ID ---
        dim.spawnItem(new ItemStack(target.typeId + '_placer', 1), target.location);
        // --- REMOVER ENTIDAD ---
        target.remove();
        player.playSound("random.anvil_land", { volume: 0.5 });
        return;
    }
})

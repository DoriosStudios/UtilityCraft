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
        if (block.typeId.includes("receiver") || block.typeId.includes("transmitter")) {
            toggleEnergyMode(block, source)
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

/**
 * Toggles an Energy block between Receiver and Transmitter mode.
 * - Preserves tier (basic, advanced, expert, ultimate)
 * - Preserves block states (rotation, etc.)
 * - Updates linked entity nameTag
 * - Sends action bar feedback to the player
 *
 * @param {Block} block
 * @param {Player} player
 */
function toggleEnergyMode(block, player) {
    if (!block?.typeId) return;

    const { dimension, location, typeId } = block;

    const [namespace, id] = typeId.split(":");
    const parts = id.split("_"); // basic_energy_receiver
    if (parts.length < 3) return;

    const tier = parts[0];
    const currentType = parts[2]; // "receiver" | "transmitter"

    const newType = currentType === "receiver"
        ? "transmitter"
        : "receiver";

    const newId = `${namespace}:${tier}_energy_${newType}`;

    // Change block
    block.setType(newId);

    const entity = dimension.getEntitiesAtBlockLocation(location)[0];
    if (entity) {

        // Update name (no tier)
        entity.nameTag = newType === "transmitter"
            ? "entity.utilitycraft:transmitter.name"
            : "entity.utilitycraft:receiver.name";

        // Handle receiver tag
        if (newType === "receiver") {
            if (!entity.hasTag("dorios:receiver")) {
                entity.addTag("dorios:receiver");
            }
        } else {
            if (entity.hasTag("dorios:receiver")) {
                entity.removeTag("dorios:receiver");
            }
        }
    }

    // Action bar feedback
    if (player) {
        const message = newType === "transmitter"
            ? "§cMode: §fTransmitting Energy"
            : "§aMode: §fReceiving Energy";

        DoriosAPI.utils.actionBar(player, message);
    }
}
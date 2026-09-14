import { world, system } from '@minecraft/server';
import { ItemEnergyStorage } from '../DoriosCore/machinery/itemEnergyStorage.js';

// Initialize fresh tagged items once, after the inventory transaction completes.
world.afterEvents.playerInventoryItemChange.subscribe(({ player, slot, itemStack }) => {
    if (!itemStack?.hasTag(ItemEnergyStorage.TAG) || itemStack.getComponent('minecraft:durability')?.damage !== 0) return;
    const typeId = itemStack.typeId;
    // Finish the inventory transaction before reading and writing its destination.
    system.run(() => {
        if (player.isValid === false) return;
        try {
            const inventory = player.getComponent('minecraft:inventory')?.container;
            if (!inventory || slot < 0 || slot >= inventory.size) return;
            const item = inventory.getItem(slot);
            if (item?.typeId !== typeId || !item.hasTag(ItemEnergyStorage.TAG)) return;
            const storage = new ItemEnergyStorage(item);
            if (storage.durability?.damage !== 0) return;
            if (!storage.isValid) {
                console.warn(`[UtilityCore:ItemEnergyStorage] Cannot initialize ${typeId}: invalid energy container (max durability: ${storage.durability?.maxDurability}).`);
                return;
            }
            storage.set(0); // 100 remaining durability, not 100 damage.
            storage.display();
            inventory.setItem(slot, item);
        } catch (error) {
            console.warn(`[UtilityCore:ItemEnergyStorage] Initialization failed for ${typeId} in slot ${slot}: ${error}`);
        }
    });
});

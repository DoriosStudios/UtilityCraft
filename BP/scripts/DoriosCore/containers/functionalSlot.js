import { EntityComponentTypes } from "@minecraft/server";

export class FunctionalSlot {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Called once when the slot is registered in a selective container.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {number} slotIndex
   * @param {import("@minecraft/server").Entity | import("@minecraft/server").Block | undefined} inGameEntity
   */
  onInitialize(container, slotIndex, inGameEntity) { }

  /**
   * Called every time the observed slot changes.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {object} event
   */
  onItemChange(container, event) { }

  /**
   * Called when the slot transitions from an item to empty.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {object} event
   */
  onItemPickup(container, event) { }

  /**
   * Called after onItemChange when the slot contains an item.
   *
   * Subclasses can treat this as their accepted-item hook.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {object} event
   */
  onAllowedItem(container, event) { }

  /**
   * Restores a fixed slot item after a pickup/click interaction.
   *
   * It clears the matching item from cursor and player inventory,
   * then places the original item back into the watched slot.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {object} event
   * @param {import("@minecraft/server").ItemStack | undefined} restoreItem
   */
  restoreButtonItem(container, event, restoreItem) {
    if (!container || !restoreItem) return;

    const clonedRestoreItem = restoreItem.clone?.() ?? restoreItem;
    this.cursorCleanup(event.player, clonedRestoreItem);
    this.removeMatchingInventoryItem(event.player, clonedRestoreItem);
    container.setItem(event.slotIndex, clonedRestoreItem);
  }

  /**
   * Removes the matching item from the player's cursor if present.
   *
   * @param {import("@minecraft/server").Player | undefined} player
   * @param {import("@minecraft/server").ItemStack | undefined} referenceItem
   */
  cursorCleanup(player, referenceItem) {
    if (!player) return;

    const cursorComponent = player.getComponent(EntityComponentTypes.CursorInventory);
    if (!cursorComponent?.isValid) return;

    const cursorItem = cursorComponent.item;
    if (!referenceItem || this.areSameItem(cursorItem, referenceItem)) {
      cursorComponent.clear();
    }
  }

  /**
   * Removes the first exact matching item from the player's inventory.
   *
   * @param {import("@minecraft/server").Player | undefined} player
   * @param {import("@minecraft/server").ItemStack | undefined} referenceItem
   */
  removeMatchingInventoryItem(player, referenceItem) {
    if (!player || !referenceItem) return;

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    const selectedSlot = player.selectedSlotIndex ?? 0;
    const selectedItem = inventory.getItem(selectedSlot);
    if (this.areSameItem(selectedItem, referenceItem)) {
      inventory.setItem(selectedSlot, undefined);
      return;
    }

    for (let slotIndex = 0; slotIndex < inventory.size; slotIndex++) {
      const item = inventory.getItem(slotIndex);
      if (!this.areSameItem(item, referenceItem)) continue;
      inventory.setItem(slotIndex, undefined);
      return;
    }
  }

  /**
   * Compares relevant item properties.
   *
   * @param {import("@minecraft/server").ItemStack | undefined} a
   * @param {import("@minecraft/server").ItemStack | undefined} b
   * @returns {boolean}
   */
  areSameItem(a, b) {
    if (!a || !b) return false;
    if (a.typeId !== b.typeId) return false;
    if ((a.nameTag ?? "") !== (b.nameTag ?? "")) return false;

    const aLore = this.safeGetLore(a);
    const bLore = this.safeGetLore(b);
    if (JSON.stringify(aLore) !== JSON.stringify(bLore)) return false;

    const aTags = this.safeGetTags(a).sort();
    const bTags = this.safeGetTags(b).sort();
    if (JSON.stringify(aTags) !== JSON.stringify(bTags)) return false;

    return true;
  }

  /**
   * @param {import("@minecraft/server").ItemStack | undefined} item
   * @returns {string[]}
   */
  safeGetLore(item) {
    try {
      return [...(item?.getLore?.() ?? [])];
    } catch {
      return [];
    }
  }

  /**
   * @param {import("@minecraft/server").ItemStack | undefined} item
   * @returns {string[]}
   */
  safeGetTags(item) {
    try {
      return [...(item?.getTags?.() ?? [])];
    } catch {
      return [];
    }
  }
}

import { SelectiveSlotContainer } from "./selectiveSlotContainer.js";
import { slotWatcherManager } from "./slotWatcherManager.js";

/**
 * Example: only slot 3 is observed and acts like a button.
 *
 * @param {import("@minecraft/server").Container} container
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity | import("@minecraft/server").Block} inGameEntity
 */
export function createSingleSlotButtonExample(container, player, inGameEntity) {
  const watcher = new SelectiveSlotContainer({
    id: `single-slot-button:${player?.id ?? "unknown"}`,
    container,
    player,
    inGameEntity,
    observedSlots: [3],
  });

  watcher.registerSlot(3, ({ slotIndex, beforeItem }) => {
    if (!beforeItem) return;
    container.setItem(slotIndex, beforeItem.clone?.() ?? beforeItem);
    player?.sendMessage("Close button pressed from slot 3.");
  });

  slotWatcherManager.register(watcher);
  return watcher;
}

/**
 * Example: multiple observed slots with different button behaviors.
 *
 * @param {import("@minecraft/server").Container} container
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity | import("@minecraft/server").Block} inGameEntity
 */
export function createMultiSlotButtonExample(container, player, inGameEntity) {
  const watcher = new SelectiveSlotContainer({
    id: `multi-slot-button:${player?.id ?? "unknown"}`,
    container,
    player,
    inGameEntity,
    observedSlots: [3, 5, 8],
  });

  watcher.registerSlots({
    3: ({ slotIndex, beforeItem }) => {
      if (!beforeItem) return;
      container.setItem(slotIndex, beforeItem.clone?.() ?? beforeItem);
      player?.sendMessage("Close button pressed from slot 3.");
    },
    5: ({ slotIndex, beforeItem }) => {
      if (!beforeItem) return;
      container.setItem(slotIndex, beforeItem.clone?.() ?? beforeItem);
      player?.sendMessage("Next page button pressed.");
    },
    8: ({ slotIndex, beforeItem }) => {
      if (!beforeItem) return;
      container.setItem(slotIndex, beforeItem.clone?.() ?? beforeItem);
      player?.sendMessage("Confirm button pressed.");
    },
  });

  slotWatcherManager.register(watcher);
  return watcher;
}

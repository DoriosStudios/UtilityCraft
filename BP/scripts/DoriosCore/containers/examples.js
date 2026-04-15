import { FunctionalSlot } from "./functionalSlot.js";
import { SelectiveSlotContainer } from "./selectiveSlotContainer.js";
import { slotWatcherManager } from "./slotWatcherManager.js";

export class CloseButtonSlot extends FunctionalSlot {
  onItemChange(container, event) {
    if (event.item?.typeId !== "minecraft:barrier") return;

    event.player?.sendMessage("Close button pressed from slot 3.");
    container.setItem(event.slotIndex, undefined);
  }
}

export class NextPageButtonSlot extends FunctionalSlot {
  onItemChange(container, event) {
    if (event.item?.typeId !== "minecraft:arrow") return;

    event.player?.sendMessage("Next page button pressed.");
    this.options.onNextPage?.(container, event);
  }
}

export class ConfirmButtonSlot extends FunctionalSlot {
  onItemChange(container, event) {
    if (event.item?.typeId !== "minecraft:emerald") return;

    event.player?.sendMessage("Confirm button pressed.");
    this.options.onConfirm?.(container, event);
  }
}

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
    options: {
      description: "Only slot 3 behaves as a functional button.",
    },
  });

  watcher.registerSlot(3, new CloseButtonSlot());
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
    options: {
      description: "Slots 3, 5 and 8 are the only observed buttons.",
    },
  });

  watcher.registerSlots({
    3: new CloseButtonSlot(),
    5: new NextPageButtonSlot(),
    8: new ConfirmButtonSlot(),
  });

  slotWatcherManager.register(watcher);
  return watcher;
}

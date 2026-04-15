import { FunctionalSlot } from "./functionalSlot.js";
import { SelectiveSlotContainer } from "./selectiveSlotContainer.js";
import { SlotWatcherManager, slotWatcherManager } from "./slotWatcherManager.js";

export * from "./utils.js";
export * from "./functionalSlot.js";
export * from "./selectiveSlotContainer.js";
export * from "./slotWatcherManager.js";
export * from "./examples.js";

if (globalThis.DoriosAPI?.containers) {
  globalThis.DoriosAPI.containers.selectiveSlots = {
    FunctionalSlot,
    SelectiveSlotContainer,
    SlotWatcherManager,
    slotWatcherManager,
  };
}

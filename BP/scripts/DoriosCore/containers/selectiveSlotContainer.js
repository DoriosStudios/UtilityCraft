import {
  cloneItem,
  hasItemChanged,
  normalizeObservedSlots,
  readSlotItem,
} from "./utils.js";
import { FunctionalSlot } from "./functionalSlot.js";

export class SelectiveSlotContainer {
  /**
   * @param {{
   *   id?: string,
   *   container: import("@minecraft/server").Container,
   *   player?: import("@minecraft/server").Player,
   *   inGameEntity?: import("@minecraft/server").Entity | import("@minecraft/server").Block,
   *   observedSlots?: number[]
   * }} settings
   */
  constructor(settings) {
    this.id = settings?.id ?? `selective_slot_container:${Date.now()}:${Math.random()}`;
    this.container = settings?.container;
    this.player = settings?.player;
    this.inGameEntity = settings?.inGameEntity;
    this.slotHandlers = new Map();
    this.slotCache = new Map();

    const initialSlots = normalizeObservedSlots(settings?.observedSlots ?? []);
    for (const slotIndex of initialSlots) {
      this.slotHandlers.set(slotIndex, new FunctionalSlot());
      this.slotCache.set(slotIndex, cloneItem(readSlotItem(this.container, slotIndex)));
    }
  }

  /**
   * Registers or replaces a single observed slot callback.
   *
   * @param {number} slotIndex
   * @param {FunctionalSlot | ((event: object) => void)} [handler]
   * @returns {this}
   */
  registerSlot(slotIndex, handler = new FunctionalSlot()) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return this;

    const slotHandler = handler instanceof FunctionalSlot ? handler : new FunctionalSlot(handler);
    this.slotHandlers.set(slotIndex, slotHandler);
    this.slotCache.set(slotIndex, cloneItem(readSlotItem(this.container, slotIndex)));
    return this;
  }

  /**
   * Registers many observed slot callbacks at once.
   *
   * @param {Record<number, FunctionalSlot | ((event: object) => void)> | Map<number, FunctionalSlot | ((event: object) => void)>} registry
   * @returns {this}
   */
  registerSlots(registry) {
    if (registry instanceof Map) {
      for (const [slotIndex, handler] of registry) {
        this.registerSlot(slotIndex, handler);
      }
      return this;
    }

    for (const [slotIndex, handler] of Object.entries(registry ?? {})) {
      this.registerSlot(Number(slotIndex), handler);
    }

    return this;
  }

  /**
   * Stops watching a single slot and removes its cache entry.
   *
   * @param {number} slotIndex
   * @returns {this}
   */
  unregisterSlot(slotIndex) {
    this.slotHandlers.delete(slotIndex);
    this.slotCache.delete(slotIndex);
    return this;
  }

  /**
   * Returns only the observed slot indices.
   *
   * @returns {number[]}
   */
  getObservedSlots() {
    return [...this.slotHandlers.keys()].sort((a, b) => a - b);
  }

  /**
   * Scans only registered slots and dispatches internal events when needed.
   *
   * @returns {number} Amount of detected slot changes in this scan.
   */
  scan() {
    if (!this.container) return 0;

    let changes = 0;

    for (const [slotIndex, slotHandler] of this.slotHandlers) {
      const item = cloneItem(readSlotItem(this.container, slotIndex));
      const beforeItem = cloneItem(this.slotCache.get(slotIndex));

      if (!hasItemChanged(beforeItem, item)) continue;

      const event = this.createChangeEvent(slotIndex, item, beforeItem);
      slotHandler.handleChange(event);

      this.slotCache.set(slotIndex, cloneItem(readSlotItem(this.container, slotIndex)));
      changes++;
    }

    return changes;
  }

  /**
   * @param {number} slotIndex
   * @param {import("@minecraft/server").ItemStack | undefined} item
   * @param {import("@minecraft/server").ItemStack | undefined} beforeItem
   * @returns {object}
   */
  createChangeEvent(slotIndex, item, beforeItem) {
    return {
      player: this.player,
      slotIndex,
      slot: slotIndex,
      item,
      beforeItem,
      container: this.container,
      inGameEntity: this.inGameEntity,
      watcher: this,
    };
  }
}

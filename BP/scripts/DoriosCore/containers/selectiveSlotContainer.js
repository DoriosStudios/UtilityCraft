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
   *   observedSlots?: number[],
   *   options?: object,
   *   compareOptions?: {
   *     includeAmount?: boolean,
   *     includeNameTag?: boolean,
   *     includeLore?: boolean,
   *     includeTags?: boolean
   *   }
   * }} settings
   */
  constructor(settings) {
    this.id = settings?.id ?? `selective_slot_container:${Date.now()}:${Math.random()}`;
    this.container = settings?.container;
    this.player = settings?.player;
    this.inGameEntity = settings?.inGameEntity;
    this.options = settings?.options ?? {};
    this.compareOptions = settings?.compareOptions ?? {};
    this.functionalSlots = new Map();
    this.slotCache = new Map();

    const initialSlots = normalizeObservedSlots(settings?.observedSlots ?? []);
    for (const slotIndex of initialSlots) {
      this.functionalSlots.set(slotIndex, new FunctionalSlot());
    }

    this.initialize();
  }

  /**
   * Seeds cache only for observed slots.
   */
  initialize() {
    for (const [slotIndex, functionalSlot] of this.functionalSlots) {
      this.slotCache.set(slotIndex, cloneItem(readSlotItem(this.container, slotIndex)));
      functionalSlot.onInitialize(this.container, slotIndex, this.inGameEntity);
    }
  }

  /**
   * Registers or replaces a single functional slot.
   *
   * @param {number} slotIndex
   * @param {FunctionalSlot} functionalSlot
   * @returns {this}
   */
  registerSlot(slotIndex, functionalSlot = new FunctionalSlot()) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return this;

    this.functionalSlots.set(slotIndex, functionalSlot);
    this.slotCache.set(slotIndex, cloneItem(readSlotItem(this.container, slotIndex)));
    functionalSlot.onInitialize(this.container, slotIndex, this.inGameEntity);
    return this;
  }

  /**
   * Registers many functional slots at once.
   *
   * @param {Record<number, FunctionalSlot> | Map<number, FunctionalSlot>} registry
   * @returns {this}
   */
  registerSlots(registry) {
    if (registry instanceof Map) {
      for (const [slotIndex, functionalSlot] of registry) {
        this.registerSlot(slotIndex, functionalSlot);
      }
      return this;
    }

    for (const [slotIndex, functionalSlot] of Object.entries(registry ?? {})) {
      this.registerSlot(Number(slotIndex), functionalSlot);
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
    this.functionalSlots.delete(slotIndex);
    this.slotCache.delete(slotIndex);
    return this;
  }

  /**
   * Returns only the observed slot indices.
   *
   * @returns {number[]}
   */
  getObservedSlots() {
    return [...this.functionalSlots.keys()].sort((a, b) => a - b);
  }

  /**
   * Scans only registered slots and dispatches internal events when needed.
   *
   * @returns {number} Amount of detected slot changes in this scan.
   */
  scan() {
    if (!this.container) return 0;

    let changes = 0;

    for (const [slotIndex, functionalSlot] of this.functionalSlots) {
      const item = cloneItem(readSlotItem(this.container, slotIndex));
      const beforeItem = cloneItem(this.slotCache.get(slotIndex));

      if (!hasItemChanged(beforeItem, item, this.compareOptions)) continue;

      const event = this.createChangeEvent(slotIndex, item, beforeItem);

      functionalSlot.onItemChange(this.container, event);

      if (beforeItem && !item) {
        functionalSlot.onItemPickup(this.container, event);
      }

      if (item) {
        functionalSlot.onAllowedItem(this.container, event);
      }

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
      options: this.options,
    };
  }
}

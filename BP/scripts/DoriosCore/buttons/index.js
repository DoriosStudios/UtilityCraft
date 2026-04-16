import { system } from "@minecraft/server";

/**
 * Shared item used to restore button slots after a press is detected.
 *
 * It is loaded once from `initializer.js` during `worldLoad`.
 *
 * @type {import("@minecraft/server").ItemStack | null}
 */
export let ButtonItemStack = null;

/**
 * Initializes the shared button item used by the button system.
 *
 * This should be called once during startup or world load.
 *
 * @param {string} [itemId="utilitycraft:ui_filler"] Item identifier used as visual button.
 * @param {typeof import("@minecraft/server").ItemStack} ItemStackClass ItemStack constructor from the Minecraft API.
 * @returns {import("@minecraft/server").ItemStack | null}
 */
export function loadButtonItemStack(itemId = "utilitycraft:ui_filler", ItemStackClass) {
  if (!ItemStackClass) return null;

  ButtonItemStack = new ItemStackClass(itemId, 1);
  ButtonItemStack.nameTag = " ";
  return ButtonItemStack;
}

/**
 * Reads a slot safely from a container.
 *
 * @param {import("@minecraft/server").Container} container
 * @param {number} slot
 * @returns {import("@minecraft/server").ItemStack | undefined}
 */
function readSlotItem(container, slot) {
  if (!container || !Number.isInteger(slot) || slot < 0) return undefined;

  try {
    return container.getItem(slot);
  } catch {
    return undefined;
  }
}

/**
 * Resolves the block where the entity is currently placed.
 *
 * Machine entities are spawned with a small offset, so the position is
 * normalized to integer block coordinates before querying the dimension.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @returns {import("@minecraft/server").Block | undefined}
 */
function getEntityBlock(entity) {
  if (!entity?.dimension || !entity.location) return undefined;

  return entity.dimension.getBlock({
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z),
  });
}

/**
 * Returns the minimal slot state used to detect button presses.
 *
 * For this library, only the presence/type of the item matters.
 *
 * @param {import("@minecraft/server").ItemStack | undefined} item
 * @returns {string}
 */
function getSlotState(item) {
  return item?.typeId ?? "empty";
}

/**
 * Static button manager for machine UI buttons.
 *
 * Recommended usage:
 * - Register buttons once by machine id with {@link registerMachineButton}
 * - Refresh active watchers from the machine `onTick` with {@link ensureWatching}
 *
 * The manager runs one global 1-tick watcher loop and only tracks entities
 * that explicitly opt in through `ensureWatching`.
 */
export class ButtonManager {
  /**
   * Registered button definitions grouped by machine id.
   *
   * Shape:
   * `machineId -> [{ slot, onPressEvent }]`
   *
   * @type {Map<string, { slot: number, onPressEvent: Function }[]>}
   */
  static machineDefinitions = new Map();

  /**
   * Runtime watchers grouped by entity id.
   *
   * Each watcher stores only per-entity state needed to detect slot changes.
   *
   * @type {Map<string, {
   *   entity: import("@minecraft/server").Entity,
   *   machineId: string,
   *   cacheBySlot: Map<number, string>
   * }>}
   */
  static activeWatchers = new Map();

  /**
   * Interval id of the global runner.
   *
   * @type {number | undefined}
   */
  static intervalId = undefined;

  /**
   * Registers or replaces a button definition for a machine id.
   *
   * The callback is shared by every entity using the same machine id.
   *
   * @param {string} machineId
   * @param {number} slot
   * @param {(event: {
   *   entity: import("@minecraft/server").Entity,
   *   block: import("@minecraft/server").Block | undefined,
   *   container: import("@minecraft/server").Container,
   *   slot: number
   * }) => void} [onPressEvent]
   * @returns {boolean}
   */
  static registerMachineButton(machineId, slot, onPressEvent = () => { }) {
    if (typeof machineId !== "string" || machineId.length === 0) return false;
    if (!Number.isInteger(slot) || slot < 0) return false;

    const buttons = this.machineDefinitions.get(machineId) ?? [];
    const callback = typeof onPressEvent === "function" ? onPressEvent : () => { };
    const existingIndex = buttons.findIndex((button) => button.slot === slot);
    const definition = { slot, onPressEvent: callback };

    if (existingIndex >= 0) {
      buttons[existingIndex] = definition;
    } else {
      buttons.push(definition);
      buttons.sort((a, b) => a.slot - b.slot);
    }

    this.machineDefinitions.set(machineId, buttons);
    return true;
  }

  /**
   * Removes a registered button definition from a machine id.
   *
   * @param {string} machineId
   * @param {number} slot
   * @returns {boolean}
   */
  static unregisterMachineButton(machineId, slot) {
    const buttons = this.machineDefinitions.get(machineId);
    if (!buttons?.length) return false;

    const filtered = buttons.filter((button) => button.slot !== slot);
    if (filtered.length === buttons.length) return false;

    if (filtered.length === 0) {
      this.machineDefinitions.delete(machineId);
    } else {
      this.machineDefinitions.set(machineId, filtered);
    }

    return true;
  }

  /**
   * Ensures that an entity is being watched using the button definition
   * registered for the given machine id.
   *
   * This is intended to be called from the machine's `onTick`.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} machineId
   * @returns {boolean}
   */
  static ensureWatching(entity, machineId) {
    if (!entity?.id) return false;

    const buttons = this.machineDefinitions.get(machineId);
    if (!buttons?.length) return false;

    const container = entity.getComponent("minecraft:inventory")?.container;
    if (!container) return false;

    const watcher = this.activeWatchers.get(entity.id);
    if (watcher) {
      watcher.entity = entity;
      watcher.machineId = machineId;
      this.ensureButtonItems(container, buttons);
      this.syncWatcherCache(watcher, container, buttons);
    } else {
      this.ensureButtonItems(container, buttons);
      this.activeWatchers.set(entity.id, this.createWatcher(entity, machineId, container, buttons));
    }

    this.start();
    return true;
  }

  /**
   * Stops watching a specific entity.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {boolean}
   */
  static unwatchEntity(entity) {
    if (!entity?.id) return false;

    const deleted = this.activeWatchers.delete(entity.id);
    if (this.activeWatchers.size === 0) {
      this.stop();
    }

    return deleted;
  }

  /**
   * Creates the runtime watcher state for an entity.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} machineId
   * @param {import("@minecraft/server").Container} container
   * @param {{ slot: number, onPressEvent: Function }[]} buttons
   * @returns {{
   *   entity: import("@minecraft/server").Entity,
   *   machineId: string,
   *   cacheBySlot: Map<number, string>
   * }}
   */
  static createWatcher(entity, machineId, container, buttons) {
    const cacheBySlot = new Map();

    for (const { slot } of buttons) {
      cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
    }

    return {
      entity,
      machineId,
      cacheBySlot,
    };
  }

  /**
   * Ensures every registered button slot contains the shared button item.
   *
   * @param {import("@minecraft/server").Container} container
   * @param {{ slot: number, onPressEvent: Function }[]} buttons
   * @returns {void}
   */
  static ensureButtonItems(container, buttons) {
    if (!container || !ButtonItemStack) return;

    for (const { slot } of buttons) {
      const currentItem = readSlotItem(container, slot);
      if (currentItem?.typeId === ButtonItemStack.typeId) continue;
      container.setItem(slot, ButtonItemStack);
    }
  }

  /**
   * Synchronizes a watcher's slot cache with the currently registered
   * button definitions of its machine id.
   *
   * @param {{
   *   cacheBySlot: Map<number, string>
   * }} watcher
   * @param {import("@minecraft/server").Container} container
   * @param {{ slot: number, onPressEvent: Function }[]} buttons
   * @returns {void}
   */
  static syncWatcherCache(watcher, container, buttons) {
    const validSlots = new Set(buttons.map(({ slot }) => slot));

    for (const slot of watcher.cacheBySlot.keys()) {
      if (validSlots.has(slot)) continue;
      watcher.cacheBySlot.delete(slot);
    }

    for (const { slot } of buttons) {
      if (watcher.cacheBySlot.has(slot)) continue;
      watcher.cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
    }
  }

  /**
   * Starts the global 1-tick watcher loop if it is not already running.
   *
   * @returns {void}
   */
  static start() {
    if (this.intervalId !== undefined) return;

    this.intervalId = system.runInterval(() => {
      this.tick();
    }, 1);
  }

  /**
   * Stops the global watcher loop.
   *
   * @returns {void}
   */
  static stop() {
    if (this.intervalId === undefined) return;

    system.clearRun(this.intervalId);
    this.intervalId = undefined;
  }

  /**
   * Global button runner.
   *
   * For each active watcher:
   * - Validates entity and inventory access
   * - Detects button slot changes
   * - Restores the shared button item
   * - Executes the registered callback
   *
   * If a watcher throws during processing, it is removed automatically.
   *
   * @returns {void}
   */
  static tick() {
    for (const [entityId, watcher] of this.activeWatchers) {
      try {
        const entity = watcher.entity;
        if (!entity?.isValid) {
          this.activeWatchers.delete(entityId);
          continue;
        }

        const buttons = this.machineDefinitions.get(watcher.machineId);
        if (!buttons?.length) {
          this.activeWatchers.delete(entityId);
          continue;
        }

        const container = entity.getComponent("minecraft:inventory")?.container;
        if (!container) {
          this.activeWatchers.delete(entityId);
          continue;
        }

        this.syncWatcherCache(watcher, container, buttons);

        for (const { slot, onPressEvent } of buttons) {
          const currentState = getSlotState(readSlotItem(container, slot));
          const previousState = watcher.cacheBySlot.get(slot) ?? "empty";

          if (currentState === previousState) continue;

          if (ButtonItemStack) {
            container.setItem(slot, ButtonItemStack);
          }

          onPressEvent({
            entity,
            block: getEntityBlock(entity),
            container,
            slot,
          });

          watcher.cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
        }
      } catch {
        this.activeWatchers.delete(entityId);
      }
    }

    if (this.activeWatchers.size === 0) {
      this.stop();
    }
  }
}

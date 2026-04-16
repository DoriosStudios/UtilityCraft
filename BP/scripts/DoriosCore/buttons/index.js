import { system } from "@minecraft/server";

function readSlotItem(container, slotIndex) {
  if (!container || !Number.isInteger(slotIndex) || slotIndex < 0) return undefined;

  try {
    return container.getItem(slotIndex);
  } catch {
    return undefined;
  }
}

function cloneItem(item) {
  if (!item) return undefined;

  try {
    return item.clone();
  } catch {
    return item;
  }
}

function safeGetTags(item) {
  try {
    return [...item.getTags()].sort();
  } catch {
    return [];
  }
}

function safeGetLore(item) {
  try {
    return [...item.getLore()];
  } catch {
    return [];
  }
}

function createItemSignature(item) {
  if (!item) return "empty";

  return JSON.stringify({
    typeId: item.typeId,
    amount: item.amount,
    nameTag: item.nameTag ?? "",
    lore: safeGetLore(item),
    tags: safeGetTags(item),
  });
}

function hasItemChanged(beforeItem, item) {
  return createItemSignature(beforeItem) !== createItemSignature(item);
}

class ButtonManagerClass {
  constructor(options = {}) {
    this.intervalTicks = Math.max(1, options.intervalTicks ?? globalThis.tickSpeed ?? 10);
    this.listeners = new Map();
    this.intervalId = undefined;
  }

  registerListener(entity, slot, onPressEvent = () => { }) {
    if (!entity || !Number.isInteger(slot) || slot < 0) return undefined;

    const container = entity.getComponent("minecraft:inventory")?.container;
    if (!container) return undefined;

    const listenerId = this.createListenerId(entity, slot);

    this.listeners.set(listenerId, {
      id: listenerId,
      entity,
      slot,
      onPressEvent: typeof onPressEvent === "function" ? onPressEvent : () => { },
      cache: cloneItem(readSlotItem(container, slot)),
    });

    this.start();
    return listenerId;
  }

  unregisterListener(entityOrListenerId, slot) {
    const listenerId =
      typeof entityOrListenerId === "string"
        ? entityOrListenerId
        : this.createListenerId(entityOrListenerId, slot);

    const deleted = this.listeners.delete(listenerId);
    if (this.listeners.size === 0) {
      this.stop();
    }

    return deleted;
  }

  unregisterEntity(entity) {
    if (!entity?.id) return 0;

    let removed = 0;
    for (const [listenerId, listener] of this.listeners) {
      if (listener.entity?.id !== entity.id) continue;
      this.listeners.delete(listenerId);
      removed++;
    }

    if (this.listeners.size === 0) {
      this.stop();
    }

    return removed;
  }

  createListenerId(entity, slot) {
    return `button:${entity?.id ?? "unknown"}:${slot}`;
  }

  start() {
    if (this.intervalId !== undefined) return;

    this.intervalId = system.runInterval(() => {
      this.tick();
    }, this.intervalTicks);
  }

  stop() {
    if (this.intervalId === undefined) return;

    system.clearRun(this.intervalId);
    this.intervalId = undefined;
  }

  tick() {
    for (const [listenerId, listener] of this.listeners) {
      const entity = listener.entity;
      if (!entity?.isValid) {
        this.listeners.delete(listenerId);
        continue;
      }

      const container = entity.getComponent("minecraft:inventory")?.container;
      if (!container) {
        this.listeners.delete(listenerId);
        continue;
      }

      const currentItem = cloneItem(readSlotItem(container, listener.slot));
      const beforeItem = cloneItem(listener.cache);

      if (!hasItemChanged(beforeItem, currentItem)) continue;

      if (beforeItem) {
        container.setItem(listener.slot, cloneItem(beforeItem));
      }

      listener.onPressEvent({
        entity,
        container,
        slot: listener.slot,
      });

      listener.cache = cloneItem(readSlotItem(container, listener.slot));
    }

    if (this.listeners.size === 0) {
      this.stop();
    }
  }
}

export const ButtonManager = new ButtonManagerClass({ intervalTicks: 1 });

if (globalThis.DoriosAPI) {
  globalThis.DoriosAPI.buttons = {
    ButtonManager,
  };
}

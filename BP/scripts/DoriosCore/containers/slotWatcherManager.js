import { system } from "@minecraft/server";

export class SlotWatcherManager {
  /**
   * @param {{ intervalTicks?: number }} [options]
   */
  constructor(options = {}) {
    this.intervalTicks = Math.max(1, options.intervalTicks ?? globalThis.tickSpeed ?? 10);
    this.watchers = new Map();
    this.intervalId = undefined;
  }

  /**
   * @param {import("./selectiveSlotContainer.js").SelectiveSlotContainer} watcher
   * @returns {import("./selectiveSlotContainer.js").SelectiveSlotContainer}
   */
  register(watcher) {
    if (!watcher?.id) return watcher;

    this.watchers.set(watcher.id, watcher);
    this.start();
    return watcher;
  }

  /**
   * @param {string} watcherId
   * @returns {boolean}
   */
  unregister(watcherId) {
    const deleted = this.watchers.delete(watcherId);
    if (this.watchers.size === 0) {
      this.stop();
    }
    return deleted;
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
    for (const watcher of this.watchers.values()) {
      watcher.scan();
    }
  }
}

export const slotWatcherManager = new SlotWatcherManager();

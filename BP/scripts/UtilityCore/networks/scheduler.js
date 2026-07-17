// @ts-check

import { system } from "@minecraft/server";

/** Wait one second after the latest topology change before rebuilding. */
export const NETWORK_DEBOUNCE_TICKS = 20;

/** Maximum queued positions processed by a traversal before yielding a tick. */
export const NETWORK_SCAN_BATCH_SIZE = 25;

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * @typedef {object} PendingDimension
 * @property {Dimension} dimension
 * @property {Map<string,Vector3>} locations
 * @property {number} readyTick
 * @property {boolean} running
 */

/**
 * Creates a debounced, serialized topology-update queue for one network type.
 * Each dimension is independent and all changes received during the debounce
 * window are delivered as one batch.
 *
 * @param {string} name
 * @param {(locations:ReadonlyArray<Vector3>, dimension:Dimension) => Promise<void>} processBatch
 * @returns {(location:Vector3, dimension:Dimension) => void}
 */
export function createNetworkRescanScheduler(name, processBatch) {
  /** @type {Map<string,PendingDimension>} */
  const pendingDimensions = new Map();

  return (location, dimension) => {
    const normalized = normalizeLocation(location);
    const dimensionId = dimension.id;
    let pending = pendingDimensions.get(dimensionId);

    if (!pending) {
      pending = {
        dimension,
        locations: new Map(),
        readyTick: 0,
        running: false,
      };
      pendingDimensions.set(dimensionId, pending);
    }

    pending.dimension = dimension;
    pending.locations.set(coordinateKey(normalized), normalized);
    pending.readyTick = system.currentTick + NETWORK_DEBOUNCE_TICKS;

    if (pending.running) return;
    pending.running = true;
    system.run(() => void drainDimension(dimensionId, pending));
  };

  /** @param {string} dimensionId @param {PendingDimension} pending */
  async function drainDimension(dimensionId, pending) {
    try {
      while (pending.locations.size > 0) {
        const remainingTicks = pending.readyTick - system.currentTick;
        if (remainingTicks > 0) {
          await system.waitTicks(remainingTicks);
          continue;
        }

        const locations = [...pending.locations.values()];
        pending.locations.clear();

        try {
          await processBatch(locations, pending.dimension);
        } catch (error) {
          console.warn(`[UtilityCore:${name}] Network rebuild failed`, error);
        }
      }
    } finally {
      pending.running = false;
      if (pending.locations.size === 0 && pendingDimensions.get(dimensionId) === pending) {
        pendingDimensions.delete(dimensionId);
      }
    }
  }
}

/** @param {Vector3} location */
function normalizeLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

/** @param {Vector3} location */
function coordinateKey(location) {
  return `${location.x},${location.y},${location.z}`;
}

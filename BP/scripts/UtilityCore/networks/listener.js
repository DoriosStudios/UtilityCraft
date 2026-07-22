// @ts-check

import "../legacy.js";
import { system, world } from "@minecraft/server";
import { reconcileMovedPersistentUpgrades } from "../upgradeable.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import {
  SCRIPT_EVENT_NAMESPACE,
  SET_CONFIG_EVENT_ID,
} from "../../DoriosLib/containers/constants.js";
import { scheduleEnergyNetworkRescan } from "./energy.js";
import { reconcileMovedFluidNodes, scheduleFluidNetworkRescan } from "./fluids.js";
import { reconcileMovedGasNodes, scheduleGasNetworkRescan } from "./gases.js";
import {
  invalidateItemContainerAt,
  invalidateItemContainerConfig,
  reconcileMovedItemNodes,
  scheduleItemNetworkRescan,
} from "./items.js";
import {
  NETWORK_OFFSETS,
  networkRegistrar,
  offsetLocation,
  safeGetBlock,
  updateEndpointGeometry,
  updateGeometry,
} from "./shared.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** @typedef {"energy"|"item"|"fluid"|"gas"} NetworkType */

const NETWORK_TYPES = new Set(["energy", "item", "fluid", "gas"]);

// All network block and item components are registered by one startup listener.
networkRegistrar.install();

/**
 * Queues every matching network touching a changed position and immediately
 * refreshes the visual geometry around that position.
 *
 * @param {Block} changedBlock
 * @param {NetworkType} type
 * @returns {boolean} Whether a matching network block was found.
 */
export function updateNetworksAt(changedBlock, type) {
  if (!changedBlock?.dimension) return false;

  const dimension = changedBlock.dimension;
  const networkTag = `dorios:${type}`;
  const locations = [
    changedBlock.location,
    ...NETWORK_OFFSETS.map((offset) => offsetLocation(changedBlock.location, offset)),
  ];

  /** @type {Block[]} */
  const blocks = [];
  for (const location of locations) {
    const block = safeGetBlock(dimension, location);
    if (block?.hasTag(networkTag)) blocks.push(block);
  }
  if (blocks.length === 0) return false;

  // One queued request rebuilds the center and all six neighbors after the
  // shared debounce window. Geometry remains immediate and inexpensive.
  if (type === "energy") scheduleEnergyNetworkRescan(changedBlock.location, dimension);
  else if (type === "fluid") scheduleFluidNetworkRescan(changedBlock.location, dimension);
  else if (type === "gas") scheduleGasNetworkRescan(changedBlock.location, dimension);
  else scheduleItemNetworkRescan(changedBlock.location, dimension);

  for (const block of blocks) {
    if (block.hasTag("dorios:isExporter") || block.hasTag("dorios:isImporter")) {
      updateEndpointGeometry(block, networkTag);
    } else if (block.hasTag("dorios:isTube")) {
      updateGeometry(block, networkTag);
    }
  }
  return true;
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "dorios:updatePipes" || !event.sourceEntity?.isValid) return;

  const separator = event.message.indexOf("|");
  if (separator < 1) return;

  const rawType = event.message.slice(0, separator);
  if (!NETWORK_TYPES.has(rawType)) return;

  const coordinates = event.message
    .slice(separator + 1)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map(Number);
  if (coordinates.length !== 3 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) return;

  const block = safeGetBlock(event.sourceEntity.dimension, {
    x: coordinates[0],
    y: coordinates[1],
    z: coordinates[2],
  });
  if (block) updateNetworksAt(block, /** @type {NetworkType} */ (rawType));
}, {
  namespaces: ["dorios"],
});

// DoriosContainers already persists the new document. UtilityCore only needs
// to invalidate the derived slot lists cached by exporters targeting it.
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === SET_CONFIG_EVENT_ID && event.sourceEntity?.isValid) {
    invalidateItemContainerConfig(event.sourceEntity);
  }
}, {
  namespaces: [SCRIPT_EVENT_NAMESPACE],
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  const dimension = block.dimension;
  const location = { ...block.location };

  system.run(() => {
    if (brokenBlockPermutation.hasTag("dorios:energy")) updateNetworksAt(block, "energy");
    if (brokenBlockPermutation.hasTag("dorios:fluid")) updateNetworksAt(block, "fluid");
    if (brokenBlockPermutation.hasTag("dorios:gas")) updateNetworksAt(block, "gas");

    // Checking adjacent item nodes is intentionally capability-agnostic here:
    // after a break, the removed vanilla container can no longer be resolved.
    if (updateNetworksAt(block, "item")) invalidateItemContainerAt(dimension, location);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  const dimension = block.dimension;
  const location = { ...block.location };

  // Custom machine/container entities are spawned through deferred component
  // callbacks. Rechecking next tick lets the first topology scan see them.
  system.run(() => {
    const placedBlock = safeGetBlock(dimension, location);
    if (!placedBlock) return;

    if (placedBlock.hasTag("dorios:energy")) updateNetworksAt(placedBlock, "energy");
    if (placedBlock.hasTag("dorios:fluid")) updateNetworksAt(placedBlock, "fluid");
    if (placedBlock.hasTag("dorios:gas")) updateNetworksAt(placedBlock, "gas");

    if (
      placedBlock.hasTag("dorios:item")
      || DoriosContainer.resolve(placedBlock)
      || DoriosContainer.resolveAt(dimension, location)
    ) {
      if (updateNetworksAt(placedBlock, "item")) invalidateItemContainerAt(dimension, location);
    }
  });
});

world.afterEvents.pistonActivate.subscribe(({ piston, isExpanding, dimension }) => {
  const locations = piston.getAttachedBlocksLocations();
  if (!locations || locations.length === 0) return;

  const direction = getPistonDirection(
    Number(piston.block.permutation.getState("facing_direction")),
  );
  const step = isExpanding ? -1 : 1;

  system.runTimeout(() => {
    const movements = locations.map((target) => ({
      target,
      source: {
        x: target.x + direction.x * step,
        y: target.y + direction.y * step,
        z: target.z + direction.z * step,
      },
    }));
    reconcileMovedItemNodes(dimension, movements);
    reconcileMovedFluidNodes(dimension, movements);
    reconcileMovedGasNodes(dimension, movements);
    reconcileMovedPersistentUpgrades(dimension, movements);

    for (const { target: location, source: pairedLocation } of movements) {
      const block = safeGetBlock(dimension, location);
      const pairedBlock = safeGetBlock(dimension, pairedLocation);
      if (!block || !pairedBlock) continue;

      if (block.hasTag("dorios:energy") || pairedBlock.hasTag("dorios:energy")) {
        updateNetworksAt(block, "energy");
        updateNetworksAt(pairedBlock, "energy");
      }
      if (block.hasTag("dorios:fluid") || pairedBlock.hasTag("dorios:fluid")) {
        updateNetworksAt(block, "fluid");
        updateNetworksAt(pairedBlock, "fluid");
      }
      if (block.hasTag("dorios:gas") || pairedBlock.hasTag("dorios:gas")) {
        updateNetworksAt(block, "gas");
        updateNetworksAt(pairedBlock, "gas");
      }

      // Containers do not necessarily carry dorios:item, so always let the
      // adjacent item nodes decide whether a rebuild is needed.
      const firstTouchesItemNetwork = updateNetworksAt(block, "item");
      const secondTouchesItemNetwork = updateNetworksAt(pairedBlock, "item");
      if (firstTouchesItemNetwork || secondTouchesItemNetwork) {
        invalidateItemContainerAt(dimension, location);
        invalidateItemContainerAt(dimension, pairedLocation);
      }
    }
  }, 2);
});

/**
 * @param {number} direction
 * @returns {Vector3}
 */
function getPistonDirection(direction) {
  switch (direction) {
    case 0: return { x: 0, y: -1, z: 0 };
    case 1: return { x: 0, y: 1, z: 0 };
    case 2: return { x: 0, y: 0, z: -1 };
    case 3: return { x: 0, y: 0, z: 1 };
    case 4: return { x: -1, y: 0, z: 0 };
    case 5: return { x: 1, y: 0, z: 0 };
    default: return { x: 0, y: 0, z: 0 };
  }
}

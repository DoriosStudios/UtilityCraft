// @ts-check

import "../legacy.js";
import { system, world } from "@minecraft/server";
import { reconcileMovedPersistentUpgrades } from "../upgradeable.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import {
  SCRIPT_EVENT_NAMESPACE,
  SET_CONFIG_EVENT_ID,
} from "../../DoriosLib/containers/constants.js";
import {
  LINK_NODE_IO_EVENT_NAMESPACE,
  SET_LINK_NODE_IO_EVENT_ID,
  parseLinkNodeIOUpdate,
} from "../../DoriosLib/linkNodes/index.js";
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
  isExporterEndpoint,
  isImporterEndpoint,
  networkRegistrar,
  offsetLocation,
  safeGetBlock,
  updateEndpointGeometry,
  updateGeometry,
} from "./shared.js";
import { clearPipeFacesAt, reconcileMovedPipeFaces } from "./pipeFaces.js";
import "./multiEndpoints.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** @typedef {"energy"|"item"|"fluid"|"gas"} NetworkType */

const NETWORK_TYPES = new Set(["energy", "item", "fluid", "gas"]);
const NETWORK_TAGS = Object.freeze({
  energy: "dorios:energy",
  item: "dorios:item",
  fluid: "dorios:fluid",
  gas: "dorios:gas",
});

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
  return updateNetworksAtMany(changedBlock, [type]).has(type);
}

/**
 * Updates several UtilityCraft networks while reading the center and its six
 * neighbors only once. Multi-resource geometry is refreshed once per block.
 *
 * @param {Block} changedBlock
 * @param {ReadonlyArray<NetworkType>} types
 * @returns {Set<NetworkType>} Network types found around the changed position.
 */
export function updateNetworksAtMany(changedBlock, types) {
  if (!changedBlock?.dimension) return new Set();

  const dimension = changedBlock.dimension;
  const requestedTypes = [...new Set(types)].filter((type) => NETWORK_TYPES.has(type));
  if (requestedTypes.length === 0) return new Set();
  const locations = [
    changedBlock.location,
    ...NETWORK_OFFSETS.map((offset) => offsetLocation(changedBlock.location, offset)),
  ];

  /** @type {Map<Block,Set<string>>} */
  const visualBlocks = new Map();
  /** @type {Set<NetworkType>} */
  const touchedTypes = new Set();
  for (const location of locations) {
    const block = safeGetBlock(dimension, location);
    if (!block) continue;
    for (const type of requestedTypes) {
      const networkTag = NETWORK_TAGS[type];
      if (!block.hasTag(networkTag)) continue;
      touchedTypes.add(type);
      let blockTags = visualBlocks.get(block);
      if (!blockTags) {
        blockTags = new Set();
        visualBlocks.set(block, blockTags);
      }
      blockTags.add(networkTag);
    }
  }
  if (touchedTypes.size === 0) return touchedTypes;

  for (const type of touchedTypes) {
    if (type === "energy") scheduleEnergyNetworkRescan(changedBlock.location, dimension);
    else if (type === "fluid") scheduleFluidNetworkRescan(changedBlock.location, dimension);
    else if (type === "gas") scheduleGasNetworkRescan(changedBlock.location, dimension);
    else scheduleItemNetworkRescan(changedBlock.location, dimension);
  }

  for (const [block, networkTags] of visualBlocks) {
    if (isExporterEndpoint(block) || isImporterEndpoint(block)) {
      updateEndpointGeometry(block, [...networkTags]);
    } else if (block.hasTag("dorios:isTube")) {
      updateGeometry(block, [...networkTags]);
    }
  }
  return touchedTypes;
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

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== SET_LINK_NODE_IO_EVENT_ID
    || !event.sourceEntity?.isValid) return;
  const update = parseLinkNodeIOUpdate(event.message);
  if (update?.resource === "items") {
    invalidateItemContainerAt(event.sourceEntity.dimension, update.location);
  }
}, {
  namespaces: [LINK_NODE_IO_EVENT_NAMESPACE],
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  const dimension = block.dimension;
  const location = { ...block.location };
  if (brokenBlockPermutation.hasTag("dorios:isTube")) {
    clearPipeFacesAt(dimension, location);
  }

  system.run(() => {
    /** @type {NetworkType[]} */
    const types = ["item"];
    if (brokenBlockPermutation.hasTag("dorios:energy")) types.push("energy");
    if (brokenBlockPermutation.hasTag("dorios:fluid")) types.push("fluid");
    if (brokenBlockPermutation.hasTag("dorios:gas")) types.push("gas");

    // Checking adjacent item nodes is intentionally capability-agnostic here:
    // after a break, the removed vanilla container can no longer be resolved.
    if (updateNetworksAtMany(block, types).has("item")) {
      invalidateItemContainerAt(dimension, location);
    }
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  const dimension = block.dimension;
  const location = { ...block.location };
  clearPipeFacesAt(dimension, location);

  // Custom machine/container entities are spawned through deferred component
  // callbacks. Rechecking next tick lets the first topology scan see them.
  system.run(() => {
    const placedBlock = safeGetBlock(dimension, location);
    if (!placedBlock) return;

    /** @type {NetworkType[]} */
    const types = [];
    if (placedBlock.hasTag("dorios:energy")) types.push("energy");
    if (placedBlock.hasTag("dorios:fluid")) types.push("fluid");
    if (placedBlock.hasTag("dorios:gas")) types.push("gas");

    if (
      placedBlock.hasTag("dorios:item")
      || DoriosContainer.resolve(placedBlock)
      || DoriosContainer.resolveAt(dimension, location)
    ) {
      types.push("item");
    }
    if (updateNetworksAtMany(placedBlock, types).has("item")) {
      invalidateItemContainerAt(dimension, location);
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
    reconcileMovedPipeFaces(dimension, movements);

    for (const { target: location, source: pairedLocation } of movements) {
      const block = safeGetBlock(dimension, location);
      const pairedBlock = safeGetBlock(dimension, pairedLocation);
      if (!block || !pairedBlock) continue;

      /** @type {NetworkType[]} */
      const types = ["item"];
      if (block.hasTag("dorios:energy") || pairedBlock.hasTag("dorios:energy")) types.push("energy");
      if (block.hasTag("dorios:fluid") || pairedBlock.hasTag("dorios:fluid")) types.push("fluid");
      if (block.hasTag("dorios:gas") || pairedBlock.hasTag("dorios:gas")) types.push("gas");

      // Containers do not necessarily carry dorios:item, so always let the
      // adjacent item nodes decide whether a rebuild is needed.
      const firstTouchesItemNetwork = updateNetworksAtMany(block, types).has("item");
      const secondTouchesItemNetwork = updateNetworksAtMany(pairedBlock, types).has("item");
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

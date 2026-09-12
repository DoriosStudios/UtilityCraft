// @ts-check

import { system } from "@minecraft/server";
import {
  getLinkNodeLocations,
  isLinkNode,
  resolveLinkNode,
} from "../../DoriosLib/linkNodes/index.js";
import {
  NETWORK_OFFSETS,
  getAttachedContainerEndpoint,
  offsetLocation,
  safeGetBlock,
} from "./shared.js";
import { PIPE_DIRECTIONS, isNetworkConnectionOpen } from "./pipeFaces.js";
import {
  NETWORK_SCAN_BATCH_SIZE,
  createNetworkRescanScheduler,
} from "./scheduler.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * Rebuilds the existing energy network starting at one network position.
 * Its tag-based persistence remains unchanged so other addons can observe it.
 *
 * @param {Vector3} startPosition
 * @param {Dimension} dimension
 * @returns {Promise<Set<string>>} Positions covered by this traversal.
 */
export async function rescanEnergyNetwork(startPosition, dimension) {
  const queue = [startPosition];
  let queueHead = 0;
  let processed = 0;
  const visited = new Set();
  const networkNodes = new Set();

  while (queueHead < queue.length) {
    if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) {
      await system.waitTicks(1);
    }
    processed++;

    const position = queue[queueHead++];

    const key = `${position.x},${position.y},${position.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const block = safeGetBlock(dimension, position);
    if (!block?.hasTag("dorios:energy")) continue;

    if (block.hasTag("dorios:isTube")
      || block.hasTag("dorios:multi_exporter")
      || block.hasTag("dorios:multi_importer")) {
      networkNodes.add(key);
      for (const { direction, offset } of PIPE_DIRECTIONS) {
        const neighborLocation = offsetLocation(position, offset);
        const neighbor = safeGetBlock(dimension, neighborLocation);
        if (neighbor && isNetworkConnectionOpen(block, direction, neighbor, "energy")) {
          queue.push(neighborLocation);
        }
      }
      continue;
    }

    let entity = dimension
      .getEntitiesAtBlockLocation(position)
      .find((candidate) => candidate.typeId !== "utilitycraft:machine_area_outline");
    if (isLinkNode(block)) {
      const linked = resolveLinkNode(block);
      if (!linked) continue;
      entity = linked.entity;
      await searchEnergyStorages(getLinkNodeLocations(entity), entity);
      continue;
    }

    if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_source")) {
      await searchEnergyStorages([position], entity);
    }
  }
  return networkNodes;
}

/**
 * Preserves the existing per-generator `net:[x,y,z]` network tags.
 *
 * @param {Vector3[]} startPositions
 * @param {Entity} generator
 * @returns {Promise<void>}
 */
async function searchEnergyStorages(startPositions, generator) {
  const dimension = generator.dimension;
  const queue = [];
  let queueHead = 0;
  let processed = 0;
  const visited = new Set();

  for (const startPosition of startPositions) {
    const key = `${startPosition.x},${startPosition.y},${startPosition.z}`;
    visited.add(key);
    const startBlock = safeGetBlock(dimension, startPosition);
    if (!startBlock) continue;
    for (const { direction, offset } of PIPE_DIRECTIONS) {
      const neighborLocation = offsetLocation(startPosition, offset);
      const neighbor = safeGetBlock(dimension, neighborLocation);
      if (neighbor?.hasTag("dorios:multi_importer")
        && isEndpointAttachedTo(neighbor, startPosition)) continue;
      if (neighbor && isNetworkConnectionOpen(startBlock, direction, neighbor, "energy")) {
        queue.push(neighborLocation);
      }
    }
  }

  const machines = [];
  while (queueHead < queue.length) {
    if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) {
      await system.waitTicks(1);
    }
    processed++;

    const position = queue[queueHead++];

    const key = `${position.x},${position.y},${position.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const block = safeGetBlock(dimension, position);
    if (!block?.hasTag("dorios:energy")) continue;

    const isMultiExporter = block.hasTag("dorios:multi_exporter");
    const isMultiImporter = block.hasTag("dorios:multi_importer");
    if (block.hasTag("dorios:isTube") && !isMultiExporter && !isMultiImporter) {
      for (const { direction, offset } of PIPE_DIRECTIONS) {
        const neighborLocation = offsetLocation(position, offset);
        const neighbor = safeGetBlock(dimension, neighborLocation);
        if (neighbor && isNetworkConnectionOpen(block, direction, neighbor, "energy")) {
          queue.push(neighborLocation);
        }
      }
      continue;
    }

    if (isMultiExporter || isMultiImporter) {
      const attached = getAttachedContainerEndpoint(block);
      for (const { direction, offset } of PIPE_DIRECTIONS) {
        const neighborLocation = offsetLocation(position, offset);
        const neighbor = safeGetBlock(dimension, neighborLocation);
        if (!neighbor || !isNetworkConnectionOpen(block, direction, neighbor, "energy")) continue;

        const isAttachment = attached && isSameLocation(attached.location, neighborLocation);
        if (isAttachment) {
          if (isMultiImporter) queue.push(neighborLocation);
          continue;
        }
        if (neighbor.hasTag("dorios:energy") && neighbor.hasTag("dorios:isTube")) {
          queue.push(neighborLocation);
        }
      }
      continue;
    }

    let entity = dimension
      .getEntitiesAtBlockLocation(position)
      .find((candidate) => candidate.typeId !== "utilitycraft:machine_area_outline");
    if (isLinkNode(block)) {
      entity = resolveLinkNode(block)?.entity;
      if (entity) machines.push(entity.location);
      continue;
    }

    if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_container")) {
      machines.push(position);
    }
  }

  if (!generator.isValid) return;

  for (const tag of generator.getTags()) {
    if (tag.startsWith("net:")) generator.removeTag(tag);
  }
  for (const position of machines) {
    generator.addTag(`net:[${position.x},${position.y},${position.z}]`);
  }
  generator.addTag("updateNetwork");
}

/** @param {Vector3} left @param {Vector3} right */
function isSameLocation(left, right) {
  return Math.floor(left.x) === Math.floor(right.x)
    && Math.floor(left.y) === Math.floor(right.y)
    && Math.floor(left.z) === Math.floor(right.z);
}

/** @param {import("@minecraft/server").Block} block @param {Vector3} location */
function isEndpointAttachedTo(block, location) {
  const attached = getAttachedContainerEndpoint(block);
  return Boolean(attached && isSameLocation(attached.location, location));
}

/**
 * Rebuilds every distinct energy component touched by one debounced batch.
 *
 * @param {ReadonlyArray<Vector3>} changedLocations
 * @param {Dimension} dimension
 */
async function rebuildEnergyNetworkBatch(changedLocations, dimension) {
  const covered = new Set();

  for (const changedLocation of changedLocations) {
    const changedKey = `${changedLocation.x},${changedLocation.y},${changedLocation.z}`;
    if (covered.has(changedKey)) continue;

    const roots = [
      changedLocation,
      ...NETWORK_OFFSETS.map((offset) => offsetLocation(changedLocation, offset)),
    ];

    for (const root of roots) {
      const key = `${root.x},${root.y},${root.z}`;
      if (covered.has(key)) continue;

      const block = safeGetBlock(dimension, root);
      if (!block?.hasTag("dorios:energy")) continue;

      const visited = await rescanEnergyNetwork(root, dimension);
      for (const visitedKey of visited) covered.add(visitedKey);
    }
  }
}

/** Queues an energy topology update after the shared debounce window. */
export const scheduleEnergyNetworkRescan = createNetworkRescanScheduler(
  "energy",
  rebuildEnergyNetworkBatch,
);

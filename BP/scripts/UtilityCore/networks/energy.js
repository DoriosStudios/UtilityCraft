// @ts-check

import { NETWORK_OFFSETS, offsetLocation, safeGetBlock } from "./shared.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * Rebuilds the existing energy network starting at one network position.
 * Its tag-based persistence remains unchanged so other addons can observe it.
 *
 * @param {Vector3} startPosition
 * @param {Dimension} dimension
 * @returns {Set<string>} Positions covered by this traversal.
 */
export function rescanEnergyNetwork(startPosition, dimension) {
  const queue = [startPosition];
  let queueHead = 0;
  const visited = new Set();

  while (queueHead < queue.length) {
    const position = queue[queueHead++];

    const key = `${position.x},${position.y},${position.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const block = safeGetBlock(dimension, position);
    if (!block?.hasTag("dorios:energy")) continue;

    if (block.hasTag("dorios:isTube")) {
      for (const offset of NETWORK_OFFSETS) queue.push(offsetLocation(position, offset));
      continue;
    }

    let entity = dimension.getEntitiesAtBlockLocation(position)[0];
    if (block.hasTag("dorios:multiblock.port")) {
      entity = dimension.getEntities({
        tags: [`input:[${position.x},${position.y},${position.z}]`],
      })[0];
      if (!entity) continue;

      const inputs = [];
      for (const tag of entity.getTags()) {
        if (!tag.startsWith("input:[")) continue;
        const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
        const inputBlock = safeGetBlock(dimension, { x, y, z });
        if (inputBlock) inputs.push(inputBlock.location);
      }
      searchEnergyStorages(inputs, entity);
      continue;
    }

    if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_source")) {
      searchEnergyStorages([position], entity);
    }
  }
  return visited;
}

/**
 * Preserves the existing per-generator `net:[x,y,z]` network tags.
 *
 * @param {Vector3[]} startPositions
 * @param {Entity} generator
 */
function searchEnergyStorages(startPositions, generator) {
  const dimension = generator.dimension;
  const queue = [];
  let queueHead = 0;
  const visited = new Set();

  for (const startPosition of startPositions) {
    const key = `${startPosition.x},${startPosition.y},${startPosition.z}`;
    visited.add(key);
    for (const offset of NETWORK_OFFSETS) queue.push(offsetLocation(startPosition, offset));
  }

  const machines = [];
  while (queueHead < queue.length) {
    const position = queue[queueHead++];

    const key = `${position.x},${position.y},${position.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const block = safeGetBlock(dimension, position);
    if (!block?.hasTag("dorios:energy")) continue;

    if (block.typeId === "utilitycraft:energy_cable") {
      for (const offset of NETWORK_OFFSETS) queue.push(offsetLocation(position, offset));
      continue;
    }

    let entity = dimension.getEntitiesAtBlockLocation(position)[0];
    if (block.hasTag("dorios:multiblock.port")) {
      entity = dimension.getEntities({
        tags: [`input:[${position.x},${position.y},${position.z}]`],
      })[0];
      if (entity) machines.push(entity.location);
      continue;
    }

    if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_container")) {
      machines.push(position);
    }
  }

  for (const tag of generator.getTags()) {
    if (tag.startsWith("net:")) generator.removeTag(tag);
  }
  for (const position of machines) {
    generator.addTag(`net:[${position.x},${position.y},${position.z}]`);
  }
  generator.addTag("updateNetwork");
}

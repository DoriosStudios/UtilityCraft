// @ts-check

import { createRegistrar } from "../../DoriosLib/registry/index.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import {
  OPPOSITE_DIRECTIONS,
  PIPE_DIRECTION_OFFSETS,
  getConnectionStateDirection,
  isExporterEndpoint,
  isImporterEndpoint,
  isPipeFaceDisabled,
  isMultiEndpoint,
  isMultiTube,
} from "./pipeFaces.js";

export {
  OPPOSITE_DIRECTIONS,
  isExporterEndpoint,
  isImporterEndpoint,
} from "./pipeFaces.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../../DoriosLib/containers/config.js").ContainerFace} ContainerFace */

export const NETWORK_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

/**
 * Physical location offset selected by the exporter's/importer's
 * `minecraft:block_face` state. This preserves UtilityCraft's established
 * block orientation semantics.
 */
export const BLOCK_FACE_OFFSETS = {
  down: { x: 0, y: 1, z: 0 },
  up: { x: 0, y: -1, z: 0 },
  south: { x: 0, y: 0, z: -1 },
  north: { x: 0, y: 0, z: 1 },
  east: { x: -1, y: 0, z: 0 },
  west: { x: 1, y: 0, z: 0 },
};

export const DIRECTION_OFFSETS = {
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

/** Shared UtilityCraft component registrar installed by the network listener. */
export const networkRegistrar = createRegistrar("utilitycraft");

/** @param {Vector3} location @param {Vector3} offset */
export function offsetLocation(location, offset) {
  return {
    x: location.x + offset.x,
    y: location.y + offset.y,
    z: location.z + offset.z,
  };
}

/**
 * Reads a block without allowing an out-of-bounds or unloaded position to
 * abort a complete network rebuild.
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {Vector3} location
 * @returns {Block|undefined}
 */
export function safeGetBlock(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined;
  }
}

/**
 * @param {Vector3} offset
 * @returns {ContainerFace|undefined}
 */
export function directionFromOffset(offset) {
  for (const [direction, candidate] of Object.entries(DIRECTION_OFFSETS)) {
    if (candidate.x === offset.x && candidate.y === offset.y && candidate.z === offset.z) {
      return /** @type {ContainerFace} */ (direction);
    }
  }
  return undefined;
}

/**
 * Returns the face of a neighboring container touched by a network node.
 *
 * @param {Vector3} nodeToContainerOffset
 * @returns {ContainerFace|undefined}
 */
export function getContainerFace(nodeToContainerOffset) {
  const direction = directionFromOffset(nodeToContainerOffset);
  return direction
    ? /** @type {ContainerFace} */ (OPPOSITE_DIRECTIONS[direction])
    : undefined;
}

/**
 * @param {Block} block
 * @returns {{location:Vector3, face:ContainerFace}|undefined}
 */
export function getAttachedContainerEndpoint(block) {
  const blockFace = block?.permutation?.getState("minecraft:block_face");
  const offset = BLOCK_FACE_OFFSETS[blockFace];
  const face = offset ? getContainerFace(offset) : undefined;
  if (!offset || !face) return undefined;
  return { location: offsetLocation(block.location, offset), face };
}

/** @param {Block} block */
export function isItemNetworkBlock(block) {
  return Boolean(block?.hasTag("dorios:item") && (
    block.hasTag("dorios:isTube")
    || isExporterEndpoint(block)
    || isImporterEndpoint(block)
  ));
}

/**
 * @param {Block} block
 * @param {string} colorTag
 */
export function isMatchingNetworkColor(block, colorTag) {
  return Boolean(block?.hasTag(colorTag));
}

/** @param {Block} block */
export function getNetworkColor(block) {
  for (const tag of block?.getTags?.() ?? []) {
    if (tag.startsWith("dorios:color.")) return tag;
  }
  return "dorios:color.default";
}

const UTILITY_NETWORK_TAGS = Object.freeze([
  "dorios:item",
  "dorios:fluid",
  "dorios:gas",
  "dorios:energy",
]);

/** @param {string} tag */
function resourceFromNetworkTag(tag) {
  return tag.startsWith("dorios:") ? tag.slice("dorios:".length) : undefined;
}

/**
 * @param {Block} block
 * @param {Block|undefined} neighbor
 * @param {keyof typeof PIPE_DIRECTION_OFFSETS} direction
 * @param {string} tag
 * @param {ReadonlyArray<string>} colorTags
 */
function shouldConnectForNetwork(block, neighbor, direction, tag, colorTags) {
  if (!neighbor) return false;

  let shouldConnect = false;
  if (neighbor.hasTag(tag)) {
    if (!neighbor.hasTag("dorios:isTube")) {
      shouldConnect = true;
    } else {
      shouldConnect = colorTags.some((color) => neighbor.hasTag(color));
    }
  } else if (tag === "dorios:item") {
    shouldConnect = Boolean(
      DoriosContainer.resolve(neighbor)
      ?? DoriosContainer.resolveAt(neighbor.dimension, neighbor.location)
    );
  }

  if (!shouldConnect) return false;
  const resource = resourceFromNetworkTag(tag);
  return !isPipeFaceDisabled(block, direction, resource)
    && !isPipeFaceDisabled(neighbor, OPPOSITE_DIRECTIONS[direction], resource);
}

/** @param {Block} block @param {string|ReadonlyArray<string>} requested */
function getGeometryNetworkTags(block, requested) {
  const requestedTags = Array.isArray(requested) ? requested : [requested];
  const candidates = isMultiTube(block) || isMultiEndpoint(block)
    ? UTILITY_NETWORK_TAGS
    : requestedTags;
  return candidates.filter((tag) => block.hasTag(tag));
}

/**
 * Updates the six visual connection states of a normal cable/pipe.
 *
 * @param {Block} block
 * @param {string|ReadonlyArray<string>} tag Fully-qualified network tag(s).
 */
export function updateGeometry(block, tag) {
  if (!block?.permutation || !block?.dimension) return;

  let permutation = block.permutation;
  const tags = getGeometryNetworkTags(block, tag);
  const colorTags = block.getTags().filter((entry) => entry.startsWith("dorios:color."));

  for (const [rawDirection, offset] of Object.entries(PIPE_DIRECTION_OFFSETS)) {
    const direction = /** @type {keyof typeof PIPE_DIRECTION_OFFSETS} */ (rawDirection);
    const neighbor = safeGetBlock(block.dimension, offsetLocation(block.location, offset));
    const shouldConnect = tags.some((networkTag) => (
      shouldConnectForNetwork(block, neighbor, direction, networkTag, colorTags)
    ));

    const stateId = `utilitycraft:${direction}`;
    if (permutation.getState(stateId) !== shouldConnect) {
      try {
        permutation = permutation.withState(stateId, shouldConnect);
      } catch {}
    }
  }

  if (permutation !== block.permutation) block.setPermutation(permutation);
}

/**
 * Updates exporter/importer geometry while preserving the established visual
 * rotation map used by their models.
 *
 * @param {Block} block
 * @param {string|ReadonlyArray<string>} tag Fully-qualified network tag(s).
 */
export function updateEndpointGeometry(block, tag) {
  if (!block?.permutation || !block?.dimension) return;
  let permutation = block.permutation;
  const tags = getGeometryNetworkTags(block, tag);
  const colorTags = block.getTags().filter((entry) => entry.startsWith("dorios:color."));

  for (const [rawDirection, offset] of Object.entries(PIPE_DIRECTION_OFFSETS)) {
    const direction = /** @type {keyof typeof PIPE_DIRECTION_OFFSETS} */ (rawDirection);
    const visualDirection = getConnectionStateDirection(block, direction);
    const neighbor = safeGetBlock(block.dimension, offsetLocation(block.location, offset));
    const shouldConnect = tags.some((networkTag) => (
      shouldConnectForNetwork(block, neighbor, direction, networkTag, colorTags)
    ));

    const stateId = `utilitycraft:${visualDirection}`;
    if (permutation.getState(stateId) !== shouldConnect) {
      try {
        permutation = permutation.withState(stateId, shouldConnect);
      } catch {}
    }
  }

  if (permutation !== block.permutation) block.setPermutation(permutation);
}

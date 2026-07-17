// @ts-check

import { ModalFormData } from "@minecraft/server-ui";
import { createRegistrar } from "../../DoriosLib/registry/index.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import { capitalizeFirst } from "../../DoriosLib/text/index.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
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

// Block model connection states follow Minecraft's visual north/south axes,
// which are intentionally different from DoriosCore's established IO naming.
const GEOMETRY_OFFSETS = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

export const OPPOSITE_DIRECTIONS = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
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
    || block.hasTag("dorios:isExporter")
    || block.hasTag("dorios:isImporter")
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

/**
 * Updates the six visual connection states of a normal cable/pipe.
 *
 * @param {Block} block
 * @param {string} tag Fully-qualified network tag.
 */
export function updateGeometry(block, tag) {
  if (!block?.permutation || !block?.dimension) return;

  let permutation = block.permutation;
  const isItemConduit = block.hasTag("dorios:item");

  for (const [direction, offset] of Object.entries(GEOMETRY_OFFSETS)) {
    const neighbor = safeGetBlock(block.dimension, offsetLocation(block.location, offset));
    let shouldConnect = false;

    if (neighbor?.hasTag(tag)) {
      if (!neighbor.hasTag("dorios:isTube")) {
        shouldConnect = true;
      } else {
        for (const color of block.getTags()) {
          if (color.startsWith("dorios:color.") && neighbor.hasTag(color)) {
            shouldConnect = true;
            break;
          }
        }
      }
    } else if (isItemConduit && neighbor) {
      shouldConnect = Boolean(
        DoriosContainer.resolve(neighbor)
        ?? DoriosContainer.resolveAt(neighbor.dimension, neighbor.location)
      );
    }

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
 * @param {string} tag Fully-qualified network tag.
 */
export function updateEndpointGeometry(block, tag) {
  if (!block?.permutation || !block?.dimension) return;

  const directionMap = {
    north: { north: "south", south: "north", east: "west", west: "east", up: "up", down: "down" },
    south: { north: "north", south: "south", east: "east", west: "west", up: "up", down: "down" },
    east: { north: "east", south: "west", east: "south", west: "north", up: "up", down: "down" },
    west: { north: "west", south: "east", east: "north", west: "south", up: "up", down: "down" },
    up: { north: "up", south: "down", east: "east", west: "west", up: "south", down: "north" },
    down: { north: "down", south: "up", east: "east", west: "west", up: "north", down: "south" },
  };

  const facing = block.permutation.getState("minecraft:block_face");
  const map = directionMap[facing] ?? directionMap.north;
  const isItemEndpoint = block.hasTag("dorios:item");
  let permutation = block.permutation;

  for (const [direction, visualDirection] of Object.entries(map)) {
    const offset = GEOMETRY_OFFSETS[direction];
    const neighbor = safeGetBlock(block.dimension, offsetLocation(block.location, offset));
    let shouldConnect = false;

    if (neighbor?.hasTag(tag)) {
      if (!neighbor.hasTag("dorios:isTube")) {
        shouldConnect = true;
      } else {
        for (const color of block.getTags()) {
          if (color.startsWith("dorios:color.") && neighbor.hasTag(color)) {
            shouldConnect = true;
            break;
          }
        }
      }
    } else if (isItemEndpoint && neighbor) {
      shouldConnect = Boolean(
        DoriosContainer.resolve(neighbor)
        ?? DoriosContainer.resolveAt(neighbor.dimension, neighbor.location)
      );
    }

    try {
      permutation = permutation.withState(`utilitycraft:${visualDirection}`, shouldConnect);
    } catch {}
  }

  block.setPermutation(permutation);
}

/**
 * Existing entity-backed menu shared by the fluid extractor.
 *
 * @param {Entity} entity
 * @param {Player} player
 */
export function openEntityTransferModeMenu(entity, player) {
  const currentMode = String(entity.getDynamicProperty("transferMode") ?? "nearest");
  const modes = ["Nearest", "Farthest", "Round"];
  const defaultIndex = Math.max(0, modes.findIndex((mode) => mode.toLowerCase() === currentMode));

  new ModalFormData()
    .title("Transfer Mode")
    .dropdown("Select transfer behavior:", modes, { defaultValueIndex: defaultIndex })
    .show(player)
    .then((result) => {
      if (result.canceled) return;
      const selection = Number(result.formValues?.[0] ?? 0);
      entity.setDynamicProperty("transferMode", (modes[selection] ?? "Nearest").toLowerCase());
      player.onScreenDisplay.setActionBar(
        `§7Transfer mode set to: §e${capitalizeFirst(modes[selection] ?? "Nearest")}`,
      );
    });
}

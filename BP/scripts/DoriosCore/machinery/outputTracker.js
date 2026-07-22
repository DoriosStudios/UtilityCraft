import { system, world } from "@minecraft/server";
import { tryGetEntityFromBlock } from "../utils/entity.js";
import { resolveItemContainerAt } from "./itemContainers.js";
import {
  DIRECTIONS,
  DIRECTION_OFFSETS,
  OPPOSITE_DIRECTIONS,
  offsetLocation,
} from "../utils/directions.js";

const IO_TARGETS_PROPERTY_ID = "dorios:io_targets";

const OUTPUT_TARGET_PROPERTY_IDS = {
  item: "dorios:item_output",
  fluid: "dorios:fluid_output",
  gas: "dorios:gas_output",
};

const OUTPUT_OFFSETS = {
  east: { x: -1, y: 0, z: 0 },
  west: { x: 1, y: 0, z: 0 },
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  up: DIRECTION_OFFSETS.down,
  down: DIRECTION_OFFSETS.up,
};

/**
 * Returns whether a block owns the six-direction IO cache.
 *
 * Machines keep the legacy behavior. Generators must opt in explicitly so
 * UI-only energy generators are not treated as IO machines.
 *
 * @param {import("@minecraft/server").Block|undefined} block Block to inspect.
 * @returns {boolean} Whether the block should store `dorios:io_targets`.
 */
function isIOOwnerBlock(block) {
  if (!block) return false;
  if (block.hasTag?.("dorios:machine")) return true;
  return block.hasTag?.("dorios:generator") && block.hasTag?.("dorios:io");
}

function getPropertyId(type) {
  return OUTPUT_TARGET_PROPERTY_IDS[type];
}

function getOutputDirection(block) {
  return block?.permutation?.getState?.("minecraft:facing_direction")
    ?? block?.permutation?.getState?.("minecraft:cardinal_direction")
    ?? block?.permutation?.getState?.("utilitycraft:axis");
}

/**
 * Checks whether an entity is a machine helper entity.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Entity to inspect.
 * @returns {boolean} Whether the entity belongs to a machine.
 */
function isMachineEntity(entity) {
  const typeFamily = entity?.getComponent?.("minecraft:type_family");
  return typeFamily?.hasTypeFamily("dorios:machine") === true
    || typeFamily?.hasTypeFamily("dorios:generator") === true;
}

/**
 * Parses the cached IO target map from a machine entity.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @returns {Record<string, Record<string, boolean>>} Parsed target map.
 */
function readIOTargets(entity) {
  const raw = entity?.getDynamicProperty?.(IO_TARGETS_PROPERTY_ID);
  if (typeof raw !== "string" || raw.length === 0) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    entity?.setDynamicProperty?.(IO_TARGETS_PROPERTY_ID, undefined);
    return {};
  }
}

/**
 * Writes the cached IO target map to a machine entity.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
 * @param {Record<string, Record<string, boolean>>} targets Target map.
 * @returns {void}
 */
function writeIOTargets(entity, targets) {
  entity?.setDynamicProperty?.(IO_TARGETS_PROPERTY_ID, JSON.stringify(targets ?? {}));
}

/**
 * Checks target compatibility at a world location.
 *
 * @param {import("@minecraft/server").Dimension} dimension Dimension to inspect.
 * @param {import("@minecraft/server").Vector3} location Target location.
 * @param {"item"|"fluid"|"gas"} type Resource type.
 * @returns {boolean} Whether that location can receive the resource.
 */
function isIOTargetAt(dimension, location, type) {
  if (type === "item") {
    return Boolean(resolveItemContainerAt(dimension, location));
  }

  if (type === "fluid") {
    try {
      return OutputTracker.isOutputTarget(dimension.getBlock(location), "fluid");
    } catch {
      return false;
    }
  }

  if (type === "gas") {
    try {
      return OutputTracker.isOutputTarget(dimension.getBlock(location), "gas");
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Tracks cached machine output targets for item, fluid, and gas transfer.
 *
 * The tracker updates machine entities when relevant blocks are placed and
 * provides a lazy fallback for already-placed machines. Cached targets are
 * cleared by the transfer logic when the target no longer exists.
 */
export class OutputTracker {
  /**
   * Returns whether a block can be used as an output target for a transfer type.
   *
   * @param {import("@minecraft/server").Block | undefined} block Block to inspect.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @returns {boolean} Whether the block can receive this transfer type.
   */
  static isOutputTarget(block, type) {
    if (!block) return false;

    if (type === "item") {
      return Boolean(resolveItemContainerAt(block.dimension, block.location));
    }

    if (type === "fluid") {
      return block.hasTag("dorios:fluid") && !block.hasTag("dorios:isTube");
    }

    if (type === "gas") {
      return block.hasTag("dorios:gas") && !block.hasTag("dorios:isTube");
    }

    return false;
  }

  /**
   * Reads cached six-direction IO targets from a machine entity.
   *
   * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
   * @returns {Record<string, Record<string, boolean>>} Cached target booleans.
   */
  static getIOTargets(entity) {
    return readIOTargets(entity);
  }

  /**
   * Returns the adjacent location for an absolute direction.
   *
   * @param {import("@minecraft/server").Block} block Source block.
   * @param {string} direction Absolute direction.
   * @returns {import("@minecraft/server").Vector3|undefined} Neighbor location.
   */
  static getNeighborLocation(block, direction) {
    if (!block || !DIRECTIONS.includes(direction)) return undefined;
    return offsetLocation(block.location, DIRECTION_OFFSETS[direction]);
  }

  /**
   * Rebuilds the six-direction IO target booleans for a machine block.
   *
   * The cache stores only compatibility, not the user's IO mode selection.
   * Transfer code must still read `utilitycraft:io_config` before moving
   * items or liquids.
   *
   * @param {import("@minecraft/server").Block|undefined} block Machine block.
   * @returns {Record<string, Record<string, boolean>>|undefined} Refreshed target map.
   */
  static refreshIOTargets(block) {
    if (!isIOOwnerBlock(block)) return undefined;

    const entity = tryGetEntityFromBlock(block);
    if (!isMachineEntity(entity)) return undefined;

    const targets = {};
    const tracksItems = block.hasTag("dorios:item");
    const tracksLiquids = block.hasTag("dorios:fluid");
    const tracksGases = block.hasTag("dorios:gas");

    if (tracksItems) targets.items = {};
    if (tracksLiquids) targets.liquids = {};
    if (tracksGases) targets.gases = {};

    for (const direction of DIRECTIONS) {
      const targetLocation = OutputTracker.getNeighborLocation(block, direction);

      if (tracksItems) {
        targets.items[direction] = isIOTargetAt(block.dimension, targetLocation, "item");
      }

      if (tracksLiquids) {
        targets.liquids[direction] = isIOTargetAt(block.dimension, targetLocation, "fluid");
      }

      if (tracksGases) {
        targets.gases[direction] = isIOTargetAt(block.dimension, targetLocation, "gas");
      }
    }

    writeIOTargets(entity, targets);
    return targets;
  }

  /**
   * Refreshes cached IO target maps for adjacent machines.
   *
   * @param {import("@minecraft/server").Block|undefined} block Center block.
   * @returns {void}
   */
  static refreshAdjacentIOTargets(block) {
    if (!block?.dimension || !block.location) return;

    for (const direction of DIRECTIONS) {
      const neighbor = block.dimension.getBlock(offsetLocation(block.location, DIRECTION_OFFSETS[direction]));
      if (isIOOwnerBlock(neighbor)) {
        OutputTracker.refreshIOTargets(neighbor);
      }
    }
  }

  /**
   * Returns whether the cached target map allows a direction for a group.
   *
   * @param {import("@minecraft/server").Entity|undefined} entity Machine entity.
   * @param {"items"|"liquids"|"gases"} group IO group.
   * @param {string} direction Absolute direction.
   * @returns {boolean} Whether transfer logic should inspect that neighbor.
   */
  static isIOTargetEnabled(entity, group, direction) {
    return readIOTargets(entity)?.[group]?.[direction] === true;
  }

  /**
   * Returns the output location used by machines for their facing state.
   *
   * Vanilla-facing machines use the opposite side of `minecraft:facing_direction`
   * or `minecraft:cardinal_direction`; older UtilityCraft-axis machines keep
   * using the opposite side of `utilitycraft:axis`.
   *
   * @param {import("@minecraft/server").Block} block Machine block.
   * @returns {import("@minecraft/server").Vector3 | undefined} Output location.
   */
  static getOutputLocation(block) {
    const direction = getOutputDirection(block);
    const outputDirection = OPPOSITE_DIRECTIONS[direction] ?? direction;
    const offset = OUTPUT_OFFSETS[direction] ?? DIRECTION_OFFSETS[outputDirection];
    if (!offset) return undefined;

    return offsetLocation(block.location, offset);
  }

  /**
   * Reads a cached output target from an entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @returns {import("@minecraft/server").Vector3 | undefined} Cached target.
   */
  static getOutputTarget(entity, type) {
    const propertyId = getPropertyId(type);
    if (!propertyId) return undefined;

    try {
      const rawTarget = entity?.getDynamicProperty?.(propertyId);
      if (typeof rawTarget !== "string") return undefined;

      const target = JSON.parse(rawTarget);
      if (![target?.x, target?.y, target?.z].every(Number.isFinite)) return undefined;

      return target;
    } catch {
      OutputTracker.clearOutputTarget(entity, type);
      return undefined;
    }
  }

  /**
   * Stores an output target on a machine helper entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @param {import("@minecraft/server").Vector3} target Output target location.
   * @returns {void}
   */
  static setOutputTarget(entity, type, target) {
    const propertyId = getPropertyId(type);
    if (!propertyId || !entity || !target) return;

    entity.setDynamicProperty(propertyId, JSON.stringify(target));
  }

  /**
   * Clears a cached output target from a machine helper entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @returns {void}
   */
  static clearOutputTarget(entity, type) {
    const propertyId = getPropertyId(type);
    if (!propertyId || !entity) return;

    entity.setDynamicProperty(propertyId, undefined);
  }

  /**
   * Recalculates and stores the output target for a machine block.
   *
   * @param {import("@minecraft/server").Block} block Machine block.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @returns {import("@minecraft/server").Vector3 | undefined} Valid output target.
   */
  static refreshOutput(block, type) {
    const entity = tryGetEntityFromBlock(block);
    if (!isMachineEntity(entity)) return undefined;

    const targetLocation = OutputTracker.getOutputLocation(block);
    if (!targetLocation) {
      OutputTracker.clearOutputTarget(entity, type);
      return undefined;
    }

    const targetBlock = block.dimension.getBlock(targetLocation);
    if (!OutputTracker.isOutputTarget(targetBlock, type)) {
      OutputTracker.clearOutputTarget(entity, type);
      return undefined;
    }

    OutputTracker.setOutputTarget(entity, type, targetLocation);
    return targetLocation;
  }

  /**
   * Refreshes output targets for machine blocks adjacent to a placed target.
   *
   * @param {import("@minecraft/server").Block} block Newly placed output target.
   * @param {"item" | "fluid" | "gas"} type Transfer type.
   * @returns {void}
   */
  static refreshAdjacentOutputs(block, type) {
    if (!block?.dimension || !block.location) return;

    for (const direction of DIRECTIONS) {
      const neighbor = block.dimension.getBlock(offsetLocation(block.location, DIRECTION_OFFSETS[direction]));
      if (neighbor?.hasTag("dorios:machine")) {
        OutputTracker.refreshOutput(neighbor, type);
      }
    }
  }
}

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  system.runTimeout(() => {
    if (isIOOwnerBlock(block)) {
      OutputTracker.refreshIOTargets(block);
    }

    if (block.hasTag("dorios:machine")) {
      OutputTracker.refreshOutput(block, "item");
      OutputTracker.refreshOutput(block, "fluid");
      OutputTracker.refreshOutput(block, "gas");
    }

    OutputTracker.refreshAdjacentIOTargets(block);

    if (OutputTracker.isOutputTarget(block, "item")) {
      OutputTracker.refreshAdjacentOutputs(block, "item");
    }

    if (OutputTracker.isOutputTarget(block, "fluid")) {
      OutputTracker.refreshAdjacentOutputs(block, "fluid");
    }

    if (OutputTracker.isOutputTarget(block, "gas")) {
      OutputTracker.refreshAdjacentOutputs(block, "gas");
    }
  }, 2);
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  system.runTimeout(() => {
    OutputTracker.refreshAdjacentIOTargets(event?.block);
    OutputTracker.refreshAdjacentOutputs(event?.block, "item");
    OutputTracker.refreshAdjacentOutputs(event?.block, "fluid");
    OutputTracker.refreshAdjacentOutputs(event?.block, "gas");
  }, 2);
});

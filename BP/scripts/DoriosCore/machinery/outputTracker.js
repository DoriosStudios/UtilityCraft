import { system, world } from "@minecraft/server";
import { tryGetEntityFromBlock } from "../utils/entity.js";

const OUTPUT_TARGET_PROPERTY_IDS = {
  item: "dorios:item_output",
  fluid: "dorios:fluid_output",
};

const OUTPUT_OFFSETS = {
  east: { x: -1, y: 0, z: 0 },
  west: { x: 1, y: 0, z: 0 },
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: -1, z: 0 },
  down: { x: 0, y: 1, z: 0 },
};

const ADJACENT_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

function offsetLocation(location, offset) {
  return {
    x: location.x + offset.x,
    y: location.y + offset.y,
    z: location.z + offset.z,
  };
}

function getPropertyId(type) {
  return OUTPUT_TARGET_PROPERTY_IDS[type];
}

/**
 * Tracks cached machine output targets for item and fluid transfer.
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
   * @param {"item" | "fluid"} type Transfer type.
   * @returns {boolean} Whether the block can receive this transfer type.
   */
  static isOutputTarget(block, type) {
    if (!block) return false;

    if (type === "item") {
      return block.hasTag("dorios:item") || DoriosAPI.constants.vanillaContainers.includes(block.typeId);
    }

    if (type === "fluid") {
      return block.hasTag("dorios:fluid") && !block.hasTag("dorios:isTube");
    }

    return false;
  }

  /**
   * Returns the output location used by machines for the given block axis.
   *
   * This matches {@link Machine.transferItems}: output is the opposite direction
   * of the block's `utilitycraft:axis` state.
   *
   * @param {import("@minecraft/server").Block} block Machine block.
   * @returns {import("@minecraft/server").Vector3 | undefined} Output location.
   */
  static getOutputLocation(block) {
    const axis = block?.getState?.("utilitycraft:axis");
    const offset = OUTPUT_OFFSETS[axis];
    if (!offset) return undefined;

    return offsetLocation(block.location, offset);
  }

  /**
   * Reads a cached output target from an entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @param {"item" | "fluid"} type Transfer type.
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
   * @param {"item" | "fluid"} type Transfer type.
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
   * @param {"item" | "fluid"} type Transfer type.
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
   * @param {"item" | "fluid"} type Transfer type.
   * @returns {import("@minecraft/server").Vector3 | undefined} Valid output target.
   */
  static refreshOutput(block, type) {
    const entity = tryGetEntityFromBlock(block);
    if (!entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:machine")) return undefined;

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
   * @param {"item" | "fluid"} type Transfer type.
   * @returns {void}
   */
  static refreshAdjacentOutputs(block, type) {
    for (const offset of ADJACENT_OFFSETS) {
      const neighbor = block.dimension.getBlock(offsetLocation(block.location, offset));
      if (neighbor?.hasTag("dorios:machine")) {
        OutputTracker.refreshOutput(neighbor, type);
      }
    }
  }
}

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  system.runTimeout(() => {
    if (block.hasTag("dorios:machine")) {
      OutputTracker.refreshOutput(block, "item");
      OutputTracker.refreshOutput(block, "fluid");
    }

    if (OutputTracker.isOutputTarget(block, "item")) {
      OutputTracker.refreshAdjacentOutputs(block, "item");
    }

    if (OutputTracker.isOutputTarget(block, "fluid")) {
      OutputTracker.refreshAdjacentOutputs(block, "fluid");
    }
  }, 2);
});

import * as Constants from "./constants.js";

/** Only live multiblock controllers may receive controller events. */
export function isMultiblockEntity(entity) {
  return entity?.isValid === true
    && entity.typeId !== "minecraft:player"
    && entity.getComponent("minecraft:type_family")?.hasTypeFamily(Constants.MULTIBLOCK_FAMILY) === true;
}

export class EntityManager {
  /**
   * Returns the geometric center of a bounding box.
   *
   * @param {import("@minecraft/server").Vector3} min Minimum corner of the bounds.
   * @param {import("@minecraft/server").Vector3} max Maximum corner of the bounds.
   * @returns {import("@minecraft/server").Vector3} Center point between the two corners.
   */
  static getCenter(min, max) {
    return {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    };
  }

  /**
   * Calculates the inclusive volume of a bounding box.
   *
   * @param {{ min: import("@minecraft/server").Vector3, max: import("@minecraft/server").Vector3 }} bounds Bounding box to measure.
   * @returns {number} Total amount of block positions contained in the bounds.
   */
  static getVolume(bounds) {
    return (
      (bounds.max.x - bounds.min.x + 1) *
      (bounds.max.y - bounds.min.y + 1) *
      (bounds.max.z - bounds.min.z + 1)
    );
  }

  /**
   * Checks whether a position lies inside inclusive multiblock bounds.
   *
   * @param {import("@minecraft/server").Vector3} pos Position to test.
   * @param {{ min: import("@minecraft/server").Vector3, max: import("@minecraft/server").Vector3 }} bounds Bounding box to test against.
   * @returns {boolean} `true` if the position lies within the bounds.
   */
  static isInsideBounds(pos, bounds) {
    return (
      pos.x >= bounds.min.x &&
      pos.x <= bounds.max.x &&
      pos.y >= bounds.min.y &&
      pos.y <= bounds.max.y &&
      pos.z >= bounds.min.z &&
      pos.z <= bounds.max.z
    );
  }

  /**
   * Resolves the helper entity stored directly on a multiblock controller.
   *
   * The supplied permutation must carry the controller tag. Passing the broken
   * permutation allows this lookup to remain safe in post-break callbacks where
   * the current block has already become air.
   *
   * @param {import("@minecraft/server").Block} block Controller block location.
   * @param {import("@minecraft/server").BlockPermutation} [permutation=block.permutation] Current or pre-break controller permutation.
   * @returns {import("@minecraft/server").Entity | undefined} Matching controller entity if one is found.
   */
  static getControllerEntityFromBlock(block, permutation = block?.permutation) {
    if (!block || !permutation?.hasTag(Constants.MULTIBLOCK_CONTROLLER_TAG)) return;

    return block.dimension
      .getEntitiesAtBlockLocation(block.location)
      .find(isMultiblockEntity);
  }

  /**
   * Resolves the active multiblock structure that owns a general block position.
   *
   * Only nearby `dorios:multiblock` entities whose serialized bounds contain
   * the position and whose state is active are eligible. Direct entities at the
   * block location are intentionally ignored.
   *
   * @param {import("@minecraft/server").Block} block Block inside an active multiblock structure.
   * @returns {import("@minecraft/server").Entity | undefined} Owning controller entity if one is found.
   */
  static getEntityFromBlock(block) {
    if (!block) return;

    return block.dimension
      .getEntities({
        location: block.location,
        maxDistance: Constants.MAX_SIZE,
        families: [Constants.MULTIBLOCK_FAMILY],
      })
      .find((entity) => {
        if (!isMultiblockEntity(entity)) return false;
        if (entity.getDynamicProperty(Constants.STATE_PROPERTY_ID) !== Constants.ACTIVE_STATE_VALUE) {
          return false;
        }

        const raw = entity.getDynamicProperty(Constants.BOUNDS_PROPERTY_ID);
        if (!raw) return false;

        try {
          const bounds = JSON.parse(raw);
          return EntityManager.isInsideBounds(block.location, bounds);
        } catch {
          return false;
        }
      });
  }
}

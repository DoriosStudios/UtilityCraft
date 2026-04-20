import * as Constants from "./constants.js";

export class EntityManager {
  /**
   * Returns the geometric center of a bounding box.
   *
   * @param {Vector3} min Minimum corner of the bounds.
   * @param {Vector3} max Maximum corner of the bounds.
   * @returns {Vector3} Center point between the two corners.
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
   * @param {{ min: Vector3, max: Vector3 }} bounds Bounding box to measure.
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
   * @param {Vector3} pos Position to test.
   * @param {{ min: Vector3, max: Vector3 }} bounds Bounding box to test against.
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
   * Resolves the controller entity associated with a block.
   *
   * Resolution strategy:
   * - First tries the entity directly stored at the exact block location.
   * - Falls back to nearby entities in the `dorios:multiblock` family.
   * - Uses serialized multiblock bounds to determine ownership.
   *
   * @param {Block} block Block belonging to or representing a multiblock.
   * @returns {Entity | undefined} Matching controller entity if one is found.
   */
  static getEntityFromBlock(block) {
    if (!block) return;

    const directEntity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (directEntity) return directEntity;

    return block.dimension
      .getEntities({
        location: block.location,
        maxDistance: Constants.MAX_SIZE,
        families: [Constants.MULTIBLOCK_FAMILY],
      })
      .find((entity) => {
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

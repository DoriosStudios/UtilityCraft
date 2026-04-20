import { system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EntityManager } from "./entityManager.js";

export class DeactivationManager {
  /**
   * Empties previously filled multiblock bounds layer by layer.
   *
   * The bounds are currently read from the legacy `reactorStats` property, which
   * is kept for structures that serialize their activation data there.
   *
   * @param {Entity} entity Controller entity that stores the old fill bounds.
   * @param {string} [blockId="minecraft:water"] Block identifier to replace with air.
   */
  static emptyBlocks(entity, blockId = "minecraft:water") {
    const oldDataRaw = entity.getDynamicProperty(Constants.LEGACY_REACTOR_STATS_PROPERTY_ID);
    if (!oldDataRaw) return;
    const oldData = JSON.parse(oldDataRaw);
    const bounds = oldData.bounds;
    const dim = entity.dimension;
    const xA = bounds.min.x;
    const yA = bounds.min.y;
    const zA = bounds.min.z;
    const xB = bounds.max.x;
    const yB = bounds.max.y;
    const zB = bounds.max.z;

    const yBottom = yA <= yB ? yA : yB;
    const yTop = yA <= yB ? yB : yA;

    system.run(async () => {
      for (let y = yTop; y >= yBottom; y--) {
        dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} air replace ${blockId}`);
        await system.waitTicks(2);
      }
    });
  }

  /**
   * Deactivates a multiblock structure associated with the given controller block.
   *
   * Responsibilities:
   * - Finds the controller entity.
   * - Hides the entity visual state.
   * - Clears active tags from connected multiblock ports.
   * - Resets controller dynamic properties used by the machine runtime.
   * - Optionally removes filled helper blocks such as water.
   *
   * @param {Block} block Controller block or any block inside the structure bounds.
   * @param {Player} [player] Optional player to notify about the deactivation.
   * @param {{ blockId?: string }} [emptyBlocksConfig]
   * Optional config describing which block should be removed from the bounds.
   * @returns {Entity | undefined} The deactivated controller entity, if found.
   */
  static deactivateMultiblock(block, player, emptyBlocksConfig) {
    const entity = EntityManager.getEntityFromBlock(block);
    if (player) player.sendMessage("\u00A7c[Scan] Multiblock structure deactivated.");
    if (!entity) return;

    entity.triggerEvent(Constants.HIDE_EVENT_ID);
    entity.getTags().forEach((tag) => {
      if (!tag.startsWith(Constants.INPUT_TAG_PREFIX)) return;

      const [x, y, z] = tag.slice(Constants.INPUT_TAG_PREFIX.length, -1).split(",").map(Number);
      const inputBlock = entity.dimension.getBlock({ x, y, z });
      if (!inputBlock?.hasTag(Constants.MULTIBLOCK_PORT_TAG)) return;

      entity.removeTag(tag);
      if (inputBlock.hasTag(Constants.ENERGY_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} energy|[${x},${y},${z}]`);
      if (inputBlock.hasTag(Constants.FLUID_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} fluid|[${x},${y},${z}]`);
      if (inputBlock.hasTag(Constants.ITEM_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} item|[${x},${y},${z}]`);
      inputBlock.setPermutation(inputBlock.permutation.withState(Constants.ACTIVE_STATE_ID, 0));
    });

    entity.setDynamicProperty(Constants.RATE_SPEED_PROPERTY_ID, 0);
    entity.setDynamicProperty(Constants.BOUNDS_PROPERTY_ID, undefined);
    entity.setDynamicProperty(Constants.STATE_PROPERTY_ID, Constants.INACTIVE_STATE_VALUE);

    if (emptyBlocksConfig) {
      DeactivationManager.emptyBlocks(entity, emptyBlocksConfig.blockId);
    }

    return entity;
  }

  /**
   * Deactivates a multiblock and removes its controller entity shortly after.
   *
   * This is typically used when the controller block itself is broken.
   *
   * @param {Block} block Controller block being broken.
   * @param {Player} [player] Player responsible for the break event.
   * @param {{ blockId?: string }} [emptyBlocksConfig]
   * Optional config describing which filled block should be removed first.
   * @returns {Entity | undefined} Removed controller entity, if one was found.
   */
  static handleBreakController(block, player, emptyBlocksConfig) {
    const entity = DeactivationManager.deactivateMultiblock(block, player, emptyBlocksConfig);
    if (!entity) return;

    system.runTimeout(() => entity.remove(), 2);
    return entity;
  }
}

import { system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EntityManager, isMultiblockEntity } from "./entityManager.js";
import { isLinkNode, parseLinkNodeTag } from "../../DoriosLib/linkNodes/index.js";
import { setTaggedBlocksWaterlogged } from "./waterlogging.js";

export class DeactivationManager {
  /**
   * Empties previously filled multiblock bounds layer by layer.
   *
   * The bounds are currently read from the legacy `reactorStats` property, which
   * is kept for structures that serialize their activation data there.
   *
   * @param {import("@minecraft/server").Entity} entity Controller entity that stores the old fill bounds.
   * @param {string} [blockId="minecraft:water"] Block identifier to replace with air.
   * @returns {void}
   */
  static emptyBlocks(entity, blockId = "minecraft:water") {
    let bounds;
    const boundsRaw = entity.getDynamicProperty(Constants.BOUNDS_PROPERTY_ID);
    if (boundsRaw) {
      try {
        bounds = JSON.parse(boundsRaw);
      } catch { }
    }

    if (!bounds) {
      const oldDataRaw = entity.getDynamicProperty(Constants.LEGACY_REACTOR_STATS_PROPERTY_ID);
      if (!oldDataRaw) return;
      try {
        bounds = JSON.parse(oldDataRaw).bounds;
      } catch {
        return;
      }
    }
    if (!bounds) return;

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
        await dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} air replace ${blockId}`);
        await system.waitTicks(2);
      }

      if (blockId === "minecraft:water") {
        for (let y = yTop; y >= yBottom; y--) {
          setTaggedBlocksWaterlogged(bounds, dim, y, false);
        }
      }
    });
  }

  /**
   * Deactivates the active multiblock structure that owns a general block.
   *
   * Responsibilities:
   * - Finds the controller entity through its serialized structure bounds.
   * - Hides the entity visual state.
   * - Clears active tags from connected multiblock ports.
   * - Resets controller dynamic properties used by the machine runtime.
   * - Optionally removes filled helper blocks such as water.
   *
   * @param {import("@minecraft/server").Block} block Any block inside the active structure bounds.
   * @param {import("@minecraft/server").Player} [player] Optional player to notify about the deactivation.
   * @param {{ blockId?: string }} [emptyBlocksConfig]
   * Optional config describing which block should be removed from the bounds.
   * @returns {import("@minecraft/server").Entity | undefined} The deactivated controller entity, if found.
   */
  static deactivateMultiblock(block, player, emptyBlocksConfig) {
    const entity = EntityManager.getEntityFromBlock(block);
    return DeactivationManager.deactivateEntity(entity, player, emptyBlocksConfig);
  }

  /**
   * Deactivates an already resolved multiblock controller entity.
   *
   * @param {import("@minecraft/server").Entity} entity Controller entity to deactivate.
   * @param {import("@minecraft/server").Player} [player] Optional player to notify when an active structure was deactivated.
   * @param {{ blockId?: string }} [emptyBlocksConfig] Optional filled-block cleanup configuration.
   * @returns {import("@minecraft/server").Entity | undefined} The controller entity, if supplied.
   */
  static deactivateEntity(entity, player, emptyBlocksConfig) {
    if (!isMultiblockEntity(entity)) return;

    const wasActive = entity.getDynamicProperty(Constants.STATE_PROPERTY_ID) === Constants.ACTIVE_STATE_VALUE
      && entity.getDynamicProperty(Constants.BOUNDS_PROPERTY_ID) !== undefined;

    entity.triggerEvent(Constants.HIDE_EVENT_ID);
    entity.getTags().forEach((tag) => {
      const location = parseLinkNodeTag(tag);
      if (!location) return;
      const { x, y, z } = location;
      entity.removeTag(tag);

      const inputBlock = entity.dimension.getBlock({ x, y, z });
      if (!isLinkNode(inputBlock)) return;

      if (inputBlock.hasTag(Constants.ENERGY_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} energy|[${x},${y},${z}]`);
      if (inputBlock.hasTag(Constants.FLUID_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} fluid|[${x},${y},${z}]`);
      if (inputBlock.hasTag(Constants.GAS_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} gas|[${x},${y},${z}]`);
      if (inputBlock.hasTag(Constants.ITEM_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} item|[${x},${y},${z}]`);
      inputBlock.setPermutation(inputBlock.permutation.withState(Constants.ACTIVE_STATE_ID, 0));
    });

    if (emptyBlocksConfig) {
      DeactivationManager.emptyBlocks(entity, emptyBlocksConfig.blockId);
    }

    entity.setDynamicProperty(Constants.RATE_SPEED_PROPERTY_ID, 0);
    entity.setDynamicProperty(Constants.BOUNDS_PROPERTY_ID, undefined);
    entity.setDynamicProperty(Constants.STATE_PROPERTY_ID, Constants.INACTIVE_STATE_VALUE);

    if (player && wasActive) {
      player.sendMessage("\u00A7c[Scan] Multiblock structure deactivated.");
    }

    return entity;
  }

  /**
   * Deactivates a multiblock and removes its controller entity shortly after.
   *
   * This is typically used when the controller block itself is broken.
   *
   * @param {import("@minecraft/server").Block} block Controller block being broken.
   * @param {import("@minecraft/server").Player} [player] Player responsible for the break event.
   * @param {{ blockId?: string }} [emptyBlocksConfig]
   * Optional config describing which filled block should be removed first.
   * @param {import("@minecraft/server").BlockPermutation} [controllerPermutation=block.permutation]
   * Current or pre-break controller permutation used to validate its block tag.
   * @returns {import("@minecraft/server").Entity | undefined} Removed controller entity, if one was found.
   */
  static handleBreakController(block, player, emptyBlocksConfig, controllerPermutation = block?.permutation) {
    const entity = EntityManager.getControllerEntityFromBlock(block, controllerPermutation);
    if (!isMultiblockEntity(entity)) return;

    DeactivationManager.deactivateEntity(entity, player, emptyBlocksConfig);
    system.runTimeout(() => entity.remove(), 2);
    return entity;
  }
}

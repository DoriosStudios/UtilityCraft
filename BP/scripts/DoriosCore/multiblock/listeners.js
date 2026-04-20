import { world } from "@minecraft/server";
import * as Constants from "./constants.js";
import { DeactivationManager } from "./deactivationManager.js";
import { EntityManager } from "./entityManager.js";

/**
 * Global multiblock listeners.
 *
 * Any time a casing block is broken or exploded, the owning multiblock is
 * resolved and deactivated to keep controller state consistent with the world.
 */
world.afterEvents.playerBreakBlock.subscribe((e) => {
  const { brokenBlockPermutation, block, player } = e;
  const tags = brokenBlockPermutation.getTags();
  const isCase = tags.some((tag) => tag.startsWith(Constants.MULTIBLOCK_CASE_TAG_PREFIX));
  if (!isCase) return;

  const entity = EntityManager.getEntityFromBlock(block);
  if (!entity) return;

  DeactivationManager.deactivateMultiblock(block, player, { blockId: "minecraft:water" });
});

world.afterEvents.blockExplode.subscribe((e) => {
  const { explodedBlockPermutation, block } = e;
  const tags = explodedBlockPermutation.getTags();
  const isCase = tags.some((tag) => tag.startsWith(Constants.MULTIBLOCK_CASE_TAG_PREFIX));
  if (!isCase) return;

  const entity = EntityManager.getEntityFromBlock(block);
  if (!entity) return;

  DeactivationManager.deactivateMultiblock(block, undefined, { blockId: "minecraft:water" });
});

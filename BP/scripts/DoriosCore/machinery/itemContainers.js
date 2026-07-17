// @ts-check

import * as DoriosContainer from "../../DoriosLib/containers/index.js";

/**
 * Resolves an item container at a world location.
 *
 * DoriosLib owns normal vanilla-block and `dorios:container` discovery. This
 * Core adapter adds only the machinery-specific indirection used by item
 * multiblock ports, whose backing entity can live at another location.
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 * @returns {import("../../DoriosLib/containers/index.js").ResolvedContainer|undefined}
 */
export function resolveItemContainerAt(dimension, location) {
  let block;
  try {
    block = dimension?.getBlock(location);
  } catch {
    return undefined;
  }

  // A real block inventory always wins, matching the container resolver.
  const blockContainer = block ? DoriosContainer.resolve(block) : undefined;
  if (blockContainer) return blockContainer;

  // Port indirection must be checked before local entities. A pipe/helper
  // entity can share the port cell without becoming the represented machine.
  if (block?.hasTag("dorios:multiblock.port") && block.hasTag("dorios:item")) {
    const tag = `input:[${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}]`;
    for (const entity of dimension.getEntities({ tags: [tag] })) {
      const resolved = DoriosContainer.resolve(entity);
      if (resolved) return { ...resolved, block };
    }
  }

  return DoriosContainer.resolveAt(dimension, location);
}

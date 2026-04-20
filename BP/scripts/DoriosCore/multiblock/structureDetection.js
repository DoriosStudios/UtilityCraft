import { system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EntityManager } from "./entityManager.js";

export class StructureDetector {
  /**
   * Detects and validates a multiblock structure starting from its controller.
   *
   * The process:
   * 1. Finds the outer casing bounds around the controller.
   * 2. Scans the full structure contents and validates every block.
   * 3. Plays a formation effect around the resulting bounds.
   * 4. Returns the component summary and metadata needed for activation.
   *
   * Player-facing scan messages are emitted during the process.
   *
   * @param {{ block: Block, player: Player }} e Interaction event used as scan origin.
   * @param {string} caseTag Block tag that identifies valid casing blocks.
   * @returns {Promise<false | {
   *   bounds: { min: Vector3, max: Vector3 },
   *   components: Record<string, number>,
   *   inputBlocks: string[],
   *   caseBlocks?: Vector3[],
   *   ventBlocks: Vector3[],
   *   center: Vector3,
   * }>} Detected structure data or `false` when validation fails.
   */
  static async detectFromController(e, caseTag) {
    const controllerBlock = e.block;
    const sendMessage = e.player.sendMessage.bind(e.player);
    const dim = controllerBlock.dimension;
    const startPos = controllerBlock.location;

    const bounds = await StructureDetector.findMultiblockBounds(startPos, dim, caseTag);
    if (bounds == null) {
      sendMessage("\u00A7c[Scan] No valid casing structure found around the controller.");
      return false;
    }

    sendMessage("\u00A77[Scan] Detecting outer casing bounds and scanning internal components...");
    const { min, max } = bounds;
    const data = await StructureDetector.scanStructure(min, max, dim, startPos, caseTag);
    if (typeof data === "string") {
      sendMessage(`\u00A7c[Scan] Invalid block detected at:${data}`);
      return false;
    }

    const { components, inputBlocks, caseBlocks, ventBlocks } = data;
    await StructureDetector.showFormationEffect(bounds, dim);

    return {
      bounds,
      components,
      inputBlocks,
      caseBlocks,
      ventBlocks,
      center: EntityManager.getCenter(min, max),
    };
  }

  /**
   * Plays a vertical outline effect around the multiblock bounds.
   *
   * This gives players visual feedback that the structure was recognized.
   *
   * @param {{ min: Vector3, max: Vector3 }} bounds Bounding box to outline.
   * @param {Dimension} dim Dimension where particles should spawn.
   * @returns {Promise<void>}
   */
  static async showFormationEffect(bounds, dim) {
    const { min, max } = bounds;

    for (let y = min.y; y <= max.y; y++) {
      const yOffset = y + 0.5;

      for (let x = min.x; x <= max.x; x++) {
        dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
          x: x + 0.5,
          y: yOffset,
          z: min.z - 0.1,
        });
      }

      for (let x = min.x; x <= max.x; x++) {
        dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
          x: x + 0.5,
          y: yOffset,
          z: max.z + 1.1,
        });
      }

      for (let z = min.z; z <= max.z; z++) {
        dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
          x: min.x - 0.1,
          y: yOffset,
          z: z + 0.5,
        });
      }

      for (let z = min.z; z <= max.z; z++) {
        dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
          x: max.x + 1.1,
          y: yOffset,
          z: z + 0.5,
        });
      }

      await system.waitTicks(2);
    }
  }

  /**
   * Expands outward from the controller to find the full casing bounds.
   *
   * The scan first determines whether the structure extends primarily along X or Z,
   * then expands across the remaining axes up to {@link MAX_SIZE}.
   *
   * @param {Vector3} start Controller block position.
   * @param {Dimension} dim Dimension where the structure exists.
   * @param {string} caseTag Block tag that marks valid casing blocks.
   * @returns {Promise<{ min: Vector3, max: Vector3 } | null>}
   * Inclusive bounds of the multiblock casing, or `null` if none are found.
   */
  static async findMultiblockBounds(start, dim, caseTag) {
    const isCasing = (pos) => dim.getBlock(pos)?.hasTag(caseTag);

    async function expandAxis(axis, origin) {
      let min = origin[axis];
      let max = origin[axis];

      for (let i = 1; i <= Constants.MAX_SIZE; i++) {
        if (i % 2 === 0) await system.waitTicks(1);
        const pos = { ...origin, [axis]: origin[axis] + i };
        if (!isCasing(pos)) break;
        max = pos[axis];
      }

      for (let i = 1; i <= Constants.MAX_SIZE; i++) {
        if (i % 2 === 0) await system.waitTicks(1);
        const pos = { ...origin, [axis]: origin[axis] - i };
        if (!isCasing(pos)) break;
        min = pos[axis];
      }

      return [min, max];
    }

    const origin = { ...start };

    const hasEast = isCasing({ ...origin, x: origin.x + 1 });
    const hasWest = isCasing({ ...origin, x: origin.x - 1 });
    const hasNorth = isCasing({ ...origin, z: origin.z - 1 });
    const hasSouth = isCasing({ ...origin, z: origin.z + 1 });

    let minX;
    let maxX;
    let minZ;
    let maxZ;

    if (hasEast || hasWest) {
      [minX, maxX] = await expandAxis("x", origin);

      let zScanPoint = { ...origin, x: minX };
      if (!isCasing(zScanPoint)) zScanPoint = { ...origin, x: maxX };
      if (!isCasing(zScanPoint)) return null;

      [minZ, maxZ] = await expandAxis("z", zScanPoint);
    } else if (hasNorth || hasSouth) {
      [minZ, maxZ] = await expandAxis("z", origin);

      let xScanPoint = { ...origin, z: minZ };
      if (!isCasing(xScanPoint)) xScanPoint = { ...origin, z: maxZ };
      if (!isCasing(xScanPoint)) return null;

      [minX, maxX] = await expandAxis("x", xScanPoint);
    } else {
      return null;
    }

    const yScanPoint = { x: minX, y: origin.y, z: minZ };
    const [minY, maxY] = await expandAxis("y", yScanPoint);

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }

  /**
   * Validates every block inside the detected multiblock bounds.
   *
   * Rules:
   * - Outer shell must be casing blocks, except for the controller itself.
   * - Ports are collected as input block tags.
   * - Vent blocks are counted only on the top layer.
   * - Interior blocks may be air, liquids, or tagged multiblock components.
   * - Any other block aborts the scan and returns its coordinates as a string.
   *
   * @param {Vector3} min Minimum bounds corner.
   * @param {Vector3} max Maximum bounds corner.
   * @param {Dimension} dim Dimension to scan.
   * @param {Vector3} controller Controller block location.
   * @param {string} caseTag Block tag that identifies valid casing blocks.
   * @returns {Promise<{
   *   components: Record<string, number>,
   *   inputBlocks: string[],
   *   ventBlocks: Vector3[],
   * } | string>}
   * Structure summary on success, or invalid coordinates on failure.
   */
  static async scanStructure(min, max, dim, controller, caseTag) {
    const components = {};
    const inputBlocks = [];
    const ventBlocks = [];

    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let z = min.z; z <= max.z; z++) {
          if (z % Constants.SCAN_SPEED === 0) await system.waitTicks(1);
          const block = dim.getBlock({ x, y, z });

          const isEdge =
            x === min.x ||
            x === max.x ||
            y === min.y ||
            y === max.y ||
            z === min.z ||
            z === max.z;

          if (isEdge) {
            if (block.x === controller.x && block.y === controller.y && block.z === controller.z) continue;
            if (block?.hasTag(caseTag)) {
              if (block?.hasTag(Constants.MULTIBLOCK_PORT_TAG)) {
                inputBlocks.push(`${Constants.INPUT_TAG_PREFIX}${x},${y},${z}]`);
              }
              if (block?.hasTag(Constants.VENT_BLOCK_TAG) && y === max.y) {
                components.vent = (components.vent ?? 0) + 1;
                ventBlocks.push({ x, y, z });
              }
              continue;
            }
            return `x: ${x}, y: ${y}, z: ${z}`;
          }

          if (block?.typeId === "minecraft:air") {
            components.air = (components.air ?? 0) + 1;
            continue;
          }

          if (block?.hasTag(Constants.MULTIBLOCK_COMPONENT_TAG)) {
            const id = block.typeId.split(":")[1];
            components[id] = (components[id] ?? 0) + 1;
            continue;
          }

          if (block?.isLiquid) continue;
          return `x: ${x}, y: ${y}, z: ${z}`;
        }
      }
    }

    return { components, inputBlocks, ventBlocks };
  }
}

// @ts-check

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { FluidStorage } from "../../DoriosCore/machinery/fluidStorage.js";
import { distance } from "../../DoriosLib/math/index.js";
import { capitalizeFirst, formatIdentifier } from "../../DoriosLib/text/index.js";
import {
  BLOCK_FACE_OFFSETS,
  NETWORK_OFFSETS,
  getNetworkColor,
  networkRegistrar,
  offsetLocation,
  openEntityTransferModeMenu,
  safeGetBlock,
} from "./shared.js";
import {
  NETWORK_SCAN_BATCH_SIZE,
  createNetworkRescanScheduler,
} from "./scheduler.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** @param {Player} player @param {string[]} fluids */
function showFilteredFluids(player, fluids) {
  const list = fluids.length === 0
    ? "§7(empty)"
    : fluids.map((type) => `- ${formatIdentifier(type)}`).join("\n");

  new ActionFormData()
    .title("Filtered Fluids")
    .body(`§aWhitelist§r\nOnly these fluid types are allowed.\n\n${list}`)
    .button("Close")
    .show(player);
}

/** @param {Block} block @param {Player} player */
function openFluidExtractorMenu(block, player) {
  const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
  if (!entity) return;

  const acceptedFluids = entity.getTags()
    .filter((tag) => !tag.startsWith("ent:") && !tag.startsWith("tan:") && !tag.startsWith("update"));
  const isOff = entity.getDynamicProperty("isOff") ?? false;
  const mode = String(entity.getDynamicProperty("transferMode") ?? "nearest");

  const menu = new ActionFormData()
    .title("Fluid Extractor Settings")
    .body(`§7Manage fluid extraction behavior.\n\n§rCurrent mode: §e${capitalizeFirst(mode)}\n§rPower: §a${isOff ? "OFF" : "ON"}`)
    .button(`${isOff ? "Turn ON" : "Turn OFF"}\n§8Toggle extractor activity`, `textures/ui/toggle_${isOff ? "on" : "off"}`)
    .button(`Transfer Mode\n§8(${capitalizeFirst(mode)})`, "textures/items/compass_item.png")
    .button("View Filter Contents\n§8List all filtered fluids", "textures/ui/icon_book_writable.png")
    .button("Add Fluid Type\n§8(Add fluid from Mainhand)", "textures/ui/icon_import.png")
    .button("Add Fluid Type\n§8(Add fluid from Source)", "textures/ui/icon_import.png")
    .button("Remove Fluid\n§8(Select a fluid to remove)", "textures/ui/trash_default.png");

  menu.show(player).then((result) => {
    if (result.selection === undefined) return;

    switch (result.selection) {
      case 0:
        entity.setDynamicProperty("isOff", !isOff);
        player.onScreenDisplay.setActionBar(`§7Extractor ${isOff ? "§aEnabled" : "§cDisabled"}`);
        break;
      case 1:
        openEntityTransferModeMenu(entity, player);
        break;
      case 2:
        showFilteredFluids(player, acceptedFluids);
        break;
      case 3:
        addHeldFluidFilter(block, entity, player);
        break;
      case 4:
        openSourceFluidFilterMenu(block, entity, player);
        break;
      case 5:
        openRemoveFluidMenu(block, entity, player, acceptedFluids);
        break;
    }
  });
}

/** @param {Block} block @param {Entity} entity @param {Player} player */
function addHeldFluidFilter(block, entity, player) {
  if (block.permutation.getState("utilitycraft:filter") !== 1) {
    player.onScreenDisplay.setActionBar("§cMissing filter upgrade.");
    return;
  }

  const mainHand = player.getComponent("equippable")?.getEquipment("Mainhand");
  const fluid = mainHand ? FluidStorage.itemFluidStorages[mainHand.typeId] : undefined;
  if (!fluid) {
    player.onScreenDisplay.setActionBar("§cYou must hold an item that contains a fluid.");
    return;
  }
  entity.addTag(fluid.type);
}

/** @param {Block} block @param {Entity} extractor @param {Player} player */
function openSourceFluidFilterMenu(block, extractor, player) {
  if (block.permutation.getState("utilitycraft:filter") !== 1) {
    player.onScreenDisplay.setActionBar("§cMissing filter upgrade.");
    return;
  }

  const face = block.permutation.getState("minecraft:block_face");
  const offset = BLOCK_FACE_OFFSETS[face];
  if (!offset) return;

  const sourceLocation = offsetLocation(block.location, offset);
  const dimension = block.dimension;
  let sourceEntity = dimension.getEntitiesAtBlockLocation(sourceLocation)[0];
  const sourceBlock = safeGetBlock(dimension, sourceLocation);

  if (!sourceEntity) {
    if (!sourceBlock?.hasTag("dorios:multiblock.port") || !sourceBlock.hasTag("dorios:fluid")) {
      player.onScreenDisplay.setActionBar("§cNo fluid source.");
      return;
    }
    sourceEntity = dimension.getEntities({
      tags: [`input:[${sourceLocation.x},${sourceLocation.y},${sourceLocation.z}]`],
    })[0];
  }

  if (!sourceEntity) {
    player.onScreenDisplay.setActionBar("§cNo fluid source.");
    return;
  }

  const tanks = FluidStorage.initializeMultiple(
    sourceEntity,
    FluidStorage.getMaxLiquids(sourceEntity),
  );
  const types = tanks
    .map((manager) => manager.getType())
    .filter((type) => type && type !== "empty");

  if (types.length === 0) {
    player.onScreenDisplay.setActionBar("§cNo fluids found in source.");
    return;
  }

  const form = new ModalFormData().title("Select Fluids");
  for (const type of types) {
    form.toggle(formatIdentifier(type), { defaultValue: extractor.hasTag(type) });
  }

  form.show(player).then((result) => {
    if (result.canceled) return;
    result.formValues?.forEach((enabled, index) => {
      if (enabled) extractor.addTag(types[index]);
      else extractor.removeTag(types[index]);
    });
    const enabledCount = result.formValues?.filter(Boolean).length ?? 0;
    player.onScreenDisplay.setActionBar(`§aAdded ${enabledCount} fluid filter(s).`);
  });
}

/** @param {Block} block @param {Entity} entity @param {Player} player @param {string[]} fluids */
function openRemoveFluidMenu(block, entity, player, fluids) {
  if (fluids.length === 0) {
    player.onScreenDisplay.setActionBar("§cNo fluid types to remove.");
    return;
  }

  const menu = new ActionFormData()
    .title("Remove Fluid Type")
    .body("§7Select a fluid type to remove.");
  for (const type of fluids) menu.button(formatIdentifier(type));

  menu.show(player).then((result) => {
    if (result.selection === undefined) {
      openFluidExtractorMenu(block, player);
      return;
    }
    const selected = fluids[result.selection];
    if (!selected) return;
    entity.removeTag(selected);
    player.onScreenDisplay.setActionBar(`§cRemoved: §r${selected}`);
    openFluidExtractorMenu(block, player);
  });
}

const fluidExtractorComponent = {
  beforeOnPlayerPlace({ block }) {
    const location = {
      x: block.location.x + 0.5,
      y: block.location.y + 0.375,
      z: block.location.z + 0.5,
    };
    system.run(() => {
      const entity = block.dimension.spawnEntity("utilitycraft:pipe", location);
      entity.setDynamicProperty("transferMode", "nearest");
      entity.setDynamicProperty("dorios:fluid_round_idx", 0);
    });
  },

  onPlayerBreak({ block }) {
    block.dimension.getEntitiesAtBlockLocation(block.location)[0]?.remove();
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const mainHand = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (mainHand?.typeId?.includes("upgrade")) return;
    openFluidExtractorMenu(block, player);
  },

  onTick({ block, dimension }) {
    processFluidExtractorTick(block, dimension);
  },
};

networkRegistrar.block("fluid_extractor", fluidExtractorComponent);

/** @param {Block} block @param {Dimension} dimension */
function processFluidExtractorTick(block, dimension) {
  if (!globalThis.worldLoaded) return;

  const extractor = dimension.getEntitiesAtBlockLocation(block.location)[0];
  if (!extractor || extractor.getDynamicProperty("isOff")) return;

  const blockFace = block.permutation.getState("minecraft:block_face");
  const offset = BLOCK_FACE_OFFSETS[blockFace] ?? { x: 0, y: -1, z: 0 };
  const sourceLocation = offsetLocation(block.location, offset);
  const sourceBlock = safeGetBlock(dimension, sourceLocation);
  if (!sourceBlock) return;

  let sourceEntity = dimension.getEntitiesAtBlockLocation(sourceLocation)
    .find((entity) => entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:fluid_container"));

  if (!sourceEntity && sourceBlock.hasTag("dorios:multiblock.port") && sourceBlock.hasTag("dorios:fluid")) {
    sourceEntity = dimension.getEntities({
      tags: [`input:[${sourceLocation.x},${sourceLocation.y},${sourceLocation.z}]`],
    })[0];
    if (!sourceEntity) return;
  }

  const vanillaLiquids = {
    "minecraft:water": "water",
    "minecraft:lava": "lava",
  };

  let fluidSource;
  let liquidType;
  let amount = 0;
  let infinite = false;

  if (sourceEntity) {
    const managers = FluidStorage.initializeMultiple(
      sourceEntity,
      FluidStorage.getMaxLiquids(sourceEntity),
    );
    const hasFilter = block.permutation.getState("utilitycraft:filter");
    fluidSource = managers.find((manager) => {
      if (manager.get() <= 0 || manager.type === "empty") return false;
      return !hasFilter || extractor.hasTag(manager.type);
    });
    if (!fluidSource) return;
    liquidType = fluidSource.getType();
    amount = fluidSource.get();
  } else if (vanillaLiquids[sourceBlock.typeId]) {
    if (sourceBlock.permutation.getState("liquid_depth") !== 0) return;
    liquidType = vanillaLiquids[sourceBlock.typeId];
    amount = 1000;
  } else if (sourceBlock.typeId === "utilitycraft:crucible") {
    const level = Number(sourceBlock.permutation.getState("utilitycraft:lava") ?? 0);
    if (level < 1) return;
    liquidType = "lava";
    amount = 250 * level;
  } else if (sourceBlock.typeId === "utilitycraft:sink") {
    liquidType = "water";
    amount = Infinity;
    infinite = true;
  } else {
    return;
  }

  if (!liquidType || amount <= 0) return;

  let cached = extractor.getDynamicProperty("dorios:fluid_nodes");
  if (!cached || extractor.hasTag("updateNetwork")) {
    const positions = extractor.getTags()
      .filter((tag) => tag.startsWith("ent:[") || tag.startsWith("tan:["))
      .map((tag) => {
        const [x, y, z] = tag.slice(5, -1).split(",").map(Number);
        return { x, y, z };
      })
      .sort((left, right) => distance(extractor.location, left) - distance(extractor.location, right));
    cached = JSON.stringify(positions);
    extractor.setDynamicProperty("dorios:fluid_nodes", cached);
    extractor.removeTag("updateNetwork");
  }

  let nodes;
  try {
    nodes = JSON.parse(String(cached ?? "[]"));
  } catch {
    return;
  }
  if (!Array.isArray(nodes) || nodes.length === 0) return;

  const mode = String(extractor.getDynamicProperty("transferMode") ?? "nearest");
  let orderedTargets = [...nodes];
  if (mode === "farthest") {
    orderedTargets.reverse();
  } else if (mode === "round") {
    const index = Number(extractor.getDynamicProperty("dorios:fluid_round_idx") ?? 0) % orderedTargets.length;
    orderedTargets = orderedTargets.slice(index).concat(orderedTargets.slice(0, index));
  }

  let speed = 4000;
  let transferred = 0;
  if (fluidSource) {
    transferred = fluidSource.transferToNetwork(speed, mode, orderedTargets);
  } else {
    for (const location of orderedTargets) {
      const targetBlock = safeGetBlock(dimension, location);
      if (!targetBlock?.hasTag("dorios:fluid")) continue;

      let targetEntity = dimension.getEntitiesAtBlockLocation(location)[0];
      if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
        FluidStorage.addfluidToTank(targetBlock, liquidType, 0);
        targetEntity = dimension.getEntitiesAtBlockLocation(location)[0];
      }
      if (!targetEntity) continue;

      const targetFluid = FluidStorage.findType(targetEntity, liquidType);
      const space = targetFluid?.getFreeSpace() ?? 0;
      if (!targetFluid || space <= 0) continue;
      if (targetFluid.type === "empty") targetFluid.setType(liquidType);

      let move = Math.min(space, speed, amount);
      if (sourceBlock.typeId === "utilitycraft:crucible") {
        move = Math.floor(move / 250) * 250;
        if (move <= 0) continue;
      }

      const added = targetFluid.add(move);
      if (added <= 0) continue;
      transferred += added;
      amount -= added;
      speed -= added;
      if (amount <= 0 || speed <= 0) break;
    }
  }

  if (transferred > 0 && !infinite && !fluidSource) {
    if (vanillaLiquids[sourceBlock.typeId]) {
      sourceBlock.setType("minecraft:air");
    } else if (sourceBlock.typeId === "utilitycraft:crucible") {
      const current = Number(sourceBlock.permutation.getState("utilitycraft:lava") ?? 0);
      const drained = Math.min(current, Math.floor(transferred / 250));
      sourceBlock.setPermutation(
        sourceBlock.permutation.withState("utilitycraft:lava", Math.max(0, current - drained)),
      );
    }
  }

  if (transferred > 0 && mode === "round") {
    const current = Number(extractor.getDynamicProperty("dorios:fluid_round_idx") ?? 0);
    extractor.setDynamicProperty("dorios:fluid_round_idx", (current + 1) % nodes.length);
  }
}

/**
 * Rebuilds the existing tag-backed fluid network without changing its storage
 * or transfer semantics.
 *
 * @param {Vector3} startPosition
 * @param {Dimension} dimension
 * @returns {Promise<Set<string>>} Fluid network nodes covered by this traversal.
 */
export async function rescanFluidNetwork(startPosition, dimension) {
  const queue = [startPosition];
  let queueHead = 0;
  let processed = 0;
  const visited = new Set();
  const networkNodes = new Set();
  const inputs = [];
  const extractors = [];
  let cablesUsed = 0;
  const initialBlock = safeGetBlock(dimension, startPosition);
  const networkColor = getNetworkColor(initialBlock);
  const blockedTags = new Set();

  while (queueHead < queue.length) {
    if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) {
      await system.waitTicks(1);
    }
    processed++;

    const position = queue[queueHead++];
    const key = `${position.x},${position.y},${position.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const block = safeGetBlock(dimension, position);
    if (!block) continue;

    if (block.typeId.includes("utilitycraft:fluid_pipe") || block.typeId.includes("utilitycraft:fluid_extractor")) {
      if (!block.hasTag(networkColor)) continue;
      networkNodes.add(key);
      cablesUsed++;
      for (const offset of NETWORK_OFFSETS) queue.push(offsetLocation(position, offset));

      const entity = dimension.getEntitiesAtBlockLocation(position)[0];
      if (entity?.typeId === "utilitycraft:pipe") extractors.push(entity);
      continue;
    }

    if (block.typeId.includes("fluid_tank")) {
      inputs.push(`tan:[${position.x},${position.y},${position.z}]`);
      continue;
    }

    let entity = dimension.getEntitiesAtBlockLocation(position)[0];
    if (block.hasTag("dorios:multiblock.port") && block.hasTag("dorios:fluid")) {
      entity = dimension.getEntities({
        tags: [`input:[${position.x},${position.y},${position.z}]`],
      })[0];
      if (entity) inputs.push(`ent:[${entity.location.x},${entity.location.y},${entity.location.z}]`);
      continue;
    }

    if (entity?.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:fluid_container")) {
      inputs.push(`ent:[${position.x},${position.y},${position.z}]`);
    }
  }

  if (cablesUsed <= 0) return networkNodes;

  for (const extractor of extractors) {
    if (!extractor.isValid) continue;
    const position = {
      x: Math.floor(extractor.location.x),
      y: Math.floor(extractor.location.y),
      z: Math.floor(extractor.location.z),
    };
    const block = safeGetBlock(dimension, position);
    if (!block) continue;
    const face = block.permutation.getState("minecraft:block_face");
    const offset = BLOCK_FACE_OFFSETS[face];
    if (!offset) continue;

    const sourceLocation = offsetLocation(position, offset);
    const sourceBlock = safeGetBlock(dimension, sourceLocation);
    if (sourceBlock?.hasTag("dorios:multiblock.port") && sourceBlock.hasTag("dorios:fluid")) {
      const sourceEntity = dimension.getEntities({
        tags: [`input:[${sourceLocation.x},${sourceLocation.y},${sourceLocation.z}]`],
      })[0];
      if (sourceEntity) {
        blockedTags.add(`ent:[${sourceEntity.location.x},${sourceEntity.location.y},${sourceEntity.location.z}]`);
      }
    }
    blockedTags.add(`tan:[${sourceLocation.x},${sourceLocation.y},${sourceLocation.z}]`);
    blockedTags.add(`ent:[${sourceLocation.x},${sourceLocation.y},${sourceLocation.z}]`);
  }

  for (const extractor of extractors) {
    if (!extractor.isValid) continue;
    for (const tag of extractor.getTags()) {
      if (tag.startsWith("tan:") || tag.startsWith("ent:")) extractor.removeTag(tag);
    }
    for (const tag of inputs) {
      if (!blockedTags.has(tag)) extractor.addTag(tag);
    }
    extractor.addTag("updateNetwork");
  }
  return networkNodes;
}

/**
 * Rebuilds every distinct fluid component touched by one debounced batch.
 *
 * @param {ReadonlyArray<Vector3>} changedLocations
 * @param {Dimension} dimension
 */
async function rebuildFluidNetworkBatch(changedLocations, dimension) {
  const covered = new Set();

  for (const changedLocation of changedLocations) {
    const changedKey = `${changedLocation.x},${changedLocation.y},${changedLocation.z}`;
    if (covered.has(changedKey)) continue;

    const roots = [
      changedLocation,
      ...NETWORK_OFFSETS.map((offset) => offsetLocation(changedLocation, offset)),
    ];

    for (const root of roots) {
      const key = `${root.x},${root.y},${root.z}`;
      if (covered.has(key)) continue;

      const block = safeGetBlock(dimension, root);
      if (!block?.hasTag("dorios:fluid")) continue;

      const visited = await rescanFluidNetwork(root, dimension);
      for (const visitedKey of visited) covered.add(visitedKey);
    }
  }
}

/** Queues a fluid topology update after the shared debounce window. */
export const scheduleFluidNetworkRescan = createNetworkRescanScheduler(
  "fluids",
  rebuildFluidNetworkBatch,
);

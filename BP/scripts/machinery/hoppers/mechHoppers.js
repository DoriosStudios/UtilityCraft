import * as DoriosLib from "DoriosLib/index.js";
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import { resolveItemContainerAt } from "../../DoriosCore/machinery/itemContainers.js";
import { getDirectionBetween, OPPOSITE_DIRECTIONS } from "../../DoriosCore/utils/directions.js";
import { UI_ITEM_TAGS } from "../../DoriosCore/utils/constants.js";

const MINECART_PULL_PROPERTY = "utilitycraft:minecartPullEnabled";
const DEFAULT_HOPPER_SPAWN_OFFSET = { x: 0.5, y: 0.25, z: 0.5 };
const ENDER_HOPPER_SPAWN_OFFSET = { x: 0.5, y: 0.375, z: 0.5 };

function isMinecartPullEnabled(entity) {
  const value = entity?.getDynamicProperty?.(MINECART_PULL_PROPERTY);
  return typeof value === "boolean" ? value : true;
}

function findChestMinecartForHopper(dimension, blockLocation, pullFromAbove) {
  const hopperCenter = {
    x: blockLocation.x + 0.5,
    y: blockLocation.y + 0.5,
    z: blockLocation.z + 0.5,
  };

  const scanCenter = {
    x: hopperCenter.x,
    y: hopperCenter.y + (pullFromAbove ? 0.375 : -0.375),
    z: hopperCenter.z,
  };

  const carts = [
    dimension.getEntities({
      type: "minecraft:chest_minecart",
      location: scanCenter,
      maxDistance: 1.75,
    }),
    dimension.getEntities({
      type: "minecraft:hopper_minecart",
      location: scanCenter,
      maxDistance: 1.75,
    }),
  ].flat();

  const minY = pullFromAbove ? hopperCenter.y : hopperCenter.y - 0.75;

  const maxY = pullFromAbove ? hopperCenter.y + 0.75 : hopperCenter.y;

  return carts.find((cart) => {
    const { x, y, z } = cart.location;

    const inVerticalRange = y >= minY && y <= maxY;
    if (!inVerticalRange) return false;

    const inHorizontalRange = Math.abs(x - hopperCenter.x) <= 0.75 && Math.abs(z - hopperCenter.z) <= 0.75;

    return inHorizontalRange;
  });
}

function getMoveCount(block) {
  const speed = Math.max(0, Math.min(4, Math.floor(Number(DoriosLib.block.getState(block, "utilitycraft:speed") ?? 0))));
  return speed + 1;
}

function passesFilter(entity, hasFilter, whiteList, item) {
  return !hasFilter || whiteList == entity.hasTag(`${item.typeId}`);
}

function pullFromContainer(source, target, direction, entity, hasFilter, whiteList, moveCount) {
  const sourceSlots = DoriosContainer.getOutputSlots(source, { face: direction });
  if (sourceSlots.length === 0) return 0;

  let moved = 0;
  let attempts = 0;
  for (const slot of sourceSlots) {
    if (attempts >= moveCount) break;

    const item = source.container.getItem(slot);
    if (!item) continue;
    if (!passesFilter(entity, hasFilter, whiteList, item)) continue;

    attempts++;
    if (DoriosContainer.transfer(source, {
      sourceSlot: slot,
      target,
      targetFace: OPPOSITE_DIRECTIONS[direction],
    }) > 0) {
      moved++;
    }
  }

  return moved;
}

function pullFromMinecart(minecartInv, target, entity, hasFilter, whiteList, moveCount) {
  const sourceSlots = DoriosContainer.getOutputSlots(minecartInv);
  let moved = 0;
  let attempts = 0;

  for (const slot of sourceSlots) {
    if (attempts >= moveCount) break;
    const item = minecartInv.getItem(slot);
    if (!item) continue;
    if (!passesFilter(entity, hasFilter, whiteList, item)) continue;

    attempts++;
    if (DoriosContainer.transfer(minecartInv, { sourceSlot: slot, target }) > 0) {
      moved++;
    }
  }

  return moved;
}

function canInsertItem(container, slots, item) {
  for (const slot of slots) {
    const current = container.getItem(slot);
    if (!current || (current.isStackableWith(item) && current.amount < current.maxAmount)) {
      return true;
    }
  }

  return false;
}

function pullDroppedItems(items, target, entity, hasFilter, whiteList, moveCount, options = {}) {
  const resolvedTarget = DoriosContainer.resolve(target);
  if (!resolvedTarget) return 0;

  const inputSlots = DoriosContainer.getInputSlots(resolvedTarget);
  if (inputSlots.length === 0) return 0;

  let moved = 0;
  let attempts = 0;

  for (const drop of items) {
    if (attempts >= moveCount) break;

    const itemComp = drop.getComponent("minecraft:item");
    if (!itemComp) continue;

    const stack = itemComp.itemStack;
    if (options.skipUIElements && UI_ITEM_TAGS.some((tag) => stack.hasTag(tag))) continue;
    if (!passesFilter(entity, hasFilter, whiteList, stack)) continue;
    if (!canInsertItem(resolvedTarget.container, inputSlots, stack)) continue;

    attempts++;

    const original = stack.clone();
    const location = { ...drop.location };
    const dimension = drop.dimension;

    try {
      drop.remove();
    } catch {
      continue;
    }

    let inserted = 0;
    try {
      inserted = DoriosContainer.insert(resolvedTarget, { item: original });
    } catch (error) {
      console.warn("[UtilityCraft:Hopper] Failed to insert a dropped item", error);
    }

    const remainingAmount = original.amount - inserted;

    if (remainingAmount > 0) {
      const remainder = original.clone();
      remainder.amount = remainingAmount;

      try {
        dimension.spawnItem(remainder, location);
      } catch (error) {
        console.warn("[UtilityCraft:Hopper] Failed to respawn a dropped-item remainder", error);
      }
    }

    if (inserted > 0) moved++;
  }

  return moved;
}

function outputFromHopper(source, dimension, sourceLoc, targetLoc, entity, hasFilter, whiteList, moveCount) {
  const target = resolveItemContainerAt(dimension, targetLoc);
  const direction = getDirectionBetween(sourceLoc, targetLoc);
  if (!target || !direction) return 0;

  const sourceSlots = DoriosContainer.getOutputSlots(source, { face: direction });
  let moved = 0;
  let attempts = 0;

  for (const slot of sourceSlots) {
    if (attempts >= moveCount) break;
    const item = source.container.getItem(slot);
    if (!item) continue;
    if (!passesFilter(entity, hasFilter, whiteList, item)) continue;

    attempts++;
    if (DoriosContainer.transfer(source, {
      sourceSlot: slot,
      target,
      targetFace: OPPOSITE_DIRECTIONS[direction],
    }) > 0) {
      moved++;
    }
  }

  return moved;
}

function dropFromHopper(source, dimension, dir, blockLocation, entity, hasFilter, whiteList, moveCount) {
  let moved = 0;
  const spawnY = dir === "down" ? blockLocation.y + 1.2 : blockLocation.y - 0.8;
  const pos = { x: blockLocation.x + 0.5, y: spawnY, z: blockLocation.z + 0.5 };
  const sourceSlots = DoriosContainer.getOutputSlots(source);

  for (const slot of sourceSlots) {
    if (moved >= moveCount) break;
    const item = source.container.getItem(slot);
    if (!item) continue;
    if (!passesFilter(entity, hasFilter, whiteList, item)) continue;

    dimension.spawnItem(item, pos);
    source.container.setItem(slot, undefined);
    moved++;
  }

  return moved;
}

const MECHANICAL_HOPPER_IDS = new Set([
  "utilitycraft:mechanic_hopper",
  "utilitycraft:mechanic_upper",
  "utilitycraft:mechanic_dropper",
  "utilitycraft:ender_hopper",
]);

/** @param {import("@minecraft/server").Block} block */
function isMechanicalHopperBlock(block) {
  return MECHANICAL_HOPPER_IDS.has(block?.typeId);
}

/**
 * Returns portable mechanical-hopper settings. Upgrade block states are not
 * copied; they remain owned by the target hopper.
 *
 * @param {import("@minecraft/server").Block} block
 * @param {{includeFilters?:boolean}} [options]
 * @returns {object|undefined}
 */
export function getMechanicalHopperCopyConfig(block, options = {}) {
  if (!isMechanicalHopperBlock(block)) return undefined;
  const entity = DoriosLib.block.getEntity(block);
  if (!entity) return undefined;

  const supportsMinecartPull = block.typeId === "utilitycraft:mechanic_hopper"
    || block.typeId === "utilitycraft:mechanic_upper";
  const isEnder = block.typeId === "utilitycraft:ender_hopper";
  const includeFilters = options.includeFilters !== false
    && block.permutation.getState("utilitycraft:filter") === 1;
  const config = {
    version: 1,
    ...(includeFilters ? {
      whitelist: entity.getDynamicProperty("utilitycraft:whitelistOn") === true,
      items: [...entity.getTags()],
    } : {}),
    ...(supportsMinecartPull ? { minecartPullEnabled: isMinecartPullEnabled(entity) } : {}),
    ...(isEnder ? {
      enabled: entity.getDynamicProperty("isOff") !== true,
      range: Number(entity.getDynamicProperty("range_selected") ?? 0),
    } : {}),
  };
  return Object.keys(config).length > 1 ? config : undefined;
}

/**
 * Applies compatible mechanical-hopper settings to the target entity.
 *
 * @param {import("@minecraft/server").Block} block
 * @param {unknown} value
 * @param {{includeFilters?:boolean}} [options]
 * @returns {boolean}
 */
export function applyMechanicalHopperCopyConfig(block, value, options = {}) {
  if (!isMechanicalHopperBlock(block)) return false;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entity = DoriosLib.block.getEntity(block);
  if (!entity) return false;

  const raw = /** @type {Record<string,unknown>} */ (value);
  const includesFilters = options.includeFilters !== false
    && (Array.isArray(raw.items) || Object.hasOwn(raw, "whitelist"));
  if (includesFilters && block.permutation.getState("utilitycraft:filter") !== 1) return false;
  let changed = false;
  if (typeof raw.whitelist === "boolean") {
    entity.setDynamicProperty("utilitycraft:whitelistOn", raw.whitelist);
    changed = true;
  }

  const supportsMinecartPull = block.typeId === "utilitycraft:mechanic_hopper"
    || block.typeId === "utilitycraft:mechanic_upper";
  if (supportsMinecartPull && typeof raw.minecartPullEnabled === "boolean") {
    entity.setDynamicProperty(MINECART_PULL_PROPERTY, raw.minecartPullEnabled);
    changed = true;
  }

  if (block.typeId === "utilitycraft:ender_hopper") {
    if (typeof raw.enabled === "boolean") {
      entity.setDynamicProperty("isOff", !raw.enabled);
      changed = true;
    }
    if (Number.isFinite(raw.range)) {
      const rangeUpgrade = Number(DoriosLib.block.getState(block, "utilitycraft:range") ?? 0);
      const maxRange = 3 + 2 * Math.max(0, Math.min(4, Math.floor(rangeUpgrade)));
      entity.setDynamicProperty("range_selected", Math.max(0, Math.min(maxRange, Number(raw.range))));
      changed = true;
    }
  }

  if (options.includeFilters !== false && Array.isArray(raw.items)) {
    for (const tag of entity.getTags()) entity.removeTag(tag);
    for (const itemId of raw.items) {
      if (typeof itemId === "string" && itemId.length > 0) entity.addTag(itemId);
    }
    changed = true;
  }
  return changed;
}

DoriosLib.registry.blockComponent("utilitycraft:mechanic_hopper", {
  onTick({ block, dimension }, { params }) {
    if (!worldLoaded) return;
    if (!block.isValid || block.isAir) return;

    const dir = block.permutation.getState("minecraft:block_face");
    const { x, y, z } = block.location;

    const isEnder = params.type === "ender";
    const isHopper = params.type === "hopper";
    const isUpper = params.type === "upper";
    const isDropper = params.type === "dropper";

    /** @type {Entity} */
    const entity = DoriosLib.block.getEntity(block);
    if (!entity) return;
    if (entity.getDynamicProperty("isOff")) return;

    const hopperContainer = DoriosContainer.resolve(entity);
    if (!hopperContainer) return;

    const hasFilter = DoriosLib.block.getState(block, "utilitycraft:filter") == 1;
    const whiteList = entity.getDynamicProperty("utilitycraft:whitelistOn");
    const minecartPullEnabled = isMinecartPullEnabled(entity);
    const moveCount = getMoveCount(block);

    // Define source and target positions depending on block type and direction
    let sourceLoc = { x, y, z };
    let targetLoc = { x, y, z };

    if (isDropper) {
      // Dropper only works vertically
      sourceLoc = dir === "down" ? { x, y: y - 1, z } : { x, y: y + 1, z };
    } else if (isHopper || isUpper) {
      // Hopper and Upper logic
      sourceLoc = isHopper ? { x, y: y + 1, z } : { x, y: y - 1, z };

      if (dir === "up" || dir === "down") {
        // Vertical output
        targetLoc = isHopper ? { x, y: y - 1, z } : { x, y: y + 1, z };
      } else {
        // Horizontal output
        switch (dir) {
          case "south":
            targetLoc = { x, y, z: z - 1 };
            break;
          case "north":
            targetLoc = { x, y, z: z + 1 };
            break;
          case "west":
            targetLoc = { x: x + 1, y, z };
            break;
          case "east":
            targetLoc = { x: x - 1, y, z };
            break;
        }
      }
    } else if (isEnder) {
      targetLoc = { x, y: y - 1, z };
    }
    if (!isEnder) {
      const source = resolveItemContainerAt(dimension, sourceLoc);

      if (source) {
        const direction = getDirectionBetween(sourceLoc, block.location);
        if (direction) {
          pullFromContainer(source, hopperContainer, direction, entity, hasFilter, whiteList, moveCount);
        }
      } else {
        let pulledFromMinecart = 0;

        if (minecartPullEnabled && (isHopper || isUpper)) {
          const minecart = findChestMinecartForHopper(dimension, block.location, isHopper);
          const minecartInv = minecart?.getComponent("minecraft:inventory")?.container;
          if (minecartInv) {
            pulledFromMinecart = pullFromMinecart(minecartInv, hopperContainer, entity, hasFilter, whiteList, moveCount);
          }
        }

        if (pulledFromMinecart === 0) {
          const items = dimension.getEntities({
            type: "item",
            location: sourceLoc,
            maxDistance: 0.8,
          });

          pullDroppedItems(items, hopperContainer, entity, hasFilter, whiteList, moveCount);
        }
      }
    } else {
      const range = entity.getDynamicProperty("range_selected") ?? 3;
      const items = dimension.getEntities({
        type: "item",
        location: block.location,
        maxDistance: range,
      });

      pullDroppedItems(items, hopperContainer, entity, hasFilter, whiteList, moveCount, { skipUIElements: true });
    }

    if (isDropper) {
      dropFromHopper(hopperContainer, dimension, dir, block.location, entity, hasFilter, whiteList, moveCount);
    } else {
      outputFromHopper(hopperContainer, dimension, block.location, targetLoc, entity, hasFilter, whiteList, moveCount);
    }
  },

  onPlace(e, { params }) {
    const { block } = e;
    const offset = params.type === "ender" ? ENDER_HOPPER_SPAWN_OFFSET : DEFAULT_HOPPER_SPAWN_OFFSET;
    const { x, y, z } = block.location;
    const entity = block.dimension.spawnEntity("utilitycraft:hopper", { x: x + offset.x, y: y + offset.y, z: z + offset.z });
    if (params.type === "ender") {
      entity.triggerEvent("utilitycraft:ender_hopper");
    }
    entity.setDynamicProperty("utilitycraft:whitelistOn", true);
    entity.setDynamicProperty(MINECART_PULL_PROPERTY, true);
    entity.nameTag = "Hopper";
  },
  onPlayerBreak(e) {
    const { block } = e;
    let { x, y, z } = block.location;
    ((x += 0.5), (z += 0.5), (y += 0.375));
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return;
    const inv = entity.getComponent("minecraft:inventory").container;
    for (let j = 0; j < inv.size; j++) {
      if (inv.getItem(j) != undefined) {
        let item = inv.getItem(j);
        block.dimension.spawnItem(item, { x, y, z });
      }
    }
    entity.remove();
  },
  onPlayerInteract(e, { params }) {
    const { block, player } = e;
    let { x, y, z } = block.location;
    ((x += 0.5), (z += 0.5), (y += 0.375));
    const hasFilter = block.permutation.getState("utilitycraft:filter");

    const mainHand = player.getComponent("equippable").getEquipment("Mainhand");
    if (mainHand?.typeId.includes("wrench") || mainHand?.typeId === "utilitycraft:copy_paste_tool") return;
    if (player.isSneaking && params.type === "ender") {
      openEnderHopperMenu(block, player);
      return;
    }
    if (hasFilter) {
      openMenu(block, player, params.type);
    }
  },
});

function translate(key, values) {
  return values ? { translate: key, with: values } : { translate: key };
}

function translatedButton(labelKey, descriptionKey) {
  return {
    rawtext: [
      translate(labelKey),
      { text: "\n§8" },
      translate(descriptionKey),
    ],
  };
}

function getFilteredItemsLabel(items) {
  if (items.length === 0) {
    return translate("ui.utilitycraft:mechanical_hopper.filtered_items_empty");
  }

  return {
    rawtext: items.map((item, index) => ({
      text: `${index === 0 ? "" : "\n"}§7- §f${DoriosLib.text.formatIdentifier(item)}`,
    })),
  };
}

function getHeldItemType(player) {
  const item = player.getComponent("equippable")?.getEquipment("Mainhand");
  if (!item) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.mechanical_hopper.hold_item"));
    return undefined;
  }
  return item.typeId;
}

function openMenu(block, player, hopperType) {
  const hopper = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
  if (!hopper) return;

  const menu = new ActionFormData()
    .title(translate("ui.utilitycraft:mechanical_hopper.title"))
    .body(translate("ui.utilitycraft:mechanical_hopper.description"))
    .button(translatedButton(
      "ui.utilitycraft:mechanical_hopper.quick_settings",
      "ui.utilitycraft:mechanical_hopper.quick_settings_description",
    ), "textures/ui/settings_glyph_color_2x.png")
    .button(translatedButton(
      "ui.utilitycraft:mechanical_hopper.add_item",
      "ui.utilitycraft:mechanical_hopper.add_item_description",
    ), "textures/ui/icon_import.png")
    .button(translatedButton(
      "ui.utilitycraft:mechanical_hopper.remove_item",
      "ui.utilitycraft:mechanical_hopper.remove_item_description",
    ), "textures/ui/trash_default.png");

  menu.show(player).then((result) => {
    switch (result.selection) {
      case 0:
        openQuickSettings(hopper, player, hopperType);
        break;
      case 1: {
        const typeId = getHeldItemType(player);
        if (!typeId) break;
        hopper.addTag(typeId);
        player.onScreenDisplay.setActionBar(translate(
          "message.utilitycraft.mechanical_hopper.item_added",
          [DoriosLib.text.formatIdentifier(typeId)],
        ));
        break;
      }
      case 2:
        openRemoveItemMenu(block, hopper, player, hopperType);
        break;
    }
  });
}

function openQuickSettings(hopper, player, hopperType) {
  const supportsMinecartPull = hopperType === "hopper" || hopperType === "upper";
  const modal = new ModalFormData()
    .title(translate("ui.utilitycraft:mechanical_hopper.quick_settings_title"))
    .toggle(translate("ui.utilitycraft:mechanical_hopper.whitelist"), {
      defaultValue: hopper.getDynamicProperty("utilitycraft:whitelistOn") === true,
      tooltip: translate("ui.utilitycraft:mechanical_hopper.whitelist_tooltip"),
    });

  if (supportsMinecartPull) {
    modal.toggle(translate("ui.utilitycraft:mechanical_hopper.minecart_pull"), {
      defaultValue: isMinecartPullEnabled(hopper),
      tooltip: translate("ui.utilitycraft:mechanical_hopper.minecart_pull_tooltip"),
    });
  }

  modal
    .divider()
    .label(translate("ui.utilitycraft:mechanical_hopper.filtered_items"))
    .label(getFilteredItemsLabel(hopper.getTags()))
    .submitButton(translate("ui.utilitycraft:mechanical_hopper.save"))
    .show(player)
    .then((result) => {
      if (result.canceled) return;
      const values = Array.isArray(result.formValues) ? result.formValues : [];
      const toggles = values.filter((value) => typeof value === "boolean");
      hopper.setDynamicProperty(
        "utilitycraft:whitelistOn",
        toggles[0] ?? hopper.getDynamicProperty("utilitycraft:whitelistOn") === true,
      );
      if (supportsMinecartPull) {
        hopper.setDynamicProperty(MINECART_PULL_PROPERTY, toggles[1] ?? isMinecartPullEnabled(hopper));
      }
      player.onScreenDisplay.setActionBar(translate("message.utilitycraft.mechanical_hopper.settings_saved"));
    });
}

function openRemoveItemMenu(block, hopper, player, hopperType) {
  const items = hopper.getTags();
  if (items.length === 0) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.mechanical_hopper.no_items"));
    return;
  }

  const menu = new ActionFormData()
    .title(translate("ui.utilitycraft:mechanical_hopper.remove_item"))
    .body(translate("ui.utilitycraft:mechanical_hopper.remove_item_prompt"));
  for (const item of items) menu.button(DoriosLib.text.formatIdentifier(item));
  menu.button(translate("ui.utilitycraft:mechanical_hopper.cancel"), "textures/ui/redX1.png");
  menu.show(player).then((result) => {
    if (result.selection === undefined || result.selection === items.length) return;
    const selected = items[result.selection];
    if (!selected) return;
    hopper.removeTag(selected);
    player.onScreenDisplay.setActionBar(translate(
      "message.utilitycraft.mechanical_hopper.item_removed",
      [DoriosLib.text.formatIdentifier(selected)],
    ));
    openMenu(block, player, hopperType);
  });
}

/**
 * Opens the Ender Hopper configuration menu.
 * Allows the player to toggle the hopper on/off and adjust its pickup radius.
 *
 * @param {Block} block The Ender Hopper block.
 * @param {Player} player The player interacting with it.
 */
function openEnderHopperMenu(block, player) {
  const hopperEntity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
  if (!hopperEntity) return;

  const equipment = player.getComponent("equippable");
  const mainHand = equipment.getEquipment("Mainhand");
  const range = DoriosLib.block.getState(block, "utilitycraft:range") ?? 0;

  // Read stored dynamic properties
  const isOff = hopperEntity.getDynamicProperty("isOff") ?? false;
  const rangeSelected = hopperEntity.getDynamicProperty("range_selected") ?? 0;

  // Create modal form
  const modal = new ModalFormData()
    .title("Ender Hopper Settings")
    .toggle("Enabled", { defaultValue: !isOff })
    .slider("Pickup Radius", 0, 3 + 2 * range, { defaultValue: rangeSelected });

  // Show form only when player is not sneaking and has empty mainhand
  modal.show(player).then((result) => {
    const values = result.formValues;
    if (!values) return;

    const [enabled, newRange] = values;

    // Update dynamic properties
    hopperEntity.setDynamicProperty("isOff", !enabled);
    hopperEntity.setDynamicProperty("range_selected", newRange);
  });
}

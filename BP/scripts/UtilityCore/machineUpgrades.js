// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

export const MACHINE_UPGRADES_COMPONENT_ID = "utilitycraft:machine_upgrades";
export const MACHINE_UPGRADE_ITEM_COMPONENT_ID = "utilitycraft:machine_upgrade";

const DEFAULT_MAX_LEVEL = 8;

/**
 * @typedef {object} MachineUpgradeSlot
 * @property {string} type Semantic upgrade type shared by one or more items.
 * @property {number} slot Exact machine inventory slot represented by its UI overlay.
 * @property {number} max Maximum effective level accepted by this slot.
 */

/**
 * @typedef {object} MachineUpgradeItemDefinition
 * @property {string} type Semantic upgrade type installed by the item.
 * @property {number} value Effective levels contributed by each item in the stack.
 */

/**
 * Returns the ordered upgrade slots declared by a machine block.
 * Invalid or duplicate definitions are ignored so malformed data fails closed.
 *
 * @param {import("@minecraft/server").Block} block
 * @returns {MachineUpgradeSlot[]}
 */
export function getMachineUpgradeSlots(block) {
  const component = block.getComponent(MACHINE_UPGRADES_COMPONENT_ID);
  const rawParams = component?.customComponentParameters?.params;
  const rawSlots = Array.isArray(rawParams)
    ? rawParams
    : rawParams && typeof rawParams === "object"
      ? /** @type {{slots?: unknown}} */ (rawParams).slots
      : undefined;
  if (!Array.isArray(rawSlots)) return [];

  /** @type {MachineUpgradeSlot[]} */
  const slots = [];
  const usedTypes = new Set();
  const usedSlots = new Set();

  for (const rawDefinition of rawSlots) {
    if (!rawDefinition || typeof rawDefinition !== "object") continue;
    const definition = /** @type {{type?: unknown, slot?: unknown, max?: unknown}} */ (rawDefinition);
    const type = typeof definition.type === "string" ? definition.type.trim() : "";
    const slot = definition.slot;
    const configuredMax = definition.max ?? DEFAULT_MAX_LEVEL;
    const max = Number(configuredMax);

    if (!type || !Number.isInteger(slot) || slot < 0) continue;
    if (!Number.isFinite(max) || max <= 0) continue;
    if (usedTypes.has(type) || usedSlots.has(slot)) continue;

    usedTypes.add(type);
    usedSlots.add(slot);
    slots.push({ type, slot, max });
  }

  return slots;
}

/**
 * Reads the semantic upgrade definition stored on an upgrade item.
 *
 * @param {import("@minecraft/server").ItemStack | undefined} item
 * @returns {MachineUpgradeItemDefinition | undefined}
 */
export function getMachineUpgradeItemDefinition(item) {
  if (!item) return undefined;

  const component = item.getComponent(MACHINE_UPGRADE_ITEM_COMPONENT_ID);
  const rawParams = component?.customComponentParameters?.params;
  if (!rawParams || typeof rawParams !== "object") return undefined;

  const params = /** @type {{type?: unknown, value?: unknown}} */ (rawParams);
  const type = typeof params.type === "string" ? params.type.trim() : "";
  const value = Number(params.value ?? 1);
  if (!type || !Number.isFinite(value) || value <= 0) return undefined;

  return { type, value };
}

/**
 * Builds a localized upgrade action-bar message.
 *
 * @param {string} messageKey
 * @param {string} upgradeTypeId
 * @param {(string | number)[]} [values]
 * @returns {import("@minecraft/server").RawMessage}
 */
function upgradeMessage(messageKey, upgradeTypeId, values = []) {
  return {
    translate: messageKey,
    with: {
      rawtext: [
        { translate: `upgrade.${upgradeTypeId}.name` },
        ...values.map((value) => ({ text: `${value}` })),
      ],
    },
  };
}

/**
 * Installs one held upgrade into its exact configured machine slot.
 * Container and hand mutations are rolled back if either write fails.
 *
 * @param {import("@minecraft/server").ItemComponentUseOnEvent} event
 */
function installMachineUpgrade(event) {
  const { source, block, itemStack } = event;
  if (source.typeId !== "minecraft:player") return;

  const player = /** @type {import("@minecraft/server").Player} */ (source);
  const itemDefinition = getMachineUpgradeItemDefinition(itemStack);
  if (!itemDefinition) return;

  const machineSlots = getMachineUpgradeSlots(block);
  if (machineSlots.length === 0) return;

  const target = machineSlots.find(({ type }) => type === itemDefinition.type);
  if (!target) {
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.unsupported", itemStack.typeId),
    );
    return;
  }

  const resolved = DoriosLib.container.resolveAt(block.dimension, block.location);
  const container = resolved?.container;
  if (!container || target.slot >= container.size) {
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.failed", itemStack.typeId),
    );
    return;
  }

  const installed = container.getItem(target.slot);
  if (installed && installed.typeId !== itemStack.typeId) {
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.failed", itemStack.typeId),
    );
    return;
  }

  const installedDefinition = getMachineUpgradeItemDefinition(installed);
  const currentLevel = installed
    ? installed.amount * (installedDefinition?.value ?? itemDefinition.value)
    : 0;

  const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");
  if (!mainHand || mainHand.typeId !== itemStack.typeId || mainHand.amount <= 0) {
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.failed", itemStack.typeId),
    );
    return;
  }

  const currentAmount = installed?.amount ?? 0;
  const stackCapacity = (installed?.maxAmount ?? mainHand.maxAmount) - currentAmount;
  const levelCapacity = Math.floor((target.max - currentLevel) / itemDefinition.value);
  const availableAmount = DoriosLib.player.isCreative(player)
    ? Number.POSITIVE_INFINITY
    : mainHand.amount;
  const requestedAmount = player.isSneaking ? Number.POSITIVE_INFINITY : 1;
  const amountToInstall = Math.min(
    requestedAmount,
    availableAmount,
    stackCapacity,
    levelCapacity,
  );

  if (!Number.isFinite(amountToInstall) || amountToInstall <= 0) {
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.max", itemStack.typeId, [target.max]),
    );
    return;
  }

  const nextLevel = currentLevel + amountToInstall * itemDefinition.value;
  const previousInstalled = installed?.clone();
  const nextInstalled = installed?.clone() ?? mainHand.clone();
  nextInstalled.amount = currentAmount + amountToInstall;

  const consumesItem = !DoriosLib.player.isCreative(player);
  const remainingAmount = mainHand.amount - amountToInstall;
  const nextMainHand = consumesItem && remainingAmount > 0 ? mainHand.clone() : undefined;
  if (nextMainHand) nextMainHand.amount = remainingAmount;

  try {
    container.setItem(target.slot, nextInstalled);

    if (consumesItem && !DoriosLib.entity.setEquipment(player, {
      slot: "Mainhand",
      item: nextMainHand,
    })) {
      container.setItem(target.slot, previousInstalled);
      player.onScreenDisplay.setActionBar(
        upgradeMessage("message.utilitycraft.upgrade.failed", itemStack.typeId),
      );
      return;
    }
  } catch {
    try {
      container.setItem(target.slot, previousInstalled);
    } catch {
      // The original write failed and there is no additional safe recovery.
    }
    player.onScreenDisplay.setActionBar(
      upgradeMessage("message.utilitycraft.upgrade.failed", itemStack.typeId),
    );
    return;
  }

  player.onScreenDisplay.setActionBar(
    upgradeMessage("message.utilitycraft.upgrade.applied", itemStack.typeId, [nextLevel, target.max]),
  );
}

// Data-only capability attached to machine blocks.
DoriosLib.registry.blockComponent(MACHINE_UPGRADES_COMPONENT_ID, {});

// Shared behavior attached to every installable machine upgrade item.
DoriosLib.registry.itemComponent(MACHINE_UPGRADE_ITEM_COMPONENT_ID, {
  onUseOn: installMachineUpgrade,
});

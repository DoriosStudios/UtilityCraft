import { ItemStack } from "@minecraft/server";
import * as GlobalConstants from "../constants.js";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./energyStorage";
import * as Utils from "../utils/entity";

export class BasicMachine {
  /**
   * BasicMachine
   *
   * Represents a simple machine.
   *
   * @param {Block} block The block representing the machine.
   * @param {number} [options.rate=16] baseRate Energy rate per tick (designed for 20 TPS logic).
   * @param {boolean} [options.ignoreTick=false] Whether to ignore the refresh speed of the world or not.
   */
  constructor(block, options) {
    this.valid = false;
    if (!options.ignoreTick && !Utils.shouldProcess()) return;
    this.entity = Utils.tryGetEntityFromBlock(block);
    if (!this.entity) return;
    this.energy = new EnergyStorage(this.entity);
    this.dimension = block.dimension;
    this.block = block;
    const inventory = this.entity.getComponent("inventory")
    if (!inventory) return;
    this.container = inventory.container;
    this.baseRate = options.rate;
    this.rate = options.rate * globalThis[GlobalConstants.GLOBAL_TICK_SPEED_KEY];
    this.valid = true;
  }

  /**
   * Sets a new base rate and updates the effective rate using tickSpeed.
   *
   * @param {number} baseRate New base processing rate
   */
  setRate(baseRate) {
    this.baseRate = baseRate;
    this.rate = baseRate * globalThis[GlobalConstants.GLOBAL_TICK_SPEED_KEY];
  }

  /**
   * Sets a label in the machine inventory using a fixed item as placeholder.
   *
   * Strings are written directly into `nameTag`.
   * Arrays use the first element as `nameTag` and the remaining ones as lore lines.
   *
   * @param {string | string[]} text The text or lines to display in the label. Supports Minecraft formatting codes (§).
   * @param {number} [slot=1] The inventory slot where the label will be placed.
   */
  setLabel(text, slot = 1) {
    const baseItem = this.container.getItem(slot) ?? new ItemStack(Constants.LABEL_ITEM_ID);

    if (Array.isArray(text)) {
      const [nameTag = "", ...lore] = text;
      baseItem.nameTag = nameTag;
      baseItem.setLore(lore);
    } else {
      baseItem.nameTag = text ?? "";
      baseItem.setLore([]);
    }

    this.container.setItem(slot, baseItem);
  }

  /**
   * Changes the texture of the block to the on version.
   */
  on() {
    this.block.setState("utilitycraft:on", true);
  }

  /**
   * Changes the texture of the block to the off version.
   */
  off() {
    this.block.setState("utilitycraft:on", false);
  }

  /**
   * Adds progress to the machine.
   *
   * @param {number} amount Value to add to the current progress.
   * @param {number} [index=0] Progress index.
   */
  addProgress(amount, index = 0) {
    const key = `${Constants.MACHINE_PROGRESS_PROPERTY_PREFIX}${index}`;
    const current = this.entity.getDynamicProperty(key) ?? 0;
    this.entity.setDynamicProperty(key, current + amount);
  }

  /**
   * Gets the current progress of the machine.
   *
   * @param {number} [index=0] Progress index.
   * @returns {number} Current progress value.
   */
  getProgress(index = 0) {
    return this.entity.getDynamicProperty(`${Constants.MACHINE_PROGRESS_PROPERTY_PREFIX}${index}`) ?? 0;
  }

  /**
   * Sets the machine progress directly.
   *
   * @param {number} value New progress value.
   * @param {number} [maxValue=800] Maximum progress value used for normalization.
   * @param {Object} [options]
   * @param {number} [options.slot=2] Inventory slot to place the progress item.
   * @param {string} [options.type='progress_right_bar'] Item type suffix.
   * @param {boolean} [options.display=true] Whether to update the visual progress.
   * @param {number} [options.index=0] Progress index.
   * @param {number} [options.scale=16] Maximum visual scale.
   * @param {boolean} [options.legacy=false] Whether to use the legacy non-padded frame naming.
   */
  setProgress(value, maxValue = Constants.DEFAULT_PROGRESS_MAX, { slot = Constants.DEFAULT_PROGRESS_SLOT, type, display = true, index = 0, scale = Constants.LEGACY_PROGRESS_SCALE, legacy = false } = {}) {
    const key = `${Constants.MACHINE_PROGRESS_PROPERTY_PREFIX}${index}`;
    this.entity.setDynamicProperty(key, Math.max(0, value));

    if (display) {
      this.displayProgress(maxValue, { slot, type, index, scale, legacy });
    }
  }

  /**
   * Displays the current progress in the machine's inventory as a progress bar item.
   *
   * @param {number} maxValue The maximum progress value used for normalization.
   * @param {Object} [options]
   * @param {number} [options.slot=2] Inventory slot.
   * @param {string} [options.type='progress_right_bar'] Item type suffix.
   * @param {number} [options.index=0] Progress index.
   * @param {boolean} [options.legacy=false] Whether to use the legacy non-padded frame naming.
   * @param {number} [options.scale=22] Maximum visual scale (e.g., 16 → 0–16).
   */
  displayProgress(maxValue = Constants.DEFAULT_PROGRESS_MAX, { slot = Constants.DEFAULT_PROGRESS_SLOT, type, index = 0, scale, legacy = false } = {}) {
    if (!maxValue || maxValue <= 0) return;

    const inv = this.container;
    if (!inv) return;

    const progress = this.getProgress(index);

    if (legacy) { scale ??= Constants.LEGACY_PROGRESS_SCALE; } else { scale ??= Constants.MODERN_PROGRESS_SCALE; }

    const normalized = Math.max(0, Math.min(
      scale,
      Math.floor((progress / maxValue) * scale)
    ));

    if (legacy) {
      type ??= Constants.LEGACY_PROGRESS_TYPE;
      const itemId = `utilitycraft:${type}_${normalized}`;
      inv.setItem(slot, new ItemStack(itemId, 1));
      return;
    }

    type ??= Constants.DEFAULT_PROGRESS_TYPE;
    const frame = normalized.toString().padStart(2, "0");
    const itemId = `utilitycraft:${type}_${frame}`;
    inv.setItem(slot, new ItemStack(itemId, 1));
  }

  /**
   * Displays the current energy of the machine in the specified inventory slot.
   *
   * Delegates the call to the internal {@link EnergyStorage.display} method.
   *
   * @param {number} [slot=0] The inventory slot index where the energy bar will be displayed.
   */
  displayEnergy(slot = 0) {
    this.energy.display(slot);
  }

  /**
   * Block specific slots in this machine by filling them with a blocker item.
   * Only applies to empty slots.
   *
   * @param {number[]} slots Array of slot indices to block.
   */
  blockSlots(slots) {
    for (const index of slots) {
      if (!this.container.getItem(index)) {
        this.container.setItem(index, new ItemStack(Constants.BLOCKED_SLOT_ITEM_ID, 1));
      }
    }
  }

  /**
   * Unblock specific slots in this machine by clearing the blocker item.
   *
   * @param {number[]} slots Array of slot indices to unblock.
   */
  unblockSlots(slots) {
    for (const index of slots) {
      const item = this.container.getItem(index);
      if (item && item.typeId === Constants.BLOCKED_SLOT_ITEM_ID) {
        this.container.setItem(index, undefined);
      }
    }
  }
}

import { ItemStack } from "@minecraft/server";
import { EnergyStorage } from "./energyStorage";
import * as Utils from "../utils/entity";

export class BasicMachine {
  /**
   * BasicMachine
   *
   * Represents a simple machine.
   *
   * @param {Block} block The block representing the machine.
   * @param {Number} baseRate Energy rate per tick (designed for 20 TPS logic).
   */
  constructor(block, rate) {
    this.valid = false;
    if (!Utils.shouldProcess()) return;
    this.entity = Utils.tryGetEntityFromBlock(block);
    if (!this.entity) return;
    this.energy = new EnergyStorage(this.entity);
    this.dimension = block.dimension;
    this.block = block;
    this.container = this.entity.getComponent("inventory").container;
    this.baseRate = rate;
    this.rate = rate * tickSpeed;
    this.valid = true;
  }

  /**
   * Sets a new base rate and updates the effective rate using tickSpeed.
   *
   * @param {number} baseRate New base processing rate
   */
  setRate(baseRate) {
    this.baseRate = baseRate;
    this.rate = baseRate * tickSpeed;
  }

  /**
   * Sets a label in the machine inventory using a fixed item as placeholder.
   *
   * The label is displayed by overriding the item's `nameTag` with custom text.
   *
   * @param {string} text The text to display in the label. Supports Minecraft formatting codes (§).
   * @param {number} [slot=1] The inventory slot where the label will be placed.
   */
  setLabel(text, slot = 1) {
    const baseItem = this.container.getItem(slot) ?? new ItemStack("utilitycraft:arrow_indicator_90");
    baseItem.nameTag = text;
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
    const key = `dorios:progress_${index}`;
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
    return this.entity.getDynamicProperty(`dorios:progress_${index}`) ?? 0;
  }

  /**
   * Sets the machine progress directly.
   *
   * @param {number} value New progress value.
   * @param {Object} [options]
   * @param {number} [options.slot=2] Inventory slot to place the progress item.
   * @param {string} [options.type='arrow_right'] Item type suffix.
   * @param {boolean} [options.display=true] Whether to update the visual progress.
   * @param {number} [options.index=0] Progress index.
   */
  setProgress(value, { slot = 2, type = "arrow_right", display = true, index = 0 } = {}) {
    const key = `dorios:progress_${index}`;
    this.entity.setDynamicProperty(key, Math.max(0, value));

    if (display) {
      this.displayProgress(slot, type, index);
    }
  }

  /**
   * Displays the current progress in the machine's inventory as a progress bar item.
   *
   * @param {number} maxValue The maximum progress value used for normalization.
   * @param {Object} [options]
   * @param {number} [options.slot=2] Inventory slot.
   * @param {string} [options.type='arrow_right'] Item type suffix.
   * @param {number} [options.index=0] Progress index.
   * @param {number} [options.scale=16] Maximum visual scale (e.g., 16 → 0–16).
   */
  displayProgress(maxValue, { slot = 2, type = "arrow_right", index = 0, scale = 16 } = {}) {
    if (!maxValue || maxValue <= 0) return;

    const inv = this.container;
    if (!inv) return;

    const progress = this.getProgress(index);

    const normalized = Math.min(
      scale,
      Math.floor((progress / maxValue) * scale)
    );

    const itemId = `utilitycraft:${type}_${normalized}`;
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
        this.container.setItem(index, new ItemStack("utilitycraft:arrow_right_0", 1));
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
      if (item && item.typeId === "utilitycraft:arrow_right_0") {
        this.container.setItem(index, undefined);
      }
    }
  }
}

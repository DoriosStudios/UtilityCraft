import { ItemStack, world } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./energyStorage";
import { FluidStorage } from "./fluidStorage";
import { OutputTracker } from "./outputTracker.js";
import { TickScheduler } from "./tickScheduler.js";
import { resolveItemContainerAt } from "./itemContainers.js";
import * as Utils from "../utils/entity";
import { readIOConfig } from "../interfaces/ioState.js";
import { ensureItemIOConfig } from "../interfaces/itemIO.js";
import { DIRECTIONS, OPPOSITE_DIRECTIONS } from "../utils/directions.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";

const IO_INPUT_SCAN_LIMIT = 9;
const IO_OUTPUT_SLOT_LIMIT = 9;
const IO_FLUID_TRANSFER_LIMIT = 2500;
const ioInputCursors = new Map();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => ioInputCursors.delete(removedEntityId));

function getIOModeConfig(config, mode) {
  if (!config || typeof config !== "object") return undefined;
  if (config[mode] !== undefined) return config[mode];
  if (mode === "input_1") return config.input;
  if (mode === "output_1") return config.output;
  return undefined;
}

function isOutputIOMode(mode) {
  return mode === "output" || /^output_[1-9]$/.test(mode);
}

export class BasicMachine {
  /**
   * Creates a base machine runtime for a machine block.
   *
   * The constructor resolves the helper entity at the block location, checks
   * the scheduler, and prepares common storage/container handles. If any
   * required piece is missing, `valid` remains false and callers should skip
   * machine logic.
   *
   * @param {import("@minecraft/server").Block} block The block representing the machine.
   * @param {Object} options Constructor options.
   * @param {number} [options.rate=16] Base rate designed for 20 TPS logic.
   * @param {boolean} [options.ignoreTick=false] Whether to bypass scheduler throttling.
   */
  constructor(block, options) {
    this.valid = false;
    this.entity = Utils.tryGetEntityFromBlock(block);
    if (!this.entity) return;
    this.shouldUpdateUI = Utils.hasOpenUI(this.entity);
    if (!options.ignoreTick && !TickScheduler.shouldProcessMachine(this.entity)) return;
    this.energy = new EnergyStorage(this.entity);
    this.dimension = block.dimension;
    this.block = block;
    const inventory = this.entity.getComponent("inventory");
    if (!inventory) return;
    this.container = inventory.container;
    this.baseRate = options.rate;
    this.processingInterval = TickScheduler.getProcessingInterval(this.entity);
    this.rate = options.rate * this.processingInterval;
    this.itemIOReady = ensureItemIOConfig(this.entity, block.typeId);
    this.valid = true;
  }

  /**
   * Sets a new base rate and updates the effective rate using the current
   * scheduler processing interval.
   *
   * @param {number} baseRate New base processing rate.
   * @returns {void}
   */
  setRate(baseRate) {
    this.baseRate = baseRate;
    this.rate = baseRate * this.processingInterval;
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
    if (!this.shouldUpdateUI) return;

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
    if (!this.shouldUpdateUI) return;
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
    if (!this.shouldUpdateUI) return;

    this.energy.display(slot);
  }

  /**
   * Processes absolute-direction IO for machines and generators.
   *
   * Item slots come from the entity's DoriosContainers config. Callers only
   * provide runtime resources, currently liquid storage bindings.
   *
   * @param {Object} [config={}] Runtime resource bindings.
   * @param {Object<string, FluidStorage>|FluidStorage} [config.liquids] Fluid storage keyed by mode, or one shared tank.
   * @param {Object} [limits] Per-tick transfer limits.
   * @param {number} [limits.maxInputSlotsScannedPerTick=9] External inventory slots scanned per input face.
   * @param {number} [limits.maxOutputSlotsMovedPerTick=9] Output slots moved per output face as full stacks.
   * @param {number} [limits.maxFluidMovedPerTick=2500] Fluid mB moved per tick.
   * @returns {{itemsMoved:number, inputSlotsScanned:number, fluidMoved:number}} Transfer summary.
   */
  processIO(config = {}, limits = {}) {
    if (!this.valid) return { itemsMoved: 0, inputSlotsScanned: 0, fluidMoved: 0 };

    let targets = OutputTracker.getIOTargets(this.entity);
    if (!targets.items && !targets.liquids) {
      targets = OutputTracker.refreshIOTargets(this.block) ?? targets;
    }

    const maxInputScans = Math.max(0, Math.floor(limits.maxInputSlotsScannedPerTick ?? IO_INPUT_SCAN_LIMIT));
    const maxOutputSlots = Math.max(0, Math.floor(limits.maxOutputSlotsMovedPerTick ?? IO_OUTPUT_SLOT_LIMIT));
    const maxFluid = Math.max(0, Math.floor(limits.maxFluidMovedPerTick ?? IO_FLUID_TRANSFER_LIMIT));
    const summary = { itemsMoved: 0, inputSlotsScanned: 0, fluidMoved: 0 };

    if (!this.itemIOReady) {
      this.itemIOReady = ensureItemIOConfig(this.entity, this.block.typeId);
    }
    if (this.itemIOReady && targets.items) {
      this.#processItemIO(targets.items, maxInputScans, maxOutputSlots, summary);
    }

    if (config.liquids && targets.liquids && maxFluid > 0) {
      const liquidModes = readIOConfig(this.entity).liquids;
      if (liquidModes) {
        this.#processLiquidIO(config.liquids, liquidModes, targets.liquids, maxFluid, summary);
      }
    }

    return summary;
  }

  #processItemIO(targets, maxInputScans, maxOutputSlots, summary) {
    for (const direction of DIRECTIONS) {
      if (targets[direction] !== true) continue;

      const neighborLocation = OutputTracker.getNeighborLocation(this.block, direction);
      if (!neighborLocation) continue;

      const outputSlots = DoriosContainer.getOutputSlots(this.entity, { face: direction });
      if (outputSlots.length > 0 && maxOutputSlots > 0) {
        const result = this.#pushOutputItems(neighborLocation, outputSlots, direction, maxOutputSlots);
        summary.itemsMoved += result.itemsMoved;
      }

      const inputSlots = DoriosContainer.getInputSlots(this.entity, { face: direction });
      if (inputSlots.length === 0 || maxInputScans <= 0) continue;

      const result = this.#pullInputItems(neighborLocation, inputSlots, direction, maxInputScans);
      summary.inputSlotsScanned += result.slotsScanned;
      summary.itemsMoved += result.itemsMoved;
    }
  }

  #pushOutputItems(targetLocation, slots, direction, maxSlots) {
    if (slots.length === 0 || maxSlots <= 0) return { slotsMoved: 0, itemsMoved: 0 };

    const target = resolveItemContainerAt(this.dimension, targetLocation);
    if (!target) return { slotsMoved: 0, itemsMoved: 0 };

    let slotsMoved = 0;
    let itemsMoved = 0;

    for (const slot of slots) {
      if (slotsMoved >= maxSlots) break;

      const moved = DoriosContainer.transfer(this.entity, {
        sourceSlot: slot,
        target,
        targetFace: OPPOSITE_DIRECTIONS[direction],
      });
      if (moved <= 0) continue;

      slotsMoved++;
      itemsMoved += moved;
    }

    return { slotsMoved, itemsMoved };
  }

  #pullInputItems(sourceLocation, targetSlots, direction, scanBudget) {
    if (targetSlots.length === 0 || scanBudget <= 0) return { slotsScanned: 0, itemsMoved: 0 };

    const source = resolveItemContainerAt(this.dimension, sourceLocation);
    if (!source) return { slotsScanned: 0, itemsMoved: 0 };

    const sourceDirection = OPPOSITE_DIRECTIONS[direction];
    const sourceSlots = DoriosContainer.getOutputSlots(source, { face: sourceDirection });
    if (sourceSlots.length === 0) return { slotsScanned: 0, itemsMoved: 0 };

    const entityCursors = ioInputCursors.get(this.entity.id) ?? new Map();
    let nextCursor = Number(entityCursors.get(direction));
    if (!Number.isInteger(nextCursor) || nextCursor < 0 || nextCursor >= sourceSlots.length) {
      nextCursor = 0;
    }

    let slotsScanned = 0;
    let itemsMoved = 0;
    const slotCount = sourceSlots.length;

    while (slotsScanned < scanBudget && slotsScanned < slotCount) {
      const sourceSlot = sourceSlots[nextCursor];
      const movedThisSlot = DoriosContainer.transfer(source, {
        sourceSlot,
        target: this.entity,
        targetSlots,
      });
      itemsMoved += movedThisSlot;

      nextCursor = (nextCursor + 1) % slotCount;
      slotsScanned++;
      if (movedThisSlot > 0) break;
    }

    entityCursors.set(direction, nextCursor);
    ioInputCursors.set(this.entity.id, entityCursors);
    return { slotsScanned, itemsMoved };
  }

  #processLiquidIO(liquidConfig, ioModes, targets, maxFluid, summary) {
    for (const direction of DIRECTIONS) {
      if (summary.fluidMoved >= maxFluid) break;
      if (targets[direction] !== true) continue;

      const mode = ioModes[direction];
      if (!mode || mode === "disabled") continue;

      const storage = getIOModeConfig(liquidConfig, mode) ?? liquidConfig?.storage ?? liquidConfig;
      if (!storage?.transferTo && !storage?.receiveFrom) continue;

      const neighborLocation = OutputTracker.getNeighborLocation(this.block, direction);
      const remaining = maxFluid - summary.fluidMoved;

      if (isOutputIOMode(mode)) {
        summary.fluidMoved += this.#pushOutputLiquid(storage, neighborLocation, remaining);
      } else {
        summary.fluidMoved += this.#pullInputLiquid(storage, neighborLocation, remaining);
      }
    }
  }

  #pushOutputLiquid(sourceStorage, targetLocation, amount) {
    if (!targetLocation || amount <= 0) return 0;
    if (sourceStorage.get() <= 0 || sourceStorage.getType() === Constants.EMPTY_FLUID_TYPE) return 0;

    const targetBlock = this.dimension.getBlock(targetLocation);
    if (!OutputTracker.isOutputTarget(targetBlock, "fluid")) return 0;

    let targetEntity = this.dimension.getEntitiesAtBlockLocation(targetLocation)[0];
    if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
      FluidStorage.addfluidToTank(targetBlock, sourceStorage.getType(), 0);
      targetEntity = this.dimension.getEntitiesAtBlockLocation(targetLocation)[0];
    }

    if (!targetEntity) return 0;

    const targetStorage = FluidStorage.findType(targetEntity, sourceStorage.getType());
    if (!targetStorage) return 0;

    return sourceStorage.transferTo(targetStorage, amount);
  }

  #pullInputLiquid(targetStorage, sourceLocation, amount) {
    if (!sourceLocation || amount <= 0 || targetStorage.getFreeSpace() <= 0) return 0;

    const sourceBlock = this.dimension.getBlock(sourceLocation);
    if (!OutputTracker.isOutputTarget(sourceBlock, "fluid")) return 0;

    const sourceEntity = this.dimension.getEntitiesAtBlockLocation(sourceLocation)[0];
    if (!sourceEntity) return 0;

    const sourceStorage = new FluidStorage(sourceEntity, 0);
    if (sourceStorage.get() <= 0 || sourceStorage.getType() === Constants.EMPTY_FLUID_TYPE) return 0;

    if (targetStorage.getType() !== Constants.EMPTY_FLUID_TYPE && targetStorage.getType() !== sourceStorage.getType()) {
      return 0;
    }

    return targetStorage.receiveFrom(sourceStorage, amount);
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

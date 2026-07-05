import { ItemStack, system, world } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./energyStorage";
import { FluidStorage } from "./fluidStorage";
import { BasicMachine } from "./basicMachine";
import { OutputTracker } from "./outputTracker.js";
import { TickScheduler } from "./tickScheduler.js";
import { Rotation } from "../utils/rotation";
import * as Utils from "../utils/entity";
import { InterfaceManager } from "../interfaces/index.js";
import { readIOConfig } from "../interfaces/ioState.js";
import { DIRECTIONS } from "../utils/directions.js";

const IO_INPUT_SCAN_LIMIT = 9;
const IO_OUTPUT_SLOT_LIMIT = 9;
const IO_FLUID_TRANSFER_LIMIT = 2500;
const ioInputCursors = new Map();

/**
 * Normalizes a slot declaration into an explicit slot list.
 *
 * @param {number|number[]|undefined} slots Slot or slots.
 * @returns {number[]} Valid slot indexes.
 */
function normalizeIOSlots(slots) {
  const rawSlots = Array.isArray(slots) ? slots : [slots];
  return rawSlots
    .map((slot) => Math.floor(Number(slot)))
    .filter((slot) => Number.isFinite(slot) && slot >= 0);
}

/**
 * Builds a stable runtime cursor key for external input scans.
 *
 * @param {import("@minecraft/server").Entity} entity Machine entity.
 * @param {string} direction Absolute IO direction.
 * @param {string} mode IO mode.
 * @returns {string} Cursor key.
 */
function getIOCursorKey(entity, direction, mode) {
  return `${entity.id}:items:${direction}:${mode}`;
}

/**
 * Resolves the preferred target object for DoriosAPI item insertion.
 *
 * @param {{container?: import("@minecraft/server").Container|null, block?: import("@minecraft/server").Block, entity?: import("@minecraft/server").Entity|null}} target Target data.
 * @returns {import("@minecraft/server").Entity|import("@minecraft/server").Block|import("@minecraft/server").Container|undefined} Insert target.
 */
function getItemInsertTarget(target) {
  return target?.entity ?? target?.block ?? target?.container ?? undefined;
}

/**
 * Inserts into a raw Minecraft container and returns the moved amount.
 *
 * @param {import("@minecraft/server").Container} container Target container.
 * @param {import("@minecraft/server").ItemStack} item Item stack to insert.
 * @returns {number} Amount inserted.
 */
function addItemToRawContainer(container, item) {
  if (!container || !item) return 0;

  const beforeAmount = item.amount;
  const remainder = container.addItem(item.clone());
  if (!remainder) return beforeAmount;
  if (remainder.typeId !== item.typeId) return beforeAmount;
  return Math.max(0, beforeAmount - remainder.amount);
}

export class Machine extends BasicMachine {
  /**
   * Creates a new Machine instance.
   *
   * @param {import("@minecraft/server").Block} block The block representing the machine.
   * @param {Object} settings Machine configuration.
   */
  constructor(block, settings) {
    const baseRate = settings.machine.rate_speed_base ?? 0;
    super(block, { rate: baseRate, ignoreTick: settings.ignoreTick });
    if (!this.valid) return;

    this.settings = settings;
    const machineSettings = settings.machine;
    if (!machineSettings) return;

    this.upgrades = {
      energy: 0,
      range: 0,
      speed: 0,
      ultimate: 0,
    };
    this.boosts = {
      speed: 1,
      consumption: 1,
    };

    if (machineSettings.upgrades) {
      this.upgrades = this.#getUpgradeLevels(machineSettings.upgrades);
      this.boosts = this.#calculateBoosts(this.upgrades);
      const adjustedRate = settings.machine.rate_speed_base * this.boosts.speed * this.boosts.consumption;
      this.setRate(adjustedRate);
    }
  }

  /**
   * Handles machine destruction:
   * - Drops inventory (excluding UI items).
   * - Drops the machine block item with stored energy and liquid info in lore.
   * - Removes the machine entity.
   * - Skips drop if the player is in Creative mode.
   *
   * @param {{
   *   block: import("@minecraft/server").Block,
   *   brokenBlockPermutation: import("@minecraft/server").BlockPermutation,
   *   player?: import("@minecraft/server").Player,
   *   dimension: import("@minecraft/server").Dimension
   * }} e Event data containing the dimension, block, broken permutation, and player.
   * @returns {boolean} True when a matching machine entity was found and queued for removal.
   */
  static onDestroy(e) {
    const { block, brokenBlockPermutation, player, dimension: dim } = e;
    const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return false;

    const energy = new EnergyStorage(entity);
    const fluid = new FluidStorage(entity);
    const blockItemId = brokenBlockPermutation.type.id;
    const blockItem = new ItemStack(blockItemId);
    const lore = [];

    // Energy lore
    if (energy.get() > 0) {
      lore.push(`§r§7  Energy: ${EnergyStorage.formatEnergyToText(energy.get())}/${EnergyStorage.formatEnergyToText(energy.cap)}`);
    }

    if (fluid.type != Constants.EMPTY_FLUID_TYPE) {
      const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
      lore.push(`§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`);
    }

    if (lore.length > 0) {
      blockItem.setLore(lore);
    }

    // Drop item and cleanup
    system.run(() => {
      if (player?.isInSurvival()) {
        const oldItemEntity = dim
          .getEntities({
            type: "item",
            maxDistance: 3,
            location: block.center(),
          })
          .find((item) => item.getComponent("minecraft:item")?.itemStack?.typeId === blockItemId);
        oldItemEntity?.remove();
      }
      TickScheduler.releaseTickGroup(entity);
      Utils.dropAllItems(entity);
      entity.remove();
      dim.spawnItem(blockItem, block.center());
    });
    return true;
  }

  /**
   * Spawns a machine entity at the specified block location and initializes
   * its energy and optional fluid storage based on the item held by the player.
   * Registered InterfaceManager buttons are also written after the caller's
   * placement callback, so UI-owned slots are reserved before machine ticks.
   *
   * Handles optional rotation logic before placing the machine.
   *
   * @param {{
   *   block: import("@minecraft/server").Block,
   *   player: import("@minecraft/server").Player,
   *   permutationToPlace: import("@minecraft/server").BlockPermutation,
   *   cancel?: boolean
   * }} e Event data containing the block location, player, and block permutation.
   *
   * @param {Object} config Machine configuration used to define
   * the entity name, inventory size, and machine capacities.
   *
   * @param {(entity: import("@minecraft/server").Entity) => void} [callback]
   * Optional function executed after the entity has been spawned and initialized.
   */
  static spawnEntity(e, config, callback) {
    const { block, player, permutationToPlace } = e;
    const mainHand = player.getComponent("equippable").getEquipment("Mainhand");
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);

    // Machine specific: rotation handling
    if (config.rotation) {
      if (player.isInSurvival()) {
        system.run(() => {
          player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`);
        });
      }

      e.cancel = true;
      Rotation.facing(player, block, permutationToPlace);
    }

    system.run(() => {
      const entity = Utils.spawnEntity(block, config);
      const energyManager = new EnergyStorage(entity);
      energyManager.setCap(config.machine.energy_cap);
      energyManager.set(energy);
      energyManager.display();

      if (config.machine.fluid_cap) {
        const fluidManager = new FluidStorage(entity);

        fluidManager.setCap(config.machine.fluid_cap);
        fluidManager.display();

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }
      system.run(() => {
        if (callback) {
          callback(entity);
        }
        InterfaceManager.ensureEntityInterfaces(entity);
      });
    });
    Utils.updateAdjacentNetwork(block, permutationToPlace);
  }
  /**
   * Transfers output items to this machine's cached item output target.
   *
   * ## Behavior
   * - Uses the output slot range registered on the machine entity.
   * - Reads the cached target from {@link OutputTracker}.
   * - Calls {@link DoriosAPI.containers.transferItemsAt} and clears stale targets.
   *
   * Compatible with:
   * - Vanilla containers (chests, barrels, hoppers, etc.)
   * - Dorios containers and machines with inventories
   *
   * Uses the output slot range registered on the machine entity.
   * - `"simple"` → transfers only the **last slot** (output).
   * - `"complex"` → transfers the **last 9 slots** (outputs).
   *
   * @returns {boolean} True when at least one item was moved.
   */
  transferItems() {
    const range = DoriosAPI.containers.getAllowedOutputRange(this.entity);
    const targetLoc = OutputTracker.getOutputTarget(this.entity, "item") ?? OutputTracker.refreshOutput(this.block, "item");
    if (!targetLoc) return false;

    const moved = DoriosAPI.containers.transferItemsAt(this.container, targetLoc, this.dimension, range);
    if (moved === -1) {
      OutputTracker.clearOutputTarget(this.entity, "item");
      return false;
    }

    return moved > 0;
  }

  /**
   * Returns whether the configured output slot or slot range contains items.
   *
   * @returns {boolean} True when at least one registered output slot has an item.
   */
  hasOutputItems() {
    const range = DoriosAPI.containers.getAllowedOutputRange(this.entity);

    if (typeof range === "number") {
      return !!this.container.getItem(range);
    }

    if (!Array.isArray(range) || range.length !== 2) {
      return false;
    }

    const [start, end] = range;
    for (let slot = start; slot <= end; slot++) {
      if (this.container.getItem(slot)) return true;
    }

    return false;
  }

  /**
   * Processes the machine's absolute-direction IO configuration.
   *
   * The persisted UI config stores modes per world direction. This method
   * combines that state with `OutputTracker` target booleans and moves only
   * through directions that are both enabled by the user and compatible.
   *
   * @param {Object} config Runtime IO handler config.
   * @param {Object<string, number|number[]>} [config.items] Item slots keyed by mode, e.g. `{ input:[3], input_extra:[4], output:[7] }`.
   * @param {Object<string, FluidStorage>|FluidStorage} [config.liquids] Fluid storage keyed by mode, or one shared tank.
   * @param {Object} [limits] Per-tick transfer limits.
   * @param {number} [limits.maxInputSlotsScannedPerTick=9] External inventory slots scanned for input.
   * @param {number} [limits.maxOutputSlotsMovedPerTick=9] Output slots moved as full stacks.
   * @param {number} [limits.maxFluidMovedPerTick=2500] Fluid mB moved per tick.
   * @returns {{itemsMoved:number, inputSlotsScanned:number, fluidMoved:number}} Transfer summary.
   */
  processIO(config = {}, limits = {}) {
    if (!this.valid) return { itemsMoved: 0, inputSlotsScanned: 0, fluidMoved: 0 };

    let targets = OutputTracker.getIOTargets(this.entity);
    if (!targets.items && !targets.liquids) {
      targets = OutputTracker.refreshIOTargets(this.block) ?? targets;
    }

    const ioConfig = readIOConfig(this.entity);
    const maxInputScans = Math.max(0, Math.floor(limits.maxInputSlotsScannedPerTick ?? IO_INPUT_SCAN_LIMIT));
    const maxOutputSlots = Math.max(0, Math.floor(limits.maxOutputSlotsMovedPerTick ?? IO_OUTPUT_SLOT_LIMIT));
    const maxFluid = Math.max(0, Math.floor(limits.maxFluidMovedPerTick ?? IO_FLUID_TRANSFER_LIMIT));
    const summary = { itemsMoved: 0, inputSlotsScanned: 0, fluidMoved: 0 };

    if (config.items && ioConfig.items && targets.items) {
      this.#processItemIO(config.items, ioConfig.items, targets.items, maxInputScans, maxOutputSlots, summary);
    }

    if (config.liquids && ioConfig.liquids && targets.liquids && maxFluid > 0) {
      this.#processLiquidIO(config.liquids, ioConfig.liquids, targets.liquids, maxFluid, summary);
    }

    return summary;
  }

  /**
   * Processes item input/output directions for the current tick.
   *
   * @param {Object<string, number|number[]>} itemConfig Slots keyed by mode.
   * @param {Record<string, string>} ioModes Persisted absolute-direction modes.
   * @param {Record<string, boolean>} targets Cached compatible targets.
   * @param {number} maxInputScans External source slots to scan.
   * @param {number} maxOutputSlots Output slots to move.
   * @param {{itemsMoved:number, inputSlotsScanned:number, fluidMoved:number}} summary Mutable transfer summary.
   * @returns {void}
   */
  #processItemIO(itemConfig, ioModes, targets, maxInputScans, maxOutputSlots, summary) {
    let outputSlotsMoved = 0;
    let inputSlotsScanned = 0;

    for (const direction of DIRECTIONS) {
      if (targets[direction] !== true) continue;

      const mode = ioModes[direction];
      if (!mode || mode === "disabled") continue;

      const neighborLocation = OutputTracker.getNeighborLocation(this.block, direction);
      if (!neighborLocation) continue;

      if (mode === "output" && outputSlotsMoved < maxOutputSlots) {
        const slots = normalizeIOSlots(itemConfig.output);
        const result = this.#pushOutputItems(neighborLocation, slots, maxOutputSlots - outputSlotsMoved);
        outputSlotsMoved += result.slotsMoved;
        summary.itemsMoved += result.itemsMoved;
        continue;
      }

      const inputSlots = normalizeIOSlots(itemConfig[mode]);
      if (inputSlots.length === 0 || inputSlotsScanned >= maxInputScans) continue;

      const result = this.#pullInputItems(neighborLocation, inputSlots, direction, mode, maxInputScans - inputSlotsScanned);
      inputSlotsScanned += result.slotsScanned;
      summary.inputSlotsScanned += result.slotsScanned;
      summary.itemsMoved += result.itemsMoved;
    }
  }

  /**
   * Pushes complete output stacks into an adjacent compatible container.
   *
   * @param {import("@minecraft/server").Vector3} targetLocation Neighbor location.
   * @param {number[]} slots Source output slots.
   * @param {number} maxSlots Maximum source slots to process.
   * @returns {{slotsMoved:number, itemsMoved:number}} Movement counts.
   */
  #pushOutputItems(targetLocation, slots, maxSlots) {
    if (slots.length === 0 || maxSlots <= 0) return { slotsMoved: 0, itemsMoved: 0 };

    const target = DoriosAPI.containers.getContainerAt(targetLocation, this.dimension);
    if (!target?.container) return { slotsMoved: 0, itemsMoved: 0 };

    let slotsMoved = 0;
    let itemsMoved = 0;

    for (const slot of slots) {
      if (slotsMoved >= maxSlots) break;

      const item = this.container.getItem(slot);
      if (!item) continue;

      const beforeAmount = item.amount;
      let moved = 0;

      if (target.entity) {
        const added = DoriosAPI.containers.addItem(getItemInsertTarget(target), item.clone());
        if (added === true) {
          moved = beforeAmount;
        } else if (typeof added === "number") {
          moved = Math.max(0, Math.min(beforeAmount, added));
        }
      } else {
        moved = addItemToRawContainer(target.container, item);
      }

      if (moved <= 0) continue;

      if (moved >= beforeAmount) {
        this.container.setItem(slot, undefined);
      } else {
        item.amount = beforeAmount - moved;
        this.container.setItem(slot, item);
      }

      slotsMoved++;
      itemsMoved += moved;
    }

    return { slotsMoved, itemsMoved };
  }

  /**
   * Pulls items from an adjacent container into configured machine input slots.
   *
   * @param {import("@minecraft/server").Vector3} sourceLocation Neighbor location.
   * @param {number[]} targetSlots Machine input slots.
   * @param {string} direction Absolute direction.
   * @param {string} mode IO input mode.
   * @param {number} scanBudget External slots allowed to scan this tick.
   * @returns {{slotsScanned:number, itemsMoved:number}} Scan and movement counts.
   */
  #pullInputItems(sourceLocation, targetSlots, direction, mode, scanBudget) {
    if (targetSlots.length === 0 || scanBudget <= 0) return { slotsScanned: 0, itemsMoved: 0 };

    const source = DoriosAPI.containers.getContainerAt(sourceLocation, this.dimension);
    if (!source?.container) return { slotsScanned: 0, itemsMoved: 0 };

    const sourceRef = source.entity ?? source.block ?? source.container;
    const [start, end] = DoriosAPI.containers.getAllowedOutputRange(sourceRef);
    if (start < 0 || end < start) return { slotsScanned: 0, itemsMoved: 0 };

    const cursorKey = getIOCursorKey(this.entity, direction, mode);
    let nextCursor = Number(ioInputCursors.get(cursorKey));
    if (!Number.isFinite(nextCursor) || nextCursor < start || nextCursor > end) nextCursor = start;

    let slotsScanned = 0;
    let itemsMoved = 0;
    const slotCount = end - start + 1;

    while (slotsScanned < scanBudget && slotsScanned < slotCount) {
      const sourceSlot = nextCursor;
      const before = source.container.getItem(sourceSlot);
      const beforeAmount = before?.amount ?? 0;
      let movedThisSlot = 0;

      if (before) {
        movedThisSlot = DoriosAPI.containers.transferItemToSlots(source.container, sourceSlot, this.container, targetSlots);
        itemsMoved += movedThisSlot;
      }

      nextCursor = sourceSlot + 1 > end ? start : sourceSlot + 1;
      slotsScanned++;
      if (beforeAmount > 0 && movedThisSlot > 0) break;
    }

    ioInputCursors.set(cursorKey, nextCursor);
    return { slotsScanned, itemsMoved };
  }

  /**
   * Processes liquid input/output directions for the current tick.
   *
   * @param {Object<string, FluidStorage>|FluidStorage} liquidConfig Storage keyed by mode, or one shared tank.
   * @param {Record<string, string>} ioModes Persisted absolute-direction modes.
   * @param {Record<string, boolean>} targets Cached compatible targets.
   * @param {number} maxFluid Maximum mB to move this tick.
   * @param {{itemsMoved:number, inputSlotsScanned:number, fluidMoved:number}} summary Mutable transfer summary.
   * @returns {void}
   */
  #processLiquidIO(liquidConfig, ioModes, targets, maxFluid, summary) {
    for (const direction of DIRECTIONS) {
      if (summary.fluidMoved >= maxFluid) break;
      if (targets[direction] !== true) continue;

      const mode = ioModes[direction];
      if (!mode || mode === "disabled") continue;

      const storage = liquidConfig?.[mode] ?? liquidConfig?.storage ?? liquidConfig;
      if (!storage?.transferTo && !storage?.receiveFrom) continue;

      const neighborLocation = OutputTracker.getNeighborLocation(this.block, direction);
      const remaining = maxFluid - summary.fluidMoved;

      if (mode === "output") {
        summary.fluidMoved += this.#pushOutputLiquid(storage, neighborLocation, remaining);
      } else {
        summary.fluidMoved += this.#pullInputLiquid(storage, neighborLocation, remaining);
      }
    }
  }

  /**
   * Pushes fluid from a machine tank into an adjacent fluid container.
   *
   * @param {FluidStorage} sourceStorage Machine fluid storage.
   * @param {import("@minecraft/server").Vector3} targetLocation Neighbor location.
   * @param {number} amount Maximum mB to move.
   * @returns {number} mB moved.
   */
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

  /**
   * Pulls fluid from an adjacent fluid container into a machine tank.
   *
   * @param {FluidStorage} targetStorage Machine fluid storage.
   * @param {import("@minecraft/server").Vector3} sourceLocation Neighbor location.
   * @param {number} amount Maximum mB to move.
   * @returns {number} mB moved.
   */
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
   * Pulls items from the vanilla container block above the machine
   * into a specific slot in its internal inventory.
   *
   * - Only works if the block above is a vanilla container (checked via DoriosAPI.constants.vanillaContainers).
   * - If the target slot is empty, moves the first available item.
   * - If it already contains an item, merges stacks until full.
   *
   * @param {number} targetSlot The slot index where items should be inserted.
   * @returns {boolean} True if at least one item was transferred.
   */
  pullItemsFromAbove(targetSlot) {
    const inv = this.container;
    const block = this.block;

    const aboveBlock = block.above(1);
    if (!aboveBlock) return false;

    // Solo contenedores vanilla
    if (!DoriosAPI.constants.vanillaContainers.includes(aboveBlock.typeId)) return false;

    const inputContainer = aboveBlock.getComponent("minecraft:inventory")?.container;
    if (!inputContainer) return false;

    const targetItem = inv.getItem(targetSlot);
    let transferred = false;
    for (let i = 0; i < inputContainer.size; i++) {
      const inputItem = inputContainer.getItem(i);
      if (!inputItem) continue;

      // Si hay item distinto en el slot → saltar
      if (targetItem && inputItem.typeId !== targetItem.typeId) continue;

      // Si el slot está vacío → mover toda la pila al slot específico
      if (!targetItem) {
        inv.setItem(targetSlot, inputItem);
        inputContainer.setItem(i);
        return true;
      }

      const space = targetItem.maxAmount - targetItem.amount;
      const amount = Math.min(space, inputItem.amount);

      // Intentar combinar stacks
      if (amount <= 0) continue;

      targetItem.amount += amount;
      inv.setItem(targetSlot, targetItem);
      if (inputItem.amount - amount <= 0) {
        inputContainer.setItem(i);
      } else {
        inputItem.amount -= amount;
        inputContainer.setItem(i, inputItem);
      }

      return transferred;
    }
  }

  /**
   * Sets the machine progress using its configured energy cost as the max value.
   *
   * @param {number} value New progress value.
   * @param {Object} [options]
   * @param {number} [options.slot=2] Inventory slot to place the progress item.
   * @param {number} [options.maxValue=800] Inventory slot to place the progress item.
   * @param {string} [options.type='progress_right_bar'] Item type suffix.
   * @param {boolean} [options.display=true] Whether to update the visual progress.
   * @param {number} [options.index=0] Progress index.
   * @param {number} [options.scale=16] Maximum visual scale.
   * @param {boolean} [options.legacy=false] Whether to use the legacy non-padded frame naming.
   */
  setProgress(value, options) {
    options ??= {};
    super.setProgress(value, options.maxValue ?? this.getEnergyCost(options.index), options);
  }

  /**
   * Displays the machine's progress using its configured energy cost.
   *
   * Supports both:
   * - `machine.displayProgress({ ...options })`
   * - internal base-class calls like `this.displayProgress(maxValue, { ...options })`
   *
   * @param {number|Object} [maxValueOrOptions]
   * @param {Object} [maybeOptions]
   * @param {number} [maybeOptions.slot=2] Inventory slot where the progress bar item will be placed.
   * @param {number} [maybeOptions.maxValue=800] Maximum progress value.
   * @param {string} [maybeOptions.type="progress_right_bar"] Item type suffix used for the progress bar texture.
   * @param {number} [maybeOptions.index=0] Progress index (useful for multi-process machines).
   * @param {boolean} [maybeOptions.legacy=false] Whether to use the legacy non-padded frame naming.
   * @param {number} [maybeOptions.scale=16] Maximum visual scale of the progress bar (e.g., 16 → 0–16).
   */
  displayProgress(maxValueOrOptions, maybeOptions) {
    let maxValue;
    let options;

    if (typeof maxValueOrOptions === "number") {
      maxValue = maxValueOrOptions;
      options = maybeOptions ?? {};
    } else {
      options = maxValueOrOptions ?? {};
      maxValue = options.maxValue ?? this.getEnergyCost(options.index);
    }

    if (!maxValue || maxValue <= 0) return;

    super.displayProgress(maxValue, options);
  }
  //#endregion

  /**
   * Sets the machine's energy cost (maximum progress).
   *
   * @param {number} value Energy cost representing 100% progress.
   * @param {number} [index=0] Cost index.
   */
  setEnergyCost(value, index = 0) {
    this.entity.setDynamicProperty(`${Constants.MACHINE_ENERGY_COST_PROPERTY_PREFIX}${index}`, Math.max(1, value));
  }

  /**
   * Gets the energy cost (maximum progress).
   *
   * @param {number} [index=0] Cost index.
   * @returns {number} Energy cost value.
   */
  getEnergyCost(index = 0) {
    return this.entity.getDynamicProperty(`${Constants.MACHINE_ENERGY_COST_PROPERTY_PREFIX}${index}`) ?? Constants.DEFAULT_PROGRESS_MAX;
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

  //#region Labels
  /**
   * Displays a warning label in the machine.
   *
   * Optionally resets the machine progress and turns the machine off.
   *
   * @param {string} message The warning text to display.
   * @param {Object} [options]
   * @param {boolean} [options.resetProgress=true] Whether to reset the machine progress to 0.
   * @param {boolean} [options.displayProgress=true] Whether to display the progress bar when resetting.
   * @param {number} [options.slot=2] Progress display slot.
   * @param {string} [options.type='progress_right_bar'] Progress bar type.
   * @param {number} [options.index=0] Progress index.
   * @param {boolean} [options.legacy=false] Whether to use the legacy non-padded frame naming.
   * @param {number} [options.scale=16] Visual progress scale.
   */
  showWarning(message, options) {
    options ??= {};
    if (options.resetProgress !== false) {
      this.setProgress(0, { ...options, display: options.displayProgress !== false });
    }

    this.displayEnergy();
    this.off();

    this.setLabel(`
§r${Constants.MACHINE_TEXT_COLORS.yellow}${message}!

§r${Constants.MACHINE_TEXT_COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${Constants.MACHINE_TEXT_COLORS.green}Efficiency ${((1 / this.boosts.consumption) * 100).toFixed(0)}%%
§r${Constants.MACHINE_TEXT_COLORS.green}Cost ---

§r${Constants.MACHINE_TEXT_COLORS.red}Rate ${EnergyStorage.formatEnergyToText(Math.floor(this.baseRate))}/t
`);
  }

  /**
   * Displays a normal status label in the machine (green).
   *
   * Does not reset the machine progress.
   *
   * @param {string} message The status text to display.
   */
  showStatus(message) {
    this.displayEnergy();

    this.setLabel(`
§r${Constants.MACHINE_TEXT_COLORS.darkGreen}${message}!

§r${Constants.MACHINE_TEXT_COLORS.green}Speed x${this.boosts.speed.toFixed(2)}
§r${Constants.MACHINE_TEXT_COLORS.green}Efficiency ${((1 / this.boosts.consumption) * 100).toFixed(0)}%%
§r${Constants.MACHINE_TEXT_COLORS.green}Cost ${EnergyStorage.formatEnergyToText(this.getEnergyCost() * this.boosts.consumption)}

§r${Constants.MACHINE_TEXT_COLORS.red}Rate ${EnergyStorage.formatEnergyToText(Math.floor(this.baseRate))}/t
    `);
  }
  //#endregion

  /**
   * Scans upgrade slots and returns upgrade levels by type.
   *
   * @param {Array<number>} [slots=[4,5,6]] The inventory slots reserved for upgrades.
   * @returns {UpgradeLevels}
   */
  #getUpgradeLevels(slots = [4, 5]) {
    /** @type {UpgradeLevels} */
    const levels = {
      energy: 0,
      range: 0,
      speed: 0,
      ultimate: 0,
    };

    for (const slot of slots) {
      const item = this.container.getItem(slot);
      if (!item) continue;

      if (!item.hasTag("utilitycraft:is_upgrade")) continue;

      // Parse type (e.g. "utilitycraft:energy_upgrade" → "energy")
      const [, raw] = item.typeId.split(":");
      const type = raw.split("_")[0];

      if (levels[type] !== undefined) {
        levels[type] += item.amount;
      }
    }

    return levels;
  }

  /**
   * Calculates the speed multiplier based on upgrade amounts.
   *
   * Formula:
   * speed = 1 + 0.125 * n * (n + 1)
   *
   * @param {number} speedAmount
   * @returns {number} Speed multiplier
   */
  #calculateSpeed(speedAmount) {
    const speedLevel = Math.min(8, speedAmount);
    return 1 + 0.125 * speedLevel * (speedLevel + 1);
  }

  /**
   * Calculates the consumption multiplier (lower = better).
   *
   * Formula (depends on energy upgrade level):
   * If level < 4:
   *   consumption = (1 - 0.2 * level) * speed
   * Else:
   *   consumption = (1 - (0.95 - 0.05 * (8 - level))) * speed
   *
   * @param {number} energyAmount
   * @param {number} speed
   * @returns {number} Consumption multiplier (0–1)
   */
  #calculateConsumption(energyAmount, speed) {
    const energyLevel = Math.min(8, energyAmount);
    if (energyLevel < 4) {
      return (1 - 0.2 * energyLevel) * speed;
    }
    return (1 - (0.95 - 0.05 * (8 - energyLevel))) * speed;
  }

  /**
   * Aggregates all boosts (speed + consumption).
   *
   * @param {Object} levels Upgrade levels { speed, energy, ... }
   * @returns {{ speed: number, consumption: number }}
   */
  #calculateBoosts(levels) {
    const speedLevel = levels.speed ?? 0;
    const energyLevel = levels.energy ?? 0;

    const speed = this.#calculateSpeed(speedLevel);
    const consumption = this.#calculateConsumption(energyLevel, speed);

    return { speed, consumption };
  }
}

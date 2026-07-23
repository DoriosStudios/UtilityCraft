import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./energyStorage";
import { FluidStorage } from "./fluidStorage";
import { GasStorage } from "./gasStorage.js";
import { BasicMachine } from "./basicMachine";
import { OutputTracker } from "./outputTracker.js";
import { resolveItemContainerAt } from "./itemContainers.js";
import { TickScheduler } from "./tickScheduler.js";
import { MachineUpgradeRegistry } from "./machineUpgrades.js";
import { Rotation } from "../utils/rotation";
import * as Utils from "../utils/entity";
import { InterfaceManager } from "../interfaces/index.js";
import { ensureItemIOConfig } from "../interfaces/itemIO.js";
import { ensureFluidIOConfig } from "../interfaces/fluidIO.js";
import { ensureGasIOConfig } from "../interfaces/gasIO.js";
import { ensureBlockIOInterface } from "../interfaces/IOInterface.js";
import { getDirectionBetween, OPPOSITE_DIRECTIONS } from "../utils/directions.js";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";

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

    this.boosts = MachineUpgradeRegistry.resolveBoosts(
      this.container,
      machineSettings.upgrades,
      {
        speed: 1,
        energy_cost: 1,
        energy_efficiency: 1,
        process_batch: 1,
      },
    );
    this.boosts.energy_cost = Math.max(0.01, this.boosts.energy_cost);
    this.boosts.energy_efficiency = Math.max(0.01, this.boosts.energy_efficiency);
    this.boosts.consumption = Math.max(
      0.01,
      this.boosts.energy_cost / this.boosts.energy_efficiency,
    );

    const adjustedRate = baseRate * this.boosts.speed * this.boosts.consumption;
    this.setRate(adjustedRate);
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
    const supportsGas = entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:gas_container") === true;
    const gas = supportsGas ? new GasStorage(entity) : undefined;
    const blockItemId = brokenBlockPermutation.type.id;
    const blockItem = new ItemStack(blockItemId);
    const lore = [];

    // Energy lore
    if (energy.get() > 0) {
      lore.push(`§r§7  Energy: ${EnergyStorage.formatEnergyToText(energy.get())}/${EnergyStorage.formatEnergyToText(energy.cap)}`);
    }

    if (fluid.type != Constants.EMPTY_FLUID_TYPE && fluid.get() > 0) {
      const liquidName = DoriosLib.text.capitalizeFirst(fluid.type);
      const storedFluid = fluid.type === "xp"
        ? `${Math.floor(fluid.get())} mB`
        : FluidStorage.formatFluid(fluid.get());
      lore.push(`§r§7  ${liquidName}: ${storedFluid}/${FluidStorage.formatFluid(fluid.cap)}`);
    }

    if (gas && gas.type !== Constants.EMPTY_GAS_TYPE && gas.get() > 0) {
      const gasName = DoriosLib.text.capitalizeFirst(gas.type);
      lore.push(`§r§7  Gas (${gasName}): ${GasStorage.formatGas(gas.get())}/${GasStorage.formatGas(gas.cap)}`);
    }

    if (lore.length > 0) {
      blockItem.setLore(lore);
    }

    // Drop item and cleanup
    system.run(() => {
      if (DoriosLib.player.isSurvival(player)) {
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
    const gasLine = mainHand?.getLore()?.find((line) => line.replace(/§./g, "").trim().startsWith("Gas ("));
    const gas = gasLine ? GasStorage.getGasFromText(gasLine) : undefined;

    // Machine specific: rotation handling
    if (config.rotation) {
      if (DoriosLib.player.isSurvival(player)) {
        system.run(() => {
          player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`);
        });
      }

      e.cancel = true;
      Rotation.facing(player, block, permutationToPlace);
    }

    system.run(() => {
      ensureBlockIOInterface(block);
      const entity = Utils.spawnEntity(block, config);
      const energyManager = new EnergyStorage(entity);
      energyManager.setCap(config.machine.energy_cap);
      energyManager.set(energy);
      energyManager.display();

      if (config.machine.fluid_cap) {
        const fluidCount = Math.max(1, Math.floor(config.machine.fluid_types ?? 1));
        const fluidManagers = FluidStorage.initializeMultiple(entity, fluidCount);
        for (const manager of fluidManagers) manager.setCap(config.machine.fluid_cap);
        const fluidManager = fluidManagers[0];
        fluidManager.display();

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }
      if (config.machine.gas_cap) {
        const gasCount = Math.max(1, Math.floor(config.machine.gas_types ?? 1));
        const gasManagers = GasStorage.initializeMultiple(entity, gasCount);
        for (const manager of gasManagers) manager.setCap(config.machine.gas_cap);
        if (gas && gas.amount > 0) {
          gasManagers[0].setType(gas.type);
          gasManagers[0].set(gas.amount);
        }
      }
      if (config.machine.gas_cap && config.machine.fluid_cap) {
        entity.triggerEvent("utilitycraft:fluid_gas_machine");
      } else if (config.machine.gas_cap) {
        entity.triggerEvent("utilitycraft:gas_machine");
      }
      // The inventory-size entity event may still expose the base container in
      // this tick. ensureItemIOConfig installs a fail-closed temporary config
      // and the next tick reconciles it against the final inventory size.
      ensureItemIOConfig(entity, block.typeId, { failClosedWhileResizing: true });
      ensureFluidIOConfig(entity, block.typeId);
      ensureGasIOConfig(entity, block.typeId);
      system.run(() => {
        if (!entity.isValid) return;
        ensureItemIOConfig(entity, block.typeId);
        ensureFluidIOConfig(entity, block.typeId);
        ensureGasIOConfig(entity, block.typeId);
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
   * - Uses the slot array configured for the machine's output face.
   * - Reads the cached target from {@link OutputTracker}.
   * - Applies the opposite input face on the resolved target.
   *
   * Compatible with:
   * - Vanilla containers (chests, barrels, hoppers, etc.)
   * - Dorios containers and machines with inventories
   * @returns {boolean} True when at least one item was moved.
   */
  transferItems() {
    const targetLoc = OutputTracker.getOutputTarget(this.entity, "item") ?? OutputTracker.refreshOutput(this.block, "item");
    if (!targetLoc) return false;

    const target = resolveItemContainerAt(this.dimension, targetLoc);
    const direction = getDirectionBetween(this.block.location, targetLoc);
    if (!target || !direction) {
      OutputTracker.clearOutputTarget(this.entity, "item");
      return false;
    }

    let moved = 0;
    const slots = DoriosContainer.getOutputSlots(this.entity, { face: direction });
    for (const sourceSlot of slots) {
      moved += DoriosContainer.transfer(this.entity, {
        sourceSlot,
        target,
        targetFace: OPPOSITE_DIRECTIONS[direction],
      });
    }
    return moved > 0;
  }

  /**
   * Returns whether an explicit no-face output slot contains items.
   *
   * @returns {boolean} True when at least one registered output slot has an item.
   */
  hasOutputItems() {
    for (const slot of DoriosContainer.getOutputSlots(this.entity)) {
      if (this.container.getItem(slot)) return true;
    }

    return false;
  }

  /**
   * Pulls one available stack from the container above into a specific
   * machine slot, respecting the source down face and machine up face.
   *
   * @param {number} targetSlot The slot index where items should be inserted.
   * @returns {boolean} True if at least one item was transferred.
   */
  pullItemsFromAbove(targetSlot) {
    const aboveBlock = this.block.above(1);
    if (!aboveBlock) return false;

    const source = resolveItemContainerAt(this.dimension, aboveBlock.location);
    if (!source) return false;

    for (const sourceSlot of DoriosContainer.getOutputSlots(source, { face: "down" })) {
      const moved = DoriosContainer.transfer(source, {
        sourceSlot,
        target: this.entity,
        targetSlots: [targetSlot],
      });
      if (moved > 0) return true;
    }
    return false;
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
§r${Constants.MACHINE_TEXT_COLORS.green}Efficiency x${(1 / this.boosts.consumption).toFixed(2)}
§r${Constants.MACHINE_TEXT_COLORS.green}Recipe Batch x${Math.max(1, Math.floor(this.boosts.process_batch))}
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
§r${Constants.MACHINE_TEXT_COLORS.green}Efficiency x${(1 / this.boosts.consumption).toFixed(2)}
§r${Constants.MACHINE_TEXT_COLORS.green}Recipe Batch x${Math.max(1, Math.floor(this.boosts.process_batch))}
§r${Constants.MACHINE_TEXT_COLORS.green}Cost ${EnergyStorage.formatEnergyToText(this.getEnergyCost() * this.boosts.consumption)}

§r${Constants.MACHINE_TEXT_COLORS.red}Rate ${EnergyStorage.formatEnergyToText(Math.floor(this.baseRate))}/t
    `);
  }
  //#endregion

}

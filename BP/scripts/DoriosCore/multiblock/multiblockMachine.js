import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system } from "@minecraft/server";
import * as MachineryConstants from "../machinery/constants.js";
import { BasicMachine } from "../machinery/basicMachine.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import { GasStorage } from "../machinery/gasStorage.js";
import { ActivationManager } from "./activationManager.js";
import { DeactivationManager } from "./deactivationManager.js";
import { StructureDetector } from "./structureDetection.js";
import * as Utils from "../utils/entity.js";
import * as Constants from "./constants.js";
import { ensureGasIOConfig } from "../interfaces/gasIO.js";

export class MultiblockMachine extends BasicMachine {
  /**
   * Default interaction shown when the player clicks the controller without a wrench.
   *
   * @param {{ entity?: Entity, player: Player }} context
   */
  static defaultOnInteractWithoutWrench({ entity, player }) {
    if (!entity) return;
    player.sendMessage("§7Use a wrench to scan and activate this multiblock.");
  }

  /**
   * Creates a multiblock machine runtime bound to a controller block.
   *
   * A multiblock machine is only considered valid when the backing controller
   * entity exists and its serialized multiblock state is currently active.
   *
   * @param {Block} block Controller block representing the machine.
   * @param {MachineSettings} config Multiblock machine configuration.
   */
  constructor(block, config) {
    const configuredRate = config?.machine?.rate_speed_base ?? 0;
    super(block, { rate: configuredRate, ignoreTick: config?.ignoreTick });
    this.configuredRate = configuredRate;
    if (!this.valid) return;

    const state = this.entity.getDynamicProperty(Constants.STATE_PROPERTY_ID);
    if (!state || state === Constants.INACTIVE_STATE_VALUE) {
      this.valid = false;
      return;
    }

    this.config = config;
    this.settings = config;
  }

  /**
   * Applies a multiplier to the configured machine rate.
   *
   * The configured value is kept separately so repeated calls never compound
   * the previous effective rate. Call {@link BasicMachine#setRate} directly
   * when a machine needs a completely custom absolute rate.
   *
   * @param {number} [multiplier=1] Multiplier applied to `rate_speed_base`.
   * @returns {void}
   */
  setRateMultiplier(multiplier = 1) {
    const normalizedMultiplier = Number.isFinite(multiplier)
      ? Math.max(0, multiplier)
      : 1;
    this.setRate(this.configuredRate * normalizedMultiplier);
  }

  /**
   * Spawns and initializes a multiblock controller entity.
   *
   * Energy and fluid stored in the held item are restored into the new entity.
   * The optional callback is deferred slightly so custom machine setup can run
   * after the entity inventory and dynamic properties are ready.
   *
   * @param {{
   *   block: Block,
   *   player: Player,
   *   permutationToPlace: BlockPermutation,
   * }} e Placement event data used to create the entity.
   * @param {MachineSettings} config Multiblock machine configuration.
   * @param {(entity: Entity) => void} [callback]
   * Optional callback invoked after the entity has been created.
   */
  static spawnEntity(e, config, callback) {
    const { block, player, permutationToPlace } = e;
    const mainHand = player.getComponent("equippable").getEquipment("Mainhand");
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);
    const gasLine = mainHand?.getLore()?.find((line) => line.replace(/§./g, "").trim().startsWith("Gas ("));
    const gas = gasLine ? GasStorage.getGasFromText(gasLine) : undefined;

    system.run(() => {
      const entity = Utils.spawnEntity(block, { ...config, spawn_offset: { x: 0, y: -0.5, z: 0 } });
      const energyManager = new EnergyStorage(entity);
      energyManager.setCap(config?.machine?.energy_cap ?? 0);
      energyManager.set(energy);

      if (config?.machine?.fluid_cap) {
        const fluidManager = new FluidStorage(entity);
        fluidManager.setCap(config.machine.fluid_cap);

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }

      if (config?.machine?.gas_cap) {
        const gasManagers = GasStorage.initializeMultiple(entity, Math.max(1, Math.floor(config.machine.gas_types ?? 1)));
        for (const manager of gasManagers) manager.setCap(config.machine.gas_cap);
        if (gas && gas.amount > 0) {
          gasManagers[0].setType(gas.type);
          gasManagers[0].set(gas.amount);
        }
      }
      if (config?.machine?.gas_cap && config?.machine?.fluid_cap) {
        entity.triggerEvent("utilitycraft:fluid_gas_machine");
      } else if (config?.machine?.gas_cap) {
        entity.triggerEvent("utilitycraft:gas_machine");
      }
      ensureGasIOConfig(entity, block.typeId);

      system.runTimeout(() => {
        if (callback) {
          try {
            callback(entity);
          } catch {
            system.runTimeout(() => callback(entity), 2);
          }
        }
      }, 2);
    });

    Utils.updateAdjacentNetwork(block, permutationToPlace);
  }

  /**
   * Shared interaction pipeline for multiblock controller blocks.
   *
   * This centralizes the common pattern used by multiblock machines:
   * - optionally handle non-wrench interaction,
   * - spawn the controller entity when missing,
   * - run optional entity initialization,
   * - and activate the structure through `activateMachineController`.
   *
   * @param {{ block: Block, player: Player }} e Player interaction event.
   * @param {MachineSettings} config Controller machine configuration.
   * @param {{
   *   initializeEntity?: (entity: Entity, context: { e: object, player: Player, config: MachineSettings, settings: MachineSettings }) => void,
   *   onInteractWithoutWrench?: (context: { e: object, entity?: Entity, player: Player, config: MachineSettings, settings: MachineSettings }) => unknown,
   *   onActivate?: (context: object) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   * }} [handlers={}] Per-machine interaction hooks.
   * @returns {Promise<unknown>}
   */
  static async handlePlayerInteract(e, config, handlers = {}) {
    const {
      initializeEntity,
      onInteractWithoutWrench = this.defaultOnInteractWithoutWrench,
      onActivate,
      successMessages,
    } = handlers;
    const { block, player } = e;
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    const mainHandTypeId = DoriosLib.entity.getEquipment(player, "Mainhand")?.typeId ?? "";
    const isUsingWrench = mainHandTypeId.includes("wrench");

    if (!isUsingWrench) {
      return onInteractWithoutWrench?.({ e, entity, player, config, settings: config });
    }

    const activate = (targetEntity) =>
      this.activateMachineController(e, config, targetEntity, { onActivate, successMessages });

    if (!entity) {
      this.spawnEntity(e, config, (spawnedEntity) => {
        initializeEntity?.(spawnedEntity, { e, player, config, settings: config });
        void activate(spawnedEntity);
      });
      return;
    }

    return await activate(entity);
  }

  /**
   * Handles controller destruction and drops stored multiblock data into the item.
   *
   * Inventory contents are dropped, stored energy/fluid are written into lore,
   * and the controller entity is removed from the world.
   *
   * @param {{
   *   block: Block,
   *   brokenBlockPermutation: BlockPermutation,
   *   player?: Player,
   *   dimension: Dimension,
   * }} e Block break event data.
   * @returns {boolean} `true` if a controller entity was found and removed.
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

    if (energy.get() > 0) {
      lore.push(
        `§r§7  Energy: ${EnergyStorage.formatEnergyToText(energy.get())}/${EnergyStorage.formatEnergyToText(energy.cap)}`,
      );
    }

    if (fluid.type != MachineryConstants.EMPTY_FLUID_TYPE) {
      const liquidName = DoriosLib.text.capitalizeFirst(fluid.type);
      lore.push(
        `§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`,
      );
    }


    if (gas && gas.type !== MachineryConstants.EMPTY_GAS_TYPE && gas.get() > 0) {
      const gasName = DoriosLib.text.capitalizeFirst(gas.type);
      lore.push(
        `§r§7  Gas (${gasName}): ${GasStorage.formatGas(gas.get())}/${GasStorage.formatGas(gas.cap)}`,
      );
    }

    if (lore.length > 0) {
      blockItem.setLore(lore);
    }

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

      Utils.dropAllItems(entity);
      entity.remove();
      dim.spawnItem(blockItem, block.center());
    });

    return true;
  }

  /**
   * Detects, validates, and activates a multiblock controller.
   *
   * Activation flow:
   * - deactivates any previous multiblock state,
   * - scans the structure from the controller,
   * - validates required component counts,
   * - activates the structure and stores computed machine stats,
   * - runs optional activation hooks,
   * - and sends success messages to the player.
   *
   * @param {{ block: Block, player: Player }} e Interaction event data.
   * @param {MachineSettings} config Controller machine configuration.
   * @param {Entity} entity Controller entity to activate.
   * @param {{
   *   onActivate?: (context: {
   *     block: Block,
   *     components: Record<string, number>,
   *     config: MachineSettings,
   *     energyCap: number,
   *     entity: Entity,
   *     factoryData: object,
   *     player: Player,
   *     structure: object,
   *   }) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   * }} [handlers={}] Activation hooks for the machine.
   * @returns {Promise<object | undefined>} Activation context when successful.
   */
  static async activateMachineController(e, config, entity, handlers = {}) {
    const {
      onActivate,
      successMessages = [],
    } = handlers;
    const { block, player } = e;
    const requirements = config.requirements ?? {};

    DeactivationManager.deactivateMultiblock(block, player);

    const structure = await StructureDetector.detectFromController(e, config.required_case);
    if (!structure) return;

    const failure = this.validateRequirements(structure.components, requirements);
    if (failure) {
      player.sendMessage(failure.warning);
      DeactivationManager.deactivateMultiblock(block, player);
      return;
    }

    const energyCap = ActivationManager.activateMultiblock(entity, structure);
    const factoryData = this.computeMachineStats(structure.components);
    entity.setDynamicProperty("components", JSON.stringify(factoryData));

    const context = {
      block,
      components: structure.components,
      config,
      energyCap,
      entity,
      factoryData,
      player,
      settings: config,
      structure,
    };

    if (onActivate) {
      const result = await onActivate(context);
      if (result === false) {
        DeactivationManager.deactivateMultiblock(block, player);
        return;
      }
    }

    const messages =
      typeof successMessages === "function" ? successMessages(context) : successMessages;
    for (const message of messages) {
      if (message) player.sendMessage(message);
    }

    return context;
  }

  /**
   * Validates that the detected structure satisfies all component requirements.
   *
   * @param {Record<string, number>} components Detected component counts.
   * @param {Record<string, { amount: number, warning: string }>} requirements
   * Required component counts keyed by component id.
   * @returns {{ amount: number, warning: string } | undefined}
   * The first failed requirement, if any.
   */
  static validateRequirements(components, requirements) {
    for (const [componentId, requirement] of Object.entries(requirements)) {
      const amount = components[componentId] ?? 0;
      if (amount < requirement.amount) {
        return requirement;
      }
    }
  }

  /**
   * Distributes an output item stack across the machine output slots.
   *
   * Empty slots are filled first, then matching partial stacks are topped up.
   *
   * @param {MultiblockMachine} controller Machine runtime owning the inventory.
   * @param {number[]} outputSlots Candidate output slots.
   * @param {string} itemId Item identifier to insert.
   * @param {number} amount Total amount to distribute.
   * @param {{ suppressErrors?: boolean }} [options={}]
   * Optional insertion behavior flags.
   */
  static distributeOutput(controller, outputSlots, itemId, amount, options = {}) {
    const { suppressErrors = false } = options;
    let remaining = amount;
    const entity = controller.entity;

    for (const slot of outputSlots) {
      if (remaining <= 0) break;

      const writeOutput = () => {
        const out = controller.container.getItem(slot);

        if (!out) {
          const add = Math.min(64, remaining);
          DoriosLib.entity.setNewItem(entity, { slot: slot, typeId: itemId, amount: add });
          remaining -= add;
          return;
        }

        if (out.typeId === itemId && out.amount < out.maxAmount) {
          const add = Math.min(out.maxAmount - out.amount, remaining);
          DoriosLib.entity.changeItemAmount(entity, { slot: slot, amount: add });
          remaining -= add;
        }
      };

      if (suppressErrors) {
        try {
          writeOutput();
        } catch { }
      } else {
        writeOutput();
      }
    }
  }

  /**
   * Sets the current machine progress using its configured energy cost.
   *
   * @param {number} value New progress value.
   * @param {Object} [options={}]
   * @param {number} [options.slot=2] Inventory slot used to display progress.
   * @param {number} [options.maxValue=this.getEnergyCost(options.index)] Maximum progress value.
   * @param {boolean} [options.display=true] Whether to redraw the progress item.
   * @param {number} [options.index=0] Progress index.
   * @param {string} [options.type] Optional progress item prefix.
   */
  setProgress(value, options = {}) {
    const maxValue = options.maxValue ?? this.getEnergyCost(options.index);
    super.setProgress(value, maxValue, options);
  }

  /**
   * Displays progress using the configured multiblock energy cost.
   *
   * Supports direct calls with an options object and internal base-class calls
   * that provide `maxValue` and `options` separately.
   *
   * @param {number|Object} [maxValueOrOptions]
   * @param {Object} [maybeOptions]
   * @param {number} [maybeOptions.slot=2] Inventory slot used to display progress.
   * @param {number} [maybeOptions.maxValue=this.getEnergyCost(maybeOptions.index)] Maximum progress value.
   * @param {number} [maybeOptions.index=0] Progress index.
   * @param {string} [maybeOptions.type] Optional progress item prefix.
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

  /**
   * Sets the stored energy cost used as the default progress max value.
   *
   * @param {number} value Energy cost representing 100% progress.
   * @param {number} [index=0] Cost index for multi-process machines.
   */
  setEnergyCost(value, index = 0) {
    this.entity.setDynamicProperty(`${MachineryConstants.MACHINE_ENERGY_COST_PROPERTY_PREFIX}${index}`, Math.max(1, value));
  }

  /**
   * Gets the stored energy cost used as the default progress max value.
   *
   * @param {number} [index=0] Cost index for multi-process machines.
   * @returns {number} Current energy cost for the requested process.
   */
  getEnergyCost(index = 0) {
    return this.entity.getDynamicProperty(`${MachineryConstants.MACHINE_ENERGY_COST_PROPERTY_PREFIX}${index}`) ?? MachineryConstants.DEFAULT_PROGRESS_MAX;
  }

  /**
   * Computes machine runtime stats from detected multiblock components.
   *
   * @param {Record<string, number>} components Detected component counts.
   * @returns {{
   *   raw: { processing: number, speed: number, efficiency: number },
   *   processing: { amount: number, penalty: number },
   *   speed: { multiplier: number, penalty: number },
   *   efficiency: { multiplier: number },
   *   energyMultiplier: number,
   * }} Computed stats used by multiblock machine tick logic.
   */
  static computeMachineStats(components) {
    const processing = Math.max(1, components.processing_module | 0);
    const speed = Math.max(0, components.speed_module | 0);
    const efficiency = Math.max(0, components.efficiency_module | 0);

    const processAmount = 2 * processing;
    const processingPenalty = 1 + 2.25 * (processing - 1);

    const maxSpeedBonus = 999;
    const speedK = 3200;
    const speedMultiplier = 1 + (maxSpeedBonus * speed) / (speedK + speed);

    const maxSpeedPenalty = 99;
    const speedPenaltyK = 640;
    const speedPenalty = 1 + (maxSpeedPenalty * speed) / (speedPenaltyK + speed);

    const minEfficiency = 0.01;
    const efficiencyRate = 0.15;
    const efficiencyMultiplier =
      minEfficiency + (1 - minEfficiency) * Math.exp(-efficiencyRate * efficiency);

    return {
      raw: {
        processing,
        speed,
        efficiency,
      },
      processing: {
        amount: Math.floor(processAmount),
        penalty: processingPenalty,
      },
      speed: {
        multiplier: speedMultiplier,
        penalty: speedPenalty,
      },
      efficiency: {
        multiplier: efficiencyMultiplier,
      },
      energyMultiplier: processingPenalty * speedPenalty * efficiencyMultiplier,
    };
  }

  /**
   * Builds the shared machine-information section used by multiblock UIs.
   *
   * The cost is formatted exactly as provided by the machine. The label helper
   * does not apply batch or processing multipliers because cost semantics are
   * machine-specific.
   *
   * @param {ReturnType<typeof MultiblockMachine.computeMachineStats> & { cost?: number }} data
   * Computed machine stats plus the current machine cost.
   * @param {string} [status="§aRunning"] Current machine status text.
   * @returns {string} Formatted machine information label.
   */
  static getMachineInfoLabel(data, status = "§aRunning") {
    const processingAmount = data?.processing?.amount ?? 1;
    const speedMultiplier = data?.speed?.multiplier ?? 1;
    const energyMultiplier = data?.energyMultiplier ?? 1;
    const efficiency = energyMultiplier > 0
      ? (processingAmount / energyMultiplier) * 100
      : 0;
    const cost = Number.isFinite(data?.cost)
      ? EnergyStorage.formatEnergyToText(data.cost)
      : "---";

    return `§r§7Status: ${status}

§r§eMachine Information

§r§aInput Capacity §fx${processingAmount}
§r§aCost §f${cost}
§r§aSpeed §fx${speedMultiplier.toFixed(2)}
§r§aEfficiency §f${efficiency.toFixed(2)}%%
`;
  }

  /**
   * Builds the shared energy-information section used by multiblock UIs.
   *
   * `baseRate` is displayed instead of the scheduler-compensated burst rate so
   * the UI reports the average rate per game tick.
   *
   * @param {MultiblockMachine} controller Active multiblock controller.
   * @returns {string} Formatted energy information label.
   */
  static getEnergyInfoLabel(controller) {
    const energy = controller.energy;
    const baseRate = Number.isFinite(controller.baseRate) ? controller.baseRate : 0;

    return `§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bRate §f${EnergyStorage.formatEnergyToText(baseRate)}/t
`;
  }

  /**
   * Writes the standard machine information label into the controller UI.
   *
   * The returned newline padding string is useful when callers want to append
   * more sections below the base multiblock machine information block.
   *
   * @param {MultiblockMachine} controller Machine runtime receiving the label.
   * @param {ReturnType<typeof MultiblockMachine.computeMachineStats> & { cost?: number }} data
   * Computed machine stats plus optional cost data.
   * @param {string} [status="§aRunning"] Current machine status text.
   * @returns {string} Newline padding string for additional label sections.
   */
  static setMachineInfoLabel(controller, data, status = "§aRunning") {
    const infoText = this.getMachineInfoLabel(data, status);

    controller.setLabel(infoText, 1);
    return "\n".repeat(infoText.split("\n").length - 1);
  }
}

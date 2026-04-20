import { ItemStack, system } from "@minecraft/server";
import * as MachineryConstants from "../machinery/constants.js";
import { BasicMachine } from "../machinery/basicMachine.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import { ActivationManager } from "./activationManager.js";
import { DeactivationManager } from "./deactivationManager.js";
import { StructureDetector } from "./structureDetection.js";
import * as Utils from "../utils/entity.js";
import * as Constants from "./constants.js";

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
    super(block, config?.machine?.rate_speed_base ?? 0);
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
    const mainHandTypeId = player.getEquipment("Mainhand")?.typeId ?? "";
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
    const blockItemId = brokenBlockPermutation.type.id;
    const blockItem = new ItemStack(blockItemId);
    const lore = [];

    if (energy.get() > 0) {
      lore.push(
        `§r§7  Energy: ${EnergyStorage.formatEnergyToText(energy.get())}/${EnergyStorage.formatEnergyToText(energy.cap)}`,
      );
    }

    if (fluid.type != MachineryConstants.EMPTY_FLUID_TYPE) {
      const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
      lore.push(
        `§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`,
      );
    }

    if (lore.length > 0) {
      blockItem.setLore(lore);
    }

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
          entity.setItem(slot, itemId, add);
          remaining -= add;
          return;
        }

        if (out.typeId === itemId && out.amount < out.maxAmount) {
          const add = Math.min(out.maxAmount - out.amount, remaining);
          entity.changeItemAmount(slot, add);
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
   * Sets the current machine progress using legacy multiblock visuals.
   *
   * Multiblocks still rely on the classic 0-16 arrow textures, so this wrapper
   * keeps `legacy: true` and the expected scale while allowing callers to
   * provide the rest of the progress config as an object.
   *
   * @param {number} value New progress value.
   * @param {Object} [options={}]
   * @param {number} [options.slot=2] Inventory slot used to display progress.
   * @param {number} [options.maxValue=this.getEnergyCost(options.index)] Maximum progress value.
   * @param {boolean} [options.display=true] Whether to redraw the progress item.
   * @param {number} [options.index=0] Progress index.
   * @param {string} [options.type] Optional legacy progress item prefix.
   */
  setProgress(value, options = {}) {
    super.setProgress(value, {
      ...options,
      maxValue: options.maxValue ?? this.getEnergyCost(options.index),
    });
  }

  /**
   * Displays progress using the configured multiblock energy cost.
   *
   * @param {Object} [options={}]
   * @param {number} [options.slot=2] Inventory slot used to display progress.
   * @param {number} [options.maxValue=this.getEnergyCost(options.index)] Maximum progress value.
   * @param {number} [options.index=0] Progress index.
   * @param {string} [options.type] Optional legacy progress item prefix.
   */
  displayProgress(options = {}) {
    const energyCost = options.maxValue ?? this.getEnergyCost(options.index);
    if (!energyCost || energyCost <= 0) return;

    super.displayProgress(energyCost, {
      ...options,
    });
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
    const infoText = `§r§7Status: ${status}

§r§eMachine Information

§r§aInput Capacity §fx${data.processing.amount}
§r§aCost §f${data.cost ? EnergyStorage.formatEnergyToText(data.cost * data.processing.amount) : "---"}
§r§aSpeed §fx${data.speed.multiplier.toFixed(2)}
§r§aEfficiency §f${((data.processing.amount / data.energyMultiplier) * 100).toFixed(2)}%%
`;

    controller.setLabel(infoText, 1);
    return "\n".repeat(infoText.split("\n").length - 1);
  }
}

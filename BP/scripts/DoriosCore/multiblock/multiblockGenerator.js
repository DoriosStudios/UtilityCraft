import { ItemStack, system } from "@minecraft/server";
import { Generator } from "../machinery/generator.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import { ActivationManager } from "./activationManager.js";
import { DeactivationManager } from "./deactivationManager.js";
import { StructureDetector } from "./structureDetection.js";
import * as Utils from "../utils/entity.js";

export class MultiblockGenerator extends Generator {
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
   * Creates a multiblock generator runtime bound to a controller block.
   *
   * Unlike multiblock machines, generators may still need to tick while their
   * state is `off`, so validity is inherited directly from {@link Generator}.
   *
   * @param {Block} block Controller block representing the generator.
   * @param {GeneratorSettings} config Multiblock generator configuration.
   */
  constructor(block, config) {
    super(block, config);
    if (!this.valid) return;

    this.config = config;
    this.settings = config;
  }

  /**
   * Spawns a multiblock generator controller entity and reapplies its localized
   * container title after the base generator initialization finishes.
   *
   * Some generator initialization paths can leave the name tag unset or with an
   * unexpected value, so multiblock generators normalize it here using the
   * configured entity name.
   *
   * @param {{
   *   block: Block,
   *   player: Player,
   *   permutationToPlace: BlockPermutation,
   * }} e Placement event data used to create the entity.
   * @param {GeneratorSettings} config Multiblock generator configuration.
   * @param {(entity: Entity) => void} [callback]
   * Optional callback invoked after the entity has been created.
   */
  static spawnEntity(e, config, callback) {
    const { block, player } = e;

    const mainHand = player.getComponent("equippable").getEquipment("Mainhand")
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);

    system.run(() => {
      const entity = Utils.spawnEntity(block, { ...config, spawn_offset: { x: 0, y: -0.5, z: 0 } });
      const energyManager = new EnergyStorage(entity)
      energyManager.setCap(config?.generator?.energy_cap);
      energyManager.set(energy);
      energyManager.display();
      if (config.generator.fluid_cap) {
        const fluidManager = new FluidStorage(entity);
        fluidManager.setCap(config.generator.fluid_cap);
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
      });
    })
  }

  /**
   * Shared interaction pipeline for multiblock generator controller blocks.
   *
   * @param {{ block: Block, player: Player }} e Player interaction event.
   * @param {GeneratorSettings} config Controller generator configuration.
   * @param {{
   *   initializeEntity?: (entity: Entity, context: { e: object, player: Player, config: GeneratorSettings, settings: GeneratorSettings }) => void,
   *   onInteractWithoutWrench?: (context: { e: object, entity?: Entity, player: Player, config: GeneratorSettings, settings: GeneratorSettings }) => unknown,
   *   onActivate?: (context: object) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   * }} [handlers={}] Per-generator interaction hooks.
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
      this.activateGeneratorController(e, config, targetEntity, { onActivate, successMessages });

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
   * Detects, validates, and activates a multiblock generator controller.
   *
   * @param {{ block: Block, player: Player }} e Interaction event data.
   * @param {GeneratorSettings} config Controller generator configuration.
   * @param {Entity} entity Controller entity to activate.
   * @param {{
   *   onActivate?: (context: {
   *     block: Block,
   *     components: Record<string, number>,
   *     config: GeneratorSettings,
   *     energyCap: number,
   *     entity: Entity,
   *     player: Player,
   *     structure: object,
   *   }) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   * }} [handlers={}] Activation hooks for the generator.
   * @returns {Promise<object | undefined>} Activation context when successful.
   */
  static async activateGeneratorController(e, config, entity, handlers = {}) {
    const {
      onActivate,
      successMessages = [],
    } = handlers;
    const { block, player } = e;
    const requirements = config.requirements ?? {};
    const deactivateConfig = config.deactivateConfig;
    const fillBlocksConfig = config.fillBlocksConfig;
    const missingEnergyWarning = config.missingEnergyWarning;

    DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);

    const structure = await StructureDetector.detectFromController(e, config.required_case);
    if (!structure) return;

    const failure = this.validateRequirements(structure.components ?? {}, requirements);
    if (failure) {
      player.sendMessage(failure.warning);
      DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
      return;
    }

    const energyCap = ActivationManager.activateMultiblock(entity, structure, fillBlocksConfig);
    if (missingEnergyWarning && energyCap <= 0) {
      player.sendMessage(missingEnergyWarning);
      DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
      return;
    }

    const context = {
      block,
      components: structure.components,
      config,
      energyCap,
      entity,
      player,
      settings: config,
      structure,
    };

    if (onActivate) {
      const result = await onActivate(context);
      if (result === false) {
        DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
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
}

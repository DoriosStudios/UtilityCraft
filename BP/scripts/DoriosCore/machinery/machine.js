import { ItemStack, system, world } from "@minecraft/server";
import * as Constants from "./constants.js";
import { EnergyStorage } from "./energyStorage";
import { FluidStorage } from "./fluidStorage";
import { BasicMachine } from "./basicMachine";
import { Rotation } from "../utils/rotation";
import * as Utils from "../utils/entity";

export class Machine extends BasicMachine {
  /**
   * Creates a new Machine instance.
   *
   * @param {Block} block The block representing the machine.
   * @param {MachineSettings} settings Machine configuration.
   */
  constructor(block, settings) {
    const baseRate = settings.machine.rate_speed_base ?? 0
    super(block, { rate: baseRate, ignoreTick: settings.ignoreTick });
    if (!this.valid) return;

    this.settings = settings;
    const machineSettings = settings.machine;
    if (!machineSettings) return;

    if (machineSettings.upgrades) {
      this.upgrades = this.#getUpgradeLevels(machineSettings.upgrades);
      this.boosts = this.#calculateBoosts(this.upgrades);
      const adjustedRate = settings.machine.rate_speed_base * this.boosts.speed * this.boosts.consumption;
      this.setRate(adjustedRate)
    }
  }

  /**
   * Handles machine destruction:
   * - Drops inventory (excluding UI items).
   * - Drops the machine block item with stored energy and liquid info in lore.
   * - Removes the machine entity.
   * - Skips drop if the player is in Creative mode.
   *
   * @param {{ block: Block, brokenBlockPermutation: BlockPermutationplayer: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
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
      Utils.dropAllItems(entity);
      entity.remove();
      dim.spawnItem(blockItem, block.center());
    });
    return true;
  }

  /**
   * Spawns a machine entity at the specified block location and initializes
   * its energy and optional fluid storage based on the item held by the player.
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
   * @param {MachineSettings} config Machine configuration used to define
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
      });
    });
    Utils.updateAdjacentNetwork(block, permutationToPlace)
  }
  /**
   * Transfers items from this machine toward the opposite direction
   * of its current facing axis (`utilitycraft:axis`).
   *
   * ## Behavior
   * - Reads `utilitycraft:axis` from the block permutation.
   * - Determines the **opposite direction vector** (e.g. east → west).
   * - Finds the block located in that opposite direction.
   * - Calls {@link DoriosAPI.containers.transferItemsAt} to move items to the target container.
   *
   * Compatible with:
   * - Vanilla containers (chests, barrels, hoppers, etc.)
   * - Dorios containers and machines with inventories
   *
   * @param {"simple" | "complex"} [type="simple"]
   * Determines which slots to transfer:
   * - `"simple"` → transfers only the **last slot** (output).
   * - `"complex"` → transfers the **last 9 slots** (outputs).
   *
   * @returns {boolean} True if the transfer was attempted, false otherwise.
   */
  transferItems() {
    const facing = this.block.getState("utilitycraft:axis");
    if (!facing) return false;

    // Opposite direction vectors
    const opposites = {
      east: [-1, 0, 0],
      west: [1, 0, 0],
      north: [0, 0, 1],
      south: [0, 0, -1],
      up: [0, -1, 0],
      down: [0, 1, 0],
    };

    const offset = opposites[facing];
    if (!offset) return false;

    const { x, y, z } = this.block.location;
    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };

    // Determine slot range based on type
    const range = DoriosAPI.containers.getAllowedOutputRange(this.entity);

    // Execute transfer using DoriosAPI
    DoriosAPI.containers.transferItemsAt(this.container, targetLoc, this.dimension, range);
    return true;
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

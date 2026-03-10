import { ItemStack, system } from "@minecraft/server";
import { BasicMachine } from "./basicMachine";
import { Energy } from "./energyManager";
import { FluidManager } from "./fluidManager";
import * as Utils from "../utils/entity";

export class Generator extends BasicMachine {
  /**
   * Creates a new Generator instance.
   *
   * @param {Block} block The block representing the generator.
   * @param {GeneratorSettings} settings Generator configuration.
   */
  constructor(block, settings) {
    const baseRate = settings?.generator?.rate_speed_base ?? 0;
    super(block, baseRate);
    if (!this.valid) return;
    this.settings = settings;
  }

  /**
   * Handles generator destruction:
   * - Drops inventory (excluding UI items).
   * - Drops the generator block item with stored energy and liquid info in lore.
   * - Removes the generator entity.
   * - Skips drop if the player is in Creative mode.
   *
   * @param {{ block: Block, brokenBlockPermutation: BlockPermutationplayer: Player, dimension: Dimension }} e The event data object containing the dimension, block and player.
   */
  static onDestroy(e) {
    const { block, brokenBlockPermutation, player, dimension: dim } = e;
    const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return false;

    const energy = new Energy(entity);
    const fluid = new FluidManager(entity);
    const blockItemId = brokenBlockPermutation.type.id;
    const blockItem = new ItemStack(blockItemId);
    const lore = [];

    // Energy lore
    if (energy.get() > 0) {
      lore.push(`§r§7  Energy: ${Energy.formatEnergyToText(energy.get())}/${Energy.formatEnergyToText(energy.cap)}`);
    }

    if (fluid.type != "empty") {
      const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
      lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
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
   * Spawns a generator entity at the specified block location and initializes
   * its energy and optional fluid storage based on the item held by the player.
   *
   * The function reads energy and fluid values from the lore of the item in the
   * player's main hand, then applies those values to the newly created entity.
   *
   * After spawning, the entity's energy capacity, fluid capacity (if defined),
   * and display elements are initialized. Nearby machines are also registered
   * and adjacent pipe networks are updated.
   *
   * @param {{
   *   block: import("@minecraft/server").Block,
   *   player: import("@minecraft/server").Player,
   *   permutationToPlace: import("@minecraft/server").BlockPermutation
   * }} e Event data containing the block location, player, and block permutation.
   *
   * @param {GeneratorSettings} config Generator configuration used to define
   * the entity name, inventory size, and machine capacities.
   *
   * @param {(entity: import("@minecraft/server").Entity) => void} [callback]
   * Optional function executed after the entity has been spawned and initialized.
   */
  static spawnEntity(e, config, callback) {
    const { block, player, permutationToPlace } = e;

    const mainHand = player.getComponent("equippable").getEquipment("Mainhand")
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);

    system.run(() => {
      const entity = Utils.spawnEntity(block, config)
      const energyManager = new Energy(entity)
      energyManager.setCap(config.generator.energy_cap);
      energyManager.set(energy);
      energyManager.display();
      if (config.generator.fluid_cap) {
        const fluidManager = new FluidManager(entity);
        fluidManager.setCap(config.generator.fluid_cap);
        fluidManager.display();

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }
      this.addNearbyMachines(entity);
      system.runTimeout(() => {
        if (callback) try {
          callback(entity);
        } catch {
          system.runTimeout(() => callback(entity), 2)
        }
      }, 2);
    })

    Utils.updateAdjacentNetwork(block, permutationToPlace)
  }

  /**
   * Adds tags to the entity for all adjacent blocks (6 directions) around it.
   *
   * - Each tag follows the format: `pos:[x,y,z]`
   * - This is used by energy transfer functions to identify nearby machines.
   * - Adds positions in all cardinal directions: North, South, East, West, Up, Down.
   *
   * @param {Entity} entity The entity (usually a generator or battery) to tag with nearby positions.
   */
  static addNearbyMachines(entity) {
    let { x, y, z } = entity.location;
    const directions = [
      [1, 0, 0], // East
      [-1, 0, 0], // West
      [0, 1, 0], // Up
      [0, -1, 0], // Down
      [0, 0, 1], // South
      [0, 0, -1], // North
    ];

    for (const [dx, dy, dz] of directions) {
      const xf = x + dx;
      const yf = y + dy;
      const zf = z + dz;
      entity.addTag(`pos:[${xf},${yf},${zf}]`);
    }
  }

  /**
   * Opens a modal form for selecting transfer mode.
   *
   * Modes:
   *  - nearest → send energy/fluid to closest target first.
   *  - farthest → send to farthest target first.
   *  - round → distribute evenly across all connected targets.
   *
   * @param {Entity} entity The generator entity.
   * @param {Player} player The interacting player.
   */
  static openGeneratorTransferModeMenu(entity, player) {
    if (!entity || !player) return;

    const mode = entity.getDynamicProperty("transferMode") ?? "nearest";
    const modes = ["Nearest", "Farthest", "Round"];
    const currentIndex = modes.findIndex((m) => m.toLowerCase() === mode);
    const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

    const modal = new ModalFormData().title("Generator Transfer Mode").dropdown("Select how this generator distributes its output:", modes, {
      defaultValueIndex: defaultIndex,
    });

    modal.show(player).then((result) => {
      if (result.canceled) return;

      const [selection] = result.formValues;
      const newMode = modes[selection]?.toLowerCase() ?? "nearest";

      entity.setDynamicProperty("transferMode", newMode);
      player.onScreenDisplay.setActionBar(`§7Transfer mode set to: §e${DoriosAPI.utils.capitalizeFirst(newMode)}`);
    });
  }
}

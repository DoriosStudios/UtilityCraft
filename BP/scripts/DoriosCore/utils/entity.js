import { ItemStack, system } from "@minecraft/server";
import * as GlobalConstants from "../constants.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import * as Constants from "./constants.js";

/**
 * Determines whether the current tick should execute machine logic.
 *
 * This function checks if the global tick counter aligns with the
 * configured tickSpeed interval. It is used to throttle machine
 * processing logic to avoid running every single game tick.
 *
 * Example:
 * - tickSpeed = 10 → logic runs every 10 ticks
 * - tickSpeed = 1  → logic runs every tick
 *
 * @function shouldProcess
 * @returns {boolean} True if the current tick matches the configured processing interval.
 */
export function shouldProcess() {
  return (
    globalThis[GlobalConstants.GLOBAL_TICK_COUNT_KEY] % globalThis[GlobalConstants.GLOBAL_TICK_SPEED_KEY] === 0 &&
    globalThis[GlobalConstants.GLOBAL_WORLD_LOADED_KEY]
  );
}

/**
 * Ensures that the given entity has a valid scoreboard identity.
 *
 * If an entity does not yet have one, its `scoreboardIdentity` will be `undefined`.
 * Running this method forces the entity to be registered in the scoreboard system
 * by setting its `energy` objective to `0`.
 *
 * @param {import("@minecraft/server").Entity} entity The entity representing the machine.
 * @returns {void}
 */
export function initializeEntity(entity) {
  entity.runCommand(`scoreboard players set @s energy 0`);
}

/**
 * Attempts to retrieve the first entity located at a given block's position.
 *
 * This is commonly used in machine systems where a controller block
 * has a paired entity storing inventory, energy, or dynamic data.
 *
 * If no entity exists at the block location, the function returns undefined.
 *
 * @function tryGetEntityFromBlock
 * @param {import("@minecraft/server").Block} block The block to inspect.
 * @returns {import("@minecraft/server").Entity | undefined} The first entity found at the block location, or undefined if none exist.
 */
export function tryGetEntityFromBlock(block) {
  return block.dimension.getEntitiesAtBlockLocation(block.location)[0];
}


/**
 * Attempts to resolve the block currently represented by a machine entity.
 *
 * Machine helper entities are spawned with a small offset, so the lookup uses
 * floored coordinates to reach the owning block position.
 *
 * @param {import("@minecraft/server").Entity} entity The helper entity to inspect.
 * @returns {import("@minecraft/server").Block | undefined} The block under the entity, if available.
 */
export function tryGetBlockFromEntity(entity) {
  if (!entity?.dimension || !entity.location) {
    return undefined;
  }

  return entity.dimension.getBlock({
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z),
  });
}

/**
 * Returns the block type id represented by a machine helper entity.
 *
 * Preference order:
 * 1. Current block under the entity (keeps renamed/swapped machines accurate)
 * 2. Persisted dynamic property written at spawn time
 *
 * @param {import("@minecraft/server").Entity} entity The helper entity to inspect.
 * @returns {string | undefined} Represented block type id.
 */
export function getRepresentedBlockId(entity) {
  const block = tryGetBlockFromEntity(entity);
  if (typeof block?.typeId === "string" && block.typeId.length > 0 && block.typeId !== "minecraft:air") {
    return block.typeId;
  }

  try {
    const storedBlockId = entity?.getDynamicProperty?.(Constants.MACHINE_BLOCK_ID_PROPERTY_ID);
    if (typeof storedBlockId === "string" && storedBlockId.trim().length > 0) {
      return storedBlockId.trim();
    }
  } catch {
    // Ignore dynamic property access failures.
  }

  return undefined;
}

function persistRepresentedBlockId(entity, blockId) {
  if (!entity || typeof blockId !== "string" || blockId.length === 0) {
    return;
  }

  try {
    entity.setDynamicProperty(Constants.MACHINE_BLOCK_ID_PROPERTY_ID, blockId);
  } catch {
    // Ignore environments where the property is not registered yet.
  }
}

/**
 * Spawns a UtilityCraft machine entity at the given block location
 * and initializes its inventory size and name tag.
 *
 * This version does NOT handle special machine types.
 * It only triggers the inventory event and assigns a name tag.
 *
 * @param {import("@minecraft/server").Block} block The block where the machine will be placed.
 * @param {Object} config Machine configuration object.
 * @param {Object} config.entity Entity configuration.
 * @param {string} [config.entity.identifier] Entity identifier.
 * @param {number} config.entity.inventory_size Inventory slot count.
 * @param {string} [config.entity.name] Optional name.
 * @param {[number, number]} [config.entity.input_range] Input slot range.
 * @param {[number, number]} [config.entity.output_range] Output slot range.
 * @param {number} [config.entity.input_slot] Single input slot.
 * @param {number} [config.entity.output_slot] Single output slot.
 * @param {{x:number,y:number,z:number}} [config.spawn_offset] Optional spawn offset.
 *
 * @returns {import("@minecraft/server").Entity} The spawned entity.
 */
export function spawnEntity(block, config) {
  const { entity: entityData, spawn_offset = Constants.DEFAULT_MACHINE_SPAWN_OFFSET } = config;
  const dimension = block.dimension;

  const center = block.center();
  const location = {
    x: center.x + spawn_offset.x,
    y: center.y + spawn_offset.y,
    z: center.z + spawn_offset.z,
  };

  const identifier = entityData.identifier ?? GlobalConstants.DEFAULT_ENTITY_ID;
  const entity = dimension.spawnEntity(identifier, location);

  const inventorySize = entityData.inventory_size ?? 1;
  try {
    entity.triggerEvent(`utilitycraft:inventory_${inventorySize}`);
  } catch { }

  const name = entityData.name ?? block.typeId.split(":")[1];
  entity.nameTag = `entity.utilitycraft:${name}.name`;
  persistRepresentedBlockId(entity, block.typeId);

  // Normalize slot config independently
  const inputRange =
    Array.isArray(entityData.input_range)
      ? entityData.input_range
      : typeof entityData.input_slot === "number"
        ? [entityData.input_slot, entityData.input_slot]
        : undefined;

  const outputRange =
    Array.isArray(entityData.output_range)
      ? entityData.output_range
      : typeof entityData.output_slot === "number"
        ? [entityData.output_slot, entityData.output_slot]
        : undefined;

  if (inputRange || outputRange) {
    registerSlotConfig(entity, {
      input_range: inputRange,
      output_range: outputRange,
      block_id: block.typeId
    });
  }

  initializeEntity(entity);

  if (entityData.type) {
    entity.triggerEvent(`utilitycraft:${entityData.type}`);
  }

  return entity;
}

/**
 * Registers slot configuration for a machine container.
 *
 * Sends slot data to multiple compatibility systems:
 * - Dorios internal container config
 * - AE2BE container registry
 * - Item Ducts compatibility
 *
 * @param {import("@minecraft/server").Entity} entity The entity that owns the container.
 * @param {{ input_range?: number[], output_range?: number[], block_id: String }} config Slot configuration object.
 */
export function registerSlotConfig(entity, config) {
  const slotRegister = {};

  let inputSlots = [];
  let outputSlots = [];

  const rangeToSlots = (range) => {
    const [start, end] = range;
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  };

  const validRange = (range) =>
    Array.isArray(range) &&
    range.length === 2 &&
    typeof range[0] === "number" &&
    typeof range[1] === "number";

  const inputRange = validRange(config.input_range) ? config.input_range : [-1, -1];
  const outputRange = validRange(config.output_range) ? config.output_range : [-1, -1];

  slotRegister.input = inputRange;
  slotRegister.output = outputRange;

  if (inputRange[0] !== -1) {
    inputSlots = rangeToSlots(inputRange);
  }

  if (outputRange[0] !== -1) {
    outputSlots = rangeToSlots(outputRange);
  }

  // Dorios internal config
  entity.runCommand(
    `scriptevent ${Constants.SPECIAL_CONTAINER_EVENT_ID} ${JSON.stringify(slotRegister)}`
  );

  // AE2BE container registry
  // system.sendScriptEvent(
  //   "ae2be://api/v1/container-registry",
  //   JSON.stringify({
  //     typeId: entity.typeId,
  //     containerType: "entity",
  //     container: {
  //       insertsItems: true,
  //       useStorageBus: {
  //         excludedSlots: inputSlots
  //       },
  //       inputSlots,
  //       outputSlots
  //     }
  //   })
  // );

  // Item Ducts compatibility
  entity.runCommand(
    `scriptevent ${Constants.ITEM_DUCTS_REGISTER_EVENT_ID} ${JSON.stringify({
      typeId: config.block_id,
      extractSlots: outputSlots,
      insertSlots: inputSlots
    })}`
  );
}

/**
 * Updates nearby pipe networks based on the block's tags.
 *
 * The function schedules a delayed update that triggers the
 * `dorios:updatePipes` script event for adjacent networks.
 *
 * The `block` parameter provides the world location used for the update,
 * while the `permutationToPlace` parameter is used to check block tags
 * (e.g. energy, item, or fluid networks).
 *
 * @param {import("@minecraft/server").Block} block The block whose location will be used to update adjacent networks.
 * @param {import("@minecraft/server").BlockPermutation} [permutationToPlace=block.permutation] Optional permutation used to read tags (e.g. when placing a new block).
 */
export function updateAdjacentNetwork(block, permutationToPlace = block.permutation) {
  let { x, y, z } = block.location;
  system.runTimeout(() => {
    if (permutationToPlace.hasTag(Constants.ENERGY_BLOCK_TAG)) {
      block.dimension.runCommand(`execute as @n run scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} energy|[${x},${y},${z}]`);
    }

    if (permutationToPlace.hasTag(Constants.ITEM_BLOCK_TAG)) {
      block.dimension.runCommand(`execute as @n run scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} item|[${x},${y},${z}]`);
    }

    if (permutationToPlace.hasTag(Constants.FLUID_BLOCK_TAG)) {
      block.dimension.runCommand(`execute as @n run scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} fluid|[${x},${y},${z}]`);
    }
  }, 2);
}

/**
 * Extracts stored energy and fluid information from an item's lore.
 *
 * The function reads the lore lines of an ItemStack and attempts to
 * parse energy and fluid values using the EnergyStorage and FluidStorage helpers.
 *
 * Expected lore format examples:
 *   "§eEnergy: 25,000 FE"
 *   "§bWater: 4,000 mB"
 *
 * @param {import("@minecraft/server").ItemStack} item The item to read lore from.
 * @returns {{
 *   energy: number,
 *   fluid?: { type: string, amount: number }
 * }} Parsed energy and fluid data.
 */
export function getEnergyAndFluidFromItem(item) {
  const lore = item?.getLore() ?? [];

  let energy = 0;
  let fluid = undefined;

  if (lore[0] && lore[0].includes("Energy")) {
    energy = EnergyStorage.getEnergyFromText(lore[0]);
  }

  const nextLine = energy > 0 ? lore[1] : lore[0];

  if (nextLine) {
    fluid = FluidStorage.getFluidFromText(nextLine);
  }

  return { energy, fluid };
}

/**
 * Drops all items from a machine entity's inventory except UI elements.
 *
 * @param {Entity} entity The machine entity whose items will be dropped.
 */
export function dropAllItems(entity) {
  const inv = entity.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  const dim = entity.dimension;
  const center = entity.location;

  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (!item) continue;

    // Skip UI items
    let shouldContinue = false;
    if (Constants.UI_ITEM_TAGS.some((tag) => item.hasTag(tag))) continue;
    item.getTags().forEach((tag) => {
      if (tag.includes("ui")) {
        shouldContinue = true;
        return;
      }
    });
    if (shouldContinue) continue;

    dim.spawnItem(item, center);
    inv.setItem(i, undefined);
  }
}

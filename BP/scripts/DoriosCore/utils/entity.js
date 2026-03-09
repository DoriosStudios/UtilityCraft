import { ItemStack, system } from "@minecraft/server";
import * as Constants from "../constants";

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
  return (globalThis.tickCount % globalThis.tickSpeed == 0 && globalThis.worldLoaded);
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

const configExample = {
  entity: {
    identifier: "utilitycraft:machine",
    type: "",
    name: "example",
    inventory_size: 10,
    input_range: [3, 6],
    output_range: [7, 10]
  },
  spawn_offset: { x: 0, y: -0.2, z: 0 },
};

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
 * @param {number} [config.entity.input_range] Input slot range.
 * @param {number} [config.entity.output_range] Output slot range.
 * @param {{x:number,y:number,z:number}} [config.spawn_offset] Optional spawn offset.
 *
 * @returns {import("@minecraft/server").Entity} The spawned entity.
 */
export function spawnEntity(block, config) {
  const { entity: entityData, spawn_offset = { x: 0, y: -0.25, z: 0 } } = config;
  const dimension = block.dimension;

  // Base position
  const center = block.center();
  const location = {
    x: center.x + spawn_offset.x,
    y: center.y + spawn_offset.y,
    z: center.z + spawn_offset.z,
  };

  const identifier = entityData.identifier ?? Constants.DEFAULT_ENTITY_ID;

  const entity = dimension.spawnEntity(identifier, location);

  // Trigger inventory event
  const inventorySize = entityData.inventory_size ?? 1;
  entity.triggerEvent(`utilitycraft:inventory_${inventorySize}`);

  // Assign name
  const name = entityData.name ?? block.typeId.split(":")[1];
  entity.nameTag = `entity.utilitycraft:${name}.name`;

  // Register slots config
  if (entityData.input_range || entityData.output_range) {
    registerSlotConfig(entity, {
      input_range: entityData.input_range,
      output_range: entityData.output_range,
      block_id: block.typeId
    })
  } else if (entityData.input_slot || entityData.output_slot) {
    registerSlotConfig(entity, {
      input_range: [entityData.input_slot, entityData.input_slot],
      output_range: [entityData.output_slot, entityData.output_slot],
      block_id: block.typeId
    })
  }

  // Initialize Entity
  initializeEntity(entity)

  // Machine type
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
    `scriptevent dorios:special_container ${JSON.stringify(slotRegister)}`
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
    `scriptevent item_ducts:register ${JSON.stringify({
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
    if (permutationToPlace.hasTag("dorios:energy")) {
      block.dimension.runCommand(`execute as @n run scriptevent dorios:updatePipes energy|[${x},${y},${z}]`);
    }

    if (permutationToPlace.hasTag("dorios:item")) {
      block.dimension.runCommand(`execute as @n run scriptevent dorios:updatePipes item|[${x},${y},${z}]`);
    }

    if (permutationToPlace.hasTag("dorios:fluid")) {
      block.dimension.runCommand(`execute as @n run scriptevent dorios:updatePipes fluid|[${x},${y},${z}]`);
    }
  }, 2);
}

/**
 * Extracts stored energy and fluid information from an item's lore.
 *
 * The function reads the lore lines of an ItemStack and attempts to
 * parse energy and fluid values using the Energy and FluidManager helpers.
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
    energy = Energy.getEnergyFromText(lore[0]);
  }

  const nextLine = energy > 0 ? lore[1] : lore[0];

  if (nextLine) {
    fluid = FluidManager.getFluidFromText(nextLine);
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
    if (item.hasTag("utilitycraft:ui_element")) continue;
    if (item.hasTag("utilitycraft:ui.element")) continue;
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

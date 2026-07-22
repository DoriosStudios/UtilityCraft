// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, GasStorage } from "DoriosCore/index.js";
import * as Constants from "../DoriosCore/machinery/constants.js";

const INFINITE_TANK_ENTITY_ID = "utilitycraft:infinite_tank";
const RESOURCE_TYPES = new Set(["fluid", "gas"]);

/**
 * @typedef {object} InfiniteTankParams
 * @property {"fluid"|"gas"} resource
 * @property {string} type
 */

/** @param {unknown} value @returns {InfiniteTankParams|undefined} */
function normalizeParams(value) {
  if (!value || typeof value !== "object") return undefined;
  const params = /** @type {{resource?:unknown,type?:unknown}} */ (value);
  if (typeof params.resource !== "string" || !RESOURCE_TYPES.has(params.resource)) return undefined;
  if (typeof params.type !== "string" || params.type.length === 0 || params.type === "empty") return undefined;
  return /** @type {InfiniteTankParams} */ ({ resource: params.resource, type: params.type });
}

/** @param {import("@minecraft/server").Block} block */
function getTankEntity(block) {
  return block.dimension.getEntitiesAtBlockLocation(block.location)
    .find((entity) => entity.typeId === INFINITE_TANK_ENTITY_ID);
}

/**
 * Creates and initializes the generic backing entity.
 * @param {import("@minecraft/server").Block} block
 * @param {InfiniteTankParams} params
 */
function createTankEntity(block, params) {
  getTankEntity(block)?.remove();

  const entity = block.dimension.spawnEntity(INFINITE_TANK_ENTITY_ID, block.center());
  entity.triggerEvent(`utilitycraft:${params.resource}`);
  entity.addTag(Constants.INFINITE_STORAGE_TAG);

  if (params.resource === "fluid") {
    entity.addTag(Constants.CONSTANT_FLUID_TYPE_TAG);
    FluidStorage.initializeObjectives(0);
    FluidStorage.initialize(entity);
    const storage = new FluidStorage(entity, 0);
    storage.setCap(Constants.INFINITE_STORAGE_CAPACITY);
    storage.setType(params.type);
    storage.set(Constants.INFINITE_STORAGE_CAPACITY);
  } else {
    entity.addTag(Constants.CONSTANT_GAS_TYPE_TAG);
    GasStorage.initializeObjectives(0);
    GasStorage.initialize(entity);
    const storage = new GasStorage(entity, 0);
    storage.setCap(Constants.INFINITE_STORAGE_CAPACITY);
    storage.setType(params.type);
    storage.set(Constants.INFINITE_STORAGE_CAPACITY);
  }

  return entity;
}

/**
 * Uses registered resource items directly against the fixed storage.
 * @param {import("@minecraft/server").Block} block
 * @param {import("@minecraft/server").Player} player
 * @param {InfiniteTankParams} params
 */
function interactWithTank(block, player, params) {
  const entity = getTankEntity(block);
  if (!entity) return;

  const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");
  if (!mainHand) {
    player.onScreenDisplay.setActionBar(
      `§b${DoriosLib.text.formatIdentifier(params.type)}: §fInfinite`,
    );
    return;
  }

  if (params.resource === "fluid") {
    const storage = new FluidStorage(entity, 0);
    const result = storage.fluidItem(mainHand.typeId);
    if (result === false) return;
    FluidStorage.replaceHeldFluidItem(player, mainHand.typeId, result || undefined);
  } else {
    const storage = new GasStorage(entity, 0);
    const result = storage.gasItem(mainHand.typeId);
    if (result === false) return;
    GasStorage.replaceHeldGasItem(player, mainHand.typeId, result || undefined);
  }

  player.onScreenDisplay.setActionBar(
    `§b${DoriosLib.text.formatIdentifier(params.type)}: §fInfinite`,
  );
}

DoriosLib.registry.blockComponent("utilitycraft:infinite_tank", {
  onPlace({ block }, { params }) {
    const config = normalizeParams(params);
    if (!config) {
      console.warn(`[UtilityCraft] Invalid infinite tank configuration on ${block.typeId}`);
      return;
    }
    createTankEntity(block, config);
  },

  onBreak({ block }) {
    getTankEntity(block)?.remove();
  },

  onPlayerInteract({ block, player }, { params }) {
    if (!player) return;
    const config = normalizeParams(params);
    if (!config) return;
    interactWithTank(block, player, config);
  },
});

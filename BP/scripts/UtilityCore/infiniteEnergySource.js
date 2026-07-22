// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Generator, TickScheduler } from "DoriosCore/index.js";
import * as EntityUtils from "../DoriosCore/utils/entity.js";
import * as Constants from "../DoriosCore/machinery/constants.js";

const ENTITY_ID = "utilitycraft:machine_entity";
const DEFAULT_RATE = 10_000;
const ENTITY_SETTINGS = {
  name: "infinite_energy_source",
  type: "generator",
  inventory_size: 2,
};

/** @param {unknown} value */
function getRate(value) {
  const params = value && typeof value === "object"
    ? /** @type {{rate_speed_base?:unknown}} */ (value)
    : undefined;
  const rate = Number(params?.rate_speed_base ?? DEFAULT_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE;
}

/** @param {import("@minecraft/server").Block} block */
function getSourceEntity(block) {
  return block.dimension.getEntitiesAtBlockLocation(block.location)
    .find((entity) => entity.typeId === ENTITY_ID && entity.hasTag(Constants.INFINITE_STORAGE_TAG));
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {number} rate
 */
function createSourceEntity(block, rate) {
  const existing = getSourceEntity(block);
  if (existing) {
    TickScheduler.releaseTickGroup(existing);
    existing.remove();
  }

  const entity = EntityUtils.spawnEntity(block, {
    entity: ENTITY_SETTINGS,
    generator: {
      energy_cap: Constants.INFINITE_STORAGE_CAPACITY,
      rate_speed_base: rate,
    },
  });
  entity.addTag(Constants.INFINITE_STORAGE_TAG);

  EnergyStorage.initializeObjectives();
  const energy = new EnergyStorage(entity);
  energy.setCap(Constants.INFINITE_STORAGE_CAPACITY);
  energy.set(Constants.INFINITE_STORAGE_CAPACITY);

  EntityUtils.updateAdjacentNetwork(block);
  return entity;
}

DoriosLib.registry.blockComponent("utilitycraft:infinite_energy_source", {
  onPlace({ block }, { params }) {
    createSourceEntity(block, getRate(params));
  },

  onTick({ block }, { params }) {
    const rate = getRate(params);
    const generator = new Generator(block, {
      entity: ENTITY_SETTINGS,
      generator: {
        energy_cap: Constants.INFINITE_STORAGE_CAPACITY,
        rate_speed_base: rate,
      },
    });
    if (!generator.valid) return;

    const transferred = generator.energy.transferToNetwork(generator.rate);
    generator.displayEnergy();
    generator.setLabel(`
§r§eInfinite Energy Source

§r§bStored §fInfinite
§r§cOutput §f${EnergyStorage.formatEnergyToText(transferred)}/t
    `);
  },

  onBreak({ block, brokenBlockPermutation }) {
    const entity = getSourceEntity(block);
    if (entity) {
      TickScheduler.releaseTickGroup(entity);
      entity.remove();
    }
    EntityUtils.updateAdjacentNetwork(block, brokenBlockPermutation);
  },
});

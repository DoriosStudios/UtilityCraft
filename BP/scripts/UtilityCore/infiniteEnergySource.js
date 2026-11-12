// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Generator, TickScheduler } from "DoriosCore/index.js";
import * as EntityUtils from "../DoriosCore/utils/entity.js";
import * as Constants from "../DoriosCore/machinery/constants.js";
import { clearBlockOwner, getBlockOwner } from "../DoriosCore/utils/blockOwner.js";

const ENTITY_ID = "utilitycraft:machine_entity";
const DEFAULT_RATE = Constants.INFINITE_STORAGE_CAPACITY;
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

/**
 * Resolves the persisted block owner for an infinite energy source.
 *
 * @param {import("@minecraft/server").Block} block Source block.
 * @returns {object|undefined} Tagged block owner, or undefined when inactive.
 */
function getSourceEntity(block) {
  const owner = getBlockOwner(block);
  return owner.hasTag(Constants.INFINITE_STORAGE_TAG) ? owner : undefined;
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
    const transferRate = transferred / generator.processingInterval;
    generator.displayEnergy();
    generator.setLabel(`
§r§eInfinite Energy Source

§r§bStored §fInfinite
§r§cOutput §f${EnergyStorage.formatEnergyToText(transferRate)}/t
    `);
  },

  onBreak({ block, brokenBlockPermutation }) {
    const entity = getSourceEntity(block);
    if (entity) {
      TickScheduler.releaseTickGroup(entity);
      clearBlockOwner(block);
    }
    EntityUtils.updateAdjacentNetwork(block, brokenBlockPermutation);
  },
});

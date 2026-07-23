// @ts-check

import { system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

/**
 * @typedef {object} CoolantDefinition
 * @property {number} efficiency Consumption divisor. A value of 2 halves coolant usage.
 * @property {number} tier Compatibility tier for machines that use coolant tiers.
 */

/** @type {Record<string, CoolantDefinition>} */
export const coolants = {};

/** @type {Record<string, CoolantDefinition>} */
const defaultCoolants = {
  water: {
    efficiency: 1,
    tier: 0,
  },
};

world.afterEvents.worldLoad.subscribe(() => {
  DoriosLib.registry.registerCoolant(defaultCoolants);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
  if (id !== DoriosLib.registry.REGISTRATION_EVENT_IDS.COOLANT) return;

  try {
    const payload = JSON.parse(message);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

    for (const [fluidType, data] of Object.entries(payload)) {
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;

      const efficiency = Number(data.efficiency);
      if (!Number.isFinite(efficiency) || efficiency <= 0) continue;

      coolants[fluidType] = {
        efficiency,
        tier: Number.isFinite(data.tier) ? Number(data.tier) : 0,
      };
    }
  } catch (error) {
    console.warn("[UtilityCraft] Failed to parse coolant registration payload:", error);
  }
});

// @ts-check

import { MachineUpgradeRegistry } from "DoriosCore/index.js";

MachineUpgradeRegistry.register("utilitycraft:speed_upgrade", {
  type: "speed",
  levels: {
    1: { speed: 0.25, speed_level: 1, energy_cost: 0.25 },
    2: { speed: 0.75, speed_level: 2, energy_cost: 0.75 },
    3: { speed: 1.5, speed_level: 3, energy_cost: 1.5 },
    4: { speed: 2.5, speed_level: 4, energy_cost: 2.5 },
    5: { speed: 3.75, speed_level: 5, energy_cost: 3.75 },
    6: { speed: 5.25, speed_level: 6, energy_cost: 5.25 },
    7: { speed: 7, speed_level: 7, energy_cost: 7 },
    8: { speed: 9, speed_level: 8, energy_cost: 9 },
  },
});

MachineUpgradeRegistry.register("utilitycraft:energy_upgrade", {
  type: "energy",
  levels: {
    1: { energy_efficiency: 0.25 },
    2: { energy_efficiency: 2 / 3 },
    3: { energy_efficiency: 1.5 },
    4: { energy_efficiency: 3 },
    5: { energy_efficiency: 4 },
    6: { energy_efficiency: 17 / 3 },
    7: { energy_efficiency: 9 },
    8: { energy_efficiency: 19 },
  },
});

// Range is consumed only by the Harvester, but it uses the same generic
// registry so no machine depends on legacy upgrade levels.
MachineUpgradeRegistry.register("utilitycraft:range_upgrade", {
  type: "range",
  levels: {
    1: { range: 1 },
    2: { range: 2 },
    3: { range: 3 },
    4: { range: 4 },
  },
});

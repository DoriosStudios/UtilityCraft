// @ts-check

import { MachineUpgradeRegistry } from "DoriosCore/index.js";

MachineUpgradeRegistry.register("utilitycraft:speed_upgrade", {
  type: "speed",
  levels: {
    1: { speed: 0.25, speed_level: 1 },
    2: { speed: 0.75, speed_level: 2 },
    3: { speed: 1.5, speed_level: 3 },
    4: { speed: 2.5, speed_level: 4 },
    5: { speed: 3.75, speed_level: 5 },
    6: { speed: 5.25, speed_level: 6 },
    7: { speed: 7, speed_level: 7 },
    8: { speed: 9, speed_level: 8 },
  },
});

MachineUpgradeRegistry.register("utilitycraft:energy_upgrade", {
  type: "energy",
  levels: {
    1: { efficiency: 0.2 },
    2: { efficiency: 0.4 },
    3: { efficiency: 0.6 },
    4: { efficiency: 0.75 },
    5: { efficiency: 0.8 },
    6: { efficiency: 0.85 },
    7: { efficiency: 0.9 },
    8: { efficiency: 0.95 },
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

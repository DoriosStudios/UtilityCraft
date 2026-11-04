import { system } from "@minecraft/server";

// Network discovery only. The owning addon stores and configures its own ports.
export function publishNetworkData(block, key, { version, source, targets }) {
  system.sendScriptEvent("utilitycraft:network_data", JSON.stringify({
    key, dimensionId: block.dimension.id, location: block.location,
    data: { version, source, targets },
  }));
  return true;
}

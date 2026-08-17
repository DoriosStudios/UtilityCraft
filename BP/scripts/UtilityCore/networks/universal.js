// @ts-check

import { ActionFormData } from "@minecraft/server-ui";
import { openFluidEndpointMenu } from "./fluids.js";
import { openGasEndpointMenu } from "./gases.js";
import { openItemExporterMenu, openItemImporterMenu } from "./items.js";
import { networkRegistrar } from "./shared.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Player} Player */

/** @param {string} key */
function translate(key) {
  return { translate: key };
}

/** @param {Block} block @param {Player} player */
function openUniversalEndpointMenu(block, player) {
  const isImporter = block.hasTag("dorios:isImporter");
  new ActionFormData()
    .title(translate(isImporter
      ? "ui.utilitycraft:universal_endpoint.importer_title"
      : "ui.utilitycraft:universal_endpoint.exporter_title"))
    .body(translate("ui.utilitycraft:universal_endpoint.description"))
    .button(translate("ui.utilitycraft:universal_endpoint.items"))
    .button(translate("ui.utilitycraft:universal_endpoint.fluids"))
    .button(translate("ui.utilitycraft:universal_endpoint.gases"))
    .show(player)
    .then((result) => {
      if (result.canceled || result.selection === undefined) return;
      if (result.selection === 0) {
        if (isImporter) openItemImporterMenu(block, player);
        else openItemExporterMenu(block, player);
      } else if (result.selection === 1) {
        openFluidEndpointMenu(block, player);
      } else if (result.selection === 2) {
        openGasEndpointMenu(block, player);
      }
    });
}

networkRegistrar.block("universal_endpoint", {
  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId === "utilitycraft:wrench" || item?.typeId === "utilitycraft:copy_paste_tool") return;
    if (item?.typeId?.includes("upgrade")) return;
    openUniversalEndpointMenu(block, player);
  },
});

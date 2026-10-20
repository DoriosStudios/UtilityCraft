// @ts-check

import { ActionFormData } from "@minecraft/server-ui";
import {
  itemExporterComponent,
  itemImporterComponent,
  openItemExporterMenu,
  openItemImporterMenu,
} from "./items.js";
import {
  fluidExporterComponent,
  fluidImporterComponent,
  openFluidEndpointMenu,
} from "./fluids.js";
import {
  gasExporterComponent,
  gasImporterComponent,
  openGasEndpointMenu,
} from "./gases.js";
import { networkRegistrar } from "./shared.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Player} Player */

/** @param {string} key */
function translate(key) {
  return { translate: key };
}

const CONFIGURABLE_RESOURCES = Object.freeze([
  Object.freeze({
    id: "item",
    tag: "dorios:item",
    open(block, player, importer) {
      if (importer) openItemImporterMenu(block, player);
      else openItemExporterMenu(block, player);
    },
  }),
  Object.freeze({
    id: "fluid",
    tag: "dorios:fluid",
    open(block, player) {
      openFluidEndpointMenu(block, player);
    },
  }),
  Object.freeze({
    id: "gas",
    tag: "dorios:gas",
    open(block, player) {
      openGasEndpointMenu(block, player);
    },
  }),
]);

/** @param {Block} block @param {Player} player @param {boolean} importer */
export function openMultiEndpointMenu(block, player, importer) {
  const resources = CONFIGURABLE_RESOURCES.filter(({ tag }) => block.hasTag(tag));
  if (resources.length === 0) return;
  if (resources.length === 1) {
    resources[0].open(block, player, importer);
    return;
  }

  const form = new ActionFormData()
    .title(translate(importer
      ? "ui.utilitycraft:multi_endpoint.importer_title"
      : "ui.utilitycraft:multi_endpoint.exporter_title"))
    .body(translate("ui.utilitycraft:multi_endpoint.description"));
  for (const resource of resources) {
    form.button(translate(`ui.utilitycraft:multi_endpoint.${resource.id}`));
  }
  form.show(player).then((result) => {
    if (result.canceled || result.selection === undefined) return;
    resources[result.selection]?.open(block, player, importer);
  });
}

/** @param {Block} block @param {string} tag */
function supports(block, tag) {
  return block?.hasTag(tag) === true;
}

const multiExporterComponent = {
  beforeOnPlayerPlace(event) {
    itemExporterComponent.beforeOnPlayerPlace(event);
    fluidExporterComponent.beforeOnPlayerPlace(event);
    gasExporterComponent.beforeOnPlayerPlace(event);
  },

  onPlayerBreak(event) {
    itemExporterComponent.onPlayerBreak(event);
    fluidExporterComponent.onPlayerBreak(event);
    gasExporterComponent.onPlayerBreak(event);
  },

  onBreak(event) {
    itemExporterComponent.onBreak(event);
    fluidExporterComponent.onBreak(event);
    gasExporterComponent.onBreak(event);
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId === "utilitycraft:wrench" || item?.typeId === "utilitycraft:copy_paste_tool") return;
    if (item?.typeId?.includes("upgrade")) return;
    openMultiEndpointMenu(block, player, false);
  },

  onTick(event) {
    if (supports(event.block, "dorios:item")) itemExporterComponent.onTick(event);
    if (supports(event.block, "dorios:fluid")) fluidExporterComponent.onTick(event);
    if (supports(event.block, "dorios:gas")) gasExporterComponent.onTick(event);
  },
};

const multiImporterComponent = {
  beforeOnPlayerPlace(event) {
    itemImporterComponent.beforeOnPlayerPlace(event);
    fluidImporterComponent.beforeOnPlayerPlace(event);
    gasImporterComponent.beforeOnPlayerPlace(event);
  },

  onPlayerBreak(event) {
    itemImporterComponent.onPlayerBreak(event);
    fluidImporterComponent.onPlayerBreak(event);
    gasImporterComponent.onPlayerBreak(event);
  },

  onBreak(event) {
    itemImporterComponent.onBreak(event);
    fluidImporterComponent.onBreak(event);
    gasImporterComponent.onBreak(event);
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId === "utilitycraft:wrench" || item?.typeId === "utilitycraft:copy_paste_tool") return;
    if (item?.typeId?.includes("upgrade")) return;
    openMultiEndpointMenu(block, player, true);
  },
};

networkRegistrar
  .block("multi_exporter", multiExporterComponent)
  .block("multi_importer", multiImporterComponent);

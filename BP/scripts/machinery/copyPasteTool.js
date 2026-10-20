// @ts-check

import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as DoriosLib from "DoriosLib/index.js";
import * as DoriosContainer from "../DoriosLib/containers/index.js";
import {
  ensureItemIOConfig,
  getItemIODefinition,
  getItemIODirectionMode,
} from "../DoriosCore/interfaces/itemIO.js";
import {
  FLUID_CONFIG_VERSION,
  ensureFluidIOConfig,
  getFluidIODefinition,
  getFluidIODirectionMode,
  setFluidConfig,
} from "../DoriosCore/interfaces/fluidIO.js";
import {
  GAS_CONFIG_VERSION,
  ensureGasIOConfig,
  getGasIODefinition,
  getGasIODirectionMode,
  setGasConfig,
} from "../DoriosCore/interfaces/gasIO.js";
import { setDisabledIOFaces } from "../DoriosLib/containers/ioFaceState.js";
import { OutputTracker } from "../DoriosCore/machinery/outputTracker.js";
import {
  DIRECTIONS,
  OPPOSITE_DIRECTIONS,
  RELATIVE_IO_FACES,
  getBlockFacingDirection,
  resolveRelativeFaceDirection,
} from "../DoriosCore/utils/directions.js";
import {
  applyFluidExtractorCopyConfig,
  applyGasExtractorCopyConfig,
  applyItemExporterCopyConfig,
  getFluidExtractorCopyConfig,
  getGasExtractorCopyConfig,
  getItemExporterCopyConfig,
  updateNetworksAtMany,
} from "../UtilityCore/networks/index.js";
import {
  applyPipeFaceCopyConfig,
  getPipeFaceCopyConfig,
} from "../UtilityCore/networks/pipeFaces.js";
import {
  applyMechanicalHopperCopyConfig,
  getMechanicalHopperCopyConfig,
} from "./hoppers/mechHoppers.js";
import { getPersistentUpgradeLevel } from "../UtilityCore/upgradeable.js";

const TOOL_ITEM_ID = "utilitycraft:copy_paste_tool";
const TOOL_COMPONENT_ID = "utilitycraft:copy_paste_tool";
const TOOL_DATA_PROPERTY = "utilitycraft:copy_paste_data";
const TOOL_DATA_VERSION = 1;
const SNAPSHOT_VERSION = 1;
const DISABLED_MODE = "disabled";

const DIRECTION_STATE_IDS = [
  "minecraft:facing_direction",
  "minecraft:cardinal_direction",
  "minecraft:block_face",
  "utilitycraft:axis",
];

const DEFAULT_SETTINGS = Object.freeze({
  copyDirection: false,
  copyItemIO: true,
  copyFluidIO: true,
  copyGasIO: true,
  copyFilters: true,
});

/** @param {string} key @param {string[]} [values] */
function translate(key, values) {
  return values ? { translate: key, with: values } : { translate: key };
}

/** @param {string} labelKey @param {string} descriptionKey */
function translatedButton(labelKey, descriptionKey) {
  return {
    rawtext: [
      translate(labelKey),
      { text: "\n§8" },
      translate(descriptionKey),
    ],
  };
}

/** @param {unknown} value */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
function normalizeSettings(value) {
  const raw = isPlainObject(value) ? /** @type {Record<string,unknown>} */ (value) : {};
  return {
    copyDirection: typeof raw.copyDirection === "boolean" ? raw.copyDirection : DEFAULT_SETTINGS.copyDirection,
    copyItemIO: typeof raw.copyItemIO === "boolean" ? raw.copyItemIO : DEFAULT_SETTINGS.copyItemIO,
    copyFluidIO: typeof raw.copyFluidIO === "boolean" ? raw.copyFluidIO : DEFAULT_SETTINGS.copyFluidIO,
    copyGasIO: typeof raw.copyGasIO === "boolean" ? raw.copyGasIO : DEFAULT_SETTINGS.copyGasIO,
    copyFilters: typeof raw.copyFilters === "boolean" ? raw.copyFilters : DEFAULT_SETTINGS.copyFilters,
  };
}

/** @param {unknown} value */
function normalizeToolDocument(value) {
  const raw = isPlainObject(value) ? /** @type {Record<string,unknown>} */ (value) : {};
  return {
    version: TOOL_DATA_VERSION,
    mode: raw.mode === "paste" ? "paste" : "copy",
    settings: normalizeSettings(raw.settings),
    ...(isPlainObject(raw.copied) ? { copied: raw.copied } : {}),
  };
}

/** @param {import("@minecraft/server").ItemStack|undefined} item */
function readToolDocument(item) {
  if (item?.typeId !== TOOL_ITEM_ID) return normalizeToolDocument(undefined);
  try {
    const raw = item.getDynamicProperty(TOOL_DATA_PROPERTY);
    return normalizeToolDocument(typeof raw === "string" ? JSON.parse(raw) : undefined);
  } catch {
    return normalizeToolDocument(undefined);
  }
}

/** @param {import("@minecraft/server").Player} player @param {number} slot */
function getToolAtSlot(player, slot) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container || slot < 0 || slot >= container.size) return undefined;
    const item = container.getItem(slot);
    return item?.typeId === TOOL_ITEM_ID ? { container, item } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the document back to the exact hotbar slot that opened the action.
 * This avoids replacing a different item if the player changes selection while
 * a form is open.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {number} slot
 * @param {ReturnType<typeof normalizeToolDocument>} document
 */
function writeToolDocument(player, slot, document) {
  const held = getToolAtSlot(player, slot);
  if (!held) return false;

  try {
    held.item.setDynamicProperty(TOOL_DATA_PROPERTY, JSON.stringify(document));
    held.container.setItem(slot, held.item);
    return true;
  } catch (error) {
    console.warn(`[CopyPasteTool] Failed to save tool data: ${error?.message ?? error}`);
    return false;
  }
}

/** @param {import("@minecraft/server").Block} block */
function getBlockEntity(block) {
  try {
    const entities = block.dimension.getEntitiesAtBlockLocation(block.location)
      .filter((entity) => entity?.isValid === true);
    return entities.find((entity) => [
      "dorios:machine",
      "dorios:container",
      "dorios:fluid_container",
      "dorios:gas_container",
      "dorios:energy_source",
      "dorios:hopper",
    ].some((family) => hasTypeFamily(entity, family))) ?? entities[0];
  } catch {
    return undefined;
  }
}

/** @param {import("@minecraft/server").Entity|undefined} entity @param {string} family */
function hasTypeFamily(entity, family) {
  try {
    return entity?.getComponent("minecraft:type_family")?.hasTypeFamily(family) === true;
  } catch {
    return false;
  }
}

/**
 * Captures semantic mode ids, including the distinct default and disabled
 * states. Slot/tank indices stay owned by the registered definition.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} blockTypeId
 * @param {(entity:import("@minecraft/server").Entity,blockTypeId:string,direction:string)=>string} getDirectionMode
 */
function captureIOModes(entity, blockTypeId, getDirectionMode) {
  const modes = {};

  for (const direction of DIRECTIONS) {
    modes[direction] = getDirectionMode(entity, blockTypeId, direction);
  }
  return { version: 1, modes };
}

/** @param {import("@minecraft/server").Block} block */
function captureOrientation(block) {
  const relative = {};
  for (const face of RELATIVE_IO_FACES) {
    relative[face] = resolveRelativeFaceDirection(block, face);
  }
  return {
    facing: getBlockFacingDirection(block),
    relative,
  };
}

/** @param {import("@minecraft/server").Block} block */
function captureDirectionState(block) {
  for (const stateId of DIRECTION_STATE_IDS) {
    try {
      const value = block.permutation.getState(stateId);
      if (typeof value === "string" && DIRECTIONS.includes(value)) {
        return { stateId, value, facing: getBlockFacingDirection(block) };
      }
    } catch {}
  }
  return undefined;
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {{stateId?:unknown,value?:unknown,facing?:unknown}} source
 */
function applyDirectionState(block, source) {
  if (!source || typeof source.facing !== "string" || !DIRECTIONS.includes(source.facing)) return false;

  for (const targetStateId of DIRECTION_STATE_IDS) {
    let current;
    try {
      current = block.permutation.getState(targetStateId);
    } catch {
      continue;
    }
    if (typeof current !== "string" || !DIRECTIONS.includes(current)) continue;

    let targetValue = source.facing;
    if (targetStateId === source.stateId && typeof source.value === "string") {
      targetValue = source.value;
    } else if (targetStateId === "utilitycraft:axis") {
      targetValue = OPPOSITE_DIRECTIONS[source.facing] ?? source.facing;
    }

    try {
      block.setPermutation(block.permutation.withState(targetStateId, targetValue));
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Reinterprets one absolute source direction as a local machine face, then
 * resolves that local face against the target orientation.
 *
 * @param {unknown} sourceRelative
 * @param {import("@minecraft/server").Block} targetBlock
 * @param {string} sourceDirection
 */
function rotateDirection(sourceRelative, targetBlock, sourceDirection) {
  if (!isPlainObject(sourceRelative)) return sourceDirection;
  const relativeFace = RELATIVE_IO_FACES.find((face) => sourceRelative[face] === sourceDirection);
  return relativeFace ? resolveRelativeFaceDirection(targetBlock, relativeFace) : sourceDirection;
}

/**
 * @param {unknown} copied
 * @param {object} definition
 * @param {unknown} sourceRelative
 * @param {import("@minecraft/server").Block} targetBlock
 * @param {string} inputModeKey
 * @param {string} outputModeKey
 * @param {string} anyInputKey
 * @param {string} anyOutputKey
 * @param {number} version
 */
function buildIOConfig(
  copied,
  definition,
  sourceRelative,
  targetBlock,
  inputModeKey,
  outputModeKey,
  anyInputKey,
  anyOutputKey,
  version,
) {
  if (!isPlainObject(copied) || !isPlainObject(copied.modes) || !Array.isArray(definition?.modes)) {
    return undefined;
  }

  const inputConfig = {};
  const outputConfig = {};
  const disabled = [];
  for (const sourceDirection of DIRECTIONS) {
    const modeId = copied.modes[sourceDirection];
    const mode = definition.modes.find((entry) => entry?.id === modeId);
    if (!mode) continue;

    const targetDirection = rotateDirection(sourceRelative, targetBlock, sourceDirection);
    if (modeId === DISABLED_MODE) disabled.push(targetDirection);
    const inputs = mode[inputModeKey] ?? [];
    const outputs = mode[outputModeKey] ?? [];
    if (inputs.length > 0) inputConfig[targetDirection] = [...inputs];
    if (outputs.length > 0) outputConfig[targetDirection] = [...outputs];
  }

  return {
    config: {
      version,
      type: "complex",
      [anyInputKey]: [...(definition[anyInputKey] ?? [])],
      [anyOutputKey]: [...(definition[anyOutputKey] ?? [])],
      inputConfig,
      outputConfig,
    },
    disabled,
  };
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {ReturnType<typeof normalizeSettings>} settings
 */
function captureBlockSnapshot(block, settings) {
  const entity = getBlockEntity(block);
  const orientation = captureOrientation(block);
  const sections = {};

  if (settings.copyItemIO && entity) {
    const definition = getItemIODefinition(block.typeId);
    if (definition) {
      ensureItemIOConfig(entity, block.typeId);
      const copied = captureIOModes(entity, block.typeId, getItemIODirectionMode);
      if (copied) sections.itemIO = copied;
    }
  }

  if (settings.copyFluidIO && entity) {
    const definition = getFluidIODefinition(block.typeId);
    if (definition) {
      ensureFluidIOConfig(entity, block.typeId);
      const copied = captureIOModes(entity, block.typeId, getFluidIODirectionMode);
      if (copied) sections.fluidIO = copied;
    }
  }

  if (settings.copyGasIO && entity) {
    const definition = getGasIODefinition(block.typeId);
    if (definition) {
      ensureGasIOConfig(entity, block.typeId);
      const copied = captureIOModes(entity, block.typeId, getGasIODirectionMode);
      if (copied) sections.gasIO = copied;
    }
  }

  const itemExporter = getItemExporterCopyConfig(block, { includeFilters: settings.copyFilters });
  if (itemExporter) sections.itemExporter = itemExporter;

  const fluidExtractor = getFluidExtractorCopyConfig(block, { includeFilters: settings.copyFilters });
  if (fluidExtractor) sections.fluidExtractor = fluidExtractor;

  const gasExtractor = getGasExtractorCopyConfig(block, { includeFilters: settings.copyFilters });
  if (gasExtractor) sections.gasExtractor = gasExtractor;

  const hopper = getMechanicalHopperCopyConfig(block, { includeFilters: settings.copyFilters });
  if (hopper) sections.mechanicalHopper = hopper;

  if (hasTypeFamily(entity, "dorios:energy_source")) {
    const mode = entity.getDynamicProperty("transferMode");
    sections.energyTransfer = {
      mode: mode === "farthest" || mode === "round" ? mode : "nearest",
    };
  }

  const pipeFaces = getPipeFaceCopyConfig(block);
  if (pipeFaces) sections.pipeFaces = pipeFaces;

  const directionState = settings.copyDirection ? captureDirectionState(block) : undefined;
  if (Object.keys(sections).length === 0 && !directionState) return undefined;

  return {
    version: SNAPSHOT_VERSION,
    sourceTypeId: block.typeId,
    orientation,
    ...(directionState ? { directionState } : {}),
    sections,
  };
}

/** @param {import("@minecraft/server").Block} block */
function refreshBlockIOAndNetworks(block) {
  try {
    OutputTracker.refreshIOTargets(block);
    OutputTracker.refreshOutput(block, "item");
    OutputTracker.refreshOutput(block, "fluid");
    OutputTracker.refreshOutput(block, "gas");
    OutputTracker.refreshAdjacentIOTargets(block);
  } catch (error) {
    console.warn(`[CopyPasteTool] Failed to refresh machine IO targets: ${error?.message ?? error}`);
  }

  /** @type {Array<"energy"|"item"|"fluid"|"gas">} */
  const types = [];
  if (block.hasTag("dorios:energy")) types.push("energy");
  if (block.hasTag("dorios:item")) types.push("item");
  if (block.hasTag("dorios:fluid")) types.push("fluid");
  if (block.hasTag("dorios:gas")) types.push("gas");
  updateNetworksAtMany(block, types);
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {Record<string,unknown>} snapshot
 * @param {ReturnType<typeof normalizeSettings>} settings
 */
function pasteBlockSnapshot(block, snapshot, settings) {
  if (snapshot.version !== SNAPSHOT_VERSION || !isPlainObject(snapshot.sections)) return 0;
  let applied = 0;

  if (settings.copyDirection && isPlainObject(snapshot.directionState)) {
    if (applyDirectionState(block, snapshot.directionState)) applied++;
  }

  const entity = getBlockEntity(block);
  const sourceRelative = isPlainObject(snapshot.orientation) ? snapshot.orientation.relative : undefined;
  const sections = snapshot.sections;

  const attempt = (name, callback) => {
    try {
      if (callback()) applied++;
    } catch (error) {
      console.warn(`[CopyPasteTool] Failed to paste ${name}: ${error?.message ?? error}`);
    }
  };

  if (settings.copyItemIO && entity && sections.itemIO) {
    attempt("item IO", () => {
      const definition = getItemIODefinition(block.typeId);
      if (!definition) return false;
      const built = buildIOConfig(
        sections.itemIO,
        definition,
        sourceRelative,
        block,
        "inputSlots",
        "outputSlots",
        "anyInputSlots",
        "anyOutputSlots",
        DoriosContainer.ITEM_CONFIG_VERSION,
      );
      if (!built || !DoriosContainer.setConfig(entity, built.config)) return false;
      setDisabledIOFaces(entity, "items", built.disabled);
      return true;
    });
  }

  if (settings.copyFluidIO && entity && sections.fluidIO) {
    attempt("fluid IO", () => {
      const definition = getFluidIODefinition(block.typeId);
      if (!definition) return false;
      const built = buildIOConfig(
        sections.fluidIO,
        definition,
        sourceRelative,
        block,
        "inputIndices",
        "outputIndices",
        "anyInputIndices",
        "anyOutputIndices",
        FLUID_CONFIG_VERSION,
      );
      if (!built || !setFluidConfig(entity, built.config)) return false;
      setDisabledIOFaces(entity, "liquids", built.disabled);
      return true;
    });
  }

  if (settings.copyGasIO && entity && sections.gasIO) {
    attempt("gas IO", () => {
      const definition = getGasIODefinition(block.typeId);
      if (!definition) return false;
      const built = buildIOConfig(
        sections.gasIO,
        definition,
        sourceRelative,
        block,
        "inputIndices",
        "outputIndices",
        "anyInputIndices",
        "anyOutputIndices",
        GAS_CONFIG_VERSION,
      );
      if (!built || !setGasConfig(entity, built.config)) return false;
      setDisabledIOFaces(entity, "gases", built.disabled);
      return true;
    });
  }

  if (sections.itemExporter) {
    attempt("item exporter", () => applyItemExporterCopyConfig(
      block,
      sections.itemExporter,
      { includeFilters: settings.copyFilters },
    ));
  }

  if (sections.fluidExtractor) {
    attempt("fluid extractor", () => applyFluidExtractorCopyConfig(
      block,
      sections.fluidExtractor,
      { includeFilters: settings.copyFilters },
    ));
  }

  if (sections.gasExtractor) {
    attempt("gas extractor", () => applyGasExtractorCopyConfig(
      block,
      sections.gasExtractor,
      { includeFilters: settings.copyFilters },
    ));
  }

  if (sections.mechanicalHopper) {
    attempt("mechanical hopper", () => applyMechanicalHopperCopyConfig(
      block,
      sections.mechanicalHopper,
      { includeFilters: settings.copyFilters },
    ));
  }

  if (entity && isPlainObject(sections.energyTransfer) && hasTypeFamily(entity, "dorios:energy_source")) {
    attempt("energy transfer", () => {
      const mode = sections.energyTransfer.mode;
      if (mode !== "nearest" && mode !== "farthest" && mode !== "round") return false;
      entity.setDynamicProperty("transferMode", mode);
      return true;
    });
  }

  if (isPlainObject(sections.pipeFaces)) {
    attempt("pipe faces", () => {
      const disabled = Array.isArray(sections.pipeFaces.disabled)
        ? sections.pipeFaces.disabled.map((direction) => rotateDirection(sourceRelative, block, direction))
        : [];
      /** @type {Record<string,unknown[]>} */
      const resources = {};
      if (isPlainObject(sections.pipeFaces.resources)) {
        for (const [sourceDirection, channels] of Object.entries(sections.pipeFaces.resources)) {
          const targetDirection = rotateDirection(sourceRelative, block, sourceDirection);
          if (!targetDirection || !Array.isArray(channels)) continue;
          resources[targetDirection] = channels;
        }
      }
      return applyPipeFaceCopyConfig(block, { version: 2, disabled, resources });
    });
  }

  if (applied > 0) refreshBlockIOAndNetworks(block);
  return applied;
}

/** @param {Record<string,unknown>|undefined} snapshot */
function getSnapshotSectionCount(snapshot) {
  if (!snapshot || !isPlainObject(snapshot.sections)) return 0;
  return Object.keys(snapshot.sections).length + (isPlainObject(snapshot.directionState) ? 1 : 0);
}

const MECHANICAL_HOPPER_IDS = new Set([
  "utilitycraft:mechanic_hopper",
  "utilitycraft:mechanic_upper",
  "utilitycraft:mechanic_dropper",
  "utilitycraft:ender_hopper",
]);

/**
 * Checks filter requirements before any part of a paste is applied, preventing
 * direction or IO changes from being left behind after a failed operation.
 *
 * @param {import("@minecraft/server").Block} block
 * @param {Record<string,unknown>} snapshot
 * @param {ReturnType<typeof normalizeSettings>} settings
 */
function isFilterUpgradeMissing(block, snapshot, settings) {
  if (!settings.copyFilters || !isPlainObject(snapshot.sections)) return false;
  const sections = snapshot.sections;
  const hasPersistentFilter = getPersistentUpgradeLevel(block, "utilitycraft:filter", 1) === 1;

  if (isPlainObject(sections.itemExporter)
    && sections.itemExporter.filter !== undefined
    && block.hasTag("dorios:isExporter")
    && block.hasTag("dorios:item")
    && !hasPersistentFilter) return true;

  if (isPlainObject(sections.fluidExtractor)
    && sections.fluidExtractor.filter !== undefined
    && block.hasTag("dorios:isExporter")
    && block.hasTag("dorios:fluid")
    && !hasPersistentFilter) return true;

  if (isPlainObject(sections.gasExtractor)
    && sections.gasExtractor.filter !== undefined
    && block.hasTag("dorios:isExporter")
    && block.hasTag("dorios:gas")
    && !hasPersistentFilter) return true;

  const hopperConfig = sections.mechanicalHopper;
  if (isPlainObject(hopperConfig)
    && (Array.isArray(hopperConfig.items) || Object.hasOwn(hopperConfig, "whitelist"))
    && MECHANICAL_HOPPER_IDS.has(block.typeId)
    && block.permutation.getState("utilitycraft:filter") !== 1) return true;

  return false;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} slot
 */
async function openQuickSettings(player, slot) {
  const held = getToolAtSlot(player, slot);
  if (!held) return;
  const document = readToolDocument(held.item);
  const settings = document.settings;

  try {
    const result = await new ModalFormData()
      .title(translate("ui.utilitycraft:copy_paste_tool.quick_settings_title"))
      .toggle(translate("ui.utilitycraft:copy_paste_tool.copy_direction"), {
        defaultValue: settings.copyDirection,
        tooltip: translate("ui.utilitycraft:copy_paste_tool.copy_direction_tooltip"),
      })
      .toggle(translate("ui.utilitycraft:copy_paste_tool.copy_item_io"), {
        defaultValue: settings.copyItemIO,
        tooltip: translate("ui.utilitycraft:copy_paste_tool.copy_item_io_tooltip"),
      })
      .toggle(translate("ui.utilitycraft:copy_paste_tool.copy_fluid_io"), {
        defaultValue: settings.copyFluidIO,
        tooltip: translate("ui.utilitycraft:copy_paste_tool.copy_fluid_io_tooltip"),
      })
      .toggle(translate("ui.utilitycraft:copy_paste_tool.copy_gas_io"), {
        defaultValue: settings.copyGasIO,
        tooltip: translate("ui.utilitycraft:copy_paste_tool.copy_gas_io_tooltip"),
      })
      .toggle(translate("ui.utilitycraft:copy_paste_tool.copy_filters"), {
        defaultValue: settings.copyFilters,
        tooltip: translate("ui.utilitycraft:copy_paste_tool.copy_filters_tooltip"),
      })
      .submitButton(translate("ui.utilitycraft:copy_paste_tool.save"))
      .show(player);
    if (result.canceled) return;

    const toggles = (Array.isArray(result.formValues) ? result.formValues : [])
      .filter((value) => typeof value === "boolean");
    document.settings = {
      copyDirection: toggles[0] ?? settings.copyDirection,
      copyItemIO: toggles[1] ?? settings.copyItemIO,
      copyFluidIO: toggles[2] ?? settings.copyFluidIO,
      copyGasIO: toggles[3] ?? settings.copyGasIO,
      copyFilters: toggles[4] ?? settings.copyFilters,
    };

    if (writeToolDocument(player, slot, document)) {
      player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.settings_saved"));
    }
  } catch (error) {
    console.warn(`[CopyPasteTool] Quick settings form failed: ${error?.message ?? error}`);
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} slot
 */
async function openToolMenu(player, slot) {
  const held = getToolAtSlot(player, slot);
  if (!held) return;
  const document = readToolDocument(held.item);
  const copiedBlock = typeof document.copied?.sourceTypeId === "string"
    ? DoriosLib.text.formatIdentifier(document.copied.sourceTypeId)
    : "—";

  const body = {
    rawtext: [
      translate("ui.utilitycraft:copy_paste_tool.description"),
      { text: "\n\n" },
      translate("ui.utilitycraft:copy_paste_tool.current_mode"),
      { text: " §f" },
      translate(`ui.utilitycraft:copy_paste_tool.mode_${document.mode}`),
      { text: "\n§7" },
      translate("ui.utilitycraft:copy_paste_tool.copied_block", [copiedBlock]),
    ],
  };

  try {
    const result = await new ActionFormData()
      .title(translate("ui.utilitycraft:copy_paste_tool.title"))
      .body(body)
      .button(translatedButton(
        "ui.utilitycraft:copy_paste_tool.quick_settings",
        "ui.utilitycraft:copy_paste_tool.quick_settings_description",
      ), "textures/ui/settings_glyph_color_2x.png")
      .button(translatedButton(
        "ui.utilitycraft:copy_paste_tool.change_mode",
        "ui.utilitycraft:copy_paste_tool.change_mode_description",
      ), "textures/ui/icon_import.png")
      .button(translatedButton(
        "ui.utilitycraft:copy_paste_tool.clear",
        "ui.utilitycraft:copy_paste_tool.clear_description",
      ), "textures/ui/trash_default.png")
      .show(player);

    if (result.selection === 0) {
      await openQuickSettings(player, slot);
      return;
    }

    const current = getToolAtSlot(player, slot);
    if (!current) return;
    const latest = readToolDocument(current.item);
    if (result.selection === 1) {
      latest.mode = latest.mode === "copy" ? "paste" : "copy";
      if (writeToolDocument(player, slot, latest)) {
        player.onScreenDisplay.setActionBar({
          rawtext: [
            translate("message.utilitycraft.copy_paste_tool.mode_changed"),
            { text: " " },
            translate(`ui.utilitycraft:copy_paste_tool.mode_${latest.mode}`),
          ],
        });
      }
    } else if (result.selection === 2) {
      delete latest.copied;
      if (writeToolDocument(player, slot, latest)) {
        player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.cleared"));
        player.playSound("random.break");
      }
    }
  } catch (error) {
    console.warn(`[CopyPasteTool] Main form failed: ${error?.message ?? error}`);
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Block} block
 * @param {number} slot
 */
function useToolOnBlock(player, block, slot) {
  const held = getToolAtSlot(player, slot);
  if (!held) return;
  const document = readToolDocument(held.item);

  if (document.mode === "copy") {
    const snapshot = captureBlockSnapshot(block, document.settings);
    if (!snapshot) {
      player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.nothing_to_copy"));
      player.playSound("random.break");
      return;
    }

    const next = { ...document, copied: snapshot };
    if (!writeToolDocument(player, slot, next)) {
      player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.save_failed"));
      return;
    }
    player.onScreenDisplay.setActionBar(translate(
      "message.utilitycraft.copy_paste_tool.copied",
      [String(getSnapshotSectionCount(snapshot))],
    ));
    player.playSound("random.orb");
    return;
  }

  if (!isPlainObject(document.copied)) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.empty"));
    player.playSound("random.break");
    return;
  }

  if (isFilterUpgradeMissing(block, document.copied, document.settings)) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.missing_filter_upgrade"));
    player.playSound("random.break");
    return;
  }

  const applied = pasteBlockSnapshot(block, document.copied, document.settings);
  if (applied === 0) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.copy_paste_tool.incompatible"));
    player.playSound("random.break");
    return;
  }

  player.onScreenDisplay.setActionBar(translate(
    "message.utilitycraft.copy_paste_tool.pasted",
    [String(applied)],
  ));
  player.playSound("place.iron");
}

DoriosLib.registry.itemComponent(TOOL_COMPONENT_ID, {
  onUse({ source }) {
    if (!source?.isSneaking) return;
    void openToolMenu(source, source.selectedSlotIndex);
  },

  onUseOn({ source, block }) {
    if (source?.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (source);
    const slot = player.selectedSlotIndex;
    if (player.isSneaking) {
      void openToolMenu(player, slot);
      return;
    }
    useToolOnBlock(player, block, slot);
  },
});

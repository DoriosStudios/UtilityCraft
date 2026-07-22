// @ts-check

import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { FluidStorage } from "../../DoriosCore/machinery/fluidStorage.js";
import * as DoriosFluid from "../../DoriosCore/machinery/fluidContainers.js";
import { DIRECTIONS } from "../../DoriosCore/utils/directions.js";
import { formatIdentifier } from "../../DoriosLib/text/index.js";
import {
  NETWORK_OFFSETS,
  getAttachedContainerEndpoint,
  getContainerFace,
  getNetworkColor,
  networkRegistrar,
  offsetLocation,
  safeGetBlock,
} from "./shared.js";
import {
  NETWORK_SCAN_BATCH_SIZE,
  createNetworkRescanScheduler,
} from "./scheduler.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../../DoriosCore/interfaces/fluidIO.js").FluidFace} FluidFace */
/** @typedef {import("../../DoriosCore/machinery/fluidContainers.js").ResolvedFluidContainer} ResolvedFluidContainer */

const NETWORK_VERSION = 1;
const MAX_SOURCE_INDEX_ATTEMPTS = 3;
const MAX_TRANSFER_AMOUNT = 4000;
const MAX_PROPERTY_CHUNK_LENGTH = 24_000;
const MAX_EXPORTER_CHUNKS = 128;
const EXPORTER_PROPERTY_PREFIX = "utilitycraft:fe";
const EXPORTER_STORAGE_FORMAT = "utilitycraft:fluid_exporter:v1";

/**
 * @typedef {object} PersistedFluidEndpoint
 * @property {Vector3} location
 * @property {FluidFace} face
 */

/**
 * @typedef {object} FluidExporterDocument
 * @property {number} version
 * @property {boolean} enabled
 * @property {"nearest"|"farthest"|"round"} mode
 * @property {{mode:"whitelist"|"blacklist",fluids:string[]}} filter
 * @property {PersistedFluidEndpoint|null} source
 * @property {PersistedFluidEndpoint[]} targets
 */

/**
 * @typedef {object} ExporterStorageManifest
 * @property {typeof EXPORTER_STORAGE_FORMAT} format
 * @property {0|1} generation
 * @property {number} chunks
 * @property {number} length
 */

/**
 * @typedef {object} FluidContainerAccess
 * @property {ResolvedFluidContainer} resolved
 * @property {ReadonlyArray<number>} indices
 * @property {number} revision
 */

/**
 * @typedef {object} FluidExporterRuntime
 * @property {string} key
 * @property {FluidExporterDocument} document
 * @property {Set<string>} filterFluids
 * @property {number} roundIndex
 * @property {boolean} persistenceReady
 * @property {FluidContainerAccess|undefined} sourceAccess
 * @property {Map<string,FluidContainerAccess>} targetAccesses
 */

/** @type {Map<string,FluidExporterRuntime>} */
const exporterCache = new Map();

/** @param {string} dimensionId @param {Vector3} location */
function locationKey(dimensionId, location) {
  return `${dimensionId}:${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

/** @param {Dimension} dimension @param {Vector3} location */
function exporterPropertyKey(dimension, location) {
  return `${EXPORTER_PROPERTY_PREFIX}:${dimensionStorageKey(dimension.id)}:${coordinateKey(location)}`;
}

/** @param {string} dimensionId */
function dimensionStorageKey(dimensionId) {
  if (dimensionId === "minecraft:overworld") return "o";
  if (dimensionId === "minecraft:nether") return "n";
  if (dimensionId === "minecraft:the_end") return "e";
  return dimensionId.replaceAll(":", ".");
}

/** @param {Vector3} location */
function coordinateKey(location) {
  return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

/** @param {Vector3} location */
function normalizeLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

/** @returns {FluidExporterDocument} */
function createExporterDocument() {
  return {
    version: NETWORK_VERSION,
    enabled: true,
    mode: "nearest",
    filter: { mode: "whitelist", fluids: [] },
    source: null,
    targets: [],
  };
}

/** @param {unknown} value */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

/** @param {unknown} value @returns {Vector3|undefined} */
function normalizePersistedLocation(value) {
  if (!value || typeof value !== "object") return undefined;
  const location = /** @type {Partial<Vector3>} */ (value);
  if (!Number.isFinite(location.x) || !Number.isFinite(location.y) || !Number.isFinite(location.z)) return undefined;
  return normalizeLocation(/** @type {Vector3} */ (location));
}

/** @param {unknown} value @returns {FluidFace|undefined} */
function normalizeFace(value) {
  return DIRECTIONS.includes(value) ? /** @type {FluidFace} */ (value) : undefined;
}

/** @param {unknown} value @returns {FluidExporterDocument} */
function normalizeExporterDocument(value) {
  const fallback = createExporterDocument();
  if (!value || typeof value !== "object") return fallback;
  const raw = /** @type {Record<string,unknown>} */ (value);
  const rawFilter = raw.filter && typeof raw.filter === "object"
    ? /** @type {Record<string,unknown>} */ (raw.filter)
    : {};

  let source = null;
  if (raw.source && typeof raw.source === "object") {
    const sourceRaw = /** @type {Record<string,unknown>} */ (raw.source);
    const location = normalizePersistedLocation(sourceRaw.location);
    const face = normalizeFace(sourceRaw.face);
    if (location && face) source = { location, face };
  }

  const targets = [];
  for (const entry of Array.isArray(raw.targets) ? raw.targets : []) {
    if (!entry || typeof entry !== "object") continue;
    const targetRaw = /** @type {Record<string,unknown>} */ (entry);
    const location = normalizePersistedLocation(targetRaw.location);
    const face = normalizeFace(targetRaw.face);
    if (location && face) targets.push({ location, face });
  }

  return {
    version: NETWORK_VERSION,
    enabled: raw.enabled !== false,
    mode: raw.mode === "farthest" || raw.mode === "round" ? raw.mode : "nearest",
    filter: {
      mode: rawFilter.mode === "blacklist" ? "blacklist" : "whitelist",
      fluids: normalizeStringArray(rawFilter.fluids),
    },
    source,
    targets,
  };
}

/** @param {string} key @returns {unknown} */
function readWorldDocument(key) {
  try {
    const raw = world.getDynamicProperty(key);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string} key @param {0|1} generation @param {number} index */
function exporterChunkKey(key, generation, index) {
  return `${key}:${generation}:${index}`;
}

/** @param {string} key @returns {ExporterStorageManifest|undefined} */
function readExporterManifest(key) {
  const value = readWorldDocument(key);
  if (!value || typeof value !== "object") return undefined;
  const raw = /** @type {Record<string,unknown>} */ (value);
  if (raw.format !== EXPORTER_STORAGE_FORMAT) return undefined;
  if (raw.generation !== 0 && raw.generation !== 1) return undefined;
  if (!Number.isInteger(raw.chunks) || Number(raw.chunks) < 1 || Number(raw.chunks) > MAX_EXPORTER_CHUNKS) return undefined;
  if (!Number.isInteger(raw.length) || Number(raw.length) < 1) return undefined;
  return {
    format: EXPORTER_STORAGE_FORMAT,
    generation: raw.generation,
    chunks: Number(raw.chunks),
    length: Number(raw.length),
  };
}

/** @param {string} key */
function readExporterDocument(key) {
  const manifest = readExporterManifest(key);
  if (!manifest) return undefined;
  let serialized = "";
  try {
    for (let index = 0; index < manifest.chunks; index++) {
      const chunk = world.getDynamicProperty(exporterChunkKey(key, manifest.generation, index));
      if (typeof chunk !== "string") return undefined;
      serialized += chunk;
    }
  } catch {
    return undefined;
  }
  if (serialized.length !== manifest.length) return undefined;
  try {
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

/** @param {string} key @param {0|1} generation @param {number} count */
function clearExporterChunks(key, generation, count) {
  for (let index = 0; index < count; index++) {
    try {
      world.setDynamicProperty(exporterChunkKey(key, generation, index), undefined);
    } catch {}
  }
}

/** @param {string} key */
function clearExporterStorage(key) {
  const manifest = readExporterManifest(key);
  try {
    world.setDynamicProperty(key, undefined);
  } catch {}
  if (manifest) clearExporterChunks(key, manifest.generation, manifest.chunks);
}

/** @param {string} key @param {FluidExporterDocument} value */
function writeExporterDocument(key, value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    clearExporterStorage(key);
    console.warn(`[UtilityCore:fluids] Could not serialize ${key}`, error);
    return false;
  }

  const chunks = [];
  for (let index = 0; index < serialized.length; index += MAX_PROPERTY_CHUNK_LENGTH) {
    chunks.push(serialized.slice(index, index + MAX_PROPERTY_CHUNK_LENGTH));
  }
  if (chunks.length === 0) chunks.push("{}");
  if (chunks.length > MAX_EXPORTER_CHUNKS) {
    clearExporterStorage(key);
    console.warn(`[UtilityCore:fluids] Exporter topology is too large to persist: ${key}`);
    return false;
  }

  const previous = readExporterManifest(key);
  const generation = /** @type {0|1} */ (previous?.generation === 0 ? 1 : 0);
  let written = 0;
  try {
    for (let index = 0; index < chunks.length; index++) {
      world.setDynamicProperty(exporterChunkKey(key, generation, index), chunks[index]);
      written++;
    }
    world.setDynamicProperty(key, JSON.stringify({
      format: EXPORTER_STORAGE_FORMAT,
      generation,
      chunks: chunks.length,
      length: serialized.length,
    }));
  } catch (error) {
    clearExporterChunks(key, generation, written);
    clearExporterStorage(key);
    console.warn(`[UtilityCore:fluids] Could not persist ${key}`, error);
    return false;
  }
  if (previous) clearExporterChunks(key, previous.generation, previous.chunks);
  return true;
}

/** @param {Block} block @returns {FluidExporterRuntime} */
function getExporterRuntime(block) {
  const key = exporterPropertyKey(block.dimension, block.location);
  const cached = exporterCache.get(key);
  if (cached) return cached;

  const storedDocument = readExporterDocument(key);
  const document = normalizeExporterDocument(storedDocument);
  const runtime = {
    key,
    document,
    filterFluids: new Set(document.filter.fluids),
    roundIndex: 0,
    persistenceReady: storedDocument !== undefined,
    sourceAccess: undefined,
    targetAccesses: new Map(),
  };
  exporterCache.set(key, runtime);
  if (storedDocument === undefined) runtime.persistenceReady = writeExporterDocument(key, document);
  return runtime;
}

/** @param {FluidExporterRuntime} runtime */
function persistExporterRuntime(runtime) {
  runtime.document.filter.fluids = [...runtime.filterFluids];
  runtime.persistenceReady = writeExporterDocument(runtime.key, runtime.document);
  return runtime.persistenceReady;
}

/** @param {Dimension} dimension @param {Vector3} location */
function deleteExporterState(dimension, location) {
  const key = exporterPropertyKey(dimension, location);
  exporterCache.delete(key);
  clearExporterStorage(key);
}

/** @param {Vector3} left @param {Vector3} right */
function isSameBlockLocation(left, right) {
  return Math.floor(left.x) === Math.floor(right.x)
    && Math.floor(left.y) === Math.floor(right.y)
    && Math.floor(left.z) === Math.floor(right.z);
}

/** @param {ResolvedFluidContainer|undefined} resolved @param {Dimension} dimension @param {Vector3} location */
function isResolvedUsable(resolved, dimension, location) {
  if (!resolved) return false;
  try {
    if (resolved.entity && (!resolved.entity.isValid || resolved.entity.dimension.id !== dimension.id)) return false;
    if (resolved.block) {
      if (resolved.block.dimension.id !== dimension.id) return false;
      if (!isSameBlockLocation(resolved.block.location, location)) return false;
    } else if (resolved.entity && !isSameBlockLocation(resolved.entity.location, location)) {
      return false;
    }
    return Boolean(resolved.entity?.isValid || resolved.kind === "tank");
  } catch {
    return false;
  }
}

/** @param {FluidExporterRuntime} runtime @param {Dimension} dimension */
function getSourceAccess(runtime, dimension) {
  const source = runtime.document.source;
  if (!source) return undefined;
  const cached = runtime.sourceAccess;
  if (cached && isResolvedUsable(cached.resolved, dimension, source.location)) {
    const revision = DoriosFluid.getFluidContainerRevision(cached.resolved);
    if (cached.revision === revision) return cached;
  }

  const resolved = DoriosFluid.resolveFluidContainerAt(dimension, source.location);
  if (!resolved) {
    runtime.sourceAccess = undefined;
    return undefined;
  }
  const indices = DoriosFluid.getFluidOutputIndices(resolved, { face: source.face });
  const revision = DoriosFluid.getFluidContainerRevision(resolved);
  runtime.sourceAccess = { resolved, indices, revision };
  return runtime.sourceAccess;
}

/** @param {PersistedFluidEndpoint} endpoint */
function endpointKey(endpoint) {
  return `${endpoint.location.x},${endpoint.location.y},${endpoint.location.z}:${endpoint.face}`;
}

/** @param {FluidExporterRuntime} runtime @param {Dimension} dimension @param {PersistedFluidEndpoint} endpoint */
function getTargetAccess(runtime, dimension, endpoint) {
  const key = endpointKey(endpoint);
  const cached = runtime.targetAccesses.get(key);
  if (cached && isResolvedUsable(cached.resolved, dimension, endpoint.location)) {
    const revision = DoriosFluid.getFluidContainerRevision(cached.resolved);
    if (cached.revision === revision) return cached;
  }

  const resolved = DoriosFluid.resolveFluidContainerAt(dimension, endpoint.location);
  if (!resolved) {
    runtime.targetAccesses.delete(key);
    return undefined;
  }
  const indices = DoriosFluid.getFluidInputIndices(resolved, { face: endpoint.face });
  const access = {
    resolved,
    indices,
    revision: DoriosFluid.getFluidContainerRevision(resolved),
  };
  runtime.targetAccesses.set(key, access);
  return access;
}

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

/** @param {Block} block */
function hasFilterUpgrade(block) {
  return block.permutation.getState("utilitycraft:filter") === 1;
}

/** @param {Block} block */
function getMenuBody(block) {
  return {
    rawtext: [
      translate("ui.utilitycraft:fluid_transfer.extractor_description"),
      { text: "\n\n" },
      translate(hasFilterUpgrade(block)
        ? "ui.utilitycraft:fluid_transfer.filter_installed"
        : "ui.utilitycraft:fluid_transfer.filter_not_installed"),
    ],
  };
}

/** @param {Block} block @param {Iterable<string>} fluids */
function getFilteredFluidsLabel(block, fluids) {
  if (!hasFilterUpgrade(block)) {
    return translate("ui.utilitycraft:fluid_transfer.filtered_fluids_unavailable");
  }

  const values = [...fluids];
  if (values.length === 0) return translate("ui.utilitycraft:fluid_transfer.filtered_fluids_empty");

  return {
    rawtext: values.map((type, index) => ({
      text: `${index === 0 ? "" : "\n"}§7- §f${formatIdentifier(type)}`,
    })),
  };
}

/** @param {Block} block @param {Player} player */
function requireFilterUpgrade(block, player) {
  if (hasFilterUpgrade(block)) return true;
  player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.missing_filter_upgrade"));
  return false;
}

/** @param {Block} block @param {Player} player */
function openFluidExporterMenu(block, player) {
  const runtime = getExporterRuntime(block);
  const menu = new ActionFormData()
    .title(translate("ui.utilitycraft:fluid_transfer.extractor_title"))
    .body(getMenuBody(block))
    .button(translatedButton(
      "ui.utilitycraft:fluid_transfer.quick_settings",
      "ui.utilitycraft:fluid_transfer.quick_settings_description",
    ), "textures/ui/settings_glyph_color_2x.png")
    .button(translatedButton(
      "ui.utilitycraft:fluid_transfer.add_fluid",
      "ui.utilitycraft:fluid_transfer.add_fluid_description",
    ), "textures/ui/icon_import.png")
    .button(translatedButton(
      "ui.utilitycraft:fluid_transfer.remove_fluid",
      "ui.utilitycraft:fluid_transfer.remove_fluid_description",
    ), "textures/ui/trash_default.png");

  menu.show(player).then((result) => {
    if (result.selection === undefined) return;
    switch (result.selection) {
      case 0:
        openFluidQuickSettings(block, runtime, player);
        break;
      case 1:
        openAddFluidMenu(block, runtime, player);
        break;
      case 2:
        openRemoveFluidMenu(block, runtime, player);
        break;
    }
  });
}

/** @param {Block} block @param {FluidExporterRuntime} runtime @param {Player} player */
function openFluidQuickSettings(block, runtime, player) {
  const modes = /** @type {const} */ (["nearest", "farthest", "round"]);
  const modeLabels = modes.map((mode) => translate(`ui.utilitycraft:fluid_transfer.mode_${mode}`));
  const defaultIndex = Math.max(0, modes.indexOf(runtime.document.mode));

  new ModalFormData()
    .title(translate("ui.utilitycraft:fluid_transfer.quick_settings_title"))
    .toggle(translate("ui.utilitycraft:fluid_transfer.enabled"), {
      defaultValue: runtime.document.enabled,
      tooltip: translate("ui.utilitycraft:fluid_transfer.enabled_tooltip"),
    })
    .toggle(translate("ui.utilitycraft:fluid_transfer.whitelist"), {
      defaultValue: runtime.document.filter.mode === "whitelist",
      tooltip: translate("ui.utilitycraft:fluid_transfer.whitelist_tooltip"),
    })
    .dropdown(translate("ui.utilitycraft:fluid_transfer.transfer_mode"), modeLabels, {
      defaultValueIndex: defaultIndex,
      tooltip: translate("ui.utilitycraft:fluid_transfer.transfer_mode_tooltip"),
    })
    .divider()
    .label(translate("ui.utilitycraft:fluid_transfer.filtered_fluids"))
    .label(getFilteredFluidsLabel(block, runtime.filterFluids))
    .submitButton(translate("ui.utilitycraft:fluid_transfer.save"))
    .show(player)
    .then((result) => {
      if (result.canceled) return;
      const values = Array.isArray(result.formValues) ? result.formValues : [];
      const toggles = values.filter((value) => typeof value === "boolean");
      const selectedMode = Number(values.find((value) => typeof value === "number" && Number.isFinite(value)));
      runtime.document.enabled = toggles[0] ?? runtime.document.enabled;
      runtime.document.filter.mode = (toggles[1] ?? (runtime.document.filter.mode === "whitelist"))
        ? "whitelist"
        : "blacklist";
      runtime.document.mode = modes[selectedMode] ?? runtime.document.mode;
      persistExporterRuntime(runtime);
      player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.settings_saved"));
    });
}

/** @param {Block} block @param {FluidExporterRuntime} runtime @param {Player} player */
function openAddFluidMenu(block, runtime, player) {
  if (!requireFilterUpgrade(block, player)) return;

  new ActionFormData()
    .title(translate("ui.utilitycraft:fluid_transfer.add_fluid"))
    .body(translate("ui.utilitycraft:fluid_transfer.add_fluid_prompt"))
    .button(translatedButton(
      "ui.utilitycraft:fluid_transfer.add_from_main_hand",
      "ui.utilitycraft:fluid_transfer.add_from_main_hand_description",
    ), "textures/ui/icon_import.png")
    .button(translatedButton(
      "ui.utilitycraft:fluid_transfer.add_from_source",
      "ui.utilitycraft:fluid_transfer.add_from_source_description",
    ), "textures/items/bucket_empty.png")
    .button(translate("ui.utilitycraft:fluid_transfer.cancel"), "textures/ui/redX1.png")
    .show(player)
    .then((result) => {
      if (result.selection === 0) addHeldFluidFilter(block, runtime, player);
      else if (result.selection === 1) openSourceFluidFilterMenu(block, runtime, player);
    });
}

/** @param {Block} block @param {FluidExporterRuntime} runtime @param {Player} player */
function addHeldFluidFilter(block, runtime, player) {
  if (!requireFilterUpgrade(block, player)) return;
  const mainHand = player.getComponent("equippable")?.getEquipment("Mainhand");
  const fluid = mainHand ? FluidStorage.itemFluidStorages[mainHand.typeId] : undefined;
  if (!fluid) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.hold_fluid_container"));
    return;
  }
  runtime.filterFluids.add(fluid.type);
  persistExporterRuntime(runtime);
  player.onScreenDisplay.setActionBar(translate(
    "message.utilitycraft.fluid_transfer.fluid_added",
    [formatIdentifier(fluid.type)],
  ));
}

/** @param {Block} block @param {FluidExporterRuntime} runtime @param {Player} player */
function openSourceFluidFilterMenu(block, runtime, player) {
  if (!requireFilterUpgrade(block, player)) return;
  const types = getSourceFluidTypes(runtime, block.dimension);
  if (types.length === 0) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.no_source_fluids"));
    return;
  }
  const form = new ModalFormData()
    .title(translate("ui.utilitycraft:fluid_transfer.select_fluids"));
  for (const type of types) {
    form.toggle(formatIdentifier(type), {
      defaultValue: runtime.filterFluids.has(type),
      tooltip: translate("ui.utilitycraft:fluid_transfer.source_fluid_tooltip"),
    });
  }
  form.submitButton(translate("ui.utilitycraft:fluid_transfer.save_selection"));
  form.show(player).then((result) => {
    if (result.canceled) return;
    const values = Array.isArray(result.formValues) ? result.formValues : [];
    values.filter((value) => typeof value === "boolean").forEach((enabled, index) => {
      if (enabled) runtime.filterFluids.add(types[index]);
      else runtime.filterFluids.delete(types[index]);
    });
    persistExporterRuntime(runtime);
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.filter_updated"));
  });
}

/** @param {Block} block @param {FluidExporterRuntime} runtime @param {Player} player */
function openRemoveFluidMenu(block, runtime, player) {
  const fluids = [...runtime.filterFluids];
  if (fluids.length === 0) {
    player.onScreenDisplay.setActionBar(translate("message.utilitycraft.fluid_transfer.no_fluids"));
    return;
  }

  const menu = new ActionFormData()
    .title(translate("ui.utilitycraft:fluid_transfer.remove_fluid"))
    .body(translate("ui.utilitycraft:fluid_transfer.remove_fluid_prompt"));
  for (const type of fluids) menu.button(formatIdentifier(type));
  menu.button(translate("ui.utilitycraft:fluid_transfer.cancel"), "textures/ui/redX1.png");
  menu.show(player).then((result) => {
    if (result.selection === undefined || result.selection === fluids.length) return;
    const selected = fluids[result.selection];
    if (!selected) return;
    runtime.filterFluids.delete(selected);
    persistExporterRuntime(runtime);
    player.onScreenDisplay.setActionBar(translate(
      "message.utilitycraft.fluid_transfer.fluid_removed",
      [formatIdentifier(selected)],
    ));
    openFluidExporterMenu(block, player);
  });
}

const fluidExporterComponent = {
  beforeOnPlayerPlace({ block }) {
    const dimension = block.dimension;
    const location = normalizeLocation(block.location);
    system.run(() => {
      deleteExporterState(dimension, location);
      const placed = safeGetBlock(dimension, location);
      if (!placed?.hasTag("dorios:isExporter")) return;
      const runtime = getExporterRuntime(placed);
      persistExporterRuntime(runtime);
      scheduleFluidNetworkRescan(location, dimension);
    });
  },

  onPlayerBreak({ block }) {
    deleteExporterState(block.dimension, block.location);
    block.dimension.getEntitiesAtBlockLocation(block.location)
      .find((entity) => entity.typeId === "utilitycraft:pipe")?.remove();
    scheduleFluidNetworkRescan(block.location, block.dimension);
  },

  onBreak({ block }) {
    deleteExporterState(block.dimension, block.location);
    scheduleFluidNetworkRescan(block.location, block.dimension);
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId?.includes("upgrade")) return;
    openFluidExporterMenu(block, player);
  },

  onTick({ block, dimension }) {
    processFluidExporterTick(block, dimension);
  },
};

networkRegistrar.block("fluid_extractor", fluidExporterComponent);

/** @param {Block} block @param {Dimension} dimension */
function processFluidExporterTick(block, dimension) {
  if (!globalThis.worldLoaded) return;
  const runtime = getExporterRuntime(block);
  if (!runtime.persistenceReady || !runtime.document.enabled || !runtime.document.source) return;

  const filterEnabled = block.permutation.getState("utilitycraft:filter") === 1;
  const sourceAccess = getSourceAccess(runtime, dimension);
  if (sourceAccess) {
    let attempts = 0;
    for (const sourceIndex of sourceAccess.indices) {
      if (attempts >= MAX_SOURCE_INDEX_ATTEMPTS) break;
      const storage = DoriosFluid.getFluidStorage(sourceAccess.resolved, sourceIndex);
      if (!storage || storage.get() <= 0) continue;
      const type = storage.getType();
      if (!type || type === "empty") continue;
      if (filterEnabled && !passesFilter(runtime, type)) continue;
      attempts++;
      if (transferContainerSource(runtime, dimension, sourceAccess, sourceIndex) > 0) break;
    }
    return;
  }

  const special = readSpecialFluidSource(dimension, runtime.document.source.location);
  if (!special || (filterEnabled && !passesFilter(runtime, special.type))) return;
  const moved = insertSpecialSource(runtime, dimension, special);
  if (moved > 0) drainSpecialFluidSource(special.block, moved);
}

/** @param {FluidExporterRuntime} runtime @param {string} type */
function passesFilter(runtime, type) {
  const listed = runtime.filterFluids.has(type);
  return runtime.document.filter.mode === "whitelist" ? listed : !listed;
}

/** @param {FluidExporterRuntime} runtime @param {Dimension} dimension @param {FluidContainerAccess} source @param {number} sourceIndex */
function transferContainerSource(runtime, dimension, source, sourceIndex) {
  return transferAcrossTargets(runtime, dimension, (target, remaining) => DoriosFluid.transferFluid(source.resolved, {
    sourceIndex,
    target: target.resolved,
    targetIndices: target.indices,
    maxAmount: remaining,
  }));
}

/**
 * Inserts external world fluids without creating fractional source units.
 * Vanilla sources move as one bucket and crucibles as complete 250 mB levels.
 *
 * @param {FluidExporterRuntime} runtime
 * @param {Dimension} dimension
 * @param {{type:string,amount:number,unit:number}} source
 */
function insertSpecialSource(runtime, dimension, source) {
  const limit = Math.floor(Math.min(MAX_TRANSFER_AMOUNT, source.amount) / source.unit) * source.unit;
  if (limit <= 0) return 0;

  return transferAcrossTargets(runtime, dimension, (target, remaining) => {
    let moved = 0;
    while (remaining - moved >= source.unit) {
      const added = DoriosFluid.insertFluid(target.resolved, {
        type: source.type,
        amount: source.unit,
        indices: target.indices,
        exact: true,
      });
      if (added !== source.unit) break;
      moved += added;
    }
    return moved;
  }, limit);
}

/**
 * @param {FluidExporterRuntime} runtime
 * @param {Dimension} dimension
 * @param {(target:FluidContainerAccess, remaining:number)=>number} transfer
 * @param {number} [limit]
 */
function transferAcrossTargets(runtime, dimension, transfer, limit = MAX_TRANSFER_AMOUNT) {
  const targets = runtime.document.targets;
  const count = targets.length;
  if (count === 0 || limit <= 0) return 0;
  let remaining = limit;
  let lastMovedIndex = -1;

  for (let offset = 0; offset < count && remaining > 0; offset++) {
    let index;
    if (runtime.document.mode === "farthest") index = count - 1 - offset;
    else if (runtime.document.mode === "round") index = (runtime.roundIndex + offset) % count;
    else index = offset;
    const access = getTargetAccess(runtime, dimension, targets[index]);
    if (!access || access.indices.length === 0) continue;
    const moved = transfer(access, remaining);
    if (moved <= 0) continue;
    remaining -= moved;
    lastMovedIndex = index;
  }

  if (runtime.document.mode === "round" && lastMovedIndex >= 0) {
    runtime.roundIndex = (lastMovedIndex + 1) % count;
  }
  return limit - remaining;
}

/** @param {FluidExporterRuntime} runtime @param {Dimension} dimension */
function getSourceFluidTypes(runtime, dimension) {
  const access = getSourceAccess(runtime, dimension);
  if (access) {
    const types = new Set();
    for (const fluidIndex of access.indices) {
      const storage = DoriosFluid.getFluidStorage(access.resolved, fluidIndex);
      const type = storage?.getType();
      if (storage && storage.get() > 0 && type && type !== "empty") types.add(type);
    }
    return [...types];
  }
  const source = runtime.document.source
    ? readSpecialFluidSource(dimension, runtime.document.source.location)
    : undefined;
  return source ? [source.type] : [];
}

/** @param {Dimension} dimension @param {Vector3} location */
function readSpecialFluidSource(dimension, location) {
  const block = safeGetBlock(dimension, location);
  if (!block) return undefined;
  if ((block.typeId === "minecraft:water" || block.typeId === "minecraft:lava")
    && block.permutation.getState("liquid_depth") === 0) {
    return { block, type: block.typeId.slice("minecraft:".length), amount: 1000, unit: 1000 };
  }
  if (block.typeId === "utilitycraft:crucible") {
    const level = Number(block.permutation.getState("utilitycraft:lava") ?? 0);
    return level > 0 ? { block, type: "lava", amount: level * 250, unit: 250 } : undefined;
  }
  return undefined;
}

/** @param {Block} block @param {number} moved */
function drainSpecialFluidSource(block, moved) {
  if (block.typeId === "minecraft:water" || block.typeId === "minecraft:lava") {
    if (moved >= 1000) block.setType("minecraft:air");
    return;
  }
  if (block.typeId === "utilitycraft:crucible") {
    const current = Number(block.permutation.getState("utilitycraft:lava") ?? 0);
    const drained = Math.min(current, Math.floor(moved / 250));
    if (drained > 0) {
      block.setPermutation(block.permutation.withState("utilitycraft:lava", Math.max(0, current - drained)));
    }
  }
}

/** @param {Block} block */
function getAttachedFluidEndpoint(block) {
  return getAttachedContainerEndpoint(block);
}

/** @param {Block} block */
function isFluidNetworkBlock(block) {
  return Boolean(block?.hasTag("dorios:fluid") && (
    block.hasTag("dorios:isTube")
    || block.hasTag("dorios:isExporter")
    || block.hasTag("dorios:isImporter")
  ));
}

/** @param {Vector3} left @param {Vector3} right */
function squaredDistance(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

/** @param {ReadonlyArray<Vector3>} changedLocations @param {Dimension} dimension */
async function rebuildFluidNetworkBatch(changedLocations, dimension) {
  const covered = new Set();
  for (const changedLocation of changedLocations) {
    const changedKey = locationKey(dimension.id, changedLocation);
    if (covered.has(changedKey)) continue;
    const roots = [
      changedLocation,
      ...NETWORK_OFFSETS.map((offset) => offsetLocation(changedLocation, offset)),
    ];
    for (const root of roots) {
      const key = locationKey(dimension.id, root);
      if (covered.has(key)) continue;
      const block = safeGetBlock(dimension, root);
      if (!block || !isFluidNetworkBlock(block)) continue;
      const visited = await rescanFluidNetwork(block.location, dimension);
      for (const visitedKey of visited) covered.add(visitedKey);
    }
  }
}

/** @param {Vector3} rootLocation @param {Dimension} dimension @returns {Promise<Set<string>>} */
export async function rescanFluidNetwork(rootLocation, dimension) {
  const rootBlock = safeGetBlock(dimension, rootLocation);
  if (!rootBlock) return new Set();
  const networkColor = getNetworkColor(rootBlock);
  const queue = [normalizeLocation(rootLocation)];
  let queueHead = 0;
  let processed = 0;
  const visited = new Set();
  const exporters = [];
  /** @type {Map<string,PersistedFluidEndpoint>} */
  const routes = new Map();

  while (queueHead < queue.length) {
    if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) await system.waitTicks(1);
    processed++;
    const position = queue[queueHead++];
    const key = locationKey(dimension.id, position);
    if (visited.has(key)) continue;
    const block = safeGetBlock(dimension, position);
    if (!block || !isFluidNetworkBlock(block) || !block.hasTag(networkColor)) continue;
    visited.add(key);

    const isExporter = block.hasTag("dorios:isExporter");
    const source = isExporter ? getAttachedFluidEndpoint(block) : undefined;
    const sourceOffset = source
      ? {
          x: source.location.x - block.location.x,
          y: source.location.y - block.location.y,
          z: source.location.z - block.location.z,
        }
      : undefined;
    if (isExporter) exporters.push({ location: normalizeLocation(block.location), source });

    for (const offset of NETWORK_OFFSETS) {
      if (sourceOffset
        && offset.x === sourceOffset.x
        && offset.y === sourceOffset.y
        && offset.z === sourceOffset.z) continue;

      const neighborLocation = offsetLocation(position, offset);
      const neighbor = safeGetBlock(dimension, neighborLocation);
      if (!neighbor) continue;
      if (isFluidNetworkBlock(neighbor)) {
        if (neighbor.hasTag(networkColor)) queue.push(normalizeLocation(neighborLocation));
        continue;
      }
      if (!DoriosFluid.resolveFluidContainerAt(dimension, neighborLocation)) continue;
      const face = getContainerFace(offset);
      if (!face) continue;
      const route = { location: normalizeLocation(neighborLocation), face };
      routes.set(endpointKey(route), route);
    }
  }

  const blockedSources = new Set(
    exporters
      .filter((entry) => entry.source)
      .map((entry) => locationKey(dimension.id, entry.source.location)),
  );

  for (const exporter of exporters) {
    const block = safeGetBlock(dimension, exporter.location);
    if (!block?.hasTag("dorios:isExporter")) continue;
    const runtime = getExporterRuntime(block);
    runtime.document.source = exporter.source
      ? { location: normalizeLocation(exporter.source.location), face: exporter.source.face }
      : null;
    runtime.document.targets = [...routes.values()]
      .filter((route) => !blockedSources.has(locationKey(dimension.id, route.location)))
      .map((route) => ({ route, distance: squaredDistance(exporter.location, route.location) }))
      .sort((left, right) => left.distance - right.distance)
      .map(({ route }) => route);
    runtime.sourceAccess = undefined;
    runtime.targetAccesses.clear();
    runtime.roundIndex = 0;
    persistExporterRuntime(runtime);
  }
  return visited;
}

/** Queues a fluid topology update after the shared debounce window. */
export function scheduleFluidNetworkRescan(location, dimension) {
  queueFluidNetworkRescan(location, dimension);
}

const queueFluidNetworkRescan = createNetworkRescanScheduler(
  "fluids",
  rebuildFluidNetworkBatch,
);

/**
 * Relocates position-keyed fluid exporter documents after a piston movement.
 *
 * @param {Dimension} dimension
 * @param {ReadonlyArray<{source:Vector3,target:Vector3}>} movements
 */
export function reconcileMovedFluidNodes(dimension, movements) {
  const snapshots = [];
  for (const movement of movements) {
    const targetBlock = safeGetBlock(dimension, movement.target);
    if (!targetBlock?.hasTag("dorios:isExporter") || !targetBlock.hasTag("dorios:fluid")) continue;
    snapshots.push({
      targetKey: exporterPropertyKey(dimension, movement.target),
      document: readExporterDocument(exporterPropertyKey(dimension, movement.source)),
    });
  }
  for (const movement of movements) {
    const sourceKey = exporterPropertyKey(dimension, movement.source);
    const targetKey = exporterPropertyKey(dimension, movement.target);
    clearExporterStorage(sourceKey);
    clearExporterStorage(targetKey);
    exporterCache.delete(sourceKey);
    exporterCache.delete(targetKey);
  }
  for (const snapshot of snapshots) {
    if (snapshot.document !== undefined) {
      writeExporterDocument(snapshot.targetKey, normalizeExporterDocument(snapshot.document));
    }
  }
  for (const movement of movements) scheduleFluidNetworkRescan(movement.target, dimension);
}

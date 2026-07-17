// @ts-check

import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as DoriosContainer from "../../DoriosLib/containers/index.js";
import { DIRECTIONS } from "../../DoriosLib/containers/constants.js";
import { capitalizeFirst, formatIdentifier } from "../../DoriosLib/text/index.js";
import {
  NETWORK_OFFSETS,
  getAttachedContainerEndpoint,
  getContainerFace,
  getNetworkColor,
  isItemNetworkBlock,
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
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../../DoriosLib/containers/config.js").ContainerFace} ContainerFace */
/** @typedef {import("../../DoriosLib/containers/index.js").ResolvedContainer} ResolvedContainer */

const NETWORK_VERSION = 1;
const MAX_SOURCE_SLOT_ATTEMPTS = 3;
const MAX_TRANSFER_AMOUNT = 64;
const MAX_PROPERTY_CHUNK_LENGTH = 24_000;
const MAX_EXPORTER_CHUNKS = 128;
const EXPORTER_PROPERTY_PREFIX = "utilitycraft:ie";
const IMPORTER_PROPERTY_PREFIX = "utilitycraft:ii";
const EXPORTER_STORAGE_FORMAT = "utilitycraft:item_exporter:v1";

/**
 * @typedef {object} PersistedEndpoint
 * @property {Vector3} location Real container access location.
 * @property {ContainerFace} face Face of the container touched by the network.
 * @property {Vector3} [importerLocation] Importer that owns the filter for this route.
 */

/**
 * @typedef {object} ExporterStorageManifest
 * @property {typeof EXPORTER_STORAGE_FORMAT} format
 * @property {0|1} generation
 * @property {number} chunks
 * @property {number} length
 */

/**
 * @typedef {object} ExporterDocument
 * @property {number} version
 * @property {boolean} enabled
 * @property {"nearest"|"farthest"|"round"} mode
 * @property {{mode:"whitelist"|"blacklist",items:string[]}} filter
 * @property {{location:Vector3,face:ContainerFace}|null} source
 * @property {PersistedEndpoint[]} targets
 */

/**
 * @typedef {object} ImporterDocument
 * @property {number} version
 * @property {"whitelist"|"blacklist"} mode
 * @property {string[]} items
 */

/**
 * @typedef {object} ContainerAccess
 * @property {ResolvedContainer} resolved
 * @property {ReadonlyArray<number>} slots
 * @property {number} revision
 */

/**
 * @typedef {object} ExporterRuntime
 * @property {string} key
 * @property {ExporterDocument} document
 * @property {Set<string>} filterItems
 * @property {number} roundIndex
 * @property {boolean} persistenceReady
 * @property {ContainerAccess|undefined} sourceAccess
 * @property {Map<string,ContainerAccess>} targetAccesses
 */

/** @type {Map<string,ExporterRuntime>} */
const exporterCache = new Map();
/** @type {Map<string,{document:ImporterDocument,items:Set<string>}>} */
const importerCache = new Map();
/** @type {Map<string,number>} */
const containerAccessRevisions = new Map();

/** @param {string} dimensionId @param {Vector3} location */
function locationKey(dimensionId, location) {
  return `${dimensionId}:${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

/** @param {Dimension} dimension @param {Vector3} location */
function exporterPropertyKey(dimension, location) {
  return `${EXPORTER_PROPERTY_PREFIX}:${dimensionStorageKey(dimension.id)}:${coordinateKey(location)}`;
}

/** @param {Dimension} dimension @param {Vector3} location */
function importerPropertyKey(dimension, location) {
  return `${IMPORTER_PROPERTY_PREFIX}:${dimensionStorageKey(dimension.id)}:${coordinateKey(location)}`;
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

function createExporterDocument() {
  return /** @type {ExporterDocument} */ ({
    version: NETWORK_VERSION,
    enabled: true,
    mode: "nearest",
    filter: { mode: "whitelist", items: [] },
    source: null,
    targets: [],
  });
}

function createImporterDocument() {
  return /** @type {ImporterDocument} */ ({
    version: NETWORK_VERSION,
    mode: "whitelist",
    items: [],
  });
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

/** @param {unknown} value @returns {ContainerFace|undefined} */
function normalizeFace(value) {
  return DIRECTIONS.includes(value) ? /** @type {ContainerFace} */ (value) : undefined;
}

/** @param {unknown} value @returns {ExporterDocument} */
function normalizeExporterDocument(value) {
  const fallback = createExporterDocument();
  if (!value || typeof value !== "object") return fallback;
  const raw = /** @type {Record<string,unknown>} */ (value);

  const mode = raw.mode === "farthest" || raw.mode === "round" ? raw.mode : "nearest";
  const rawFilter = raw.filter && typeof raw.filter === "object"
    ? /** @type {Record<string,unknown>} */ (raw.filter)
    : {};
  const filterMode = rawFilter.mode === "blacklist" ? "blacklist" : "whitelist";

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
    const importerLocation = normalizePersistedLocation(targetRaw.importerLocation);
    const face = normalizeFace(targetRaw.face);
    if (!location || !face) continue;
    targets.push({
      location,
      face,
      ...(importerLocation ? { importerLocation } : {}),
    });
  }

  return {
    version: NETWORK_VERSION,
    enabled: raw.enabled !== false,
    mode,
    filter: { mode: filterMode, items: normalizeStringArray(rawFilter.items) },
    source,
    targets,
  };
}

/** @param {unknown} value @returns {ImporterDocument} */
function normalizeImporterDocument(value) {
  if (!value || typeof value !== "object") return createImporterDocument();
  const raw = /** @type {Record<string,unknown>} */ (value);
  return {
    version: NETWORK_VERSION,
    mode: raw.mode === "blacklist" ? "blacklist" : "whitelist",
    items: normalizeStringArray(raw.items),
  };
}

/** @param {string} key @returns {unknown} */
function readWorldDocument(key) {
  try {
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== "string") return undefined;
    return JSON.parse(raw);
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
  return /** @type {ExporterStorageManifest} */ ({
    format: EXPORTER_STORAGE_FORMAT,
    generation: raw.generation,
    chunks: Number(raw.chunks),
    length: Number(raw.length),
  });
}

/** @param {string} key @returns {unknown} */
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

/**
 * Atomically publishes a chunked exporter document. The root manifest is
 * replaced only after every chunk exists; a failed write clears the root so a
 * reload cannot consume stale topology.
 *
 * @param {string} key
 * @param {ExporterDocument} value
 */
function writeExporterDocument(key, value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    clearExporterStorage(key);
    console.warn(`[UtilityCore:items] Could not serialize ${key}`, error);
    return false;
  }

  const chunks = [];
  for (let index = 0; index < serialized.length; index += MAX_PROPERTY_CHUNK_LENGTH) {
    chunks.push(serialized.slice(index, index + MAX_PROPERTY_CHUNK_LENGTH));
  }
  if (chunks.length === 0) chunks.push("{}");
  if (chunks.length > MAX_EXPORTER_CHUNKS) {
    clearExporterStorage(key);
    console.warn(`[UtilityCore:items] Exporter topology is too large to persist: ${key}`);
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

    /** @type {ExporterStorageManifest} */
    const manifest = {
      format: EXPORTER_STORAGE_FORMAT,
      generation,
      chunks: chunks.length,
      length: serialized.length,
    };
    world.setDynamicProperty(key, JSON.stringify(manifest));
  } catch (error) {
    clearExporterChunks(key, generation, written);
    clearExporterStorage(key);
    console.warn(`[UtilityCore:items] Could not persist ${key}`, error);
    return false;
  }

  if (previous) clearExporterChunks(key, previous.generation, previous.chunks);
  return true;
}

/** @param {string} key @param {unknown} value */
function writeWorldDocument(key, value) {
  try {
    world.setDynamicProperty(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[UtilityCore:items] Could not persist ${key}`, error);
    return false;
  }
}

/** @param {Block} block @returns {ExporterRuntime} */
function getExporterRuntime(block) {
  const key = exporterPropertyKey(block.dimension, block.location);
  const cached = exporterCache.get(key);
  if (cached) return cached;

  const storedDocument = readExporterDocument(key);
  const document = normalizeExporterDocument(storedDocument);
  const runtime = {
    key,
    document,
    filterItems: new Set(document.filter.items),
    roundIndex: 0,
    persistenceReady: storedDocument !== undefined,
    sourceAccess: undefined,
    targetAccesses: new Map(),
  };
  exporterCache.set(key, runtime);
  if (storedDocument === undefined) runtime.persistenceReady = writeExporterDocument(key, document);
  return runtime;
}

/** @param {ExporterRuntime} runtime @returns {boolean} */
function persistExporterRuntime(runtime) {
  runtime.document.filter.items = [...runtime.filterItems];
  runtime.persistenceReady = writeExporterDocument(runtime.key, runtime.document);
  return runtime.persistenceReady;
}

/** @param {Dimension} dimension @param {Vector3} location */
function getImporterRuntime(dimension, location) {
  const key = importerPropertyKey(dimension, location);
  const cached = importerCache.get(key);
  if (cached) return cached;

  const document = normalizeImporterDocument(readWorldDocument(key));
  const runtime = { document, items: new Set(document.items) };
  importerCache.set(key, runtime);
  if (world.getDynamicProperty(key) === undefined) writeWorldDocument(key, document);
  return runtime;
}

/** @param {Dimension} dimension @param {Vector3} location @param {{document:ImporterDocument,items:Set<string>}} runtime */
function persistImporterRuntime(dimension, location, runtime) {
  runtime.document.items = [...runtime.items];
  writeWorldDocument(importerPropertyKey(dimension, location), runtime.document);
}

/** @param {Dimension} dimension @param {Vector3} location */
function getContainerAccessRevision(dimension, location) {
  return containerAccessRevisions.get(locationKey(dimension.id, location)) ?? 0;
}

/**
 * Marks cached IO-derived slots at a location as stale.
 *
 * @param {Dimension} dimension
 * @param {Vector3} location
 */
export function invalidateItemContainerAt(dimension, location) {
  const key = locationKey(dimension.id, location);
  const current = containerAccessRevisions.get(key) ?? 0;
  containerAccessRevisions.set(key, current >= Number.MAX_SAFE_INTEGER ? 1 : current + 1);
}

/** @param {Entity} entity */
export function invalidateItemContainerConfig(entity) {
  if (!entity?.isValid) return;
  invalidateItemContainerAt(entity.dimension, entity.location);
}

/** @param {Vector3} left @param {Vector3} right */
function isSameBlockLocation(left, right) {
  return Math.floor(left.x) === Math.floor(right.x)
    && Math.floor(left.y) === Math.floor(right.y)
    && Math.floor(left.z) === Math.floor(right.z);
}

/**
 * @param {ResolvedContainer|undefined} resolved
 * @param {Dimension} dimension
 * @param {Vector3} expectedLocation
 */
function isResolvedUsable(resolved, dimension, expectedLocation) {
  if (!resolved) return false;
  try {
    if (resolved.kind === "entity") {
      if (!resolved.entity?.isValid) return false;
      if (resolved.entity.dimension.id !== dimension.id) return false;
      if (!isSameBlockLocation(resolved.entity.location, expectedLocation)) return false;
    } else if (resolved.kind === "block") {
      if (!resolved.block || resolved.block.dimension.id !== dimension.id) return false;
      if (!isSameBlockLocation(resolved.block.location, expectedLocation)) return false;
    }
    return resolved.container?.isValid !== false && Number.isInteger(resolved.container?.size);
  } catch {
    return false;
  }
}

/** @param {ExporterRuntime} runtime @param {Dimension} dimension */
function getSourceAccess(runtime, dimension) {
  const source = runtime.document.source;
  if (!source) return undefined;
  const revision = getContainerAccessRevision(dimension, source.location);
  const cached = runtime.sourceAccess;
  if (cached
    && cached.revision === revision
    && isResolvedUsable(cached.resolved, dimension, source.location)) return cached;

  const resolved = DoriosContainer.resolveAt(dimension, source.location);
  if (!resolved) {
    runtime.sourceAccess = undefined;
    return undefined;
  }
  const slots = DoriosContainer.getOutputSlots(resolved, { face: source.face });
  runtime.sourceAccess = { resolved, slots, revision };
  return runtime.sourceAccess;
}

/** @param {PersistedEndpoint} endpoint */
function endpointKey(endpoint) {
  const importer = endpoint.importerLocation
    ? `:${endpoint.importerLocation.x},${endpoint.importerLocation.y},${endpoint.importerLocation.z}`
    : "";
  return `${endpoint.location.x},${endpoint.location.y},${endpoint.location.z}:${endpoint.face}${importer}`;
}

/** @param {ExporterRuntime} runtime @param {Dimension} dimension @param {PersistedEndpoint} endpoint */
function getTargetAccess(runtime, dimension, endpoint) {
  const key = endpointKey(endpoint);
  const revision = getContainerAccessRevision(dimension, endpoint.location);
  const cached = runtime.targetAccesses.get(key);
  if (cached
    && cached.revision === revision
    && isResolvedUsable(cached.resolved, dimension, endpoint.location)) return cached;

  const resolved = DoriosContainer.resolveAt(dimension, endpoint.location);
  if (!resolved) {
    runtime.targetAccesses.delete(key);
    return undefined;
  }
  const slots = DoriosContainer.getInputSlots(resolved, { face: endpoint.face });
  const access = { resolved, slots, revision };
  runtime.targetAccesses.set(key, access);
  return access;
}

/** @param {Player} player @param {"whitelist"|"blacklist"} mode @param {Iterable<string>} items */
function showFilteredItems(player, mode, items) {
  const values = [...items];
  const list = values.length === 0
    ? "§7(empty)"
    : values.map((item) => `- ${formatIdentifier(item)}`).join("\n");
  const title = mode === "whitelist" ? "Whitelist" : "Blacklist";
  new ActionFormData()
    .title("Filtered Items")
    .body(`${title}\n\n${list}`)
    .button("Close")
    .show(player);
}

/** @param {Block} block @param {Player} player */
function openExporterMenu(block, player) {
  const runtime = getExporterRuntime(block);
  const document = runtime.document;
  const filterMode = document.filter.mode;

  const menu = new ActionFormData()
    .title("Item Exporter Settings")
    .body(`§7Manage item export settings.\n\n§rCurrent mode: §e${capitalizeFirst(document.mode)}\n§rPower: ${document.enabled ? "§aON" : "§cOFF"}`)
    .button(`${document.enabled ? "Turn OFF" : "Turn ON"}\n§8Toggle exporter activity`, `textures/ui/toggle_${document.enabled ? "on" : "off"}`)
    .button(`Transfer Mode\n§8(${capitalizeFirst(document.mode)})`, "textures/items/compass_item.png")
    .button(`${capitalizeFirst(filterMode)} Mode\n§8Click to toggle`, filterMode === "whitelist"
      ? "textures/items/misc/whitelist.png"
      : "textures/items/misc/blacklist.png")
    .button("View Filter Contents\n§8List all filtered items", "textures/ui/icon_book_writable.png")
    .button("Add Item\n§8(Add item from Mainhand)", "textures/ui/icon_import.png")
    .button("Remove Item\n§8(Select item to remove)", "textures/ui/trash_default.png");

  menu.show(player).then((result) => {
    if (result.selection === undefined) return;
    switch (result.selection) {
      case 0:
        document.enabled = !document.enabled;
        persistExporterRuntime(runtime);
        break;
      case 1:
        openExporterModeMenu(runtime, player);
        break;
      case 2:
        document.filter.mode = filterMode === "whitelist" ? "blacklist" : "whitelist";
        persistExporterRuntime(runtime);
        break;
      case 3:
        showFilteredItems(player, document.filter.mode, runtime.filterItems);
        break;
      case 4: {
        if (block.permutation.getState("utilitycraft:filter") !== 1) {
          player.onScreenDisplay.setActionBar("§cMissing filter upgrade.");
          break;
        }
        const item = player.getComponent("equippable")?.getEquipment("Mainhand");
        if (!item) {
          player.onScreenDisplay.setActionBar("§cYou must hold an item in your main hand.");
          break;
        }
        runtime.filterItems.add(item.typeId);
        persistExporterRuntime(runtime);
        break;
      }
      case 5:
        openExporterRemoveMenu(block, runtime, player);
        break;
    }
  });
}

/** @param {ExporterRuntime} runtime @param {Player} player */
function openExporterModeMenu(runtime, player) {
  const modes = ["Nearest", "Farthest", "Round"];
  const defaultIndex = Math.max(0, modes.findIndex((mode) => mode.toLowerCase() === runtime.document.mode));
  new ModalFormData()
    .title("Transfer Mode")
    .dropdown("Select item transfer behavior:", modes, { defaultValueIndex: defaultIndex })
    .show(player)
    .then((result) => {
      if (result.canceled) return;
      const index = Number(result.formValues?.[0] ?? 0);
      runtime.document.mode = /** @type {ExporterDocument["mode"]} */ ((modes[index] ?? "Nearest").toLowerCase());
      persistExporterRuntime(runtime);
    });
}

/** @param {Block} block @param {ExporterRuntime} runtime @param {Player} player */
function openExporterRemoveMenu(block, runtime, player) {
  const items = [...runtime.filterItems];
  if (items.length === 0) {
    player.onScreenDisplay.setActionBar("§cNo items to remove.");
    return;
  }

  const menu = new ActionFormData().title("Remove Item").body("§7Select an item to remove.");
  for (const item of items) menu.button(formatIdentifier(item));
  menu.show(player).then((result) => {
    if (result.selection === undefined) return;
    const selected = items[result.selection];
    if (!selected) return;
    runtime.filterItems.delete(selected);
    persistExporterRuntime(runtime);
    openExporterMenu(block, player);
  });
}

/** @param {Block} block @param {Player} player */
function openImporterMenu(block, player) {
  const runtime = getImporterRuntime(block.dimension, block.location);
  const document = runtime.document;
  const modeText = capitalizeFirst(document.mode);

  const menu = new ActionFormData()
    .title("Item Importer Settings")
    .body(`§7Configure importer filtering.\n\n§rCurrent Mode: §e${modeText}`)
    .button(`${modeText}\n§8Click to toggle`, document.mode === "whitelist"
      ? "textures/items/misc/whitelist.png"
      : "textures/items/misc/blacklist.png")
    .button("View Filter Contents\n§8List all filtered items", "textures/ui/icon_book_writable.png")
    .button("Add Item\n§8(Add item from Mainhand)", "textures/ui/icon_import.png")
    .button("Remove Item\n§8(Select item to remove)", "textures/ui/trash_default.png")
    .button("Close", "textures/ui/redX1.png");

  menu.show(player).then((result) => {
    if (result.canceled) return;
    switch (result.selection) {
      case 0:
        document.mode = document.mode === "whitelist" ? "blacklist" : "whitelist";
        persistImporterRuntime(block.dimension, block.location, runtime);
        break;
      case 1:
        showFilteredItems(player, document.mode, runtime.items);
        break;
      case 2: {
        const item = player.getComponent("equippable")?.getEquipment("Mainhand");
        if (!item) {
          player.onScreenDisplay.setActionBar("§cYou are not holding an item.");
          break;
        }
        runtime.items.add(item.typeId);
        persistImporterRuntime(block.dimension, block.location, runtime);
        break;
      }
      case 3:
        openImporterRemoveMenu(block, runtime, player);
        break;
    }
  });
}

/** @param {Block} block @param {{document:ImporterDocument,items:Set<string>}} runtime @param {Player} player */
function openImporterRemoveMenu(block, runtime, player) {
  const items = [...runtime.items];
  if (items.length === 0) {
    player.onScreenDisplay.setActionBar("§cNo items to remove.");
    return;
  }
  const menu = new ActionFormData().title("Remove Item").body("§7Select an item to remove.");
  for (const item of items) menu.button(formatIdentifier(item));
  menu.button("Cancel");
  menu.show(player).then((result) => {
    if (result.selection === undefined || result.selection === items.length) return;
    const selected = items[result.selection];
    if (!selected) return;
    runtime.items.delete(selected);
    persistImporterRuntime(block.dimension, block.location, runtime);
    openImporterMenu(block, player);
  });
}

const exporterComponent = {
  beforeOnPlayerPlace({ block }) {
    const dimension = block.dimension;
    const location = normalizeLocation(block.location);
    system.run(() => {
      deleteExporterState(dimension, location);
      const placed = safeGetBlock(dimension, location);
      if (!placed?.hasTag("dorios:isExporter")) return;
      const runtime = getExporterRuntime(placed);
      persistExporterRuntime(runtime);
      scheduleItemNetworkRescan(location, dimension);
    });
  },

  onPlayerBreak({ block }) {
    deleteExporterState(block.dimension, block.location);
    scheduleItemNetworkRescan(block.location, block.dimension);
  },

  onBreak({ block }) {
    deleteExporterState(block.dimension, block.location);
    scheduleItemNetworkRescan(block.location, block.dimension);
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId?.includes("upgrade")) return;
    openExporterMenu(block, player);
  },

  onTick({ block, dimension }) {
    processExporterTick(block, dimension);
  },
};

const importerComponent = {
  beforeOnPlayerPlace({ block }) {
    const dimension = block.dimension;
    const location = normalizeLocation(block.location);
    system.run(() => {
      deleteImporterState(dimension, location);
      const placed = safeGetBlock(dimension, location);
      if (!placed?.hasTag("dorios:isImporter")) return;
      const runtime = getImporterRuntime(dimension, location);
      persistImporterRuntime(dimension, location, runtime);
      scheduleItemNetworkRescan(location, dimension);
    });
  },

  onPlayerBreak({ block }) {
    deleteImporterState(block.dimension, block.location);
    scheduleItemNetworkRescan(block.location, block.dimension);
  },

  onBreak({ block }) {
    deleteImporterState(block.dimension, block.location);
    scheduleItemNetworkRescan(block.location, block.dimension);
  },

  onPlayerInteract({ block, player }) {
    if (player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId?.includes("upgrade")) return;
    if (block.permutation.getState("utilitycraft:filter") === 1) openImporterMenu(block, player);
  },
};

networkRegistrar
  .block("exporter", exporterComponent)
  .block("item_importer", importerComponent);

/** @param {Dimension} dimension @param {Vector3} location */
function deleteExporterState(dimension, location) {
  const key = exporterPropertyKey(dimension, location);
  exporterCache.delete(key);
  clearExporterStorage(key);
}

/** @param {Dimension} dimension @param {Vector3} location */
function deleteImporterState(dimension, location) {
  const key = importerPropertyKey(dimension, location);
  importerCache.delete(key);
  try {
    world.setDynamicProperty(key, undefined);
  } catch {}
}

/** @param {Block} block @param {Dimension} dimension */
function processExporterTick(block, dimension) {
  if (!globalThis.worldLoaded) return;
  const runtime = getExporterRuntime(block);
  if (!runtime.persistenceReady) return;
  if (!runtime.document.enabled) return;
  if (!runtime.document.source) return;

  const sourceAccess = getSourceAccess(runtime, dimension);
  if (!sourceAccess || sourceAccess.slots.length === 0) return;
  try {
    if (sourceAccess.resolved.container.emptySlotsCount === sourceAccess.resolved.container.size) return;
  } catch {
    runtime.sourceAccess = undefined;
    return;
  }

  const filterEnabled = block.permutation.getState("utilitycraft:filter") === 1;
  let attempts = 0;
  for (const sourceSlot of sourceAccess.slots) {
    if (attempts >= MAX_SOURCE_SLOT_ATTEMPTS) break;

    let item;
    try {
      item = sourceAccess.resolved.container.getItem(sourceSlot);
    } catch {
      runtime.sourceAccess = undefined;
      return;
    }
    if (!item || item.hasTag("utilitycraft:ui_element")) continue;
    if (filterEnabled && !passesFilter(runtime.document.filter.mode, runtime.filterItems, item.typeId, false)) continue;

    attempts++;
    if (tryTransferToNetwork(runtime, dimension, sourceAccess, sourceSlot, item.typeId)) break;
  }
}

/**
 * @param {"whitelist"|"blacklist"} mode
 * @param {Set<string>} items
 * @param {string} typeId
 * @param {boolean} emptyAllowsAll
 */
function passesFilter(mode, items, typeId, emptyAllowsAll) {
  if (items.size === 0 && emptyAllowsAll) return true;
  const listed = items.has(typeId);
  return mode === "whitelist" ? listed : !listed;
}

/**
 * @param {ExporterRuntime} runtime
 * @param {Dimension} dimension
 * @param {ContainerAccess} sourceAccess
 * @param {number} sourceSlot
 * @param {string} itemTypeId
 */
function tryTransferToNetwork(runtime, dimension, sourceAccess, sourceSlot, itemTypeId) {
  const targets = runtime.document.targets;
  const count = targets.length;
  if (count === 0) return false;

  for (let offset = 0; offset < count; offset++) {
    let index;
    if (runtime.document.mode === "farthest") index = count - 1 - offset;
    else if (runtime.document.mode === "round") index = (runtime.roundIndex + offset) % count;
    else index = offset;

    const endpoint = targets[index];
    if (!passesEndpointFilter(dimension, endpoint, itemTypeId)) continue;

    const targetAccess = getTargetAccess(runtime, dimension, endpoint);
    if (!targetAccess || targetAccess.slots.length === 0) continue;
    if (!passesNativeTargetFilter(dimension, endpoint, targetAccess.resolved, itemTypeId)) continue;

    const moved = DoriosContainer.transfer(sourceAccess.resolved, {
      sourceSlot,
      target: targetAccess.resolved,
      targetSlots: targetAccess.slots,
      maxAmount: MAX_TRANSFER_AMOUNT,
    });
    if (moved <= 0) continue;

    if (runtime.document.mode === "round") runtime.roundIndex = (index + 1) % count;
    return true;
  }
  return false;
}

/** @param {Dimension} dimension @param {PersistedEndpoint} endpoint @param {string} itemTypeId */
function passesEndpointFilter(dimension, endpoint, itemTypeId) {
  if (!endpoint.importerLocation) return true;
  const importerBlock = safeGetBlock(dimension, endpoint.importerLocation);
  if (importerBlock?.permutation.getState("utilitycraft:filter") !== 1) return true;
  const runtime = getImporterRuntime(dimension, endpoint.importerLocation);
  return passesFilter(runtime.document.mode, runtime.items, itemTypeId, true);
}

/**
 * Preserves the existing filter behavior of entity-backed mechanical hoppers
 * when they are direct network targets.
 *
 * @param {Dimension} dimension
 * @param {PersistedEndpoint} endpoint
 * @param {ResolvedContainer} resolved
 * @param {string} itemTypeId
 */
function passesNativeTargetFilter(dimension, endpoint, resolved, itemTypeId) {
  if (endpoint.importerLocation) return true;
  const targetBlock = resolved.block ?? safeGetBlock(dimension, endpoint.location);
  if (targetBlock?.permutation.getState("utilitycraft:filter") !== 1 || !resolved.entity) return true;
  const whitelist = resolved.entity.getDynamicProperty("utilitycraft:whitelistOn") ?? true;
  return resolved.entity.hasTag(itemTypeId) === whitelist;
}

/**
 * Queues an item topology update after the shared debounce window.
 *
 * @param {Vector3} startLocation
 * @param {Dimension} dimension
 */
export function scheduleItemNetworkRescan(startLocation, dimension) {
  queueItemNetworkRescan(startLocation, dimension);
}

/**
 * Rebuilds every distinct item component touched by one debounced batch.
 *
 * @param {ReadonlyArray<Vector3>} changedLocations
 * @param {Dimension} dimension
 */
async function rebuildItemNetworkBatch(changedLocations, dimension) {
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
      if (!block || !isItemNetworkBlock(block)) continue;
      const visited = await rebuildItemNetworkComponent(block.location, dimension);
      for (const visitedKey of visited) covered.add(visitedKey);
    }
  }
}

const queueItemNetworkRescan = createNetworkRescanScheduler(
  "items",
  rebuildItemNetworkBatch,
);

/**
 * @typedef {object} DiscoveredRoute
 * @property {Vector3} location
 * @property {ContainerFace} face
 * @property {Vector3} [importerLocation]
 */

/**
 * @param {Vector3} rootLocation
 * @param {Dimension} dimension
 * @returns {Promise<Set<string>>}
 */
async function rebuildItemNetworkComponent(rootLocation, dimension) {
  const rootBlock = safeGetBlock(dimension, rootLocation);
  if (!rootBlock) return new Set();
  const networkColor = getNetworkColor(rootBlock);
  const queue = [normalizeLocation(rootLocation)];
  let queueHead = 0;
  let processed = 0;
  const visited = new Set();
  const exporters = [];
  /** @type {Map<string,DiscoveredRoute>} */
  const routes = new Map();

  while (queueHead < queue.length) {
    if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) {
      await system.waitTicks(1);
    }
    processed++;

    const position = queue[queueHead++];
    const key = locationKey(dimension.id, position);
    if (visited.has(key)) continue;

    const block = safeGetBlock(dimension, position);
    if (!block || !isItemNetworkBlock(block) || !block.hasTag(networkColor)) continue;
    visited.add(key);

    const isExporter = block.hasTag("dorios:isExporter");
    const isImporter = block.hasTag("dorios:isImporter");
    const attached = isExporter || isImporter ? getAttachedContainerEndpoint(block) : undefined;
    const attachedOffset = attached
      ? {
          x: attached.location.x - block.location.x,
          y: attached.location.y - block.location.y,
          z: attached.location.z - block.location.z,
        }
      : undefined;

    if (isExporter) exporters.push({ location: normalizeLocation(block.location), source: attached });
    if (isImporter && attached && DoriosContainer.resolveAt(dimension, attached.location)) {
      const route = {
        location: normalizeLocation(attached.location),
        face: attached.face,
        importerLocation: normalizeLocation(block.location),
      };
      routes.set(routeKey(route), route);
    }

    for (const offset of NETWORK_OFFSETS) {
      if (attachedOffset
        && offset.x === attachedOffset.x
        && offset.y === attachedOffset.y
        && offset.z === attachedOffset.z
        && (isExporter || isImporter)) {
        continue;
      }

      const neighborLocation = offsetLocation(position, offset);
      const neighbor = safeGetBlock(dimension, neighborLocation);
      if (!neighbor) continue;

      if (isItemNetworkBlock(neighbor)) {
        if (neighbor.hasTag(networkColor)) queue.push(normalizeLocation(neighborLocation));
        continue;
      }

      if (!DoriosContainer.resolveAt(dimension, neighborLocation)) continue;
      const face = getContainerFace(offset);
      if (!face) continue;
      const route = {
        location: normalizeLocation(neighborLocation),
        face,
      };
      routes.set(routeKey(route), route);
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
      .map((route) => ({
        route,
        distance: squaredDistance(exporter.location, route.importerLocation ?? route.location),
      }))
      .sort((left, right) => left.distance - right.distance)
      .map(({ route }) => route);
    runtime.sourceAccess = undefined;
    runtime.targetAccesses.clear();
    runtime.roundIndex = 0;
    persistExporterRuntime(runtime);
  }

  return visited;
}

/** @param {DiscoveredRoute} route */
function routeKey(route) {
  const importer = route.importerLocation
    ? `:${route.importerLocation.x},${route.importerLocation.y},${route.importerLocation.z}`
    : "";
  return `${route.location.x},${route.location.y},${route.location.z}:${route.face}${importer}`;
}

/** @param {Vector3} left @param {Vector3} right */
function squaredDistance(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

/** @typedef {{source:Vector3,target:Vector3}} ItemNodeMovement */

/**
 * Relocates all position-keyed item-node state from one piston activation as
 * a batch. Every source is snapshotted before anything is cleared, so adjacent
 * exporters/importers cannot overwrite each other's configuration.
 *
 * @param {Dimension} dimension
 * @param {ReadonlyArray<ItemNodeMovement>} movements
 */
export function reconcileMovedItemNodes(dimension, movements) {
  if (movements.length === 0) return;

  const exporterSnapshots = [];
  const importerSnapshots = [];

  for (const movement of movements) {
    const targetBlock = safeGetBlock(dimension, movement.target);
    if (targetBlock?.hasTag("dorios:isExporter")) {
      const sourceKey = exporterPropertyKey(dimension, movement.source);
      exporterSnapshots.push({
        targetKey: exporterPropertyKey(dimension, movement.target),
        document: readExporterDocument(sourceKey),
      });
    }
    if (targetBlock?.hasTag("dorios:isImporter")) {
      const sourceKey = importerPropertyKey(dimension, movement.source);
      importerSnapshots.push({
        targetKey: importerPropertyKey(dimension, movement.target),
        document: readWorldDocument(sourceKey),
      });
    }
  }

  // Clear both ends only after all overlapping sources were read.
  for (const movement of movements) {
    const exporterSource = exporterPropertyKey(dimension, movement.source);
    const exporterTarget = exporterPropertyKey(dimension, movement.target);
    clearExporterStorage(exporterSource);
    clearExporterStorage(exporterTarget);
    exporterCache.delete(exporterSource);
    exporterCache.delete(exporterTarget);

    const importerSource = importerPropertyKey(dimension, movement.source);
    const importerTarget = importerPropertyKey(dimension, movement.target);
    try {
      world.setDynamicProperty(importerSource, undefined);
      world.setDynamicProperty(importerTarget, undefined);
    } catch {}
    importerCache.delete(importerSource);
    importerCache.delete(importerTarget);
  }

  for (const snapshot of exporterSnapshots) {
    if (snapshot.document !== undefined) {
      writeExporterDocument(snapshot.targetKey, normalizeExporterDocument(snapshot.document));
    }
  }
  for (const snapshot of importerSnapshots) {
    if (snapshot.document !== undefined) {
      writeWorldDocument(snapshot.targetKey, normalizeImporterDocument(snapshot.document));
    }
  }

  for (const movement of movements) scheduleItemNetworkRescan(movement.target, dimension);
}

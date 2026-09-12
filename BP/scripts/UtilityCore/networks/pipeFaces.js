// @ts-check

import { system, world } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {"north"|"south"|"east"|"west"|"up"|"down"} PipeDirection */
/** @typedef {"item"|"fluid"|"gas"|"energy"} PipeResource */
/**
 * @typedef {object} PipeResourceDefinition
 * @property {string} id Persisted channel identifier.
 * @property {string} tag Block capability tag used to expose the channel.
 * @property {string} translationKey Wrench toggle translation key.
 */

const PIPE_FACE_PROPERTY_PREFIX = "utilitycraft:pf";
const PIPE_FACE_DOCUMENT_VERSION = 2;
export const MULTI_TUBE_TAG = "dorios:multi_tube";
export const MULTI_EXPORTER_TAG = "dorios:multi_exporter";
export const MULTI_IMPORTER_TAG = "dorios:multi_importer";
export const PIPE_RESOURCES = Object.freeze(["item", "fluid", "gas", "energy"]);
const PIPE_RESOURCE_TAGS = Object.freeze({
  item: "dorios:item",
  fluid: "dorios:fluid",
  gas: "dorios:gas",
  energy: "dorios:energy",
});
const PIPE_NETWORK_TAGS = Object.freeze(Object.values(PIPE_RESOURCE_TAGS));
export const PIPE_RESOURCE_REGISTER_EVENT = "utilitycraft:register_pipe_resource";
export const PIPE_RESOURCE_REGISTRY_READY_EVENT = "utilitycraft:pipe_resource_registry_ready";

/** @type {Map<string,Readonly<PipeResourceDefinition>>} */
const registeredPipeResources = new Map(PIPE_RESOURCES.map((id) => [
  id,
  Object.freeze({
    id,
    tag: PIPE_RESOURCE_TAGS[id],
    translationKey: `ui.utilitycraft:multi_tube.channel_${id}`,
  }),
]));

export const PIPE_DIRECTION_OFFSETS = Object.freeze({
  north: Object.freeze({ x: 0, y: 0, z: -1 }),
  south: Object.freeze({ x: 0, y: 0, z: 1 }),
  east: Object.freeze({ x: 1, y: 0, z: 0 }),
  west: Object.freeze({ x: -1, y: 0, z: 0 }),
  up: Object.freeze({ x: 0, y: 1, z: 0 }),
  down: Object.freeze({ x: 0, y: -1, z: 0 }),
});

export const PIPE_DIRECTIONS = Object.freeze(
  Object.entries(PIPE_DIRECTION_OFFSETS).map(([direction, offset]) => Object.freeze({
    direction: /** @type {PipeDirection} */ (direction),
    offset,
  })),
);

export const OPPOSITE_DIRECTIONS = Object.freeze({
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
});

// Endpoint connection states name local model bones. This map converts a
// physical world direction to the state that renders that direction after the
// endpoint's minecraft:block_face transformation is applied.
const ENDPOINT_STATE_DIRECTION_MAP = Object.freeze({
  north: Object.freeze({ north: "south", south: "north", east: "west", west: "east", up: "up", down: "down" }),
  south: Object.freeze({ north: "north", south: "south", east: "east", west: "west", up: "up", down: "down" }),
  east: Object.freeze({ north: "east", south: "west", east: "south", west: "north", up: "up", down: "down" }),
  west: Object.freeze({ north: "west", south: "east", east: "north", west: "south", up: "up", down: "down" }),
  up: Object.freeze({ north: "up", south: "down", east: "east", west: "west", up: "south", down: "north" }),
  down: Object.freeze({ north: "down", south: "up", east: "east", west: "west", up: "north", down: "south" }),
});

/**
 * @typedef {object} PipeFaceState
 * @property {ReadonlySet<PipeDirection>} disabled Every resource is blocked.
 * @property {ReadonlyMap<PipeDirection,ReadonlySet<string>>} resources
 * Per-resource blocks. Unknown resource identifiers are retained so another
 * addon can own an additional channel without UtilityCore knowing its type.
 */

/** @type {Map<string,PipeFaceState>} */
const disabledFaceCache = new Map();

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

/** @param {Dimension} dimension @param {Vector3} location */
function pipeFacePropertyKey(dimension, location) {
  return `${PIPE_FACE_PROPERTY_PREFIX}:${dimensionStorageKey(dimension.id)}:${coordinateKey(location)}`;
}

/** @param {unknown} value @returns {PipeDirection|undefined} */
export function normalizePipeDirection(value) {
  const direction = String(value ?? "").toLowerCase();
  return Object.hasOwn(PIPE_DIRECTION_OFFSETS, direction)
    ? /** @type {PipeDirection} */ (direction)
    : undefined;
}

/** @param {unknown} value @returns {PipeResource|undefined} */
export function normalizePipeResource(value) {
  const resource = String(value ?? "").toLowerCase();
  return registeredPipeResources.has(resource) ? resource : undefined;
}

/** @param {unknown} value @returns {string|undefined} */
function normalizeStoredResource(value) {
  const resource = String(value ?? "").toLowerCase();
  return /^[a-z0-9_.:-]{1,64}$/.test(resource) ? resource : undefined;
}

/**
 * Registers an additional face-configurable channel without adding it to the
 * UtilityCraft-owned network scanners. Registration is idempotent, but an
 * existing identifier cannot be replaced with a different definition.
 * @param {unknown} value
 */
export function registerPipeResource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = /** @type {{id?:unknown,tag?:unknown,translationKey?:unknown}} */ (value);
  const id = normalizeStoredResource(raw.id);
  const tag = String(raw.tag ?? "").toLowerCase();
  const translationKey = String(raw.translationKey ?? "");
  if (!id
    || !/^[a-z0-9_.-]+:[a-z0-9_./-]{1,96}$/.test(tag)
    || translationKey.length < 1
    || translationKey.length > 160
    || /[\u0000-\u001f]/.test(translationKey)) return false;

  const existing = registeredPipeResources.get(id);
  if (existing) {
    return existing.tag === tag && existing.translationKey === translationKey;
  }
  registeredPipeResources.set(id, Object.freeze({ id, tag, translationKey }));
  return true;
}

/** @returns {ReadonlyArray<Readonly<PipeResourceDefinition>>} */
export function getRegisteredPipeResources() {
  return [...registeredPipeResources.values()];
}

/** @param {unknown} rawResource */
export function getPipeResourceTranslationKey(rawResource) {
  const resource = normalizePipeResource(rawResource);
  return resource ? registeredPipeResources.get(resource)?.translationKey : undefined;
}

/** @param {Block|undefined} block */
export function isMultiTube(block) {
  return block?.hasTag?.(MULTI_TUBE_TAG) === true;
}

/** @param {Block|undefined} block */
export function isExporterEndpoint(block) {
  return block?.hasTag?.("dorios:isExporter") === true
    || block?.hasTag?.(MULTI_EXPORTER_TAG) === true;
}

/** @param {Block|undefined} block */
export function isImporterEndpoint(block) {
  return block?.hasTag?.("dorios:isImporter") === true
    || block?.hasTag?.(MULTI_IMPORTER_TAG) === true;
}

/** @param {Block|undefined} block */
export function isMultiEndpoint(block) {
  return block?.hasTag?.(MULTI_EXPORTER_TAG) === true
    || block?.hasTag?.(MULTI_IMPORTER_TAG) === true;
}

/** @param {Block|undefined} block @returns {string[]} */
export function getSupportedPipeResources(block) {
  if (!block) return [];
  const supported = [];
  for (const resource of registeredPipeResources.values()) {
    if (block.hasTag(resource.tag)) supported.push(resource.id);
  }
  return supported;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
  if (id !== PIPE_RESOURCE_REGISTER_EVENT) return;
  try {
    registerPipeResource(JSON.parse(message));
  } catch {}
}, {
  namespaces: ["utilitycraft"],
});

// The ready event plus the addon's next-tick registration avoids depending on
// behavior-pack script evaluation order without introducing recurring work.
system.run(() => {
  try {
    system.sendScriptEvent(PIPE_RESOURCE_REGISTRY_READY_EVENT, "");
  } catch {}
});

/** @param {unknown} value @returns {PipeFaceState} */
function normalizePipeFaceState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { disabled: new Set(), resources: new Map() };
  }
  const raw = /** @type {{disabled?:unknown,resources?:unknown}} */ (value);
  const disabled = new Set();
  for (const entry of Array.isArray(raw.disabled) ? raw.disabled : []) {
    const direction = normalizePipeDirection(entry);
    if (direction) disabled.add(direction);
  }

  /** @type {Map<PipeDirection,ReadonlySet<string>>} */
  const resources = new Map();
  if (raw.resources && typeof raw.resources === "object" && !Array.isArray(raw.resources)) {
    for (const [rawDirection, rawResources] of Object.entries(raw.resources)) {
      const direction = normalizePipeDirection(rawDirection);
      if (!direction || !Array.isArray(rawResources)) continue;
      const blocked = new Set();
      for (const rawResource of rawResources) {
        const resource = normalizeStoredResource(rawResource);
        if (resource) blocked.add(resource);
      }
      if (blocked.size > 0) resources.set(direction, blocked);
    }
  }

  return { disabled, resources };
}

/** @param {Dimension} dimension @param {Vector3} location */
function readPipeFaceStateAt(dimension, location) {
  const key = pipeFacePropertyKey(dimension, location);
  const cached = disabledFaceCache.get(key);
  if (cached) return cached;

  /** @type {PipeFaceState} */
  let state = { disabled: new Set(), resources: new Map() };
  try {
    const raw = world.getDynamicProperty(key);
    if (typeof raw === "string" && raw.length > 0) {
      state = normalizePipeFaceState(JSON.parse(raw));
    }
  } catch {}

  disabledFaceCache.set(key, state);
  return state;
}

/**
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @param {PipeFaceState} state
 */
function writePipeFaceStateAt(dimension, location, state) {
  const key = pipeFacePropertyKey(dimension, location);
  /** @type {Set<PipeDirection>} */
  const disabled = new Set();
  for (const entry of state.disabled) {
    const direction = normalizePipeDirection(entry);
    if (direction) disabled.add(direction);
  }
  /** @type {Record<string,string[]>} */
  const resources = {};
  for (const [rawDirection, rawResources] of state.resources) {
    const direction = normalizePipeDirection(rawDirection);
    if (!direction) continue;
    const normalized = [];
    for (const rawResource of rawResources) {
      const resource = normalizeStoredResource(rawResource);
      if (resource && !normalized.includes(resource)) normalized.push(resource);
    }
    if (normalized.length > 0) resources[direction] = normalized;
  }

  try {
    world.setDynamicProperty(
      key,
      disabled.size > 0 || Object.keys(resources).length > 0
        ? JSON.stringify({
          version: PIPE_FACE_DOCUMENT_VERSION,
          ...(disabled.size > 0 ? { disabled: [...disabled] } : {}),
          ...(Object.keys(resources).length > 0 ? { resources } : {}),
        })
        : undefined,
    );
  } catch {
    return false;
  }

  if (disabled.size > 0 || Object.keys(resources).length > 0) {
    disabledFaceCache.set(key, {
      disabled,
      resources: new Map(Object.entries(resources).map(([direction, values]) => [
        /** @type {PipeDirection} */ (direction),
        new Set(values),
      ])),
    });
  } else {
    disabledFaceCache.delete(key);
  }
  return true;
}

/** @param {Block} block @param {PipeFaceState} state */
function writeBlockPipeFaceState(block, state) {
  const changed = writePipeFaceStateAt(block.dimension, block.location, state);
  if (changed) notifyPipeFaceChange(block);
  return changed;
}

/**
 * Emits a capability-neutral event so addon-owned network types can react to
 * face changes without UtilityCore knowing those network types.
 * @param {Block} block
 */
function notifyPipeFaceChange(block) {
  try {
    system.sendScriptEvent("utilitycraft:pipe_face_update", JSON.stringify({
      dimensionId: block.dimension.id,
      location: {
        x: Math.floor(block.location.x),
        y: Math.floor(block.location.y),
        z: Math.floor(block.location.z),
      },
    }));
  } catch {}
}

/** @param {Dimension} dimension @param {Vector3} location @param {ReadonlySet<PipeDirection>} disabled */
function writeDisabledFacesAt(dimension, location, disabled) {
  return writePipeFaceStateAt(dimension, location, { disabled, resources: new Map() });
}

/** @param {Block} block @param {PipeDirection} direction @param {string|undefined} [rawResource] */
export function isPipeFaceDisabled(block, direction, rawResource) {
  if (!block?.hasTag("dorios:isTube")) return false;
  if (getProtectedEndpointDirection(block) === direction) return false;
  const state = readPipeFaceStateAt(block.dimension, block.location);
  if (state.disabled.has(direction)) return true;
  if (!isMultiTube(block)) return false;
  const resource = normalizeStoredResource(rawResource);
  return resource ? state.resources.get(direction)?.has(resource) === true : false;
}

/**
 * @param {Block} block
 * @param {unknown} rawDirection
 * @returns {PipeResource[]}
 */
export function getMultiTubeFaceDisabledResources(block, rawDirection) {
  const direction = normalizePipeDirection(rawDirection);
  if (!direction || !isMultiTube(block)) return [];
  if (getProtectedEndpointDirection(block) === direction) return [];

  const supported = getSupportedPipeResources(block);
  const state = readPipeFaceStateAt(block.dimension, block.location);
  if (state.disabled.has(direction)) return supported;
  const blocked = state.resources.get(direction);
  return supported.filter((resource) => blocked?.has(resource));
}

/**
 * Replaces registered channels while retaining unknown channel ids for addons
 * that are currently absent or have not registered yet.
 * @param {Block} block
 * @param {unknown} rawDirection
 * @param {unknown} rawResources
 */
export function setMultiTubeFaceDisabledResources(block, rawDirection, rawResources) {
  const direction = normalizePipeDirection(rawDirection);
  if (!direction || !isMultiTube(block)) return false;
  if (getProtectedEndpointDirection(block) === direction) return false;

  const supported = new Set(getSupportedPipeResources(block));
  const current = readPipeFaceStateAt(block.dimension, block.location);
  const blocked = new Set(current.resources.get(direction) ?? []);
  for (const resource of supported) blocked.delete(resource);
  for (const rawResource of Array.isArray(rawResources) ? rawResources : []) {
    const resource = normalizePipeResource(rawResource);
    if (resource && supported.has(resource)) blocked.add(resource);
  }

  const next = {
    disabled: new Set(current.disabled),
    resources: new Map(current.resources),
  };
  next.disabled.delete(direction);
  if (blocked.size > 0) next.resources.set(direction, blocked);
  else next.resources.delete(direction);
  return writeBlockPipeFaceState(block, next);
}

/**
 * @param {Block} block
 * @returns {{version:number,disabled?:PipeDirection[],resources?:Record<string,string[]>}|undefined}
 */
export function getPipeFaceCopyConfig(block) {
  if (!block?.hasTag("dorios:isTube")) return undefined;
  const protectedDirection = getProtectedEndpointDirection(block);
  const state = readPipeFaceStateAt(block.dimension, block.location);
  const disabled = [...state.disabled].filter((direction) => direction !== protectedDirection);
  /** @type {Record<string,string[]>} */
  const resources = {};
  if (isMultiTube(block)) {
    for (const [direction, blocked] of state.resources) {
      if (direction === protectedDirection || blocked.size === 0) continue;
      resources[direction] = [...blocked];
    }
  }
  return {
    version: PIPE_FACE_DOCUMENT_VERSION,
    ...(disabled.length > 0 ? { disabled } : {}),
    ...(Object.keys(resources).length > 0 ? { resources } : {}),
  };
}

/** @param {Block} block */
export function getProtectedEndpointDirection(block) {
  if (!isExporterEndpoint(block) && !isImporterEndpoint(block)) return undefined;
  const facing = normalizePipeDirection(block.permutation.getState("minecraft:block_face"));
  return facing ? /** @type {PipeDirection} */ (OPPOSITE_DIRECTIONS[facing]) : undefined;
}

/** @param {Block} block @param {PipeDirection} physicalDirection @returns {PipeDirection} */
export function getConnectionStateDirection(block, physicalDirection) {
  if (!isExporterEndpoint(block) && !isImporterEndpoint(block)) {
    return physicalDirection;
  }
  const facing = normalizePipeDirection(block.permutation.getState("minecraft:block_face")) ?? "north";
  return /** @type {PipeDirection} */ (
    ENDPOINT_STATE_DIRECTION_MAP[facing]?.[physicalDirection] ?? physicalDirection
  );
}

/** @param {Block} block @param {PipeDirection} physicalDirection */
export function getPhysicalConnectionState(block, physicalDirection) {
  if (!block?.hasTag("dorios:isTube")) return false;
  const stateDirection = getConnectionStateDirection(block, physicalDirection);
  try {
    return block.permutation.getState(`utilitycraft:${stateDirection}`) === true;
  } catch {
    return false;
  }
}

/**
 * Normal tubes retain state-driven topology. Multi-resource nodes use their
 * face state directly because their physical connection is a visual union.
 * @param {Block} block
 * @param {PipeDirection} direction
 * @param {Block} neighbor
 * @param {PipeResource|string|undefined} [resource]
 */
export function isNetworkConnectionOpen(block, direction, neighbor, resource) {
  if (!block || !neighbor) return false;
  const opposite = /** @type {PipeDirection} */ (OPPOSITE_DIRECTIONS[direction]);
  if (block.hasTag("dorios:isTube")
    && !isMultiTube(block)
    && !isMultiEndpoint(block)
    && !getPhysicalConnectionState(block, direction)) return false;
  if (neighbor.hasTag("dorios:isTube")
    && !isMultiTube(neighbor)
    && !isMultiEndpoint(neighbor)
    && !getPhysicalConnectionState(neighbor, opposite)) return false;
  if (isPipeFaceDisabled(block, direction, resource)) return false;
  if (isPipeFaceDisabled(neighbor, opposite, resource)) return false;
  return true;
}

/** @param {Block} block @param {Block} neighbor */
function areCompatiblePipes(block, neighbor) {
  if (!block?.hasTag("dorios:isTube") || !neighbor?.hasTag("dorios:isTube")) return false;
  if (!PIPE_NETWORK_TAGS.some((tag) => block.hasTag(tag) && neighbor.hasTag(tag))) return false;
  for (const tag of block.getTags()) {
    if (tag.startsWith("dorios:color.") && neighbor.hasTag(tag)) return true;
  }
  return false;
}

/** @param {Block} block @param {PipeDirection} direction @param {boolean} disabled */
function setPipeFaceDisabled(block, direction, disabled) {
  const current = readPipeFaceStateAt(block.dimension, block.location);
  const faces = new Set(current.disabled);
  if (disabled) faces.add(direction);
  else faces.delete(direction);
  return writeBlockPipeFaceState(block, { disabled: faces, resources: current.resources });
}

/** @param {Block} block @param {unknown} value @returns {boolean} */
export function applyPipeFaceCopyConfig(block, value) {
  if (!block?.hasTag("dorios:isTube")) return false;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const raw = /** @type {{disabled?:unknown,resources?:unknown}} */ (value);
  const protectedDirection = getProtectedEndpointDirection(block);
  /** @type {Set<PipeDirection>} */
  const disabled = new Set();
  for (const entry of Array.isArray(raw.disabled) ? raw.disabled : []) {
    const direction = normalizePipeDirection(entry);
    if (direction && direction !== protectedDirection) disabled.add(direction);
  }
  /** @type {Map<PipeDirection,ReadonlySet<string>>} */
  const resources = new Map();
  if (isMultiTube(block)
    && raw.resources
    && typeof raw.resources === "object"
    && !Array.isArray(raw.resources)) {
    for (const [rawDirection, rawValues] of Object.entries(raw.resources)) {
      const direction = normalizePipeDirection(rawDirection);
      if (!direction || direction === protectedDirection || !Array.isArray(rawValues)) continue;
      const blocked = new Set();
      for (const rawResource of rawValues) {
        const resource = normalizeStoredResource(rawResource);
        if (resource) blocked.add(resource);
      }
      if (blocked.size > 0) resources.set(direction, blocked);
    }
  }
  return writeBlockPipeFaceState(block, { disabled, resources });
}

/**
 * @param {Block} block
 * @param {unknown} rawDirection
 * @returns {{changed:boolean,disabled:boolean,protected:boolean,direction?:PipeDirection}}
 */
export function togglePipeFace(block, rawDirection) {
  const direction = normalizePipeDirection(rawDirection);
  if (!direction || !block?.hasTag("dorios:isTube")) {
    return { changed: false, disabled: false, protected: false };
  }
  if (getProtectedEndpointDirection(block) === direction) {
    return { changed: false, disabled: false, protected: true, direction };
  }

  const opposite = /** @type {PipeDirection} */ (OPPOSITE_DIRECTIONS[direction]);
  const offset = PIPE_DIRECTION_OFFSETS[direction];
  let neighbor;
  try {
    neighbor = block.dimension.getBlock({
      x: block.location.x + offset.x,
      y: block.location.y + offset.y,
      z: block.location.z + offset.z,
    });
  } catch {}

  const compatibleNeighbor = neighbor && areCompatiblePipes(block, neighbor) ? neighbor : undefined;
  const currentDisabled = isPipeFaceDisabled(block, direction);
  const neighborDisabled = compatibleNeighbor ? isPipeFaceDisabled(compatibleNeighbor, opposite) : false;

  if (currentDisabled || neighborDisabled) {
    let changed = true;
    if (currentDisabled) changed = setPipeFaceDisabled(block, direction, false) && changed;
    if (neighborDisabled && compatibleNeighbor) {
      changed = setPipeFaceDisabled(compatibleNeighbor, opposite, false) && changed;
    }
    return { changed, disabled: false, protected: false, direction };
  }

  const changed = setPipeFaceDisabled(block, direction, true);
  return { changed, disabled: changed, protected: false, direction };
}

/** @param {Dimension} dimension @param {Vector3} location */
export function clearPipeFacesAt(dimension, location) {
  return writeDisabledFacesAt(dimension, location, new Set());
}

/**
 * @param {Dimension} dimension
 * @param {ReadonlyArray<{source:Vector3,target:Vector3}>} movements
 */
export function reconcileMovedPipeFaces(dimension, movements) {
  const snapshots = [];
  for (const movement of movements) {
    let targetBlock;
    try {
      targetBlock = dimension.getBlock(movement.target);
    } catch {}
    if (!targetBlock?.hasTag("dorios:isTube")) continue;
    snapshots.push({ target: movement.target, state: readPipeFaceStateAt(dimension, movement.source) });
  }

  for (const movement of movements) {
    clearPipeFacesAt(dimension, movement.source);
    clearPipeFacesAt(dimension, movement.target);
  }
  for (const snapshot of snapshots) {
    if (snapshot.state.disabled.size > 0 || snapshot.state.resources.size > 0) {
      writePipeFaceStateAt(dimension, snapshot.target, snapshot.state);
    }
  }
}

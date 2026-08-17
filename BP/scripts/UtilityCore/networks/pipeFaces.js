// @ts-check

import { system, world } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {"north"|"south"|"east"|"west"|"up"|"down"} PipeDirection */

const PIPE_FACE_PROPERTY_PREFIX = "utilitycraft:pf";
const PIPE_FACE_DOCUMENT_VERSION = 2;
export const UNIVERSAL_PIPE_TAG = "dorios:universal_pipe";
export const PIPE_RESOURCES = Object.freeze([
  "item",
  "fluid",
  "gas",
  "energy",
  "overclock",
]);
const PIPE_NETWORK_TAGS = Object.freeze([
  "dorios:energy",
  "dorios:item",
  "dorios:fluid",
  "dorios:gas",
]);

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

/** @typedef {"item"|"fluid"|"gas"|"energy"|"overclock"} PipeResource */

/**
 * @typedef {object} PipeFaceState
 * @property {ReadonlySet<PipeDirection>} disabled Every resource is blocked.
 * @property {ReadonlyMap<PipeDirection,ReadonlySet<PipeResource>>} resources
 * Per-resource blocks, used only by universal pipes.
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
  return PIPE_RESOURCES.includes(resource)
    ? /** @type {PipeResource} */ (resource)
    : undefined;
}

/** @param {import("@minecraft/server").Block|undefined} block */
export function isUniversalPipe(block) {
  return block?.hasTag?.(UNIVERSAL_PIPE_TAG) === true;
}

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

  /** @type {Map<PipeDirection,ReadonlySet<PipeResource>>} */
  const resources = new Map();
  if (raw.resources && typeof raw.resources === "object" && !Array.isArray(raw.resources)) {
    for (const [rawDirection, rawResources] of Object.entries(raw.resources)) {
      const direction = normalizePipeDirection(rawDirection);
      if (!direction || !Array.isArray(rawResources)) continue;
      /** @type {Set<PipeResource>} */
      const blocked = new Set();
      for (const rawResource of rawResources) {
        const resource = normalizePipeResource(rawResource);
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
      const resource = normalizePipeResource(rawResource);
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
        new Set(/** @type {PipeResource[]} */ (values)),
      ])),
    });
  }
  else disabledFaceCache.delete(key);
  return true;
}

/** @param {Block} block @param {PipeFaceState} state */
function writeBlockPipeFaceState(block, state) {
  const changed = writePipeFaceStateAt(block.dimension, block.location, state);
  if (changed) notifyOverclockPipeFaceChange(block);
  return changed;
}

/** Keeps optional overclock integrations synchronized with persisted faces. */
function notifyOverclockPipeFaceChange(block) {
  if (!block?.hasTag?.("dorios:overclock_network")) return;
  try {
    system.sendScriptEvent("utilitycraft:universal_pipe_face_update", JSON.stringify({
      dimensionId: block.dimension.id,
      location: {
        x: Math.floor(block.location.x),
        y: Math.floor(block.location.y),
        z: Math.floor(block.location.z),
      },
    }));
  } catch {}
}

/**
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @param {ReadonlySet<PipeDirection>} disabled
 */
function writeDisabledFacesAt(dimension, location, disabled) {
  return writePipeFaceStateAt(dimension, location, {
    disabled,
    resources: new Map(),
  });
}

/**
 * @param {Block} block
 * @param {PipeDirection} direction
 * @param {PipeResource|string|undefined} [rawResource]
 */
export function isPipeFaceDisabled(block, direction, rawResource) {
  if (!block?.hasTag("dorios:isTube")) return false;
  if (getProtectedEndpointDirection(block) === direction) return false;
  const state = readPipeFaceStateAt(block.dimension, block.location);
  if (state.disabled.has(direction)) return true;
  if (!isUniversalPipe(block)) return false;
  const resource = normalizePipeResource(rawResource);
  return resource
    ? state.resources.get(direction)?.has(resource) === true
    : false;
}

/**
 * Returns the channels currently blocked on one Universal Cable face.
 *
 * @param {Block} block
 * @param {unknown} rawDirection
 * @returns {PipeResource[]}
 */
export function getUniversalPipeFaceDisabledResources(block, rawDirection) {
  const direction = normalizePipeDirection(rawDirection);
  if (!direction || !isUniversalPipe(block)) return [];
  if (getProtectedEndpointDirection(block) === direction) return [];

  const state = readPipeFaceStateAt(block.dimension, block.location);
  if (state.disabled.has(direction)) return [...PIPE_RESOURCES];
  const blocked = state.resources.get(direction);
  return PIPE_RESOURCES.filter((resource) => blocked?.has(resource));
}

/**
 * Replaces the channels blocked on one Universal Cable face. This intentionally
 * does not use the legacy all-resource toggle, so each resource stays
 * independently controllable.
 *
 * @param {Block} block
 * @param {unknown} rawDirection
 * @param {unknown} rawResources
 */
export function setUniversalPipeFaceDisabledResources(block, rawDirection, rawResources) {
  const direction = normalizePipeDirection(rawDirection);
  if (!direction || !isUniversalPipe(block)) return false;
  if (getProtectedEndpointDirection(block) === direction) return false;

  /** @type {Set<PipeResource>} */
  const resources = new Set();
  for (const rawResource of Array.isArray(rawResources) ? rawResources : []) {
    const resource = normalizePipeResource(rawResource);
    if (resource) resources.add(resource);
  }

  const current = readPipeFaceStateAt(block.dimension, block.location);
  const next = {
    disabled: new Set(current.disabled),
    resources: new Map(current.resources),
  };
  next.disabled.delete(direction);
  if (resources.size > 0) next.resources.set(direction, resources);
  else next.resources.delete(direction);
  return writeBlockPipeFaceState(block, next);
}

/**
 * Returns a portable snapshot of the pipe's manually disabled physical faces.
 *
 * @param {Block} block
 * @returns {{version:number,disabled:PipeDirection[]}|undefined}
 */
export function getPipeFaceCopyConfig(block) {
  if (!block?.hasTag("dorios:isTube")) return undefined;
  const protectedDirection = getProtectedEndpointDirection(block);
  const state = readPipeFaceStateAt(block.dimension, block.location);
  const disabled = [...state.disabled]
    .filter((direction) => direction !== protectedDirection);
  /** @type {Record<string,PipeResource[]>} */
  const resources = {};
  if (isUniversalPipe(block)) {
    for (const [direction, blocked] of state.resources) {
      if (direction === protectedDirection || blocked.size === 0) continue;
      resources[direction] = PIPE_RESOURCES.filter((resource) => blocked.has(resource));
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
  if (!block?.hasTag("dorios:isExporter") && !block?.hasTag("dorios:isImporter")) return undefined;
  const facing = normalizePipeDirection(block.permutation.getState("minecraft:block_face"));
  return facing ? /** @type {PipeDirection} */ (OPPOSITE_DIRECTIONS[facing]) : undefined;
}

/**
 * Returns the local connection state name that represents one physical world
 * direction for a normal pipe or rotated endpoint.
 *
 * @param {Block} block
 * @param {PipeDirection} physicalDirection
 * @returns {PipeDirection}
 */
export function getConnectionStateDirection(block, physicalDirection) {
  if (!block?.hasTag("dorios:isExporter") && !block?.hasTag("dorios:isImporter")) {
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
 * Treats the six connection states as the effective network topology. Blocks
 * without pipe states (machines and containers) leave their side unrestricted.
 *
 * @param {Block} block
 * @param {PipeDirection} direction
 * @param {Block} neighbor
 * @param {PipeResource|string|undefined} [resource]
 */
export function isNetworkConnectionOpen(block, direction, neighbor, resource) {
  if (!block || !neighbor) return false;
  if (block.hasTag("dorios:isTube") && !getPhysicalConnectionState(block, direction)) return false;
  const opposite = /** @type {PipeDirection} */ (OPPOSITE_DIRECTIONS[direction]);
  if (neighbor.hasTag("dorios:isTube") && !getPhysicalConnectionState(neighbor, opposite)) return false;
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
  return writeBlockPipeFaceState(block, {
    disabled: faces,
    resources: current.resources,
  });
}

/**
 * Replaces the pipe's disabled physical faces. Endpoint attachment faces are
 * always protected, matching the wrench behavior.
 *
 * @param {Block} block
 * @param {unknown} value
 * @returns {boolean}
 */
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
  /** @type {Map<PipeDirection,ReadonlySet<PipeResource>>} */
  const resources = new Map();
  if (isUniversalPipe(block)
    && raw.resources
    && typeof raw.resources === "object"
    && !Array.isArray(raw.resources)) {
    for (const [rawDirection, rawValues] of Object.entries(raw.resources)) {
      const direction = normalizePipeDirection(rawDirection);
      if (!direction || direction === protectedDirection || !Array.isArray(rawValues)) continue;
      /** @type {Set<PipeResource>} */
      const blocked = new Set();
      for (const rawResource of rawValues) {
        const resource = normalizePipeResource(rawResource);
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

  const compatibleNeighbor = neighbor && areCompatiblePipes(block, neighbor)
    ? neighbor
    : undefined;
  const currentDisabled = isPipeFaceDisabled(block, direction);
  const neighborDisabled = compatibleNeighbor
    ? isPipeFaceDisabled(compatibleNeighbor, opposite)
    : false;

  // A disabled pipe-to-pipe edge can be restored from either endpoint. Clear
  // both sides as well, so earlier worlds where both faces were toggled off
  // recover with one interaction.
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
 * Moves position-keyed pipe face documents after one piston activation.
 *
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
    snapshots.push({
      target: movement.target,
      state: readPipeFaceStateAt(dimension, movement.source),
    });
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

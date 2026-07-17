// @ts-check

import {
  BlockComponentTypes,
  EntityComponentTypes,
  ItemStack,
  system,
  world,
} from "@minecraft/server";
import { isPlainObject } from "../utils/index.js";
import { cloneItemConfig, normalizeItemConfig } from "./config.js";
import {
  CONTAINER_FAMILY,
  DIRECTIONS,
  IO_CONFIG_PROPERTY,
  ITEM_CONFIG_KEY,
  SCRIPT_EVENT_NAMESPACE,
  SET_CONFIG_EVENT_ID,
} from "./constants.js";

export {
  CONTAINER_FAMILY,
  DIRECTIONS,
  IO_CONFIG_PROPERTY,
  ITEM_CONFIG_KEY,
  ITEM_CONFIG_VERSION,
  SCRIPT_EVENT_NAMESPACE,
  SET_CONFIG_EVENT_ID,
} from "./constants.js";

/** @typedef {import("./config.js").ContainerFace} ContainerFace */
/** @typedef {import("./config.js").ItemConfig} ItemConfig */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Container} Container */

/**
 * @typedef {object} ResolvedContainer
 * @property {"block"|"entity"|"raw"} kind
 * @property {Block|Entity|Container} owner
 * @property {Container} container
 * @property {Block} [block]
 * @property {Entity} [entity]
 */

/** @typedef {Block|Entity|Container|ResolvedContainer} ContainerTarget */

/**
 * @typedef {object} InsertOptions
 * @property {ItemStack} item Item stack to copy into the target.
 * @property {ContainerFace} [face] Target face. Omit it to use the explicit fallback.
 * @property {ReadonlyArray<number>} [slots] Optional ordered subset of allowed input slots.
 * @property {number} [maxAmount] Maximum amount to attempt from the supplied stack.
 */

/**
 * @typedef {object} TransferOptions
 * @property {number} sourceSlot Exact source inventory slot selected by the caller.
 * @property {ContainerTarget} target Destination container target.
 * @property {ContainerFace} [targetFace] Target input face. Omit it to use the explicit fallback.
 * @property {ReadonlyArray<number>} [targetSlots] Explicit ordered target slots. When present, overrides `targetFace` completely.
 * @property {number} [maxAmount] Maximum amount to move from the source stack.
 */

/**
 * @typedef {object} SlotQueryOptions
 * @property {ContainerFace} [face] Absolute face. Omit it to use the explicit `any*Slots` fallback.
 */

/**
 * @typedef {object} UnsupportedCacheEntry
 * @property {"unsupported"} status
 */

/**
 * @typedef {object} BasicCacheEntry
 * @property {"basic"} status
 * @property {number[]} slots
 */

/**
 * @typedef {object} InvalidCacheEntry
 * @property {"invalid"} status
 */

/**
 * @typedef {object} ConfiguredCacheEntry
 * @property {"configured"} status
 * @property {ItemConfig} config
 * @property {number} revision Local cache revision incremented whenever the item document changes.
 */

/** @typedef {UnsupportedCacheEntry|BasicCacheEntry|InvalidCacheEntry|ConfiguredCacheEntry} CacheEntry */

/** Item IO state cache keyed by the unique runtime entity ID. */
/** @type {Map<string, CacheEntry>} */
const configCache = new Map();

/** Shared empty result for unsupported, invalid, or unavailable access. */
/** @type {number[]} */
const EMPTY_SLOTS = [];

/** Cached `[0..size)` slot arrays for vanilla blocks and raw containers. */
/** @type {WeakMap<object, {size:number, slots:number[]}>} */
const allSlotsCache = new WeakMap();

let initialized = false;
let nextConfigRevision = 1;
/** @type {((event: import("@minecraft/server").ScriptEventCommandMessageAfterEvent) => void)|undefined} */
let scriptEventListener;
/** @type {((event: import("@minecraft/server").EntityRemoveAfterEvent) => void)|undefined} */
let entityRemoveListener;

/**
 * Installs the cross-addon configuration listener and entity-cache cleanup.
 * Importing this module alone has no runtime side effects.
 *
 * @returns {boolean} `true` when listeners were installed by this call.
 */
export function initialize() {
  if (initialized) return false;

  scriptEventListener = onScriptEvent;
  entityRemoveListener = ({ removedEntityId }) => configCache.delete(removedEntityId);

  let scriptEventSubscribed = false;
  let entityRemoveSubscribed = false;
  try {
    system.afterEvents.scriptEventReceive.subscribe(scriptEventListener, {
      namespaces: [SCRIPT_EVENT_NAMESPACE],
    });
    scriptEventSubscribed = true;
    world.afterEvents.entityRemove.subscribe(entityRemoveListener);
    entityRemoveSubscribed = true;
  } catch (error) {
    if (scriptEventSubscribed) system.afterEvents.scriptEventReceive.unsubscribe(scriptEventListener);
    if (entityRemoveSubscribed) world.afterEvents.entityRemove.unsubscribe(entityRemoveListener);
    scriptEventListener = undefined;
    entityRemoveListener = undefined;
    throw error;
  }

  initialized = true;
  return true;
}

/**
 * Removes installed listeners and clears the runtime cache.
 *
 * @returns {boolean} `true` when an installed lifecycle was removed.
 */
export function shutdown() {
  if (!initialized) return false;

  if (scriptEventListener) system.afterEvents.scriptEventReceive.unsubscribe(scriptEventListener);
  if (entityRemoveListener) world.afterEvents.entityRemove.unsubscribe(entityRemoveListener);

  scriptEventListener = undefined;
  entityRemoveListener = undefined;
  configCache.clear();
  initialized = false;
  return true;
}

/** @returns {boolean} */
export function isInitialized() {
  return initialized;
}

/**
 * Publishes a complete Simple or Complex item configuration from an entity.
 * Every addon listening to the Dorios protocol validates it, merges it into
 * `utilitycraft:io_config.items`, and refreshes its own cache.
 *
 * @param {Entity} entity Source entity that owns the inventory.
 * @param {ItemConfig} config Complete item configuration.
 * @returns {boolean} `true` when the script event command was sent.
 */
export function setConfig(entity, config) {
  const container = requireCompatibleInventory(entity);
  const normalized = normalizeItemConfig(config, container.size);
  const message = JSON.stringify(normalized);
  entity.runCommand(`scriptevent ${SET_CONFIG_EVENT_ID} ${message}`);

  // Make the publishing addon fail closed immediately instead of exposing
  // every slot as Basic while the event is pending. Persistence remains owned
  // exclusively by the shared script-event protocol.
  configCache.set(entity.id, createConfiguredEntry(normalized));
  return true;
}

/**
 * Resolves a block, compatible entity, raw Container, or an existing resolved
 * reference into one canonical transfer target.
 *
 * Blocks are capability-based: any real block inventory is treated as a
 * vanilla container. Custom entities must opt in with `dorios:container`.
 * Passing a raw Container is an explicit low-level operation and therefore has
 * access to all of that Container's slots.
 *
 * @param {ContainerTarget} target
 * @returns {ResolvedContainer|undefined}
 */
export function resolve(target) {
  if (!target) return undefined;

  if (isResolvedContainer(target)) {
    if (target.kind === "entity") {
      if (!target.entity) return undefined;
      if (target.entity.isValid && isRawContainer(target.container)) return target;
      const refreshed = resolve(target.entity);
      return refreshed && target.block ? { ...refreshed, block: target.block } : refreshed;
    }
    if (target.kind === "block") {
      if (target.block && isRawContainer(target.container)) return target;
      return target.block ? resolve(target.block) : undefined;
    }
    return isRawContainer(target.container) ? target : undefined;
  }

  if (isRawContainer(target)) {
    return { kind: "raw", owner: target, container: target };
  }

  if (isEntityReference(target)) {
    if (!isCompatible(target)) return undefined;
    const container = getInventory(target);
    return container
      ? { kind: "entity", owner: target, entity: target, container }
      : undefined;
  }

  if (isBlockReference(target)) {
    const container = getBlockInventory(target);
    return container
      ? { kind: "block", owner: target, block: target, container }
      : undefined;
  }

  return undefined;
}

/**
 * Resolves the item container occupying one block location.
 *
 * A block inventory wins. Otherwise every entity in the cell is checked until
 * a compatible `dorios:container` entity is found; entity order is never used
 * as a compatibility shortcut.
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 * @returns {ResolvedContainer|undefined}
 */
export function resolveAt(dimension, location) {
  if (!dimension || !isLocation(location)) return undefined;

  try {
    const block = dimension.getBlock(location);
    const blockContainer = getBlockInventory(block);
    if (block && blockContainer) {
      return {
        kind: "block",
        owner: block,
        block,
        container: blockContainer,
      };
    }

    for (const entity of dimension.getEntitiesAtBlockLocation(location)) {
      if (!isCompatible(entity)) continue;
      const container = getInventory(entity);
      if (!container) continue;

      return {
        kind: "entity",
        owner: entity,
        entity,
        block,
        container,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Returns a mutable snapshot of the persisted Simple/Complex configuration.
 * Basic, invalid, and unsupported entities return `undefined`.
 *
 * @param {Entity} entity
 * @returns {ItemConfig|undefined}
 */
export function getConfig(entity) {
  const entry = resolveCacheEntry(entity);
  return entry.status === "configured" ? cloneItemConfig(entry.config) : undefined;
}

/**
 * Returns the local cache revision for a configured entity.
 *
 * This token is intentionally local to the current addon and session. It lets
 * higher-level registries validate a config once, then perform O(1) change
 * checks without cloning or serializing the item document every tick.
 *
 * @param {Entity} entity
 * @returns {number} Positive revision for configured entities, otherwise `0`.
 */
export function getConfigRevision(entity) {
  const entry = resolveCacheEntry(entity);
  return entry.status === "configured" ? entry.revision : 0;
}

/**
 * Resolves the effective container category.
 *
 * @param {Entity} entity
 * @returns {"basic"|"simple"|"complex"|"invalid"|"unsupported"}
 */
export function getStatus(entity) {
  const entry = resolveCacheEntry(entity);
  if (entry.status !== "configured") return entry.status;
  return entry.config.type;
}

/**
 * Returns the slots that accept automated insertion.
 *
 * For Complex configs, omitting `face` uses `anyInputSlots`. Supplying an
 * invalid or unavailable face fails closed and returns no slots.
 *
 * The returned array is cache-owned and must not be modified.
 *
 * @param {ContainerTarget} target
 * @param {SlotQueryOptions} [options]
 * @returns {ReadonlyArray<number>}
 */
export function getInputSlots(target, options = {}) {
  return resolveTargetSlots(target, "input", options.face);
}

/**
 * Returns the slots that allow automated extraction.
 *
 * For Complex configs, omitting `face` uses `anyOutputSlots`. Supplying an
 * invalid or unavailable face fails closed and returns no slots.
 *
 * The returned array is cache-owned and must not be modified.
 *
 * @param {ContainerTarget} target
 * @param {SlotQueryOptions} [options]
 * @returns {ReadonlyArray<number>}
 */
export function getOutputSlots(target, options = {}) {
  return resolveTargetSlots(target, "output", options.face);
}

/**
 * Inserts a copy of an ItemStack into allowed target slots.
 *
 * Existing compatible stacks are filled before empty slots. The supplied item
 * is never mutated, native stack metadata is compared with
 * `ItemStack.isStackableWith`, and the exact moved amount is returned.
 *
 * @param {ContainerTarget} target
 * @param {InsertOptions} options
 * @returns {number} Exact number of inserted items.
 */
export function insert(target, options) {
  if (!options || !(options.item instanceof ItemStack)) {
    throw new TypeError("insert options must include an ItemStack");
  }

  const resolved = resolve(target);
  if (!resolved) return 0;

  const allowedSlots = getInputSlots(resolved, { face: options.face });
  const slots = selectAllowedSlots(allowedSlots, options.slots);
  if (slots.length === 0) return 0;

  const amount = normalizeTransferAmount(options.maxAmount, options.item.amount);
  if (amount <= 0) return 0;

  const containerSize = getContainerSize(resolved.container);
  if (containerSize === undefined) return 0;

  if (options.slots === undefined && coversWholeContainer(slots, containerSize)) {
    return addItemFast(resolved.container, options.item, amount);
  }

  return insertIntoSlots(resolved.container, options.item, slots, amount).moved;
}

/**
 * Moves items from one allowed source slot into allowed target slots.
 *
 * The caller owns source-slot policy: this primitive moves the exact slot it
 * receives without consulting output rules. When `targetSlots` is present it
 * is used as the complete destination selection and overrides `targetFace`.
 * Otherwise the target's input rules are resolved by `targetFace`, or by its
 * explicit no-face fallback when the face is omitted.
 *
 * The target writes are tracked so a failed source update can restore their
 * previous snapshots on a best-effort basis.
 *
 * @param {ContainerTarget} source
 * @param {TransferOptions} options
 * @returns {number} Exact number of moved items.
 */
export function transfer(source, options) {
  if (!options || !Number.isInteger(options.sourceSlot)) return 0;

  const resolvedSource = resolve(source);
  const resolvedTarget = resolve(options.target);
  if (!resolvedSource || !resolvedTarget) return 0;

  const sourceSlot = options.sourceSlot;
  let sourceItem;
  try {
    sourceItem = resolvedSource.container.getItem(sourceSlot);
  } catch {
    return 0;
  }
  if (!sourceItem) return 0;

  const amount = normalizeTransferAmount(options.maxAmount, sourceItem.amount);
  if (amount <= 0) return 0;

  let targetSlots;
  if (options.targetSlots !== undefined) {
    const targetSize = getContainerSize(resolvedTarget.container);
    if (targetSize === undefined) return 0;
    targetSlots = normalizeExplicitSlots(options.targetSlots, targetSize);
  } else {
    targetSlots = getInputSlots(resolvedTarget, { face: options.targetFace });
  }
  if (isSameResolvedContainer(resolvedSource, resolvedTarget)) {
    targetSlots = targetSlots.filter((slot) => slot !== sourceSlot);
  }
  if (targetSlots.length === 0) return 0;

  const insertion = insertIntoSlots(resolvedTarget.container, sourceItem, targetSlots, amount);
  if (insertion.moved <= 0) return 0;

  try {
    if (insertion.moved >= sourceItem.amount) {
      resolvedSource.container.setItem(sourceSlot, undefined);
    } else {
      const remainder = sourceItem.clone();
      remainder.amount = sourceItem.amount - insertion.moved;
      resolvedSource.container.setItem(sourceSlot, remainder);
    }
  } catch {
    rollbackChanges(resolvedTarget.container, insertion.changes);
    return 0;
  }

  return insertion.moved;
}

/**
 * Checks the required family and inventory capability.
 *
 * @param {Entity} entity
 * @returns {boolean}
 */
export function isCompatible(entity) {
  if (!entity?.isValid || !getInventory(entity)) return false;

  try {
    const typeFamily = entity.getComponent(EntityComponentTypes.TypeFamily);
    return Boolean(typeFamily?.hasTypeFamily(CONTAINER_FAMILY));
  } catch {
    return false;
  }
}

/**
 * Invalidates one cached entity so the next access reads its dynamic property.
 * Normal configuration changes should use {@link setConfig}, whose event
 * refreshes caches across addons automatically.
 *
 * @param {Entity|string} entityOrId
 * @returns {boolean}
 */
export function invalidate(entityOrId) {
  const id = typeof entityOrId === "string" ? entityOrId : entityOrId?.id;
  return typeof id === "string" ? configCache.delete(id) : false;
}

/**
 * @param {import("@minecraft/server").ScriptEventCommandMessageAfterEvent} event
 */
function onScriptEvent(event) {
  if (!event.sourceEntity) return;

  if (event.id !== SET_CONFIG_EVENT_ID) return;

  try {
    const value = JSON.parse(event.message);
    applyConfig(event.sourceEntity, value);
  } catch (error) {
    console.warn("[DoriosLib:containers] Ignored invalid item configuration", error);
  }
}

/**
 * Applies an event payload locally without rebroadcasting it.
 *
 * @param {Entity} entity
 * @param {unknown} value
 */
function applyConfig(entity, value) {
  const container = requireCompatibleInventory(entity);
  const config = normalizeItemConfig(value, container.size);
  const root = readRootForWrite(entity);

  root[ITEM_CONFIG_KEY] = config;
  entity.setDynamicProperty(IO_CONFIG_PROPERTY, JSON.stringify(root));
  configCache.set(entity.id, createConfiguredEntry(config));
}

/**
 * @typedef {object} ContainerChange
 * @property {number} slot
 * @property {ItemStack|undefined} previous
 */

/**
 * @param {ContainerTarget} target
 * @param {"input"|"output"} operation
 * @param {ContainerFace|undefined} face
 * @returns {ReadonlyArray<number>}
 */
function resolveTargetSlots(target, operation, face) {
  if (isEntityReference(target)) return resolveSlots(target, operation, face);

  const resolved = resolve(target);
  if (!resolved) return EMPTY_SLOTS;
  if (resolved.kind === "entity" && resolved.entity) {
    return resolveSlots(resolved.entity, operation, face);
  }

  return getAllSlots(resolved.container);
}

/**
 * @param {Container} container
 * @returns {ReadonlyArray<number>}
 */
function getAllSlots(container) {
  const size = getContainerSize(container);
  if (size === undefined) return EMPTY_SLOTS;

  const cached = allSlotsCache.get(container);
  if (cached?.size === size) return cached.slots;

  const slots = Array.from({ length: size }, (_, slot) => slot);
  allSlotsCache.set(container, { size, slots });
  return slots;
}

/**
 * @param {ReadonlyArray<number>} allowedSlots
 * @param {ReadonlyArray<number>|undefined} requestedSlots
 * @returns {ReadonlyArray<number>}
 */
function selectAllowedSlots(allowedSlots, requestedSlots) {
  if (requestedSlots === undefined) return allowedSlots;

  const allowed = new Set(allowedSlots);
  const seen = new Set();
  const selected = [];
  for (const slot of requestedSlots) {
    if (!Number.isInteger(slot) || seen.has(slot) || !allowed.has(slot)) continue;
    seen.add(slot);
    selected.push(slot);
  }
  return selected;
}

/**
 * Validates caller-selected target slots without rebuilding the container's
 * full slot list. Explicit slots intentionally bypass input-face policy.
 *
 * @param {ReadonlyArray<number>} requestedSlots
 * @param {number} size
 * @returns {ReadonlyArray<number>}
 */
function normalizeExplicitSlots(requestedSlots, size) {
  const seen = new Set();
  const selected = [];
  for (const slot of requestedSlots) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= size || seen.has(slot)) continue;
    seen.add(slot);
    selected.push(slot);
  }
  return selected;
}

/**
 * @param {Container} container
 * @param {ItemStack} item
 * @param {ReadonlyArray<number>} slots
 * @param {number} amount
 * @returns {{moved:number, changes:ContainerChange[]}}
 */
function insertIntoSlots(container, item, slots, amount) {
  let remaining = amount;
  /** @type {ContainerChange[]} */
  const changes = [];

  for (const slot of slots) {
    if (remaining <= 0) break;

    try {
      const current = container.getItem(slot);
      if (!current || !current.isStackableWith(item)) continue;

      const space = current.maxAmount - current.amount;
      if (space <= 0) continue;

      const moved = Math.min(space, remaining);
      const updated = current.clone();
      updated.amount = current.amount + moved;
      container.setItem(slot, updated);
      changes.push({ slot, previous: current });
      remaining -= moved;
    } catch {
      if (!isRawContainer(container)) break;
    }
  }

  for (const slot of slots) {
    if (remaining <= 0) break;

    try {
      if (container.getItem(slot)) continue;

      const inserted = item.clone();
      inserted.amount = remaining;
      container.setItem(slot, inserted);
      changes.push({ slot, previous: undefined });
      remaining = 0;
    } catch {
      if (!isRawContainer(container)) break;
    }
  }

  return { moved: amount - remaining, changes };
}

/**
 * @param {Container} container
 * @param {ItemStack} item
 * @param {number} amount
 * @returns {number}
 */
function addItemFast(container, item, amount) {
  try {
    const inserted = item.clone();
    inserted.amount = amount;
    const remainder = container.addItem(inserted);
    return Math.max(0, Math.min(amount, amount - (remainder?.amount ?? 0)));
  } catch {
    return 0;
  }
}

/**
 * @param {Container} container
 * @param {ContainerChange[]} changes
 */
function rollbackChanges(container, changes) {
  for (let index = changes.length - 1; index >= 0; index--) {
    const change = changes[index];
    try {
      container.setItem(change.slot, change.previous);
    } catch {
      // Best effort: the owner may have become invalid during the operation.
    }
  }
}

/**
 * @param {number|undefined} requested
 * @param {number} available
 * @returns {number}
 */
function normalizeTransferAmount(requested, available) {
  if (requested === undefined) return available;
  const amount = Math.floor(Number(requested));
  return Number.isFinite(amount) ? Math.max(0, Math.min(available, amount)) : 0;
}

/**
 * @param {ReadonlyArray<number>} slots
 * @param {number} size
 * @returns {boolean}
 */
function coversWholeContainer(slots, size) {
  return slots.length === size && slots.every((slot, index) => slot === index);
}

/**
 * Detects two references to the same backing inventory without relying only
 * on native wrapper identity. Script API component lookups may return distinct
 * JavaScript objects for the same entity or block.
 *
 * @param {ResolvedContainer} left
 * @param {ResolvedContainer} right
 * @returns {boolean}
 */
function isSameResolvedContainer(left, right) {
  if (left.container === right.container || left.owner === right.owner) return true;

  if (left.kind === "entity" && right.kind === "entity") {
    return typeof left.entity?.id === "string" && left.entity.id === right.entity?.id;
  }

  if (left.kind === "block" && right.kind === "block") {
    const leftBlock = left.block;
    const rightBlock = right.block;
    if (!leftBlock || !rightBlock || leftBlock.dimension?.id !== rightBlock.dimension?.id) return false;

    return leftBlock.location.x === rightBlock.location.x
      && leftBlock.location.y === rightBlock.location.y
      && leftBlock.location.z === rightBlock.location.z;
  }

  return false;
}

/** @param {unknown} value @returns {value is ResolvedContainer} */
function isResolvedContainer(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = /** @type {Partial<ResolvedContainer>} */ (value);
  return (candidate.kind === "block" || candidate.kind === "entity" || candidate.kind === "raw")
    && Boolean(candidate.container)
    && typeof candidate.container === "object";
}

/** @param {unknown} value @returns {value is Container} */
function isRawContainer(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = /** @type {Partial<Container>} */ (value);
  try {
    const size = candidate.size;
    return candidate.isValid !== false
      && typeof size === "number"
      && Number.isInteger(size)
      && size >= 0
      && typeof candidate.getItem === "function"
      && typeof candidate.setItem === "function"
      && typeof candidate.addItem === "function";
  } catch {
    return false;
  }
}

/** @param {unknown} value @returns {value is Entity} */
function isEntityReference(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = /** @type {Partial<Entity>} */ (value);
  return typeof candidate.id === "string" && typeof candidate.getComponent === "function";
}

/** @param {unknown} value @returns {value is Block} */
function isBlockReference(value) {
  if (!value || typeof value !== "object" || isEntityReference(value)) return false;
  const candidate = /** @type {Partial<Block>} */ (value);
  return typeof candidate.typeId === "string"
    && typeof candidate.getComponent === "function"
    && Boolean(candidate.dimension)
    && Boolean(candidate.location);
}

/** @param {unknown} value @returns {value is import("@minecraft/server").Vector3} */
function isLocation(value) {
  if (!value || typeof value !== "object") return false;
  const location = /** @type {Partial<import("@minecraft/server").Vector3>} */ (value);
  return Number.isFinite(location.x) && Number.isFinite(location.y) && Number.isFinite(location.z);
}

/**
 * @param {Entity} entity
 * @param {"input"|"output"} operation
 * @param {ContainerFace|undefined} face
 * @returns {ReadonlyArray<number>}
 */
function resolveSlots(entity, operation, face) {
  const entry = resolveCacheEntry(entity);
  if (entry.status === "basic") return entry.slots;
  if (entry.status !== "configured") return EMPTY_SLOTS;

  const config = entry.config;
  if (config.type === "simple") {
    return operation === "input" ? config.inputConfig : config.outputConfig;
  }

  if (face === undefined) {
    return operation === "input" ? config.anyInputSlots : config.anyOutputSlots;
  }
  if (!DIRECTIONS.includes(face)) return EMPTY_SLOTS;

  const faceConfig = operation === "input" ? config.inputConfig : config.outputConfig;
  return faceConfig[face] ?? EMPTY_SLOTS;
}

/**
 * @param {Entity} entity
 * @returns {CacheEntry}
 */
function resolveCacheEntry(entity) {
  if (!entity?.isValid || typeof entity.id !== "string") return { status: "unsupported" };

  const cached = configCache.get(entity.id);
  if (cached) return cached;

  if (!isCompatible(entity)) return { status: "unsupported" };
  const container = getInventory(entity);
  if (!container) return { status: "unsupported" };

  const raw = entity.getDynamicProperty(IO_CONFIG_PROPERTY);
  if (raw === undefined) return cache(entity.id, createBasicEntry(container.size));
  if (typeof raw !== "string") return cache(entity.id, { status: "invalid" });

  try {
    const root = JSON.parse(raw);
    if (!isPlainObject(root)) return cache(entity.id, { status: "invalid" });
    if (!Object.prototype.hasOwnProperty.call(root, ITEM_CONFIG_KEY)) {
      return cache(entity.id, createBasicEntry(container.size));
    }

    const config = normalizeItemConfig(root[ITEM_CONFIG_KEY], container.size);
    return cache(entity.id, createConfiguredEntry(config));
  } catch {
    return cache(entity.id, { status: "invalid" });
  }
}

/**
 * @param {Entity} entity
 * @returns {Record<string, unknown>}
 */
function readRootForWrite(entity) {
  const raw = entity.getDynamicProperty(IO_CONFIG_PROPERTY);
  if (raw === undefined) return {};
  if (typeof raw !== "string") return {};

  try {
    const root = JSON.parse(raw);
    return isPlainObject(root) ? root : {};
  } catch {
    return {};
  }
}

/**
 * @param {Entity} entity
 * @returns {import("@minecraft/server").Container}
 */
function requireCompatibleInventory(entity) {
  if (!isCompatible(entity)) {
    throw new TypeError(`Entity must have ${CONTAINER_FAMILY} and an inventory`);
  }

  const container = getInventory(entity);
  if (!container) throw new TypeError("Entity inventory is unavailable");
  return container;
}

/**
 * Keeps the containers module independent from the broader entity helpers.
 *
 * @param {Entity} entity
 * @returns {import("@minecraft/server").Container|undefined}
 */
function getInventory(entity) {
  try {
    const component = entity?.getComponent(EntityComponentTypes.Inventory);
    const container = component?.container;
    return container?.isValid === false ? undefined : container;
  } catch {
    return undefined;
  }
}

/**
 * @param {Block|undefined} block
 * @returns {Container|undefined}
 */
function getBlockInventory(block) {
  try {
    const component = block?.getComponent(BlockComponentTypes.Inventory);
    const container = component?.container;
    return container?.isValid === false ? undefined : container;
  } catch {
    return undefined;
  }
}

/**
 * Reads a container size without allowing an invalid native wrapper to throw
 * through the public API.
 *
 * @param {Container} container
 * @returns {number|undefined}
 */
function getContainerSize(container) {
  try {
    if (container?.isValid === false) return undefined;
    const size = container?.size;
    return Number.isInteger(size) && size >= 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {number} size
 * @returns {BasicCacheEntry}
 */
function createBasicEntry(size) {
  return {
    status: "basic",
    slots: Array.from({ length: size }, (_, slot) => slot),
  };
}

/**
 * @param {string} id
 * @param {CacheEntry} entry
 * @returns {CacheEntry}
 */
function cache(id, entry) {
  configCache.set(id, entry);
  return entry;
}

/**
 * @param {ItemConfig} config
 * @returns {ConfiguredCacheEntry}
 */
function createConfiguredEntry(config) {
  const revision = nextConfigRevision;
  nextConfigRevision = nextConfigRevision >= Number.MAX_SAFE_INTEGER ? 1 : nextConfigRevision + 1;
  return { status: "configured", config, revision };
}

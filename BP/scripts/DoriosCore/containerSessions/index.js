import { world } from "@minecraft/server";

const playerSessions = new Map();
const openEntityIds = new Set();

/**
 * Normalizes Minecraft entity ids, which may be exposed as strings or numbers
 * depending on the API/runtime version.
 *
 * @param {unknown} id Raw entity id.
 * @returns {string|undefined} Stable string id, if present.
 */
function normalizeId(id) {
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return undefined;
}

/**
 * Builds the runtime key used to associate a player with the container entity
 * they are currently using.
 *
 * @param {import("@minecraft/server").Player|undefined} player Player entity.
 * @returns {string|undefined} Player runtime key.
 */
function getPlayerKey(player) {
  const id = normalizeId(player?.id);
  if (id) return id;
  const name = player?.name;
  if (typeof name === "string" && name.length > 0) return name;
  return undefined;
}

/**
 * Attempts to read the player field from container events across API variants.
 *
 * @param {object|undefined} event Container open/close event.
 * @returns {import("@minecraft/server").Player|undefined} Event player.
 */
function getEventPlayer(event) {
  return event?.player ?? event?.source ?? event?.sourceEntity;
}

/**
 * Checks whether an entity handle can still be safely used.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Entity handle.
 * @returns {boolean} True when the entity is valid.
 */
function isValidEntity(entity) {
  try {
    return entity?.isValid === true;
  } catch {
    return false;
  }
}

/**
 * Resolves an entity id back into a live entity handle.
 *
 * @param {string|undefined} entityId Entity id.
 * @returns {import("@minecraft/server").Entity|undefined} Live entity.
 */
function resolveEntity(entityId) {
  if (typeof entityId !== "string" || entityId.length === 0) return undefined;

  try {
    const entity = world.getEntity(entityId);
    return isValidEntity(entity) ? entity : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the player stored in a session. The name fallback exists for cases
 * where the runtime cannot resolve the player by id.
 *
 * @param {{ playerEntityId?: string, playerName?: string }|undefined} session Session data.
 * @returns {import("@minecraft/server").Player|undefined} Live player.
 */
function resolvePlayer(session) {
  const player = resolveEntity(session?.playerEntityId);
  if (player?.typeId === "minecraft:player") return player;

  const playerName = session?.playerName;
  if (typeof playerName !== "string" || playerName.length === 0) return undefined;

  try {
    return world.getPlayers().find((candidate) => candidate.name === playerName);
  } catch {
    return undefined;
  }
}

/**
 * Runtime registry for open entity containers.
 *
 * Container open/close events in this API version expose the opened entity but
 * not always the player. This manager therefore tracks open entities separately
 * from player-specific sessions; systems can later bind a player to one of
 * those open entities when another event, such as item drop, provides the
 * player.
 */
export class ContainerSessionManager {
  /**
   * Tracks one entity as having an open container UI.
   *
   * @param {import("@minecraft/server").Entity|undefined} entity Open container entity.
   * @returns {boolean} True when the entity was tracked.
   */
  static trackEntity(entity) {
    const entityId = normalizeId(entity?.id);
    if (!isValidEntity(entity) || !entityId) return false;

    openEntityIds.add(entityId);
    return true;
  }

  /**
   * Stops tracking an entity and clears any player sessions pointing to it.
   *
   * @param {import("@minecraft/server").Entity|undefined} entity Closed container entity.
   * @returns {boolean} True when the entity was in the open set.
   */
  static untrackEntity(entity) {
    const entityId = normalizeId(entity?.id);
    if (!entityId) return false;

    const removed = openEntityIds.delete(entityId);
    for (const [playerKey, session] of playerSessions.entries()) {
      if (session.entityId === entityId) playerSessions.delete(playerKey);
    }

    return removed;
  }

  /**
   * Returns all live entities currently known to have open container UIs.
   * Stale entity ids are removed during the scan.
   *
   * @returns {import("@minecraft/server").Entity[]} Open entities.
   */
  static getOpenEntities() {
    const entities = [];

    for (const entityId of [...openEntityIds]) {
      const entity = resolveEntity(entityId);
      if (!entity) {
        openEntityIds.delete(entityId);
        continue;
      }

      entities.push(entity);
    }

    return entities;
  }

  /**
   * Binds a player to an open container entity.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player using the container.
   * @param {import("@minecraft/server").Entity|undefined} entity Open container entity.
   * @returns {boolean} True when a session was stored.
   */
  static open(player, entity) {
    const playerKey = getPlayerKey(player);
    const playerEntityId = normalizeId(player?.id);
    const entityId = normalizeId(entity?.id);
    if (!playerKey || !isValidEntity(entity) || !entityId) return false;

    playerSessions.set(playerKey, {
      playerId: playerKey,
      playerEntityId,
      playerName: player?.name,
      entityId,
      entityTypeId: entity.typeId,
    });
    return true;
  }

  /**
   * Clears the session for a player when their container closes.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player using the container.
   * @param {import("@minecraft/server").Entity|undefined} entity Closed container entity.
   * @returns {boolean} True when a player session was removed.
   */
  static close(player, entity) {
    const playerKey = getPlayerKey(player);
    if (!playerKey) return false;

    const session = playerSessions.get(playerKey);
    if (!session) return false;

    const entityId = normalizeId(entity?.id);
    if (entityId && session.entityId !== entityId) return false;

    playerSessions.delete(playerKey);
    return true;
  }

  /**
   * Gets the currently open session for a player.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player to inspect.
   * @returns {{ playerId:string, playerEntityId?:string, playerName?:string, entityId:string, entityTypeId?:string }|undefined} Session data.
   */
  static getOpenSession(player) {
    const playerKey = getPlayerKey(player);
    if (!playerKey) return undefined;

    const session = playerSessions.get(playerKey);
    if (!session) return undefined;

    const entity = resolveEntity(session.entityId);
    if (!entity) {
      playerSessions.delete(playerKey);
      return undefined;
    }

    return session;
  }

  /**
   * Gets the open session plus live player and entity handles.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player to inspect.
   * @returns {{ player: import("@minecraft/server").Player|undefined, entity: import("@minecraft/server").Entity|undefined, session: object }|undefined} Open session entry.
   */
  static getOpenSessionEntry(player) {
    const session = this.getOpenSession(player);
    if (!session) return undefined;

    return {
      player: resolvePlayer(session) ?? player,
      entity: resolveEntity(session.entityId),
      session,
    };
  }

  /**
   * Gets the entity currently bound to a player.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player to inspect.
   * @returns {import("@minecraft/server").Entity|undefined} Open container entity.
   */
  static getOpenEntity(player) {
    const session = this.getOpenSession(player);
    return session ? resolveEntity(session.entityId) : undefined;
  }

  /**
   * Removes all runtime state for one player.
   *
   * @param {import("@minecraft/server").Player|undefined} player Player to clear.
   * @returns {boolean} True when a session was removed.
   */
  static clearPlayer(player) {
    const playerKey = getPlayerKey(player);
    if (!playerKey) return false;
    return playerSessions.delete(playerKey);
  }
}

world.afterEvents.entityContainerOpened?.subscribe?.((event) => {
  const player = getEventPlayer(event);
  const entity = event?.entity;
  ContainerSessionManager.trackEntity(entity);
  ContainerSessionManager.open(player, entity);
});

world.afterEvents.entityContainerClosed?.subscribe?.((event) => {
  const player = getEventPlayer(event);
  const entity = event?.entity;
  ContainerSessionManager.close(player, entity);
  ContainerSessionManager.untrackEntity(entity);
});

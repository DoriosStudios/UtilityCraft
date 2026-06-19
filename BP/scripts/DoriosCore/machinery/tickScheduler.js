import { system, world } from "@minecraft/server";
import * as Constants from "../constants.js";

/**
 * Entity property used to store the closed-background tick group assigned to a
 * machine helper entity.
 *
 * @constant
 * @type {string}
 */
export const TICK_GROUP_PROPERTY_ID = "utilitycraft:tick_group";

/**
 * World dynamic property used to store how many machines are assigned to each
 * closed-background tick group.
 *
 * @constant
 * @type {string}
 */
export const TICK_GROUP_COUNTS_PROPERTY_ID = "utilitycraft:tick_group_counts";

/**
 * Entity property used as the UI viewer counter for machine helper entities.
 *
 * @constant
 * @type {string}
 */
const OPEN_UI_PLAYERS_PROPERTY_ID = "utilitycraft:players";

/**
 * Number of closed-background tick groups used to spread machine work.
 *
 * @constant
 * @type {number}
 */
const GROUP_COUNT = 5;

/**
 * Processing interval used while a machine UI is open.
 *
 * This is kept fixed because the block tick base is currently 4 ticks.
 *
 * @constant
 * @type {number}
 */
const OPEN_INTERVAL = 4;

/**
 * Scheduler profiles used for closed machines.
 *
 * Fast is the current baseline. Normal doubles the closed tick span, and Low
 * doubles it again. Open UIs are intentionally unaffected.
 *
 * @constant
 * @type {Record<string, { label: string, closedInterval: number }>}
 */
const SCHEDULER_PROFILES = {
  fast: {
    label: "Fast",
    closedInterval: 20,
  },
  normal: {
    label: "Normal",
    closedInterval: 40,
  },
  low: {
    label: "Low",
    closedInterval: 80,
  },
};

/**
 * Cached scheduler profile id loaded from world dynamic properties.
 *
 * @type {string | undefined}
 */
let schedulerProfileCache;

/**
 * Normalizes a scheduler profile id.
 *
 * @param {string | undefined | null} profile Profile id or label.
 * @returns {string} A valid scheduler profile id.
 */
function normalizeProfile(profile) {
  const value = String(profile ?? "").trim().toLowerCase();
  return SCHEDULER_PROFILES[value] ? value : Constants.DEFAULT_SCHEDULER_PROFILE;
}

/**
 * Returns the tick phase assigned to a group for a closed interval.
 *
 * Groups are spread evenly across the interval. The final group runs on the
 * zero phase so the cycle closes cleanly.
 *
 * @param {number} group Normalized group id.
 * @param {number} closedInterval Closed-machine interval.
 * @returns {number} Tick phase for the group.
 */
function getGroupPhase(group, closedInterval) {
  const step = closedInterval / GROUP_COUNT;
  return group === GROUP_COUNT ? 0 : group * step;
}

/**
 * Normalizes a group id into the supported group range.
 *
 * @param {number | string | undefined | null} group Group value.
 * @returns {number} Valid group id, or 0 when invalid.
 */
function normalizeGroup(group) {
  const value = Math.floor(Number(group) || 0);
  return value >= 1 && value <= GROUP_COUNT ? value : 0;
}

/**
 * Normalizes persisted group counts into a fixed length array.
 *
 * @param {unknown} counts Raw counts data.
 * @returns {number[]} One non-negative count per group.
 */
function normalizeCounts(counts) {
  const normalized = Array.isArray(counts) ? counts : [];

  return Array.from({ length: GROUP_COUNT }, (_, index) => {
    const count = Math.floor(Number(normalized[index]) || 0);
    return Math.max(0, count);
  });
}

/**
 * Broadcasts a group count delta to other addons that share the scheduler.
 *
 * @param {number} group Group id.
 * @param {number} delta Count delta.
 * @returns {void}
 */
function broadcastGroupCount(group, delta) {
  const action = delta > 0 ? "add" : "remove";
  system.sendScriptEvent(Constants.TICK_GROUP_EVENT_ID, `${action}|${group}|${Constants.TICK_GROUP_SOURCE_ID}`);
}

/**
 * Static scheduler for UtilityCraft machine ticks.
 *
 * The scheduler spreads closed machines across five groups, keeps open machine
 * UIs responsive, and stores group assignments on machine helper entities. All
 * methods are static so callers can use the module as a single shared service.
 */
export class TickScheduler {
  /**
   * Returns all scheduler profile ids in display order.
   *
   * @returns {string[]} Profile ids.
   */
  static getSchedulerProfileIds() {
    return Object.keys(SCHEDULER_PROFILES);
  }

  /**
   * Returns a copy of all scheduler profile configs.
   *
   * @returns {Record<string, { label: string, closedInterval: number }>} Profile configs.
   */
  static getSchedulerProfiles() {
    return { ...SCHEDULER_PROFILES };
  }

  /**
   * Returns the active scheduler profile id.
   *
   * @returns {string} Active profile id.
   */
  static getSchedulerProfile() {
    if (!schedulerProfileCache) {
      schedulerProfileCache = normalizeProfile(world.getDynamicProperty(Constants.SCHEDULER_PROFILE_PROPERTY_ID));
    }

    return schedulerProfileCache;
  }

  /**
   * Persists and activates a scheduler profile.
   *
   * @param {string} profile Requested profile id.
   * @returns {string} Normalized profile id that was stored.
   */
  static setSchedulerProfile(profile) {
    const normalizedProfile = normalizeProfile(profile);
    world.setDynamicProperty(Constants.SCHEDULER_PROFILE_PROPERTY_ID, normalizedProfile);
    schedulerProfileCache = normalizedProfile;
    return normalizedProfile;
  }

  /**
   * Returns the profile configuration for a profile id.
   *
   * @param {string} [profile=TickScheduler.getSchedulerProfile()] Profile id.
   * @returns {{ label: string, closedInterval: number }} Profile config.
   */
  static getSchedulerProfileConfig(profile = TickScheduler.getSchedulerProfile()) {
    return SCHEDULER_PROFILES[normalizeProfile(profile)];
  }

  /**
   * Returns the current persisted group counts.
   *
   * @returns {number[]} One count per group.
   */
  static getGroupCounts() {
    try {
      return normalizeCounts(JSON.parse(world.getDynamicProperty(TICK_GROUP_COUNTS_PROPERTY_ID) ?? "[]"));
    } catch {
      return normalizeCounts();
    }
  }

  /**
   * Persists group counts.
   *
   * @param {number[]} counts Group counts.
   * @returns {number[]} Normalized counts that were stored.
   */
  static setGroupCounts(counts) {
    const normalizedCounts = normalizeCounts(counts);
    world.setDynamicProperty(TICK_GROUP_COUNTS_PROPERTY_ID, JSON.stringify(normalizedCounts));
    return normalizedCounts;
  }

  /**
   * Applies a count delta to one group.
   *
   * @param {number} group Group id.
   * @param {number} delta Count delta.
   * @returns {number[]} Updated group counts.
   */
  static updateGroupCount(group, delta) {
    const normalizedGroup = normalizeGroup(group);
    if (normalizedGroup === 0) return TickScheduler.getGroupCounts();

    const counts = TickScheduler.getGroupCounts();
    const index = normalizedGroup - 1;
    counts[index] = Math.max(0, counts[index] + Math.floor(Number(delta) || 0));

    return TickScheduler.setGroupCounts(counts);
  }

  /**
   * Returns the group with the fewest assigned machines.
   *
   * @returns {number} Least used group id.
   */
  static getLeastUsedGroup() {
    const counts = TickScheduler.getGroupCounts();
    let group = 1;
    let count = counts[0];

    for (let index = 1; index < counts.length; index++) {
      if (counts[index] >= count) continue;

      group = index + 1;
      count = counts[index];
    }

    return group;
  }

  /**
   * Reads the tick group assigned to a machine entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {number} Assigned group id, or 0 when unassigned.
   */
  static getTickGroup(entity) {
    try {
      return normalizeGroup(entity?.getProperty?.(TICK_GROUP_PROPERTY_ID));
    } catch {
      return 0;
    }
  }

  /**
   * Writes a tick group to a machine entity.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @param {number} group Group id.
   * @returns {number} Group id written, or 0 on failure.
   */
  static setTickGroup(entity, group) {
    const normalizedGroup = normalizeGroup(group);

    try {
      entity?.setProperty?.(TICK_GROUP_PROPERTY_ID, normalizedGroup);
    } catch {
      return 0;
    }

    return normalizedGroup;
  }

  /**
   * Ensures a machine entity has a tick group.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {number} Assigned group id.
   */
  static assignTickGroup(entity) {
    const currentGroup = TickScheduler.getTickGroup(entity);
    if (currentGroup !== 0) return currentGroup;

    const group = TickScheduler.getLeastUsedGroup();
    const assignedGroup = TickScheduler.setTickGroup(entity, group);

    if (assignedGroup !== 0) {
      TickScheduler.updateGroupCount(assignedGroup, 1);
      broadcastGroupCount(assignedGroup, 1);
    }

    return assignedGroup;
  }

  /**
   * Releases a machine entity from its tick group.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {number} Released group id, or 0 when the entity was unassigned.
   */
  static releaseTickGroup(entity) {
    const group = TickScheduler.getTickGroup(entity);
    if (group === 0) return 0;

    TickScheduler.updateGroupCount(group, -1);
    broadcastGroupCount(group, -1);
    TickScheduler.setTickGroup(entity, 0);

    return group;
  }

  /**
   * Returns whether at least one player has the machine UI open.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {boolean} Whether the UI is open.
   */
  static hasOpenUI(entity) {
    try {
      return Number(entity?.getProperty?.(OPEN_UI_PLAYERS_PROPERTY_ID) ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Determines whether a machine should process on the current tick.
   *
   * Open machines process every {@link OPEN_INTERVAL} ticks. Closed machines are
   * spread by group across the active scheduler profile's closed interval.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {boolean} True when the machine should run this tick.
   */
  static shouldProcessMachine(entity) {
    if (!globalThis[Constants.GLOBAL_WORLD_LOADED_KEY]) return false;

    const tick = globalThis[Constants.GLOBAL_TICK_COUNT_KEY] ?? 0;

    if (TickScheduler.hasOpenUI(entity)) {
      return tick % OPEN_INTERVAL === 0;
    }

    const group = TickScheduler.assignTickGroup(entity);
    if (group === 0) return false;

    const { closedInterval } = TickScheduler.getSchedulerProfileConfig();
    return tick % closedInterval === getGroupPhase(group, closedInterval);
  }

  /**
   * Returns the effective processing interval for a machine.
   *
   * This is used by machine logic to scale per-tick work so total throughput
   * remains stable when closed machines run less often.
   *
   * @param {import("@minecraft/server").Entity} entity Machine helper entity.
   * @returns {number} Processing interval in ticks.
   */
  static getProcessingInterval(entity) {
    return TickScheduler.hasOpenUI(entity) ? OPEN_INTERVAL : TickScheduler.getSchedulerProfileConfig().closedInterval;
  }

  /**
   * Handles the scheduler profile script event payload.
   *
   * @param {string} message Requested scheduler profile id.
   * @returns {void}
   */
  static handleSchedulerProfileScriptEvent(message) {
    TickScheduler.setSchedulerProfile(message);
  }

  /**
   * Handles tick group count synchronization messages from other addons.
   *
   * @param {string} message Payload in the form "add|group|source" or "remove|group|source".
   * @returns {void}
   */
  static handleTickGroupScriptEvent(message) {
    const [action, groupRaw, source] = String(message ?? "").split("|");
    if (source === Constants.TICK_GROUP_SOURCE_ID) return;

    const group = normalizeGroup(groupRaw);
    if (group === 0) return;

    if (action === "add") {
      TickScheduler.updateGroupCount(group, 1);
    } else if (action === "remove") {
      TickScheduler.updateGroupCount(group, -1);
    }
  }
}

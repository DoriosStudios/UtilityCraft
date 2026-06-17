import { system, world } from "@minecraft/server";
import * as Constants from "../constants.js";

export const TICK_GROUP_PROPERTY_ID = "utilitycraft:tick_group";
export const TICK_GROUP_COUNTS_PROPERTY_ID = "utilitycraft:tick_group_counts";

const OPEN_UI_PLAYERS_PROPERTY_ID = "utilitycraft:players";
const GROUP_COUNT = 5;
const OPEN_INTERVAL = 4;

export const SCHEDULER_PROFILES = {
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

export const SCHEDULER_PROFILE_IDS = Object.keys(SCHEDULER_PROFILES);

let schedulerProfileCache;

function normalizeProfile(profile) {
  const value = String(profile ?? "").trim().toLowerCase();
  return SCHEDULER_PROFILES[value] ? value : Constants.DEFAULT_SCHEDULER_PROFILE;
}

function getGroupPhase(group, closedInterval) {
  const step = closedInterval / GROUP_COUNT;
  return group === GROUP_COUNT ? 0 : group * step;
}

function normalizeGroup(group) {
  const value = Math.floor(Number(group) || 0);
  return value >= 1 && value <= GROUP_COUNT ? value : 0;
}

function normalizeCounts(counts) {
  const normalized = Array.isArray(counts) ? counts : [];

  return Array.from({ length: GROUP_COUNT }, (_, index) => {
    const count = Math.floor(Number(normalized[index]) || 0);
    return Math.max(0, count);
  });
}

export function getGroupCounts() {
  try {
    return normalizeCounts(JSON.parse(world.getDynamicProperty(TICK_GROUP_COUNTS_PROPERTY_ID) ?? "[]"));
  } catch {
    return normalizeCounts();
  }
}

export function setGroupCounts(counts) {
  const normalizedCounts = normalizeCounts(counts);
  world.setDynamicProperty(TICK_GROUP_COUNTS_PROPERTY_ID, JSON.stringify(normalizedCounts));
  return normalizedCounts;
}

export function updateGroupCount(group, delta) {
  const normalizedGroup = normalizeGroup(group);
  if (normalizedGroup === 0) return getGroupCounts();

  const counts = getGroupCounts();
  const index = normalizedGroup - 1;
  counts[index] = Math.max(0, counts[index] + Math.floor(Number(delta) || 0));

  return setGroupCounts(counts);
}

function broadcastGroupCount(group, delta) {
  const action = delta > 0 ? "add" : "remove";
  system.sendScriptEvent(Constants.TICK_GROUP_EVENT_ID, `${action}|${group}|${Constants.TICK_GROUP_SOURCE_ID}`);
}

export function getSchedulerProfile() {
  if (!schedulerProfileCache) {
    schedulerProfileCache = normalizeProfile(world.getDynamicProperty(Constants.SCHEDULER_PROFILE_PROPERTY_ID));
  }

  return schedulerProfileCache;
}

export function setSchedulerProfile(profile) {
  const normalizedProfile = normalizeProfile(profile);
  world.setDynamicProperty(Constants.SCHEDULER_PROFILE_PROPERTY_ID, normalizedProfile);
  schedulerProfileCache = normalizedProfile;
  return normalizedProfile;
}

export function getSchedulerProfileConfig(profile = getSchedulerProfile()) {
  return SCHEDULER_PROFILES[normalizeProfile(profile)];
}

export function getLeastUsedGroup() {
  const counts = getGroupCounts();
  let group = 1;
  let count = counts[0];

  for (let index = 1; index < counts.length; index++) {
    if (counts[index] >= count) continue;

    group = index + 1;
    count = counts[index];
  }

  return group;
}

export function getTickGroup(entity) {
  try {
    return normalizeGroup(entity?.getProperty?.(TICK_GROUP_PROPERTY_ID));
  } catch {
    return 0;
  }
}

export function setTickGroup(entity, group) {
  const normalizedGroup = normalizeGroup(group);

  try {
    entity?.setProperty?.(TICK_GROUP_PROPERTY_ID, normalizedGroup);
  } catch {
    return 0;
  }

  return normalizedGroup;
}

export function assignTickGroup(entity) {
  const currentGroup = getTickGroup(entity);
  if (currentGroup !== 0) return currentGroup;

  const group = getLeastUsedGroup();
  const assignedGroup = setTickGroup(entity, group);

  if (assignedGroup !== 0) {
    updateGroupCount(assignedGroup, 1);
    broadcastGroupCount(assignedGroup, 1);
  }

  return assignedGroup;
}

export function releaseTickGroup(entity) {
  const group = getTickGroup(entity);
  if (group === 0) return 0;

  updateGroupCount(group, -1);
  broadcastGroupCount(group, -1);
  setTickGroup(entity, 0);

  return group;
}

export function hasOpenUI(entity) {
  try {
    return Number(entity?.getProperty?.(OPEN_UI_PLAYERS_PROPERTY_ID) ?? 0) > 0;
  } catch {
    return false;
  }
}

export function shouldProcessMachine(entity) {
  if (!globalThis[Constants.GLOBAL_WORLD_LOADED_KEY]) return false;

  const tick = globalThis[Constants.GLOBAL_TICK_COUNT_KEY] ?? 0;

  if (hasOpenUI(entity)) {
    return tick % OPEN_INTERVAL === 0;
  }

  const group = assignTickGroup(entity);
  if (group === 0) return false;

  const { closedInterval } = getSchedulerProfileConfig();
  return tick % closedInterval === getGroupPhase(group, closedInterval);
}

export function getProcessingInterval(entity) {
  return hasOpenUI(entity) ? OPEN_INTERVAL : getSchedulerProfileConfig().closedInterval;
}

export function handleSchedulerProfileScriptEvent(message) {
  setSchedulerProfile(message);
}

export function handleTickGroupScriptEvent(message) {
  const [action, groupRaw, source] = String(message ?? "").split("|");
  if (source === Constants.TICK_GROUP_SOURCE_ID) return;

  const group = normalizeGroup(groupRaw);
  if (group === 0) return;

  if (action === "add") {
    updateGroupCount(group, 1);
  } else if (action === "remove") {
    updateGroupCount(group, -1);
  }
}

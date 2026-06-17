import { system, world } from "@minecraft/server";
import * as Constants from "../constants.js";

export const TICK_GROUP_PROPERTY_ID = "utilitycraft:tick_group";
export const TICK_GROUP_COUNTS_PROPERTY_ID = "utilitycraft:tick_group_counts";

const OPEN_UI_PLAYERS_PROPERTY_ID = "utilitycraft:players";
const GROUP_COUNT = 5;
const CLOSED_INTERVAL = 20;
const OPEN_INTERVAL = 4;
const GROUP_PHASES = [0, 4, 8, 12, 16, 0];

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

  return tick % CLOSED_INTERVAL === GROUP_PHASES[group];
}

export function getProcessingInterval(entity) {
  return hasOpenUI(entity) ? OPEN_INTERVAL : CLOSED_INTERVAL;
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

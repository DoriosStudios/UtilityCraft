import { system, world } from "@minecraft/server";
import * as Constants from "../constants.js";

export const TICK_SLOT_COUNTS_PROPERTY_ID = "utilitycraft:tick_slot_counts";

const TICK_SLOT_PROPERTY_PREFIX = "utilitycraft:tick_slot";
const OPEN_UI_COUNT_PROPERTY_PREFIX = "utilitycraft:open_ui";
const GROUP_COUNT = 5;
const SUBGROUP_COUNT = 8;
const SLOT_COUNT = GROUP_COUNT * SUBGROUP_COUNT;
const BASE_STEP = 4;
const DEBUG_COUNT_RETENTION_TICKS = 80;
const TICK_SYNC_SOURCE_ID = `${Constants.TICK_GROUP_SOURCE_ID}_${Math.random().toString(36).slice(2)}`;

export const SCHEDULER_PROFILES = {
  fast: {
    label: "Fast",
    subgroupsPerPulse: 8,
    openInterval: 2,
  },
  normal: {
    label: "Normal",
    subgroupsPerPulse: 4,
    openInterval: 2,
  },
  low: {
    label: "Low",
    subgroupsPerPulse: 2,
    openInterval: 4,
  },
  lowest: {
    label: "Lowest",
    subgroupsPerPulse: 1,
    openInterval: 4,
  },
};

export const SCHEDULER_PROFILE_IDS = Object.keys(SCHEDULER_PROFILES);

let schedulerProfileCache;
let machineTickDebugEnabled = false;
const machineTickDebugCounts = new Map();

function normalizeProfile(profile) {
  const value = String(profile ?? "").trim().toLowerCase();
  return SCHEDULER_PROFILES[value] ? value : Constants.DEFAULT_SCHEDULER_PROFILE;
}

function normalizeSlot(slot) {
  const value = Math.floor(Number(slot) || 0);
  return value >= 1 && value <= SLOT_COUNT ? value : 0;
}

function normalizeCounts(counts) {
  const normalized = Array.isArray(counts) ? counts : [];

  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const count = Math.floor(Number(normalized[index]) || 0);
    return Math.max(0, count);
  });
}

function sanitizeDimensionId(dimension) {
  return String(dimension?.id ?? "unknown").replace(/[^a-zA-Z0-9_]/g, "_");
}

function getLocationKey(location) {
  return `${Math.floor(location.x)}_${Math.floor(location.y)}_${Math.floor(location.z)}`;
}

function getTargetDimension(target) {
  return target?.dimension;
}

function getTargetLocation(target) {
  return target?.location;
}

function getTargetKey(target, prefix) {
  const dimension = getTargetDimension(target);
  const location = getTargetLocation(target);

  if (!dimension || !location) return undefined;

  return `${prefix}_${sanitizeDimensionId(dimension)}_${getLocationKey(location)}`;
}

function slotToGroup(slot) {
  return ((slot - 1) % GROUP_COUNT) + 1;
}

function slotToSubgroup(slot) {
  return Math.floor((slot - 1) / GROUP_COUNT) + 1;
}

function getCurrentGroup(tick) {
  if (tick % BASE_STEP !== 0) return 0;

  const cycleTick = tick % (GROUP_COUNT * BASE_STEP);
  return cycleTick === 0 ? GROUP_COUNT : cycleTick / BASE_STEP;
}

function getActiveSubgroupRange(tick, config) {
  const windowCount = SUBGROUP_COUNT / config.subgroupsPerPulse;
  const round = Math.floor(Math.max(0, tick - 1) / (GROUP_COUNT * BASE_STEP));
  const window = round % windowCount;
  const start = window * config.subgroupsPerPulse + 1;

  return {
    start,
    end: start + config.subgroupsPerPulse - 1,
  };
}

function broadcastSlotCount(slot, delta) {
  const action = delta > 0 ? "add" : "remove";
  system.sendScriptEvent(Constants.TICK_GROUP_EVENT_ID, `${action}|${slot}|${TICK_SYNC_SOURCE_ID}`);
}

function getRuntimeTick() {
  return system.currentTick ?? globalThis[Constants.GLOBAL_TICK_COUNT_KEY] ?? 0;
}

function pruneMachineTickDebugCounts(currentTick = getRuntimeTick()) {
  const oldestTick = currentTick - DEBUG_COUNT_RETENTION_TICKS;

  for (const tick of machineTickDebugCounts.keys()) {
    if (tick < oldestTick) {
      machineTickDebugCounts.delete(tick);
    }
  }
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

export function setMachineTickDebugEnabled(enabled) {
  const shouldEnable = enabled === true;

  if (shouldEnable && !machineTickDebugEnabled) {
    machineTickDebugCounts.clear();
  }

  machineTickDebugEnabled = shouldEnable;

  if (!machineTickDebugEnabled) {
    machineTickDebugCounts.clear();
  }

  return machineTickDebugEnabled;
}

export function isMachineTickDebugEnabled() {
  return machineTickDebugEnabled;
}

export function recordMachineTick() {
  if (!machineTickDebugEnabled) return;

  const tick = getRuntimeTick();
  machineTickDebugCounts.set(tick, (machineTickDebugCounts.get(tick) ?? 0) + 1);

  if (tick % 20 === 0) {
    pruneMachineTickDebugCounts(tick);
  }
}

export function getMachineTickDebugCount(tick = getRuntimeTick()) {
  return machineTickDebugCounts.get(Math.floor(Number(tick) || 0)) ?? 0;
}

export function getMachineTickDebugCounts(startTick, endTick) {
  const start = Math.floor(Number(startTick) || 0);
  const end = Math.floor(Number(endTick) || start);

  pruneMachineTickDebugCounts();

  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
    return getMachineTickDebugCount(start + index);
  });
}

export function getSlotCounts() {
  try {
    return normalizeCounts(JSON.parse(world.getDynamicProperty(TICK_SLOT_COUNTS_PROPERTY_ID) ?? "[]"));
  } catch {
    return normalizeCounts();
  }
}

export function setSlotCounts(counts) {
  const normalizedCounts = normalizeCounts(counts);
  world.setDynamicProperty(TICK_SLOT_COUNTS_PROPERTY_ID, JSON.stringify(normalizedCounts));
  return normalizedCounts;
}

export function updateSlotCount(slot, delta) {
  const normalizedSlot = normalizeSlot(slot);
  if (normalizedSlot === 0) return getSlotCounts();

  const counts = getSlotCounts();
  const index = normalizedSlot - 1;
  counts[index] = Math.max(0, counts[index] + Math.floor(Number(delta) || 0));

  return setSlotCounts(counts);
}

export function getGroupCounts() {
  const counts = getSlotCounts();

  return Array.from({ length: GROUP_COUNT }, (_, groupIndex) => {
    const group = groupIndex + 1;
    return counts.reduce((sum, count, slotIndex) => {
      return slotToGroup(slotIndex + 1) === group ? sum + count : sum;
    }, 0);
  });
}

export function getLeastUsedSlot() {
  const counts = getSlotCounts();
  let slot = 1;
  let count = counts[0];

  for (let index = 1; index < counts.length; index++) {
    if (counts[index] >= count) continue;

    slot = index + 1;
    count = counts[index];
  }

  return slot;
}

export function getTickSlot(target) {
  const key = getTargetKey(target, TICK_SLOT_PROPERTY_PREFIX);
  if (!key) return 0;

  try {
    return normalizeSlot(world.getDynamicProperty(key));
  } catch {
    return 0;
  }
}

export function setTickSlot(target, slot) {
  const key = getTargetKey(target, TICK_SLOT_PROPERTY_PREFIX);
  if (!key) return 0;

  const normalizedSlot = normalizeSlot(slot);

  if (normalizedSlot === 0) {
    world.setDynamicProperty(key, undefined);
  } else {
    world.setDynamicProperty(key, normalizedSlot);
  }

  return normalizedSlot;
}

export function assignTickSlot(target) {
  const currentSlot = getTickSlot(target);
  if (currentSlot !== 0) return currentSlot;

  const slot = getLeastUsedSlot();
  const assignedSlot = setTickSlot(target, slot);

  if (assignedSlot !== 0) {
    updateSlotCount(assignedSlot, 1);
    broadcastSlotCount(assignedSlot, 1);
  }

  return assignedSlot;
}

export function releaseTickSlot(target) {
  const slot = getTickSlot(target);
  if (slot === 0) return 0;

  updateSlotCount(slot, -1);
  broadcastSlotCount(slot, -1);
  setTickSlot(target, 0);
  clearOpenUICount(target);

  return slot;
}

export function getOpenUICount(target) {
  const key = getTargetKey(target, OPEN_UI_COUNT_PROPERTY_PREFIX);
  if (!key) return 0;

  try {
    return Math.max(0, Math.floor(Number(world.getDynamicProperty(key)) || 0));
  } catch {
    return 0;
  }
}

export function setOpenUICount(target, count) {
  const key = getTargetKey(target, OPEN_UI_COUNT_PROPERTY_PREFIX);
  if (!key) return 0;

  const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));

  if (normalizedCount === 0) {
    world.setDynamicProperty(key, undefined);
  } else {
    world.setDynamicProperty(key, normalizedCount);
  }

  return normalizedCount;
}

export function addOpenUICount(target) {
  return setOpenUICount(target, getOpenUICount(target) + 1);
}

export function removeOpenUICount(target) {
  return setOpenUICount(target, getOpenUICount(target) - 1);
}

export function clearOpenUICount(target) {
  return setOpenUICount(target, 0);
}

export function hasOpenUI(target) {
  return getOpenUICount(target) > 0;
}

export function shouldProcessSlot(slot, tick = globalThis[Constants.GLOBAL_TICK_COUNT_KEY] ?? 0) {
  const normalizedSlot = normalizeSlot(slot);
  if (normalizedSlot === 0) return false;

  const currentGroup = getCurrentGroup(tick);
  if (currentGroup === 0 || slotToGroup(normalizedSlot) !== currentGroup) return false;

  const range = getActiveSubgroupRange(tick, getSchedulerProfileConfig());
  const subgroup = slotToSubgroup(normalizedSlot);

  return subgroup >= range.start && subgroup <= range.end;
}

export function shouldProcessBlock(block) {
  if (!globalThis[Constants.GLOBAL_WORLD_LOADED_KEY]) return false;

  const tick = globalThis[Constants.GLOBAL_TICK_COUNT_KEY] ?? 0;
  const config = getSchedulerProfileConfig();
  const slot = assignTickSlot(block);

  if (hasOpenUI(block)) {
    return tick % config.openInterval === 0;
  }

  return shouldProcessSlot(slot, tick);
}

export function getProcessingInterval(target) {
  const config = getSchedulerProfileConfig();

  if (hasOpenUI(target)) {
    return config.openInterval;
  }

  const windowCount = SUBGROUP_COUNT / config.subgroupsPerPulse;
  return GROUP_COUNT * BASE_STEP * windowCount;
}

export function handleSchedulerProfileScriptEvent(message) {
  setSchedulerProfile(message);
}

export function handleTickGroupScriptEvent(message) {
  const [action, slotRaw, source] = String(message ?? "").split("|");
  if (source === TICK_SYNC_SOURCE_ID) return;

  const slot = normalizeSlot(slotRaw);
  if (slot === 0) return;

  if (action === "add") {
    updateSlotCount(slot, 1);
  } else if (action === "remove") {
    updateSlotCount(slot, -1);
  }
}

// Legacy aliases kept while addons migrate to block/location based scheduling.
export const assignTickGroup = assignTickSlot;
export const releaseTickGroup = releaseTickSlot;

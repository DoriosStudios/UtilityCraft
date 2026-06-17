import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import * as CoreConstants from "../DoriosCore/constants.js";
import {
  getGroupCounts,
  getSchedulerProfile,
  getSchedulerProfileConfig,
  getMachineTickDebugCounts,
  getSlotCounts,
  setMachineTickDebugEnabled,
  SCHEDULER_PROFILE_IDS,
} from "../DoriosCore/machinery/tickScheduler.js";

const STACK_REFILL_PROPERTY = "utilitycraft:stackRefillEnabled";
const SCHEDULER_PROFILE_LABELS = ["Fast", "Normal", "Low", "Lowest"];
const MACHINE_TICK_DEBUG_INTERVALS = new Map();

function isStackRefillEnabled(player) {
  const value = player?.getDynamicProperty?.(STACK_REFILL_PROPERTY);
  return typeof value === "boolean" ? value : true;
}

function sendCommandMessage(origin, message) {
  const source = origin.sourceEntity;
  if (source?.sendMessage) {
    source.sendMessage(message);
  } else {
    world.sendMessage(message);
  }
}

function getDebugPlayerKey(player) {
  return player?.id ?? player?.name ?? player?.nameTag;
}

function stopMachineTickDebugActionbar(player, key = getDebugPlayerKey(player)) {
  const runId = MACHINE_TICK_DEBUG_INTERVALS.get(key);
  if (runId === undefined) return false;

  system.clearRun(runId);
  MACHINE_TICK_DEBUG_INTERVALS.delete(key);

  try {
    player?.onScreenDisplay?.setActionBar("");
  } catch {}

  if (MACHINE_TICK_DEBUG_INTERVALS.size === 0) {
    setMachineTickDebugEnabled(false);
  }

  return true;
}

function startMachineTickDebugActionbar(player) {
  const key = getDebugPlayerKey(player);
  if (!key || !player?.onScreenDisplay) return false;

  setMachineTickDebugEnabled(true);

  const runId = system.runInterval(() => {
    try {
      const tick = system.currentTick ?? 0;
      const startTick = tick - 2;
      const endTick = tick - 1;
      const counts = getMachineTickDebugCounts(startTick, endTick);
      const profile = getSchedulerProfileConfig(getSchedulerProfile()).label;

      player.onScreenDisplay.setActionBar(
        `\u00a7aMachine ticks \u00a77${profile} \u00a78| \u00a77T${startTick}: \u00a7e${counts[0] ?? 0} \u00a78| \u00a77T${endTick}: \u00a7e${counts[1] ?? 0}`,
      );
    } catch {
      stopMachineTickDebugActionbar(player, key);
    }
  }, 2);

  MACHINE_TICK_DEBUG_INTERVALS.set(key, runId);
  return true;
}

function toggleMachineTickDebugActionbar(origin) {
  const player = origin.sourceEntity;
  const key = getDebugPlayerKey(player);

  if (!key || !player?.onScreenDisplay) {
    sendCommandMessage(origin, "\u00a7cMachine tick debug needs a player source.");
    return;
  }

  if (stopMachineTickDebugActionbar(player, key)) {
    sendCommandMessage(origin, "\u00a7cMachine tick debug disabled.");
    return;
  }

  if (startMachineTickDebugActionbar(player)) {
    sendCommandMessage(origin, "\u00a7aMachine tick debug enabled. Run \u00a7e/tickgroups Debug\u00a7a again to disable it.");
  }
}

DoriosAPI.register.command({
  name: "legacyrefreshspeed",
  description: "Legacy global UtilityCraft tick speed setting",
  permissionLevel: "admin",
  parameters: [
    {
      name: "mode",
      type: "enum",
      enum: ["Lowest", "Low", "Normal", "Fast", "Fastest", "Custom"],
    },
    {
      name: "value",
      type: "int",
      optional: true,
    },
  ],
  callback(origin, mode, value) {
    const source = origin.sourceEntity;

    const presets = {
      lowest: { ticks: 40, impact: "low" },
      low: { ticks: 20, impact: "Medium" },
      normal: { ticks: 10, impact: "normal" },
      fast: { ticks: 4, impact: "High" },
      fastest: { ticks: 2, impact: "Very High" },
      default: { ticks: 20, impact: "Medium" },
    };

    let finalValue;
    const preset = presets[mode?.toLowerCase()] ?? presets.default;

    if (mode === "Custom" || mode === "custom") {
      if (typeof value !== "number" || value <= 0) {
        source?.sendMessage("\u00a7cCustom mode requires a valid number.");
        return;
      }
      finalValue = Math.floor(value / 2) * 2;
    } else {
      finalValue = preset.ticks;
    }

    if (finalValue <= 0) {
      source?.sendMessage("\u00a7cInvalid tick speed result.");
      return;
    }

    system.sendScriptEvent(CoreConstants.SET_TICK_SPEED_EVENT_ID, `${finalValue}`);

    source?.sendMessage(`\u00a7aLegacy tick speed set to \u00a7e${finalValue}`);

    if (mode !== "Custom" && mode !== "custom") {
      source?.sendMessage(
        `\u00a77Mode: \u00a7f${mode.replace("_", " ")} \u00a78| \u00a77Impact: \u00a7f${preset.impact ?? "Variable"}`,
      );
    } else {
      source?.sendMessage(
        `\u00a77Mode: \u00a7f${mode.replace("_", " ")} \u00a78| \u00a77Impact: \u00a7fVariable`,
      );
    }

    if (finalValue <= 4) {
      source?.sendMessage(
        "\u00a7cWarning: This legacy tick speed has a high performance impact. " +
        "Only recommended for powerful devices.",
      );
    }
  },
});

DoriosAPI.register.command({
  name: "refreshspeed",
  description: "Sets the UtilityCraft machine scheduler profile",
  permissionLevel: "admin",
  parameters: [
    {
      name: "mode",
      type: "enum",
      enum: SCHEDULER_PROFILE_LABELS,
    },
  ],
  callback(origin, mode) {
    const profile = String(mode ?? CoreConstants.DEFAULT_SCHEDULER_PROFILE).toLowerCase();
    const config = getSchedulerProfileConfig(profile);
    const closedInterval = 5 * 4 * (8 / config.subgroupsPerPulse);

    system.sendScriptEvent(CoreConstants.SET_SCHEDULER_PROFILE_EVENT_ID, profile);

    origin.sourceEntity?.sendMessage(
      `\u00a7aRefresh speed profile set to \u00a7e${config.label} \u00a77(Closed: ${closedInterval} ticks, Open: ${config.openInterval} ticks)`,
    );
  },
});

DoriosAPI.register.command({
  name: "tickgroups",
  description: "Lists UtilityCraft machine tick group counts",
  permissionLevel: "admin",
  parameters: [
    {
      name: "action",
      type: "enum",
      enum: ["List", "Debug"],
    },
  ],
  callback(origin, action) {
    if (action === "Debug" || action === "debug") {
      toggleMachineTickDebugActionbar(origin);
      return;
    }

    if (action !== "List" && action !== "list") return;

    const groupCounts = getGroupCounts();
    const slotCounts = getSlotCounts();
    const total = groupCounts.reduce((sum, count) => sum + count, 0);
    const labels = ["A", "B", "C", "D", "E"];
    const lines = labels.map((label, groupIndex) => {
      const subgroups = Array.from({ length: 8 }, (_, subgroupIndex) => {
        const slotIndex = subgroupIndex * labels.length + groupIndex;
        return `S${subgroupIndex + 1}:\u00a7e${slotCounts[slotIndex] ?? 0}`;
      }).join("\u00a77 ");

      return `\u00a77Group ${label}: \u00a7f${groupCounts[groupIndex]} \u00a78| \u00a77${subgroups}`;
    });
    const message = [
      "\u00a7aUtilityCraft Tick Groups",
      ...lines,
      `\u00a77Total: \u00a7e${total}`,
    ].join("\n");

    sendCommandMessage(origin, message);
  },
});

DoriosAPI.register.itemComponent("settings", {
  async onUse(e) {
    const player = e.source;
    if (!player) return;

    openUtilityCraftSettings(player);
  },
});

/**
 * Opens the UtilityCraft settings menu.
 *
 * @param {import("@minecraft/server").Player} player
 */
async function openUtilityCraftSettings(player) {
  const currentProfile = getSchedulerProfile();
  const currentProfileIndex = Math.max(0, SCHEDULER_PROFILE_IDS.indexOf(currentProfile));
  const currentStackRefill = isStackRefillEnabled(player);

  const form = new ModalFormData()
    .title("UtilityCraft Settings")
    .label(
      "\u00a7bRefresh Speed\n" +
      "\u00a77Controls how often closed machines process in the background.\n" +
      "\u00a7aFast\u00a77 = smoother background updates, higher performance cost.\n" +
      "\u00a7aLowest\u00a77 = slower background updates, better for low-end devices.\n" +
      "\u00a77Open machine UIs still refresh quickly.",
    )
    .dropdown(
      "Machine Refresh Speed",
      SCHEDULER_PROFILE_LABELS,
      {
        defaultValueIndex: currentProfileIndex,
      },
    )
    .label(
      "\u00a7bAuto Stack Refill\n" +
      "\u00a77Automatically refills your main hand stack from your inventory when it runs out.\n" +
      "\u00a77Works with blocks and items.\n" +
      "\u00a77Can be toggled on/off.",
    )
    .toggle(
      "Auto Stack Refill",
      {
        defaultValue: currentStackRefill,
      },
    );

  const res = await form.show(player);
  if (res.canceled) return;

  const formValues = Array.isArray(res.formValues) ? res.formValues : [];
  const profileIndex = formValues.find((value) => typeof value === "number" && Number.isFinite(value));
  const stackRefillEnabledValue = [...formValues].reverse().find((value) => typeof value === "boolean");
  const profileLabel = SCHEDULER_PROFILE_LABELS[profileIndex] ?? SCHEDULER_PROFILE_LABELS[currentProfileIndex];
  const profile = profileLabel.toLowerCase();
  const profileConfig = getSchedulerProfileConfig(profile);
  const stackRefillEnabled = stackRefillEnabledValue ?? currentStackRefill;

  player.setDynamicProperty(STACK_REFILL_PROPERTY, stackRefillEnabled);

  try {
    system.sendScriptEvent(CoreConstants.SET_SCHEDULER_PROFILE_EVENT_ID, profile);
  } catch {
    player.sendMessage("\u00a7cFailed to apply refresh speed profile.");
    return;
  }

  player.sendMessage(`\u00a7aRefresh speed profile set to \u00a7e${profileConfig.label}`);
  player.sendMessage(`\u00a77Auto Stack Refill: ${stackRefillEnabled ? "\u00a7aEnabled" : "\u00a7cDisabled"}`);
}

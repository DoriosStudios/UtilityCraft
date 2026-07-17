import * as DoriosLib from "DoriosLib/index.js";
import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  DEFAULT_SCHEDULER_PROFILE,
  SET_SCHEDULER_PROFILE_EVENT_ID,
  SET_TICK_SPEED_EVENT_ID,
  TickScheduler,
} from "DoriosCore/index.js";

const STACK_REFILL_PROPERTY = "utilitycraft:stackRefillEnabled";
const SCHEDULER_PROFILE_LABELS = ["Fast", "Normal", "Low"];

function isStackRefillEnabled(player) {
  const value = player?.getDynamicProperty?.(STACK_REFILL_PROPERTY);
  return typeof value === "boolean" ? value : true;
}

function getClosedIntervalLabel(profile) {
  return TickScheduler.getSchedulerProfileConfig(profile).closedInterval;
}

DoriosLib.registry.customCommand({
  name: "utilitycraft:legacyrefreshspeed",
  description: "Legacy global UtilityCraft tick speed setting",
  permissionLevel: "admin",
  parameters: [
    {
      name: "mode",
      type: "enum",
      values: ["Lowest", "Low", "Normal", "Fast", "Fastest", "Custom"],
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
      lowest: { ticks: 40, impact: "Low" },
      low: { ticks: 20, impact: "Medium" },
      normal: { ticks: 10, impact: "Normal" },
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

    system.sendScriptEvent(SET_TICK_SPEED_EVENT_ID, `${finalValue}`);

    source?.sendMessage(`\u00a7aLegacy tick speed set to \u00a7e${finalValue}`);

    if (mode !== "Custom" && mode !== "custom") {
      source?.sendMessage(
        `\u00a77Mode: \u00a7f${mode.replace("_", " ")} \u00a78| \u00a77Impact: \u00a7f${preset.impact ?? "Variable"}`,
      );
    } else {
      source?.sendMessage("\u00a77Mode: \u00a7fCustom \u00a78| \u00a77Impact: \u00a7fVariable");
    }
  },
});

DoriosLib.registry.customCommand({
  name: "utilitycraft:refreshspeed",
  description: "Sets the UtilityCraft machine scheduler profile",
  permissionLevel: "admin",
  parameters: [
    {
      name: "mode",
      type: "enum",
      values: SCHEDULER_PROFILE_LABELS,
    },
  ],
  callback(origin, mode) {
    const profile = String(mode ?? DEFAULT_SCHEDULER_PROFILE).toLowerCase();
    const config = TickScheduler.getSchedulerProfileConfig(profile);

    system.sendScriptEvent(SET_SCHEDULER_PROFILE_EVENT_ID, profile);

    origin.sourceEntity?.sendMessage(
      `\u00a7aRefresh speed profile set to \u00a7e${config.label} \u00a77(Closed: ${config.closedInterval} ticks, Open: 4 ticks)`,
    );
  },
});

DoriosLib.registry.customCommand({
  name: "utilitycraft:tickgroups",
  description: "Lists UtilityCraft machine tick group counts",
  permissionLevel: "admin",
  parameters: [
    {
      name: "action",
      type: "enum",
      values: ["List"],
    },
  ],
  callback(origin, action) {
    if (action !== "List" && action !== "list") return;

    const counts = TickScheduler.getGroupCounts();
    const total = counts.reduce((sum, count) => sum + count, 0);
    const labels = ["A", "B", "C", "D", "E"];
    const lines = counts.map((count, index) => `\u00a77Group ${labels[index]}: \u00a7e${count}`);
    const message = [
      "\u00a7aUtilityCraft Tick Groups",
      ...lines,
      `\u00a77Total: \u00a7e${total}`,
    ].join("\n");

    const source = origin.sourceEntity;
    if (source?.sendMessage) {
      source.sendMessage(message);
    } else {
      world.sendMessage(message);
    }
  },
});

DoriosLib.registry.itemComponent("utilitycraft:settings", {
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
  const schedulerProfileIds = TickScheduler.getSchedulerProfileIds();
  const currentProfile = TickScheduler.getSchedulerProfile();
  const currentProfileIndex = Math.max(0, schedulerProfileIds.indexOf(currentProfile));
  const currentStackRefill = isStackRefillEnabled(player);

  const form = new ModalFormData()
    .title("UtilityCraft Settings")
    .label(
      "\u00a7bRefresh Speed\n" +
      "\u00a77Controls how often closed machines process in the background.\n" +
      "\u00a7aFast\u00a77 = current scheduler speed.\n" +
      "\u00a7aNormal\u00a77 = double closed tick span.\n" +
      "\u00a7aLow\u00a77 = 80 tick closed span.\n" +
      "\u00a77Open machine UIs always refresh every 4 ticks.",
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
  const profile = schedulerProfileIds[profileIndex] ?? currentProfile;
  const stackRefillEnabled = stackRefillEnabledValue ?? currentStackRefill;

  player.setDynamicProperty(STACK_REFILL_PROPERTY, stackRefillEnabled);

  try {
    system.sendScriptEvent(SET_SCHEDULER_PROFILE_EVENT_ID, profile);
  } catch {
    player.sendMessage("\u00a7cFailed to apply refresh speed profile.");
    return;
  }

  player.sendMessage(
    `\u00a7aRefresh speed profile set to \u00a7e${TickScheduler.getSchedulerProfileConfig(profile).label} \u00a77(Closed: ${getClosedIntervalLabel(profile)} ticks)`,
  );
  player.sendMessage(`\u00a77Auto Stack Refill: ${stackRefillEnabled ? "\u00a7aEnabled" : "\u00a7cDisabled"}`);
}

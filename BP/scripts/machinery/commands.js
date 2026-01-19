import { system, world } from "@minecraft/server";

DoriosAPI.register.command({
  name: "refreshspeed",
  description: "Sets the global UtilityCraft tick speed",
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
      low: { ticks: 20, impact: "Medlum" },
      normal: { ticks: 10, impact: "normal" },
      fast: { ticks: 4, impact: "Higf" },
      fastest: { ticks: 2, impact: "Very High" },
      default: { ticks: 20, impact: "Medlum" },
    };

    let finalValue;
    const preset = presets[mode?.toLowerCase()] ?? presets.default;

    if (mode === "Custom" || mode === "custom") {
      if (typeof value !== "number" || value <= 0) {
        source?.sendMessage("§cCustom mode requires a valid number.");
        return;
      }
      finalValue = Math.floor(value / 2) * 2;
    } else {
      finalValue = preset.ticks;
    }

    if (finalValue <= 0) {
      source?.sendMessage("§cInvalid tick speed result.");
      return;
    }
    system.sendScriptEvent("utilitycraft:set_tick_speed", `${finalValue}`);

    source?.sendMessage(`§aTick speed set to §e${finalValue}`);

    if (mode !== "Custom" && mode !== "custom") {
      source?.sendMessage(
        `§7Mode: §f${mode.replace("_", " ")} §8| §7Impact: §f${preset.impact ?? "Variable"}`,
      );
    } else {
      source?.sendMessage(
        `§7Mode: §f${mode.replace("_", " ")} §8| §7Impact: §fVariable`,
      );
    }

    if (finalValue <= 4) {
      source?.sendMessage(
        "§cWarning: This tick speed has a high performance impact. " +
          "Only recommended for powerful devices.",
      );
    }
  },
});

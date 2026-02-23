import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

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
      fast: { ticks: 4, impact: "High" },
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

DoriosAPI.register.itemComponent("settings", {
  async onUse(e) {
    const player = e.source;
    if (!player) return;

    openUtilityCraftSettings(player);
  }
});

/**
 * Opens the UtilityCraft Refresh Speed menu.
 *
 * Controls how often UtilityCraft machines visually update.
 * Does NOT affect processing speed.
 *
 * @param {import("@minecraft/server").Player} player
 */
async function openUtilityCraftSettings(player) {
  const currentSpeed = world.getDynamicProperty("utilitycraft:tickSpeed") ?? 10;

  const form = new ModalFormData()
    .title("UtilityCraft Settings")

    .label(
      "§bRefresh Speed\n" +
      "§7Controls how often machines visually update.\n" +
      "§aLower§7 = smoother animation, higher performance cost.\n" +
      "§aHigher§7 = less frequent updates, better performance.\n" +
      "§7Does §bnot§7 affect machine processing speed."
    )

    .slider(
      "Machine Refresh Speed",
      2,
      40,
      {
        defaultValue: currentSpeed,
        valueStep: 2
      }
    );

  const res = await form.show(player);
  if (res.canceled) return;

  const [, refreshSpeed] = res.formValues;

  world.setDynamicProperty("utilitycraft:tickSpeed", refreshSpeed);

  player.sendMessage(`§aRefresh speed set to §e${refreshSpeed} ticks`);
}
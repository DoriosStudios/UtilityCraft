import { system, world } from "@minecraft/server";

/**
  * Registers input and output slots for containers.
  */
const registerContainer = ({ message, sourceEntity }) => {
    let slots;
    try {
        slots = JSON.parse(message)
    } catch { return }
    if (!slots) return
    if (!slots.input && !slots.output) return
    sourceEntity.setDynamicProperty("dorios:special_container", JSON.stringify(slots))
}
import { system } from "@minecraft/server";

export const BLUEPRINT_ITEM_ID = "utilitycraft:blueprint";
export const BLUEPRINT_WRITE_EVENT_ID = "utilitycraft:set_blueprint_data";

/**
 * @typedef {{ id?: string, amount?: number, materials?: Array<{ id: string, amount: number }> | string, leftover?: string | string[] | false, lore?: string[] }} BlueprintData
 * @typedef {{ slot: number | string, data: BlueprintData }} BlueprintSlotPayload
 */

function getEntityContainer(entity) {
    return entity?.getComponent("minecraft:inventory")?.container;
}

function normalizeSlot(slot) {
    const value = typeof slot === "string" ? Number(slot) : slot;
    if (!Number.isInteger(value) || value < 0) return undefined;
    return value;
}

function formatItemId(itemId) {
    const rawId = typeof itemId === "string" ? (itemId.split(":")[1] ?? itemId) : "";
    return rawId
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function normalizeMaterials(materials) {
    let parsed = materials;

    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            parsed = [];
        }
    }

    if (!Array.isArray(parsed)) return [];

    return parsed
        .map((entry) => {
            if (!entry || typeof entry !== "object") return undefined;

            const id = typeof entry.id === "string" ? entry.id : undefined;
            const amount = Number(entry.amount);

            if (!id || !Number.isFinite(amount) || amount <= 0) return undefined;

            return {
                id,
                amount: Math.floor(amount),
            };
        })
        .filter(Boolean);
}

function normalizeLeftover(leftover) {
    if (leftover === false || leftover === undefined || leftover === null) {
        return undefined;
    }

    if (Array.isArray(leftover)) {
        return typeof leftover[0] === "string" ? leftover[0] : undefined;
    }

    return typeof leftover === "string" ? leftover : undefined;
}

export function readBlueprintData(itemStack) {
    if (!itemStack || itemStack.typeId !== BLUEPRINT_ITEM_ID) {
        return undefined;
    }

    return {
        id: itemStack.getDynamicProperty("id"),
        amount: itemStack.getDynamicProperty("amount"),
        materials: normalizeMaterials(itemStack.getDynamicProperty("materials")),
        leftover: itemStack.getDynamicProperty("leftover"),
        lore: itemStack.getLore(),
    };
}

export function buildBlueprintLore(data) {
    const materials = normalizeMaterials(data?.materials);
    const resultId = typeof data?.id === "string" ? data.id : "";

    const lore = [
        `\u00A7r\u00A77 Recipe: \u00A7r\u00A7f${formatItemId(resultId)}`,
        "\u00A7r\u00A77 Materials:",
    ];

    for (const material of materials) {
        lore.push(`\u00A7r\u00A77 - ${formatItemId(material.id)} x${material.amount}`);
    }

    return lore;
}

export function writeBlueprintData(itemStack, data, options = {}) {
    if (!itemStack || itemStack.typeId !== BLUEPRINT_ITEM_ID || !data || typeof data !== "object") {
        return false;
    }

    const current = readBlueprintData(itemStack) ?? {};
    const id = typeof data.id === "string" ? data.id : current.id;
    const amountValue = data.amount ?? current.amount;
    const amount = Number(amountValue);
    const materialsSource = Object.prototype.hasOwnProperty.call(data, "materials")
        ? data.materials
        : current.materials;
    const materials = normalizeMaterials(materialsSource);
    const leftoverSource = Object.prototype.hasOwnProperty.call(data, "leftover")
        ? data.leftover
        : current.leftover;
    const leftover = normalizeLeftover(leftoverSource);

    if (!id || !Number.isFinite(amount) || amount <= 0) {
        return false;
    }

    itemStack.setDynamicProperty("id", id);
    itemStack.setDynamicProperty("amount", Math.floor(amount));
    itemStack.setDynamicProperty("materials", JSON.stringify(materials));

    if (leftover) {
        itemStack.setDynamicProperty("leftover", leftover);
    } else {
        itemStack.setDynamicProperty("leftover", undefined);
    }

    if (options.setLore !== false) {
        const lore = Array.isArray(data.lore)
            ? data.lore.filter((line) => typeof line === "string")
            : buildBlueprintLore({ id, materials });
        itemStack.setLore(lore);
    }

    return true;
}

export function writeBlueprintDataAtSlot(entity, slot, data, options = {}) {
    const container = getEntityContainer(entity);
    const slotIndex = normalizeSlot(slot);

    if (!container || slotIndex === undefined || slotIndex >= container.size) {
        return false;
    }

    const itemStack = container.getItem(slotIndex);
    if (!itemStack || itemStack.typeId !== BLUEPRINT_ITEM_ID) {
        return false;
    }

    if (!writeBlueprintData(itemStack, data, options)) {
        return false;
    }

    container.setItem(slotIndex, itemStack);
    return true;
}

export function sendBlueprintDataEvent(entity, payload, eventId = BLUEPRINT_WRITE_EVENT_ID) {
    if (!entity || typeof entity.runCommand !== "function" || !payload || typeof payload !== "object") {
        return false;
    }

    try {
        entity.runCommand(`scriptevent ${eventId} ${JSON.stringify(payload)}`);
        return true;
    } catch {
        return false;
    }
}

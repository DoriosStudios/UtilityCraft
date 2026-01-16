import { world, system, ItemStack } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'
import { blockFaceOffsets } from './system.js'

/**
 * Slot definitions for special containers.
 *
 * Structure:
 * {
 *   "namespace:block_id": {
 *      "Slot Name": number | number[]
 *   }
 * }
 */
const slotRegister = {};


const DEFAULT_CONFIG = {
    version: 1,
    slots: {},
    itemMap: {}
}

export function openSmartImporterMenu(block, player) {
    const key = getImporterKey(block);
    const raw = world.getDynamicProperty(key);
    let cfg;

    try {
        cfg = normalizeSmartImporterConfig(raw ? JSON.parse(raw) : null);
    } catch {
        cfg = normalizeSmartImporterConfig(null);
    }

    const target = getFacingBlock(block);
    const targetId = target.typeId
    if (cfg.blockId != targetId) {
        cfg = DEFAULT_CONFIG
        cfg.blockId = targetId
        cfg.blockName = DoriosAPI.utils.formatIdToText(targetId)
    }

    const menu = new ActionFormData()
        .title("Smart Importer")
        .body(
            "Advanced item filter for machines.\n" +
            "§7- Control exactly where each item is inserted\n" +
            "§7- Target must be a machine or complex inventory\n" +
            "§7- Not compatible with chests"
        );

    menu.button("Configure Slot Filters");
    menu.button("View Summary");
    menu.button("Back");

    menu.show(player).then(res => {
        if (res.canceled) return;

        switch (res.selection) {
            case 0:
                openSmartSlotSelectMenu(block, player, cfg, key);
                break;
            case 1:
                openSmartSummaryMenu(player, cfg);
                break;
            case 2:
                break;
        }
    });
}
function openSmartSlotSelectMenu(block, player, cfg, key) {
    const target = getFacingBlock(block);
    if (!target) {
        player.sendMessage("§cNo target block.");
        return;
    }

    let params = target.getComponent("utilitycraft:special_container")
        ?.customComponentParameters?.params;

    if (!params) {
        params = slotRegister[target.typeId]
        if (!params) {
            player.sendMessage("§cTarget block has no slot data.");
            return;
        }
    }

    const slotKeys = Object.keys(params);
    const menu = new ActionFormData()
        .title("Select Slot");

    slotKeys.forEach(k => {
        menu.button(k);
    });

    menu.button("Back");

    menu.show(player).then(res => {
        if (res.selection === undefined || res.selection === slotKeys.length) {
            openSmartImporterMenu(block, player);
            return;
        }

        const slotKey = slotKeys[res.selection];
        const slots = DoriosAPI.utils.toSlotArray(params[slotKey]);
        // world.sendMessage(`${JSON.stringify(slots)}`)
        if (!cfg.slots[slotKey]) {
            cfg.slots[slotKey] = {
                slots,
                items: []
            };
        }

        openSmartSlotItemMenu(block, player, cfg, key, slotKey);
    });
}
function openSmartSlotItemMenu(block, player, cfg, key, slotKey) {
    const entry = cfg.slots[slotKey];

    const menu = new ActionFormData()
        .title(slotKey)
    // .body(`§7Slots: §e[${entry.slots.join(", ")}]`);

    menu.button("Add Item (Mainhand)");
    menu.button("Remove Item");

    menu.button("Back");

    menu.show(player).then(res => {
        if (res.canceled) return;

        switch (res.selection) {
            case 0: {
                const it = player.getComponent("equippable")?.getEquipment("Mainhand");
                if (!it) {
                    player.sendMessage("§cHold an item.");
                    return;
                }
                if (!entry.items.includes(it.typeId)) {
                    entry.items.push(it.typeId);
                }
                rebuildSmartItemMap(cfg);
                world.setDynamicProperty(key, JSON.stringify(cfg));
                player.sendMessage(`§aAdded ${it.typeId}`);
                break;
            }

            case 1:
                openSmartRemoveItemMenu(block, player, cfg, key, slotKey);
                return;

            case 2:
                openSmartSlotSelectMenu(block, player, cfg, key);
                return;
        }
    });
}
function openSmartRemoveItemMenu(block, player, cfg, key, slotKey) {
    const entry = cfg.slots[slotKey];
    if (entry.items.length === 0) {
        player.sendMessage("§cNo items.");
        return;
    }

    const menu = new ActionFormData()
        .title("Remove Item");

    entry.items.forEach(i => {
        menu.button(DoriosAPI.utils.formatIdToText(i));
    });

    menu.button("Cancel");

    menu.show(player).then(res => {
        if (res.selection === undefined || res.selection === entry.items.length) {
            openSmartSlotItemMenu(block, player, cfg, key, slotKey);
            return;
        }

        entry.items.splice(res.selection, 1);
        rebuildSmartItemMap(cfg);
        world.setDynamicProperty(key, JSON.stringify(cfg));
        player.sendMessage("§cItem removed.");
        openSmartSlotItemMenu(block, player, cfg, key, slotKey);
    });
}
function openSmartSummaryMenu(player, cfg) {
    const lines = [];
    if (cfg.blockName) lines.push(`§a${cfg.blockName} Configuration\n`)
    for (const [k, v] of Object.entries(cfg.slots)) {
        lines.push(`§e${k}`);
        for (const i of v.items) {
            lines.push(` §7- ${DoriosAPI.utils.formatIdToText(i)}`);
        }
    }

    const form = new ActionFormData()
        .title("Smart Importer Summary")
        .body(lines.length ? lines.join("\n") : "§7(No data)");

    form.button("Close");
    form.show(player);
}

function getImporterKey(block) {
    const { x, y, z } = block.location;
    return `imp:${x},${y},${z}`;
}

function normalizeSmartImporterConfig(rawCfg) {
    // Caso 1: no hay config o está corrupto
    if (!rawCfg || typeof rawCfg !== "object") {
        return DEFAULT_CONFIG;
    }

    // Caso 2: config vieja (basic filter v0)
    if (rawCfg.version !== 1) {
        return DEFAULT_CONFIG;
    }

    // Caso 3: smart válido, solo asegurar estructura
    return {
        version: 1,
        slots: rawCfg.slots && typeof rawCfg.slots === "object" ? rawCfg.slots : {},
        itemMap: rawCfg.itemMap && typeof rawCfg.itemMap === "object" ? rawCfg.itemMap : {}
    };
}

function getFacingBlock(block) {
    const face = block.permutation.getState("minecraft:block_face");
    const off = blockFaceOffsets[face];
    if (!off) return null;

    return block.dimension.getBlock({
        x: block.location.x + off[0],
        y: block.location.y + off[1],
        z: block.location.z + off[2],
    });
}

function rebuildSmartItemMap(cfg) {
    const map = {};

    for (const entry of Object.values(cfg.slots)) {
        const slotArr = entry.slots;
        for (const item of entry.items) {
            // first-write-wins (no conflictos)
            if (!map[item]) {
                map[item] = slotArr;
            }
        }
    }

    cfg.itemMap = map;
}

/**
 * ScriptEvent handler to register slot definitions for special containers.
 *
 * Payload format (JSON):
 * {
 *   "namespace:block_id": {
 *     "Input Slot": 3,
 *     "Catalyst Slot": [4, 5]
 *   }
 * }
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_special_container_slots") return;

    let payload;
    try {
        payload = JSON.parse(message);
    } catch {
        console.warn("[Utilicraft] Invalid JSON payload when registering custom special container.");
        return;
    }

    if (!payload || typeof payload !== "object") return;

    for (const [blockId, slots] of Object.entries(payload)) {
        if (!slots || typeof slots !== "object") continue;

        if (!slotRegister[blockId]) {
            slotRegister[blockId] = {};
        }

        for (const [slotName, slotValue] of Object.entries(slots)) {
            if (
                typeof slotValue !== "number" &&
                !Array.isArray(slotValue)
            ) continue;

            slotRegister[blockId][slotName] = slotValue;
        }
    }
});

/* Example
system.sendScriptEvent(
    "utilitycraft:register_special_container_slots",
    JSON.stringify({
        "utilitycraft:alchemy_table": {
            "Input Slot": 3,
            "Catalyst Slot": 4
        },
        "utilitycraft:infusion_altar": {
            "Essence Slots": [5, 6, 7],
            "Core Slot": 8
        }
    })
);
*/
import * as DoriosLib from "DoriosLib/index.js";
import { ModalFormData } from "@minecraft/server-ui";
import { Rotation, Generator } from "DoriosCore/index.js"
import { updateNetworksAtMany } from "../UtilityCore/networks/index.js";
import { openMultiEndpointMenu } from "../UtilityCore/networks/multiEndpoints.js";
import {
    getMultiTubeFaceDisabledResources,
    getPipeResourceTranslationKey,
    getProtectedEndpointDirection,
    getSupportedPipeResources,
    isImporterEndpoint,
    isMultiEndpoint,
    isMultiTube,
    normalizePipeDirection,
    setMultiTubeFaceDisabledResources,
    togglePipeFace,
} from "../UtilityCore/networks/pipeFaces.js";

function translate(key, withArgs) {
    return withArgs ? { translate: key, with: withArgs } : { translate: key };
}

// --- REGISTRO DEL COMPONENTE ---
DoriosLib.registry.itemComponent("utilitycraft:wrench", {
    /**
     * Se ejecuta cuando el jugador usa la wrench sobre un bloque.
     * Soporta tanto rotaciones vanilla como el sistema de 24 rotaciones de UtilityCraft.
     */
    onUseOn(e) {
        const { source, block, blockFace } = e;
        if (block.hasTag("dorios:isTube")) {
            if (isMultiEndpoint(block)) {
                openMultiEndpointMenu(block, source, isImporterEndpoint(block));
                return;
            }
            if (isMultiTube(block)) {
                openMultiTubeFaceMenu(block, blockFace, source);
                return;
            }
            const result = togglePipeFace(block, blockFace);
            if (result.protected) {
                source.onScreenDisplay.setActionBar(translate("message.utilitycraft.pipe.face_protected"));
                source.playSound("random.break");
                return;
            }
            if (!result.changed) return;

            refreshPipeNetworks(block);

            source.onScreenDisplay.setActionBar(
                translate(result.disabled
                    ? "message.utilitycraft.pipe.face_disabled"
                    : "message.utilitycraft.pipe.face_enabled"),
            );
            source.playSound("place.iron");
            return;
        }
        if (!source.isSneaking) {
            if (block.typeId.includes("receiver")) {
                openEnergyNodeMenu(block, source)
                return
            }
            if (block.typeId.includes("transmitter")) {
                toggleEnergyMode(block, source)
                return
            }
            if (!block.hasTag('dorios:energy')) return
            const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
            if (!entity || !entity.getComponent('type_family').hasTypeFamily('dorios:energy_source')) return
            Generator.openGeneratorTransferModeMenu(entity, source)
            return
        }
        if (block.typeId.includes("receiver") || block.typeId.includes("transmitter")) {
            const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
            if (entity) openBasicNetworkMenu(entity, source)
            // toggleEnergyMode(block, source)
            return
        }
        Rotation.handleRotation(block, blockFace)
    },
});

function openMultiTubeFaceMenu(block, rawDirection, source) {
    const direction = normalizePipeDirection(rawDirection);
    if (!direction) return;
    if (getProtectedEndpointDirection(block) === direction) {
        source.onScreenDisplay.setActionBar(translate("message.utilitycraft.pipe.face_protected"));
        source.playSound("random.break");
        return;
    }

    const resources = getSupportedPipeResources(block);
    if (resources.length === 0) return;
    const disabled = new Set(getMultiTubeFaceDisabledResources(block, direction));
    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:multi_tube.face_title"))
        .label(translate(`ui.utilitycraft:multi_tube.face_${direction}`));
    for (const resource of resources) {
        const translationKey = getPipeResourceTranslationKey(resource);
        if (!translationKey) continue;
        form.toggle(translate(translationKey), {
            defaultValue: disabled.has(resource),
        });
    }
    form.submitButton(translate("ui.utilitycraft:multi_tube.confirm"));

    form.show(source).then((result) => {
        if (result.canceled) return;
        const toggles = (Array.isArray(result.formValues) ? result.formValues : [])
            .filter((value) => typeof value === "boolean");
        const blocked = resources.filter((resource, index) => toggles[index] === true);
        if (!setMultiTubeFaceDisabledResources(block, direction, blocked)) {
            source.playSound("random.break");
            return;
        }

        refreshPipeNetworks(block);
        source.onScreenDisplay.setActionBar(
            translate("message.utilitycraft.multi_tube.face_saved"),
        );
        source.playSound("place.iron");
    });
}

function refreshPipeNetworks(block) {
    /** @type {Array<"energy"|"item"|"fluid"|"gas">} */
    const types = [];
    if (block.hasTag("dorios:energy")) types.push("energy");
    if (block.hasTag("dorios:item")) types.push("item");
    if (block.hasTag("dorios:fluid")) types.push("fluid");
    if (block.hasTag("dorios:gas")) types.push("gas");
    updateNetworksAtMany(block, types);
}

/**
 * Opens the Energy Node configuration menu.
 *
 * Allows:
 * - Switching Receiver ↔ Transmitter
 * - Selecting transfer mode
 *
 * @param {Block} block Energy block
 * @param {Player} player Interacting player
 */
export function openEnergyNodeMenu(block, player) {
    if (!block || !player) return;

    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return;

    const isReceiver = block.typeId.includes("receiver");

    const nodeModes = ["receiver", "transmitter"];
    const nodeLabels = nodeModes.map(mode => translate(`ui.utilitycraft:energy.node_${mode}`));
    const nodeDefault = isReceiver ? 0 : 1;

    const mode = entity.getDynamicProperty("transferMode") ?? "nearest";
    const modes = ["nearest", "farthest", "round"];
    const modeLabels = modes.map(value => translate(`ui.utilitycraft:energy.mode_${value}`));

    const currentIndex = modes.indexOf(mode);
    const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

    const modal = new ModalFormData()
        .title(translate("ui.utilitycraft:energy.node_settings_title"))

        // Receiver / Transmitter dropdown
        .dropdown(
            translate("ui.utilitycraft:energy.node_mode"),
            nodeLabels,
            {
                defaultValueIndex: nodeDefault,
                tooltip: translate("ui.utilitycraft:energy.node_mode_tooltip")
            }
        )

        // EXACT same transfer dropdown as generator
        .dropdown(
            translate("ui.utilitycraft:energy.node_transfer_mode"),
            modeLabels,
            {
                defaultValueIndex: defaultIndex,
                tooltip: translate("ui.utilitycraft:energy.node_transfer_tooltip")
            }
        )
        .submitButton(translate("ui.utilitycraft:energy.save"));

    modal.show(player).then((result) => {
        if (result.canceled) return;

        const [nodeSelection, transferSelection] = result.formValues ?? [];

        const selectedNodeMode = nodeModes[nodeSelection];
        const shouldBeReceiver = selectedNodeMode === "receiver";

        // Toggle if different
        if (shouldBeReceiver !== isReceiver) {
            toggleEnergyMode(block, player);
        }

        // EXACT same transfer logic as generator
        const newMode = modes[transferSelection] ?? "nearest";

        entity.setDynamicProperty("transferMode", newMode);

        player.onScreenDisplay.setActionBar({
            rawtext: [
                translate("message.utilitycraft.energy.transfer_mode_set"),
                translate(`ui.utilitycraft:energy.mode_${newMode}`)
            ]
        });
    });
}
/**
 * Toggles an Energy block between Receiver and Transmitter mode.
 * - Preserves tier (basic, advanced, expert, ultimate)
 * - Preserves block states (rotation, etc.)
 * - Updates linked entity nameTag
 * - Sends action bar feedback to the player
 *
 * @param {Block} block
 * @param {Player} player
 */
function toggleEnergyMode(block, player) {
    if (!block?.typeId) return;

    const { dimension, location, typeId } = block;

    const [namespace, id] = typeId.split(":");
    const parts = id.split("_"); // basic_energy_receiver
    if (parts.length < 3) return;

    const tier = parts[0];
    const currentType = parts[2]; // "receiver" | "transmitter"

    const newType = currentType === "receiver"
        ? "transmitter"
        : "receiver";

    const newId = `${namespace}:${tier}_energy_${newType}`;

    // Change block
    block.setType(newId);

    const entity = dimension.getEntitiesAtBlockLocation(location)[0];
    if (entity) {

        // Update name (no tier)
        entity.nameTag = newType === "transmitter"
            ? "entity.utilitycraft:transmitter.name"
            : "entity.utilitycraft:receiver.name";

        // Handle receiver tag
        if (newType === "receiver") {
            if (!entity.hasTag("dorios:receiver")) {
                entity.addTag("dorios:receiver");
            }
        } else {
            if (entity.hasTag("dorios:receiver")) {
                entity.removeTag("dorios:receiver");
            }
        }
    }

    // Action bar feedback
    if (player) {
        player.onScreenDisplay.setActionBar(translate(
            newType === "transmitter"
                ? "message.utilitycraft.energy.transmitting"
                : "message.utilitycraft.energy.receiving"
        ));
    }
}

/**
 * Opens the Basic Network configuration menu.
 *
 * Allows selecting 3 color channels used for machine networking.
 * The result is stored as:
 *
 *   bn:color1|color2|color3
 *
 * Example:
 *   bn:red|blue|dark_green
 *
 * @param {Entity} entity
 * @param {Player} player
 */
export function openBasicNetworkMenu(entity, player) {
    if (!entity || !player) return;

    const COLORS = [
        { id: "black", code: "§0" },
        { id: "dark_blue", code: "§1" },
        { id: "dark_green", code: "§2" },
        { id: "dark_aqua", code: "§3" },
        { id: "dark_red", code: "§4" },
        { id: "dark_purple", code: "§5" },
        { id: "gold", code: "§6" },
        { id: "gray", code: "§7" },
        { id: "dark_gray", code: "§8" },
        { id: "blue", code: "§9" },
        { id: "green", code: "§a" },
        { id: "aqua", code: "§b" },
        { id: "red", code: "§c" },
        { id: "light_purple", code: "§d" },
        { id: "yellow", code: "§e" },
        { id: "white", code: "§f" }
    ];

    const colorNames = COLORS.map(c => ({
        rawtext: [
            { text: c.code },
            translate(`ui.utilitycraft:energy.color_${c.id}`)
        ]
    }));

    // --- Detect existing network ---
    const existing = entity.getTags().find(t => t.startsWith("bn:"));

    let defaults = [15, 15, 15];

    if (existing) {
        const parts = existing.replace("bn:", "").split("|");

        defaults = parts.map(p => {
            const index = COLORS.findIndex(c => c.id === p);
            return index >= 0 ? index : 0;
        });

        while (defaults.length < 3) defaults.push(0);
    }

    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:energy.network_title"))

        .dropdown(translate("ui.utilitycraft:energy.primary_channel"), colorNames, {
            defaultValueIndex: defaults[0],
            tooltip: translate("ui.utilitycraft:energy.channel_tooltip")
        })

        .dropdown(translate("ui.utilitycraft:energy.secondary_channel"), colorNames, {
            defaultValueIndex: defaults[1],
            tooltip: translate("ui.utilitycraft:energy.channel_tooltip")
        })

        .dropdown(translate("ui.utilitycraft:energy.tertiary_channel"), colorNames, {
            defaultValueIndex: defaults[2],
            tooltip: translate("ui.utilitycraft:energy.channel_tooltip")
        })
        .submitButton(translate("ui.utilitycraft:energy.save"));

    form.show(player).then(res => {
        if (res.canceled) return;

        const [c1, c2, c3] = res.formValues;

        const network =
            `${COLORS[c1].id}|${COLORS[c2].id}|${COLORS[c3].id}`;

        const tag = `bn:${network}`;

        // Remove previous network
        entity.getTags().forEach(t => {
            if (t.startsWith("bn:")) entity.removeTag(t);
        });

        entity.addTag(tag);

        player.onScreenDisplay.setActionBar({
            rawtext: [
                translate("message.utilitycraft.energy.network_set"),
                { text: " " },
                { text: `${COLORS[c1].code}■ §r${COLORS[c2].code}■ §r${COLORS[c3].code}■` }
            ]
        });
    });
}

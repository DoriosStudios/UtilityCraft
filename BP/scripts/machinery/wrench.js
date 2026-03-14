import { world, ItemStack, system, BlockType } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { Rotation, Generator } from "DoriosCore/index.js"

// Nombres de entidades removibles
const REMOVABLE_ENTITIES = [
    "utilitycraft:tractor",
    "utilitycraft:drill"
];

// --- REGISTRO DEL COMPONENTE ---
DoriosAPI.register.itemComponent("wrench", {
    /**
     * Se ejecuta cuando el jugador usa la wrench sobre un bloque.
     * Soporta tanto rotaciones vanilla como el sistema de 24 rotaciones de UtilityCraft.
     */
    onUseOn(e) {
        const { source, block, blockFace } = e;
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

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, itemStack }) => {
    if (!itemStack || itemStack.typeId != 'utilitycraft:wrench') return
    if (!player.isSneaking) {
        // if (!target.getComponent('type_family').hasTypeFamily('dorios:energy_source')) return
        // Generator.openGeneratorTransferModeMenu(target, player)
        // return
    }
    const dim = player.dimension
    if (target && REMOVABLE_ENTITIES.includes(target.typeId)) {
        // --- DROPEAR INVENTARIO ---
        target.dropAllItems();
        // --- SPAWNEAR EL ITEM DEL MISMO ID ---
        dim.spawnItem(new ItemStack(target.typeId + '_placer', 1), target.location);
        // --- REMOVER ENTIDAD ---
        target.remove();
        player.playSound("random.anvil_land", { volume: 0.5 });
        return;
    }
})

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

    const nodeModes = ["Receiver", "Transmitter"];
    const nodeDefault = isReceiver ? 0 : 1;

    const mode = entity.getDynamicProperty("transferMode") ?? "nearest";
    const modes = ["Nearest", "Farthest", "Round"];

    const currentIndex = modes.findIndex((m) => m.toLowerCase() === mode);
    const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

    const modal = new ModalFormData()
        .title(`${nodeModes[nodeDefault]} Transfer Mode`)

        // Receiver / Transmitter dropdown
        .dropdown(
            "Node Mode",
            nodeModes,
            { defaultValueIndex: nodeDefault }
        )

        // EXACT same transfer dropdown as generator
        .dropdown(
            "Select how this node distributes its output:",
            modes,
            { defaultValueIndex: defaultIndex }
        );

    modal.show(player).then((result) => {
        if (result.canceled) return;

        const [nodeSelection, transferSelection] = result.formValues;

        const selectedNodeMode = nodeModes[nodeSelection];
        const shouldBeReceiver = selectedNodeMode === "Receiver";

        // Toggle if different
        if (shouldBeReceiver !== isReceiver) {
            toggleEnergyMode(block, player);
        }

        // EXACT same transfer logic as generator
        const newMode = modes[transferSelection]?.toLowerCase() ?? "nearest";

        entity.setDynamicProperty("transferMode", newMode);

        player.onScreenDisplay.setActionBar(
            `§7Transfer mode set to: §e${DoriosAPI.utils.capitalizeFirst(newMode)}`
        );
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
        const message = newType === "transmitter"
            ? "§cMode: §fTransmitting Energy"
            : "§aMode: §fReceiving Energy";

        DoriosAPI.utils.actionBar(player, message);
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

    const colorNames = COLORS.map(c => `${c.code}${DoriosAPI.utils.formatIdToText(c.id)}`);

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
        .title("Basic Network")

        .dropdown("Primary Channel", colorNames, {
            defaultValueIndex: defaults[0]
        })

        .dropdown("Secondary Channel", colorNames, {
            defaultValueIndex: defaults[1]
        })

        .dropdown("Tertiary Channel", colorNames, {
            defaultValueIndex: defaults[2]
        });

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

        player.onScreenDisplay.setActionBar(
            `§7Network set: ${COLORS[c1].code}■ §r${COLORS[c2].code}■ §r${COLORS[c3].code}■`
        );
    });
}
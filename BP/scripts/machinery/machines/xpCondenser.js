import * as DoriosLib from "DoriosLib/index.js";
import {
    FluidStorage,
    InterfaceManager,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";

const BLOCK_ID = "utilitycraft:xp_condenser";
const CONTROLS_INTERFACE_ID = `${BLOCK_ID}:xp_controls`;
const XP_FLUID_TYPE = "xp";
const XP_CAPACITY = 256_000;
const MAX_XP_PER_API_CALL = 16_777_216;
const LABEL_ITEM_ID = "utilitycraft:arrow_indicator_90";
const STATUS_PROPERTY_ID = "utilitycraft:xp_condenser_status";

const XP_DISPLAY_SLOT = 7;
const STATUS_LABEL_SLOT = 14;
const IO_BUTTON_SLOTS = [8, 13];

const XP_BUTTONS = {
    deposit_one: { slot: 1, direction: -1, levels: 1, nameTag: "§rDeposit 1 Level" },
    withdraw_one: { slot: 2, direction: 1, levels: 1, nameTag: "§rWithdraw 1 Level" },
    deposit_five: { slot: 3, direction: -1, levels: 5, nameTag: "§rDeposit 5 Levels" },
    withdraw_five: { slot: 4, direction: 1, levels: 5, nameTag: "§rWithdraw 5 Levels" },
    deposit_max: { slot: 5, direction: -1, max: true, nameTag: "§rDeposit Max" },
    withdraw_max: { slot: 6, direction: 1, max: true, nameTag: "§rWithdraw Max" },
};

/**
 * Returns the total raw XP required to begin a vanilla experience level.
 *
 * @param {number} level
 * @returns {number}
 */
function levelToXp(level) {
    const normalizedLevel = Math.max(0, Math.floor(Number(level) || 0));

    if (normalizedLevel <= 16) {
        return normalizedLevel ** 2 + 6 * normalizedLevel;
    }

    if (normalizedLevel <= 31) {
        return 2.5 * normalizedLevel ** 2 - 40.5 * normalizedLevel + 360;
    }

    return 4.5 * normalizedLevel ** 2 - 162.5 * normalizedLevel + 2220;
}

/**
 * Returns the size of the XP bar for a vanilla experience level.
 *
 * @param {number} level
 * @returns {number}
 */
function xpNeededForNextLevel(level) {
    const normalizedLevel = Math.max(0, Math.floor(Number(level) || 0));

    if (normalizedLevel <= 15) return 2 * normalizedLevel + 7;
    if (normalizedLevel <= 30) return 5 * normalizedLevel - 38;
    return 9 * normalizedLevel - 158;
}

/**
 * Calculates the exact raw-XP target for a level change while preserving the
 * player's current raw progress whenever it fits in the destination level.
 * Progress is clamped when moving down to a smaller XP bar so the resulting
 * displayed level is always exact.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {-1|1} direction
 * @param {number} levels
 * @returns {number|undefined}
 */
function getExactLevelTargetXp(player, direction, levels) {
    const currentLevel = player.level;
    const levelAmount = Math.max(1, Math.floor(levels));

    if (direction < 0 && currentLevel < levelAmount) return undefined;

    const targetLevel = currentLevel + direction * levelAmount;
    if (targetLevel < 0) return undefined;

    const currentProgress = Math.max(0, player.xpEarnedAtCurrentLevel);
    const maxTargetProgress = Math.max(0, xpNeededForNextLevel(targetLevel) - 1);
    const targetProgress = Math.min(currentProgress, maxTargetProgress);

    return levelToXp(targetLevel) + targetProgress;
}

/**
 * Rebuilds a player's exact total XP, including changes that cross level
 * boundaries. Large totals are restored in API-safe chunks.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {number} totalXp
 * @returns {boolean}
 */
function setPlayerTotalXp(player, totalXp) {
    const targetTotal = Math.max(0, Math.floor(totalXp));
    player.resetLevel();

    let remaining = targetTotal;
    while (remaining > 0) {
        const chunk = Math.min(remaining, MAX_XP_PER_API_CALL);
        player.addExperience(chunk);
        remaining -= chunk;
    }

    return player.getTotalXp() === targetTotal;
}

/**
 * Moves raw XP from a player into the condenser as one guarded transaction.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {FluidStorage} storage
 * @param {number} amount
 * @returns {boolean}
 */
function depositXp(player, storage, amount) {
    const transferAmount = Math.max(0, Math.floor(amount));
    if (transferAmount <= 0 || storage.getFreeSpace() < transferAmount) return false;

    const playerXpBefore = player.getTotalXp();
    if (playerXpBefore < transferAmount) return false;

    const storedBefore = storage.get();
    if (storage.add(transferAmount) !== transferAmount) return false;

    try {
        if (!setPlayerTotalXp(player, playerXpBefore - transferAmount)) {
            setPlayerTotalXp(player, playerXpBefore);
            storage.set(storedBefore);
            return false;
        }
    } catch (error) {
        storage.set(storedBefore);
        try {
            setPlayerTotalXp(player, playerXpBefore);
        } catch {}
        console.warn(`[XP Condenser] Failed to deposit XP: ${error?.message ?? error}`);
        return false;
    }

    return true;
}

/**
 * Moves raw XP from the condenser into a player as one guarded transaction.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {FluidStorage} storage
 * @param {number} amount
 * @returns {boolean}
 */
function withdrawXp(player, storage, amount) {
    const transferAmount = Math.max(0, Math.floor(amount));
    if (transferAmount <= 0 || storage.get() < transferAmount) return false;

    const playerXpBefore = player.getTotalXp();
    const storedBefore = storage.get();
    if (storage.consume(transferAmount) !== transferAmount) return false;

    try {
        player.addExperience(transferAmount);
        if (player.getTotalXp() - playerXpBefore !== transferAmount) {
            setPlayerTotalXp(player, playerXpBefore);
            storage.set(storedBefore);
            return false;
        }
    } catch (error) {
        storage.set(storedBefore);
        try {
            setPlayerTotalXp(player, playerXpBefore);
        } catch {}
        console.warn(`[XP Condenser] Failed to withdraw XP: ${error?.message ?? error}`);
        return false;
    }

    return true;
}

/**
 * Returns the condenser's fixed XP FluidStorage and repairs its invariant.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @returns {FluidStorage}
 */
function getXpStorage(entity) {
    if (!entity.hasTag("dorios:constant_fluid_type")) {
        entity.addTag("dorios:constant_fluid_type");
    }

    const storage = FluidStorage.initializeSingle(entity);
    if (storage.getCap() !== XP_CAPACITY) storage.setCap(XP_CAPACITY);
    if (storage.getType() !== XP_FLUID_TYPE) storage.setType(XP_FLUID_TYPE);
    return storage;
}

/**
 * Formats raw XP without relying on a runtime locale.
 *
 * @param {number} amount
 * @returns {string}
 */
function formatXpAmount(amount) {
    return Math.max(0, Math.floor(Number(amount) || 0))
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Writes the condenser status into the label rendered over its machine screen.
 * The last operation is kept while the current storage amount can refresh.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {FluidStorage} storage
 * @param {string} [status]
 */
function displayXpStatus(entity, storage, status) {
    if (typeof status === "string") {
        entity.setDynamicProperty(STATUS_PROPERTY_ID, status);
    }

    const currentStatus = entity.getDynamicProperty(STATUS_PROPERTY_ID) ?? "§7Ready";
    const label = [
        "",
        "§r§aXP",
        "",
        `§r§fStored: ${FluidStorage.formatFluid(storage.get())}`,
        `§r§fCap: ${FluidStorage.formatFluid(XP_CAPACITY)}`,
        "",
        `§r${currentStatus}`,
    ].join("\n");

    DoriosLib.entity.setNewItem(entity, {
        slot: STATUS_LABEL_SLOT,
        typeId: LABEL_ITEM_ID,
        amount: 1,
        nameTag: label,
    });
}

/**
 * Resolves a requested button operation and provides a concise UI error when
 * the exact transfer cannot be performed.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {FluidStorage} storage
 * @param {object} button
 * @returns {{amount: number, error?: string}}
 */
function getTransferRequest(player, storage, button) {
    const storedXp = storage.get();

    if (button.max === true) {
        if (button.direction < 0) {
            const playerXp = player.getTotalXp();
            if (playerXp <= 0) return { amount: 0, error: "§cNo Player XP" };

            const freeSpace = storage.getFreeSpace();
            if (freeSpace <= 0) return { amount: 0, error: "§cStorage Full" };
            return { amount: Math.min(playerXp, freeSpace) };
        }

        if (storedXp <= 0) return { amount: 0, error: "§cNo Stored XP" };
        return { amount: storedXp };
    }

    const targetXp = getExactLevelTargetXp(player, button.direction, button.levels);
    if (targetXp === undefined) {
        const error = player.getTotalXp() <= 0
            ? "§cNo Player XP"
            : `§cNeed ${button.levels} Level${button.levels === 1 ? "" : "s"}`;
        return { amount: 0, error };
    }

    const amount = Math.abs(targetXp - player.getTotalXp());
    if (button.direction < 0 && storage.getFreeSpace() < amount) {
        return {
            amount: 0,
            error: storage.getFreeSpace() <= 0 ? "§cStorage Full" : "§cNot Enough Space",
        };
    }

    if (button.direction > 0 && storedXp < amount) {
        return {
            amount: 0,
            error: storedXp <= 0 ? "§cNo Stored XP" : "§cNot Enough XP",
        };
    }

    return { amount };
}

/**
 * Executes one of the six XP controls.
 *
 * @param {object} context
 * @param {import("@minecraft/server").Entity} context.entity
 * @param {import("@minecraft/server").Player|undefined} context.player
 * @param {object} button
 */
function handleXpButton({ entity, player }, button) {
    if (!player?.isValid || !entity?.isValid) return;

    const storage = getXpStorage(entity);
    const request = getTransferRequest(player, storage, button);

    if (request.error) {
        storage.display(XP_DISPLAY_SLOT);
        displayXpStatus(entity, storage, request.error);
        return;
    }

    const transferred = button.direction < 0
        ? depositXp(player, storage, request.amount)
        : withdrawXp(player, storage, request.amount);

    storage.display(XP_DISPLAY_SLOT);
    const status = transferred
        ? `§a${button.direction < 0 ? "Stored" : "Sent"} ${formatXpAmount(request.amount)} XP`
        : "§cTransfer Failed";
    displayXpStatus(entity, storage, status);
}

InterfaceManager.registerInterface(CONTROLS_INTERFACE_ID, {
    buttons: Object.fromEntries(
        Object.entries(XP_BUTTONS).map(([buttonId, button]) => [buttonId, {
            slot: button.slot,
            nameTag: button.nameTag,
            onPress: (context) => handleXpButton(context, button),
        }]),
    ),
});
InterfaceManager.linkBlockInterface(BLOCK_ID, CONTROLS_INTERFACE_ID);

registerIOInterface(BLOCK_ID, {
    liquids: {
        buttonSlots: IO_BUTTON_SLOTS,
        anyInputIndices: [0],
        anyOutputIndices: [0],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
            { id: "output_1", outputIndices: [0] },
        ],
    },
});

DoriosLib.registry.blockComponent(BLOCK_ID, {
    /**
     * @param {import("@minecraft/server").BlockComponentPlayerPlaceBeforeEvent} event
     * @param {{ params: MachineSettings }} context
     */
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, (entity) => {
            const storage = getXpStorage(entity);
            storage.display(XP_DISPLAY_SLOT);
            displayXpStatus(entity, storage);
        });
    },

    /**
     * Keeps the fixed XP type and refreshes the visible bar while the UI is open.
     *
     * @param {import("@minecraft/server").BlockComponentTickEvent} event
     */
    onTick({ block }, { params: settings }) {
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        machine.processIO();
        const storage = getXpStorage(machine.entity);
        storage.display(XP_DISPLAY_SLOT);
        if (machine.shouldUpdateUI) displayXpStatus(machine.entity, storage);
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

// Slot 0 remains owned by Machine.spawnEntity's internal energy display. The
// XP Condenser UI intentionally does not render that slot.

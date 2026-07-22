import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, world } from '@minecraft/server'

const PERSISTENT_UPGRADE_TYPE = "persistent";
const PERSISTENT_UPGRADE_PREFIX = "utilitycraft:pu";
const persistentUpgradeCache = new Map();

function dimensionStorageKey(dimensionId) {
    if (dimensionId === "minecraft:overworld") return "o";
    if (dimensionId === "minecraft:nether") return "n";
    if (dimensionId === "minecraft:the_end") return "e";
    return dimensionId.replaceAll(":", ".");
}

function coordinateKey(location) {
    return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

function persistentUpgradeKey(dimension, location) {
    return `${PERSISTENT_UPGRADE_PREFIX}:${dimensionStorageKey(dimension.id)}:${coordinateKey(location)}`;
}

function normalizeUpgradeName(upgradeKey) {
    const value = String(upgradeKey ?? "");
    const separator = value.indexOf(":");
    return separator >= 0 ? value.slice(separator + 1) : value;
}

function normalizePersistentUpgradeData(value) {
    if (!value || typeof value !== "object") return {};

    const normalized = {};
    for (const [key, level] of Object.entries(value)) {
        const numericLevel = Math.max(0, Math.floor(Number(level) || 0));
        normalized[key] = numericLevel;
    }
    return normalized;
}

function readPersistentUpgradeDataAt(dimension, location) {
    const key = persistentUpgradeKey(dimension, location);
    const cached = persistentUpgradeCache.get(key);
    if (cached) return cached;

    let data = {};
    try {
        const raw = world.getDynamicProperty(key);
        if (typeof raw === "string" && raw.length > 0) {
            data = normalizePersistentUpgradeData(JSON.parse(raw));
        }
    } catch {}

    persistentUpgradeCache.set(key, data);
    return data;
}

function writePersistentUpgradeDataAt(dimension, location, value) {
    const key = persistentUpgradeKey(dimension, location);
    const data = normalizePersistentUpgradeData(value);
    persistentUpgradeCache.set(key, data);

    try {
        world.setDynamicProperty(key, Object.keys(data).length > 0 ? JSON.stringify(data) : undefined);
        return true;
    } catch {
        return false;
    }
}

function getPersistentUpgradeLimits(params) {
    if (!params || params.type !== PERSISTENT_UPGRADE_TYPE) return new Map();

    const limits = new Map();
    for (const [key, value] of Object.entries(params)) {
        if (!key.endsWith("_max")) continue;
        const name = key.slice(0, -4);
        const max = Math.max(0, Math.floor(Number(value) || 0));
        if (name && max > 0) limits.set(name, max);
    }
    return limits;
}

function dropPersistentUpgrades(block, params) {
    const limits = getPersistentUpgradeLimits(params);
    for (const [name, max] of limits) {
        const level = getPersistentUpgradeLevel(block, `utilitycraft:${name}`, max);
        if (level <= 0) continue;
        try {
            block.dimension.spawnItem(
                new ItemStack(`utilitycraft:${name}_upgrade`, level),
                block.center(),
            );
        } catch {}
    }
}

/**
 * Reads an upgrade level stored by dimension and block location. When possible,
 * a missing value is initialized from the former block state for world migration.
 *
 * @param {import("@minecraft/server").Block} block
 * @param {string} upgradeKey
 * @param {number} [max]
 */
export function getPersistentUpgradeLevel(block, upgradeKey, max = 16) {
    if (!block?.dimension || !block?.location) return 0;
    const name = normalizeUpgradeName(upgradeKey);
    const data = readPersistentUpgradeDataAt(block.dimension, block.location);
    if (Object.hasOwn(data, name)) return Math.min(max, data[name]);

    let legacyLevel = 0;
    try {
        legacyLevel = Math.max(0, Math.floor(Number(block.permutation.getState(upgradeKey)) || 0));
    } catch {}

    data[name] = Math.min(max, legacyLevel);
    writePersistentUpgradeDataAt(block.dimension, block.location, data);
    return Math.min(max, legacyLevel);
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {string} upgradeKey
 * @param {number} level
 * @param {number} max
 */
export function setPersistentUpgradeLevel(block, upgradeKey, level, max) {
    if (!block?.dimension || !block?.location) return false;
    const name = normalizeUpgradeName(upgradeKey);
    const data = readPersistentUpgradeDataAt(block.dimension, block.location);
    const normalizedLevel = Math.max(0, Math.min(max, Math.floor(Number(level) || 0)));

    data[name] = normalizedLevel;
    return writePersistentUpgradeDataAt(block.dimension, block.location, data);
}

/** @param {import("@minecraft/server").Block} block */
export function clearPersistentUpgrades(block) {
    if (!block?.dimension || !block?.location) return;
    writePersistentUpgradeDataAt(block.dimension, block.location, {});
}

/**
 * Moves persistent upgrade records together with piston-moved blocks.
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {ReadonlyArray<{source:import("@minecraft/server").Vector3,target:import("@minecraft/server").Vector3}>} movements
 */
export function reconcileMovedPersistentUpgrades(dimension, movements) {
    const snapshots = movements.map(({ source, target }) => ({
        source,
        target,
        data: { ...readPersistentUpgradeDataAt(dimension, source) },
    }));

    for (const { source, target } of snapshots) {
        writePersistentUpgradeDataAt(dimension, source, {});
        writePersistentUpgradeDataAt(dimension, target, {});
    }
    for (const { target, data } of snapshots) {
        if (Object.keys(data).length > 0) writePersistentUpgradeDataAt(dimension, target, data);
    }
}

/**
 * Builds a localized action-bar message whose first substitution is the
 * localized short name of an upgrade.
 *
 * @param {string} messageKey
 * @param {string} upgradeTypeId
 * @param {(string|number)[]} [values]
 * @returns {import('@minecraft/server').RawMessage}
 */
function upgradeMessage(messageKey, upgradeTypeId, values = []) {
    return {
        translate: messageKey,
        with: {
            rawtext: [
                { translate: `upgrade.${upgradeTypeId}.name` },
                ...values.map(value => ({ text: `${value}` }))
            ]
        }
    }
}

DoriosLib.registry.blockComponent("utilitycraft:upgradeable", {
    beforeOnPlayerPlace({ block }, { params } = {}) {
        if (params?.type === PERSISTENT_UPGRADE_TYPE) clearPersistentUpgrades(block);
    },

    onPlayerInteract({ player, block }, { params } = {}) {
        /** @type {import('@minecraft/server').ItemStack} */
        const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand")
        if (!mainHand || !mainHand?.typeId.endsWith("_upgrade")) return

        const upgradeKey = mainHand.typeId.replace("_upgrade", "");

        if (params?.type === PERSISTENT_UPGRADE_TYPE) {
            const upgradeName = normalizeUpgradeName(upgradeKey);
            const max = getPersistentUpgradeLimits(params).get(upgradeName);
            if (max === undefined) {
                player.onScreenDisplay.setActionBar(
                    upgradeMessage("message.utilitycraft.upgrade.unsupported", mainHand.typeId)
                );
                return;
            }

            const current = getPersistentUpgradeLevel(block, upgradeKey, max);
            if (current >= max) {
                player.onScreenDisplay.setActionBar(
                    upgradeMessage("message.utilitycraft.upgrade.max", mainHand.typeId, [max])
                );
                return;
            }

            const nextLevel = current + 1;
            if (!setPersistentUpgradeLevel(block, upgradeKey, nextLevel, max)) {
                player.onScreenDisplay.setActionBar(
                    upgradeMessage("message.utilitycraft.upgrade.failed", mainHand.typeId)
                );
                return;
            }

            player.runCommand(`clear @s ${mainHand.typeId} 0 1`);
            player.onScreenDisplay.setActionBar(
                upgradeMessage("message.utilitycraft.upgrade.applied", mainHand.typeId, [nextLevel, max])
            );
            return;
        }

        const current = block.permutation.getState(upgradeKey);
        if (current === undefined) {
            player.onScreenDisplay.setActionBar(
                upgradeMessage("message.utilitycraft.upgrade.unsupported", mainHand.typeId)
            );
            return;
        }

        const max = getMaxState(block, upgradeKey);

        if (current >= max) {
            player.onScreenDisplay.setActionBar(
                upgradeMessage("message.utilitycraft.upgrade.max", mainHand.typeId, [max])
            )
            return;
        }

        const nextLevel = current + 1;
        const nextPermutation = tryCreateStatePermutation(block.permutation, upgradeKey, nextLevel);
        if (!nextPermutation) {
            player.onScreenDisplay.setActionBar(
                upgradeMessage("message.utilitycraft.upgrade.failed", mainHand.typeId)
            );
            return;
        }

        block.setPermutation(nextPermutation);
        player.runCommand(`clear @s ${mainHand.typeId} 0 1`);

        player.onScreenDisplay.setActionBar(
            upgradeMessage("message.utilitycraft.upgrade.applied", mainHand.typeId, [nextLevel, max])
        );
    },
    /**
     * Drop upgrade items when the block is broken
     */
    onPlayerBreak({ block, brokenBlockPermutation, dimension }, { params } = {}) {
        // Persistent upgrades are handled by the general break callback so they
        // are refunded exactly once regardless of what destroyed the block.
        if (params?.type === PERSISTENT_UPGRADE_TYPE) return;

        const states = brokenBlockPermutation.getAllStates();

        for (const [key, value] of Object.entries(states)) {
            if (typeof value !== "number" || value <= 0) continue;

            const upgradeId = `${key}_upgrade`;
            try {
                dimension.spawnItem(new ItemStack(upgradeId, value), block.center());
            } catch {
                // En caso de que el ítem no exista, simplemente lo ignora
            }
        }
    },

    onBreak({ block }, { params } = {}) {
        if (params?.type !== PERSISTENT_UPGRADE_TYPE) return;
        dropPersistentUpgrades(block, params);
        clearPersistentUpgrades(block);
    },
})

/**
 * Gets the maximum upgrade level supported by a block state.
 *
 * This probes possible numeric values, but only accepts a value when the returned
 * permutation still reports the same value. That keeps the behavior dynamic while
 * avoiding states that silently normalize back to defaults.
 *
 * @param {import("@minecraft/server").Block} block Block to test the state on.
 * @param {string} key Block state key to test (e.g., "utilitycraft:speed").
 * @param {number} [maxTry=16] Maximum value to test.
 * @returns {number} Maximum valid state value for the given key, or 0 if the state does not exist.
 */
function getMaxState(block, key, maxTry = 16) {
    const current = block.permutation.getState(key);
    if (current === undefined) return 0;

    let lastValid = current;
    for (let i = current + 1; i <= maxTry; i++) {
        if (!tryCreateStatePermutation(block.permutation, key, i)) break;
        lastValid = i;
    }

    return lastValid;
}

/**
 * Attempts to create a permutation with a numeric state value and verifies that
 * Bedrock did not silently normalize the value to another state.
 *
 * @param {import("@minecraft/server").BlockPermutation} permutation Source permutation.
 * @param {string} key Block state key.
 * @param {number} value State value to test.
 * @returns {import("@minecraft/server").BlockPermutation | undefined} Valid permutation, if accepted.
 */
function tryCreateStatePermutation(permutation, key, value) {
    try {
        const nextPermutation = permutation.withState(key, value);
        return nextPermutation.getState(key) === value ? nextPermutation : undefined;
    } catch {
        return undefined;
    }
}

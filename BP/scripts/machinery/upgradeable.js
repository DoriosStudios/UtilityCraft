import { ItemStack } from '@minecraft/server'

DoriosAPI.register.blockComponent("upgradeable", {
    onPlayerInteract({ player, block }) {
        /** @type {import('@minecraft/server').ItemStack} */
        const mainHand = player.getEquipment("Mainhand")
        if (!mainHand || !mainHand?.typeId.endsWith("_upgrade")) return

        const upgradeKey = mainHand.typeId.replace("_upgrade", "");

        const current = block.permutation.getState(upgradeKey);
        if (current === undefined) {
            player.onScreenDisplay.setActionBar(`§cBlock does not support upgrade ${DoriosAPI.utils.formatIdToText(upgradeKey)}`);
            return;
        }

        const max = getMaxState(block, upgradeKey);

        if (current >= max) {
            player.onScreenDisplay.setActionBar(`§c${upgradeKey} is already at max (${max})`)
            return;
        }

        const nextLevel = current + 1;
        const nextPermutation = tryCreateStatePermutation(block.permutation, upgradeKey, nextLevel);
        if (!nextPermutation) {
            player.onScreenDisplay.setActionBar(`§cCould not apply ${DoriosAPI.utils.formatIdToText(upgradeKey)} upgrade`);
            return;
        }

        block.setPermutation(nextPermutation);
        player.runCommand(`clear @s ${mainHand.typeId} 0 1`);

        player.onScreenDisplay.setActionBar(`§aApplied ${upgradeKey} upgrade (${nextLevel}/${max})`);
    },
    /**
     * Drop upgrade items when the block is broken
     */
    onPlayerBreak({ block, brokenBlockPermutation, dimension }) {
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
    }
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

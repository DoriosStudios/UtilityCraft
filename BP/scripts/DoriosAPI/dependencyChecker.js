import { world, system } from '@minecraft/server'
import { addonData } from './config.js'

/**
 * @typedef {Object} AddonData
 * @property {string} name - The name of the addon.
 * @property {string} author - The author or studio of the addon.
 * @property {string} identifier - The unique identifier for the addon.
 * @property {string} version - The version of the addon.
 * @property {Object<string, string>} [dependencies] - Dependencies for the addon, where the addon identifier is the key and its version is the value.
 */

/**
 * Addon data object.
 * @type {AddonData}
 */

/**
 * Event listener that triggers when the world is loaded.
 * It sends the addon data to the "dorios:dependency_checker" script event for dependency validation.
 * Additionally, it checks if all required dependencies are present and up-to-date.
 */
world.afterEvents.worldLoad.subscribe(e => {
    system.sendScriptEvent("dorios:dependency_checker", JSON.stringify(addonData));

    if (!addonData.dependencies) return;

    system.runTimeout(() => {
        let missingDependencies = false;
        let outdatedDependenciesLines = [];
        let missingDependenciesLines = [];

        for (const [identifier, data] of Object.entries(addonData.dependencies)) {
            if (!dependenciesRegistry.has(identifier)) {
                missingDependenciesLines.push(`- §e${data.name ?? identifier}§r`);
                missingDependenciesLines.push(` - §eRequires: ${data.version}§r`);
                missingDependenciesLines.push(` - §cFound: None§r`);
                if (data.warning) missingDependenciesLines.push(` - §7${data.warning}§r`);
                missingDependencies = true;
                continue;
            }

            /** @type {AddonData} **/
            const dependencyData = dependenciesRegistry.get(identifier);
            if (data.version) {
                const versionState = compareDependencyVersion(data.version, dependencyData.version);
                if (versionState === "outdated") {
                    outdatedDependenciesLines.push(`- §e${dependencyData.name ?? identifier}§r`);
                    outdatedDependenciesLines.push(` - §eRequires: ${data.version}§r`);
                    outdatedDependenciesLines.push(` - §cFound: ${dependencyData.version} (Outdated)§r`);
                    if (data.warning) outdatedDependenciesLines.push(` - §7${data.warning}§r`);
                    missingDependencies = true;
                    continue;
                }
            }
        }

        let warningText = ['§e[ Warning! ]'];

        // Handle missing dependencies
        if (missingDependenciesLines.length > 0) {
            warningText.push(`§7${addonData.name} is missing dependencies!§r`);
            warningText.push(`§cMissing:§r`);
            warningText = [...warningText, ...missingDependenciesLines];
        }

        // Handle outdated dependencies
        if (outdatedDependenciesLines.length > 0) {
            if (missingDependenciesLines.length > 0) {
                warningText.push(`§eOutdated dependencies:§r`);
            } else {
                warningText.push(`§eOutdated:§r`);
            }
            warningText = [...warningText, ...outdatedDependenciesLines];
        }

        // Send the final warning message
        if (missingDependencies || outdatedDependenciesLines.length > 0) {
            const warning = warningText.join(`\n`);
            world.sendMessage(`${warning}`);
        } else {
            world.sendMessage(`§a${addonData.name} initialized correctly!§r`);
        }
    }, 300);
});


/**
 * A registry to store the dependencies for each addon.
 * The keys of the map are the addon identifiers (e.g., "utilitycraft") and the values are the addon data objects 
 * containing the version and other metadata.
 *
 * @type {Map<string, AddonData>}
 * @description
 * This map is used to store the data of the addons that have been received, including their dependencies 
 * and version information. It is populated when addon data is received through the "dorios:dependency_checker" 
 * script event and is later used to verify if the required dependencies for the current addon are met.
 */
export const dependenciesRegistry = new Map()

/**
 * Event listener that listens for incoming "dorios:dependency_checker" script events.
 * It adds the received addon data to the `dependenciesRegistry` map if it is not already present.
 *
 * @param {ScriptEventReceiveEvent} e - The event triggered when a script event is received.
 * @param {string} e.id - The identifier for the script event.
 * @param {string} e.message - The message payload for the event, containing addon data.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message: raw }) => {
    if (id != "dorios:dependency_checker") return
    /** @type {AddonData} **/
    let data;
    try {
        data = raw ? JSON.parse(raw) : {}
    } catch { return }
    if (!data.identifier || dependenciesRegistry.has(data.identifier)) return

    dependenciesRegistry.set(data.identifier, data)
})

/**
 * Compares the required version with the dependency version and returns a corresponding comparison result.
 *
 * @param {string} requiredVersion The version required by the addon.
 * @param {string} addonVersion The version of the addon being checked.
 * @returns {string} 
 *      - "outdated" if addonVersion < requiredVersion,
 *      - "matches" if addonVersion === requiredVersion,
 *      - "newer" if addonVersion > requiredVersion.
 */
export function compareDependencyVersion(requiredVersion, addonVersion) {
    const v1Parts = requiredVersion.split(/[-.]/);
    const v2Parts = addonVersion.split(/[-.]/);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || '';
        const v2Part = v2Parts[i] || '';

        if (/^\d+$/.test(v1Part) && /^\d+$/.test(v2Part)) {
            const num1 = parseInt(v1Part, 10);
            const num2 = parseInt(v2Part, 10);

            if (num1 < num2) return "newer";
            if (num1 > num2) return "outdated";
        } else {
            if (v1Part < v2Part) return "newer";
            if (v1Part > v2Part) return "outdated";
        }
    }

    return "matches";
}
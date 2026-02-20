import { world, system } from '@minecraft/server'
import { addonData } from './config.js'

/**
 * @typedef {Object} AddonData
 * @property {string} name
 * @property {string} author
 * @property {string} identifier
 * @property {string} version
 * @property {Object<string, string>} [dependencies]
 */

world.afterEvents.worldLoad.subscribe(() => {
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

        if (missingDependenciesLines.length > 0) {
            warningText.push(`§7${addonData.name} is missing dependencies!§r`);
            warningText.push(`§cMissing:§r`);
            warningText = [...warningText, ...missingDependenciesLines];
        }

        if (outdatedDependenciesLines.length > 0) {
            if (missingDependenciesLines.length > 0) {
                warningText.push(`§eOutdated dependencies:§r`);
            } else {
                warningText.push(`§eOutdated:§r`);
            }
            warningText = [...warningText, ...outdatedDependenciesLines];
        }

        if (missingDependencies || outdatedDependenciesLines.length > 0) {
            const warning = warningText.join(`\n`);
            world.sendMessage(`${warning}`);
        } else {
            world.sendMessage(`§a${addonData.name} initialized correctly!§r`);
        }
    }, 300);
});

export const dependenciesRegistry = new Map()

system.afterEvents.scriptEventReceive.subscribe(({ id, message: raw }) => {
    if (id != "dorios:dependency_checker") return

    let data;
    try {
        data = raw ? JSON.parse(raw) : {}
    } catch { return }

    if (!data.identifier || dependenciesRegistry.has(data.identifier)) return
    dependenciesRegistry.set(data.identifier, data)
})

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
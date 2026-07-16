// @ts-check

import { system, world } from "@minecraft/server";

/** Script event used by Dorios addons to announce their metadata. */
export const SCRIPT_EVENT_ID = "dorios:dependency_checker";

/**
 * @typedef {object} DependencyRequirement
 * @property {string} [version] Minimum required version.
 * @property {string} [name]
 * @property {string} [warning]
 */

/**
 * @typedef {object} AddonMetadata
 * @property {string} name
 * @property {string} identifier
 * @property {string} version
 * @property {string} [author]
 * @property {Record<string, DependencyRequirement>} [dependencies]
 */

/**
 * @typedef {object} DependencyIssue
 * @property {string} identifier
 * @property {string} name
 * @property {string|undefined} required
 * @property {string|undefined} found
 * @property {string|undefined} warning
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {DependencyIssue[]} missing
 * @property {DependencyIssue[]} outdated
 */

/**
 * @typedef {object} InitializeOptions
 * @property {number} [validationDelayTicks=300]
 * @property {boolean} [announceSuccess=false]
 * @property {(result: ValidationResult, addon: AddonMetadata) => void} [onResult]
 */

/** @type {Map<string, AddonMetadata>} */
const registry = new Map();
/** @type {Map<string, {metadata: AddonMetadata, options: InitializeOptions}>} */
const localAddons = new Map();
let listenersInstalled = false;

/**
 * Initializes dependency discovery for an addon.
 *
 * Calling this function installs the required listeners once. Importing the
 * dependencies module alone has no runtime side effects.
 *
 * @param {AddonMetadata} metadata
 * @param {InitializeOptions} [options]
 * @returns {() => void} Function that removes the addon from local validation.
 */
export function initialize(metadata, options = {}) {
  validateMetadata(metadata);
  installListeners();

  const snapshot = cloneMetadata(metadata);
  registry.set(snapshot.identifier, snapshot);
  localAddons.set(snapshot.identifier, { metadata: snapshot, options });

  return () => {
    localAddons.delete(snapshot.identifier);
  };
}

/**
 * Returns metadata currently known by the dependency service.
 *
 * @param {string} identifier
 * @returns {AddonMetadata|undefined}
 */
export function get(identifier) {
  const metadata = registry.get(identifier);
  return metadata ? cloneMetadata(metadata) : undefined;
}

/**
 * Returns a snapshot of every discovered addon.
 *
 * @returns {AddonMetadata[]}
 */
export function getAll() {
  return [...registry.values()].map(cloneMetadata);
}

/**
 * Validates addon requirements against a registry snapshot.
 *
 * @param {AddonMetadata} metadata
 * @param {ReadonlyMap<string, AddonMetadata>} [available=registry]
 * @returns {ValidationResult}
 */
export function validate(metadata, available = registry) {
  /** @type {DependencyIssue[]} */
  const missing = [];
  /** @type {DependencyIssue[]} */
  const outdated = [];

  for (const [identifier, requirement] of Object.entries(metadata.dependencies ?? {})) {
    const installed = available.get(identifier);
    const baseIssue = {
      identifier,
      name: requirement.name ?? installed?.name ?? identifier,
      required: requirement.version,
      warning: requirement.warning,
    };

    if (!installed) {
      missing.push({ ...baseIssue, found: undefined });
      continue;
    }

    if (requirement.version && compareVersions(installed.version, requirement.version) < 0) {
      outdated.push({ ...baseIssue, found: installed.version });
    }
  }

  return { ok: missing.length === 0 && outdated.length === 0, missing, outdated };
}

/**
 * Compares two semantic-version-like strings.
 *
 * @param {string} left
 * @param {string} right
 * @returns {-1|0|1} Negative when left is older, positive when it is newer.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.core.length, b.core.length);

  for (let index = 0; index < length; index++) {
    const aPart = a.core[index] ?? 0;
    const bPart = b.core[index] ?? 0;
    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }

  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;

  const prereleaseLength = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < prereleaseLength; index++) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;

    const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : undefined;
    const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : undefined;
    if (aNumber !== undefined && bNumber !== undefined) return aNumber < bNumber ? -1 : 1;
    if (aNumber !== undefined) return -1;
    if (bNumber !== undefined) return 1;
    return aPart < bPart ? -1 : 1;
  }

  return 0;
}

/**
 * Builds a Minecraft-formatted dependency report.
 *
 * @param {AddonMetadata} addon
 * @param {ValidationResult} result
 * @returns {string}
 */
export function formatReport(addon, result) {
  if (result.ok) return `§a${addon.name} initialized correctly!§r`;

  const lines = ["§e[ Warning! ]", `§7${addon.name} has dependency problems.§r`];
  if (result.missing.length > 0) {
    lines.push("§cMissing:§r");
    for (const issue of result.missing) appendIssue(lines, issue);
  }
  if (result.outdated.length > 0) {
    lines.push("§eOutdated:§r");
    for (const issue of result.outdated) appendIssue(lines, issue);
  }
  return lines.join("\n");
}

/**
 * Sends a validation report to the world. Successful reports are silent by
 * default.
 *
 * @param {AddonMetadata} addon
 * @param {ValidationResult} result
 * @param {{announceSuccess?: boolean}} [options]
 */
export function report(addon, result, options = {}) {
  if (result.ok && !options.announceSuccess) return;
  world.sendMessage(formatReport(addon, result));
}

function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== SCRIPT_EVENT_ID) return;

    try {
      const metadata = /** @type {AddonMetadata} */ (JSON.parse(message));
      validateMetadata(metadata);
      registry.set(metadata.identifier, cloneMetadata(metadata));
    } catch (error) {
      console.warn("[DoriosLib:dependencies] Ignored invalid dependency metadata", error);
    }
  });

  world.afterEvents.worldLoad.subscribe(() => {
    for (const { metadata, options } of localAddons.values()) {
      system.sendScriptEvent(SCRIPT_EVENT_ID, JSON.stringify(metadata));
      system.runTimeout(() => {
        const result = validate(metadata);
        if (options.onResult) options.onResult(result, cloneMetadata(metadata));
        else report(metadata, result, { announceSuccess: options.announceSuccess });
      }, options.validationDelayTicks ?? 300);
    }
  });
}

/** @param {AddonMetadata} metadata */
function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") throw new TypeError("Addon metadata is required");
  if (!metadata.name || typeof metadata.name !== "string") throw new TypeError("Addon name is required");
  if (!metadata.identifier || typeof metadata.identifier !== "string") {
    throw new TypeError("Addon identifier is required");
  }
  if (!metadata.version || typeof metadata.version !== "string") throw new TypeError("Addon version is required");
}

/** @param {AddonMetadata} metadata */
function cloneMetadata(metadata) {
  return {
    ...metadata,
    dependencies: metadata.dependencies
      ? Object.fromEntries(Object.entries(metadata.dependencies).map(([id, value]) => [id, { ...value }]))
      : undefined,
  };
}

/** @param {string[]} lines @param {DependencyIssue} issue */
function appendIssue(lines, issue) {
  lines.push(`- §e${issue.name}§r`);
  if (issue.required) lines.push(`  §7Requires: §e${issue.required}§r`);
  lines.push(`  §7Found: §c${issue.found ?? "None"}§r`);
  if (issue.warning) lines.push(`  §7${issue.warning}§r`);
}

/** @param {string} value */
function parseVersion(value) {
  const normalized = String(value).trim().replace(/^v/i, "").split("+")[0];
  const [coreRaw, prereleaseRaw = ""] = normalized.split("-", 2);
  const core = coreRaw.split(".").map((part) => {
    if (!/^\d+$/.test(part)) throw new TypeError(`Invalid version: ${value}`);
    return Number(part);
  });
  return { core, prerelease: prereleaseRaw ? prereleaseRaw.split(".") : [] };
}

import { world } from "@minecraft/server";

/**
 * Retrieves a scoreboard objective by id, or creates it if it does not exist.
 *
 * If the objective already exists in the world scoreboard,
 * it will be returned. Otherwise, it will be created with
 * the provided display name.
 *
 * @param {string} id Unique identifier of the scoreboard objective.
 * @param {string} [display=id] Display name shown in the scoreboard UI.
 * @returns {import("@minecraft/server").ScoreboardObjective}
 */
export function getOrCreateObjective(id, display = id) {
    return world.scoreboard.getObjective(id)
        ?? world.scoreboard.addObjective(id, display);
}

/**
 * Creates or retrieves multiple scoreboard objectives
 * and stores them in the shared objectives object.
 *
 * @param {Array<[string, string?]>} definitions
 * Array of [id, displayName] pairs.
 *
 * @param {Record<string, import("@minecraft/server").ScoreboardObjective>} [target]
 * Optional object where objectives will be stored.
 *
 * @returns {typeof objectives}
 */
export function loadObjectives(definitions, target) {
    for (const [id, display] of definitions) {
        target[id] = getOrCreateObjective(id, display);
    }
    return target;
}
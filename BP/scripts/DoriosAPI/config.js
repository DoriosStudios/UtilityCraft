
/**
 * DoriosAPI - Setup Instructions
 *
 * To ensure everything functions correctly, make sure to import the main API file
 * in your addon’s main script. The import should look like this:
 *
 * ```js
 * import './DoriosAPI/index.js';
 * ```
 *
 * Additionally, the **DoriosAPI** folder must be located in the `/scripts` directory
 * of your addon structure.
 *
 * Example folder structure:
 * ```
 * /scripts
 * └── /DoriosAPI
 *     └── index.js
 * ```
 */

/**
 * Addon Configuration
 *
 * This section contains the metadata for the addon, including its name,
 * author, version, identifier, and dependencies.
 * Dependencies can have additional properties:
 * - **name**: Optional. The custom name of the dependency to display in messages. If not provided, the `identifier` will be used.
 * - **warning**: Optional. A custom warning message to display if the dependency is missing or outdated.
 *
 * Example:
 * ```js
 * const addonData = {
 *     name: "UtilityCraft: Heavy Machinery",
 *     author: "Dorios Studios",
 *     identifier: "utilitycraft_heavy_machinery",
 *     version: "0.3.0",
 *     dependencies: {
 *         "utilitycraft": {
 *             version: "3.3.5",  // Required version
 *             name: "UtilityCraft",  // Custom name to display
 *             warning: "Please update to the latest version."  // Custom warning message
 *         }
 *     }
 * };
 * ```
 */
export const addonData = {
    name: "UtilityCraft",
    author: "Dorios Studios",
    identifier: "utilitycraft",
    version: "3.3.5"
}

/**
 * Module Imports
 *
 * To activate a module, uncomment the import line.
 * To deactivate a module, comment out the import line.
 *
 * Example of available modules:
 * - **blockClass.js**: Logic for block utilities and machines.
 * - **playerClass.js**: Helpers for player-related actions (inventory, stats).
 * - **itemStackClass.js**: Simplified methods for item stack manipulation.
 * - **entityClass.js**: Extended methods for handling entities and interactions.
 *
 * Example imports:
 * ```js
 * import './blockClass.js'; // Block utilities
 * // import './playerClass.js'; // Player helpers (disabled)
 * import './itemStackClass.js'; // Item stack handling
 * ```
 */
import './API.js'
import './dependencyChecker.js'
import './modules/blockClass.js'
import './modules/playerClass.js'
import './modules/itemStackClass.js'
import './modules/entityClass.js'
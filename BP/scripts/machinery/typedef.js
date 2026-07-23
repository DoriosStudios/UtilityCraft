
/** 
 * @global
 * @typedef {import("@minecraft/server").ItemStack} ItemStack
 * @typedef {import("@minecraft/server").Container} Container
 * @typedef {import("@minecraft/server").Block} Block
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").EntityTypeFamilyComponent} EntityTypeFamilyComponent
 * @typedef {import("@minecraft/server").ScoreboardObjective} ScoreboardObjective
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {import("@minecraft/server").Dimension} Dimension
 * @typedef {import("@minecraft/server").BlockPermutation} BlockPermutation
 * @typedef {import("@minecraft/server").BlockCustomComponent} BlockCustomComponent
 * @typedef {import("@minecraft/server").ItemCustomComponent} ItemCustomComponent
 * @typedef {import("@minecraft/server").BlockComponentTickEvent} BlockComponentTickEvent
 * @typedef {import("@minecraft/server").BlockComponentPlayerPlaceBeforeEvent} BlockComponentPlayerPlaceBeforeEvent
 */

/**
 * Machine settings object for configuring behavior.
 * 
 * @global
 * @typedef {Object} MachineSettings
 * 
 * @property {string} rotation Block rotation type.
 * 
 * @property {Object} entity Entity configuration of the machine.
 * @property {string} entity.name Internal machine name (e.g., "crusher").
 * @property {string} entity.input_type Type of input (e.g., "simple").
 * @property {string} entity.output_type Type of output (e.g., "complex").
 * @property {number} entity.inventory_size Number of inventory slots.
 * 
 * @property {Object} machine Machine operational settings.
 * @property {number} machine.energy_cap Maximum internal energy capacity.
 * @property {number} machine.energy_cost Energy consumed per operation.
 * @property {number} generator.fluidCap Maximum internal fluid capacity.
 * @property {number} machine.rate_speed_base Base processing rate (DE/t).
 * @property {number[]} machine.upgrades Ordered inventory slots scanned for registered upgrades.
 */

/**
 * Generator settings object for configuring behavior.
 * 
 * @global
 * @typedef {Object} GeneratorSettings
 * @property {Object} entity Entity configuration of the generator.
 * @property {string} entity.name Internal generator name (e.g., "furnator").
 * @property {string} entity.type Type of generator (e.g., "simple").
 * @property {number} entity.inventory_size Number of inventory slots.
 * 
 * @property {Object} generator Generator operational settings.
 * @property {number} generator.energy_cap Maximum internal energy capacity.
 * @property {number} generator.fluidCap Maximum internal fluid capacity.
 * @property {number} generator.rate_speed_base Base processing rate (DE/t).
 */


/**
 * Parameters stored in a sieve mesh item.
 *
 * @global
 * @typedef {Object} MeshParams
 * @property {number} tier       The mesh tier level (e.g., 0, 1, 2...).
 * @property {number} multiplier Loot multiplier applied to sieve results.
 * @property {number} amount_multiplier Loot multiplier applied to sieve results.
 */

/**
 * Represents a single input→output recipe (Press, Furnace, Crusher, etc.).
 *
 * @global
 * @typedef {Object} SingleInputRecipe
 * @property {string} output The resulting item identifier.
 * @property {number} [required=1] Number of input items required per operation (defaults to 1).
 * @property {number} [amount=1] Number of output items produced (defaults to 1).
 * @property {number} [cost=800] Energy cost to process the item (defaults to 800).
 */

/**
 * Represents a collection of single-input recipes.
 *
 * The keys are input item identifiers, and each value describes
 * the resulting output and requirements.
 *
 * @global
 * @typedef {Object.<string, SingleInputRecipe>} SingleInputRecipes
 */

/**
 * Represents a single infusing recipe entry.
 *
 * @global
 * @typedef {Object} InfusingRecipe
 * @property {string} output The resulting item identifier.
 * @property {number} [required=1] Number of catalyst items required (defaults to 1).
 * @property {number} [amount=1] Number of output items produced (defaults to 1).
 */

/**
 * Represents all infusing recipes in a flat format (catalyst|input).
 *
 * Key format: "catalyst|input"
 *
 * @global
 * @typedef {Object.<string, InfusingRecipe>} InfuserRecipes
 */

/**
 * @global
 * @typedef {Object} SoilData
 * @property {number} cost Energy cost multiplier for growth.
 * @property {number} multi Loot multiplier (max 4).
 */

/**
 * @global
* @typedef {Object} CropDrop
* @property {string} item Item identifier.
* @property {number} min Minimum quantity dropped.
* @property {number} max Maximum quantity dropped.
* @property {number} chance Probability percentage (0–100).
*/

/**
 * @global
 * @typedef {Object} CropData
 * @property {number} cost Energy cost to grow the crop.
 * @property {CropDrop[]} drops List of possible drops from the crop.
 */

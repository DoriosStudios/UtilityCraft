import { ItemStack } from '@minecraft/server'

/**
 * Dynamic smelting helper
 * - Automatically compatible with other addons: respects each item's namespace.
 * - Allows registering new exceptions or custom rules via script at runtime.
 * - Documented with JSDoc so other addons and developers can use the API.
 */

/** @type {Set<string>} - List of known ore variant prefixes to strip when deriving base names. */
const ORE_PREFIXES = new Set([
    'deepslate_',
    'nether_',
    'end_',
    'dense_'
])

/** @type {Map<string, string>} - Map of raw item IDs to their smelted result IDs for exceptions. */
const EXCEPTIONS = new Map(Object.entries({
    'minecraft:ancient_debris': 'minecraft:netherite_scrap',
    'minecraft:cobblestone': 'minecraft:stone',
    'minecraft:cobbled_deepslate': 'minecraft:deepslate'
}))

/** @type {Array<(rawId: string, namespace: string, name: string) => string | undefined>} */
const CUSTOM_RULES = []

/**
 * Cheap validity check: attempts to create an ItemStack to see if the id exists.
 * Avoids relying on registries; catch to stay safe when the id is missing.
 * @param {string} typeId
 * @returns {boolean}
 */
function isValidItemId(typeId) {
    try {
        // eslint-disable-next-line no-new
        new ItemStack(typeId, 1)
        return true
    } catch (e) {
        return false
    }
}

/**
 * Normalize an ore name by stripping known prefixes.
 * @param {string} name
 */
function normalizeOreName(name) {
    for (const prefix of ORE_PREFIXES) {
        if (name.startsWith(prefix)) {
            return name.slice(prefix.length)
        }
    }
    return name
}

/**
 * Register an additional ore prefix to be stripped when deriving base names.
 * Example: registerOrePrefix('dense_') so 'dense_copper_ore' becomes 'copper'.
 * @param {string} prefix
 */
export function registerOrePrefix(prefix) {
    if (prefix && typeof prefix === 'string') {
        ORE_PREFIXES.add(prefix)
    }
}

/**
 * Register a direct smelting exception mapping: rawId -> resulting item id.
 * Useful for special cases where the default naming rules don't apply.
 * @param {string} rawId
 * @param {string} resultId
 */
export function registerSmeltingException(rawId, resultId) {
    if (!rawId || !resultId) return
    EXCEPTIONS.set(rawId, resultId)
}

/**
 * Register a custom rule function. The rule receives (rawId, namespace, name) and
 * should return the smelted item id string or undefined to fall back to defaults.
 * This enables complex or addon-specific mappings.
 * @param {(rawId: string, namespace: string, name: string) => string | undefined} rule
 */
export function registerSmeltingRule(rule) {
    if (typeof rule === 'function') {
        CUSTOM_RULES.push(rule)
    }
}

/**
 * Resolve the final smelted id considering exceptions, custom rules and defaults.
 * @param {string} rawId
 * @returns {string | undefined}
 */
function getSmeltedId(rawId) {
    if (EXCEPTIONS.has(rawId)) return EXCEPTIONS.get(rawId)
    if (!rawId.includes(':')) return

    const [namespace, name] = rawId.split(':')

    // User-provided custom rules
    for (const rule of CUSTOM_RULES) {
        const out = rule(rawId, namespace, name)
        if (out) return out
    }

    // Default rules
    if (name.startsWith('raw_') && !name.includes('block')) {
        return `${namespace}:${name.replace(/^raw_/, '')}_ingot`
    }

    if (name.startsWith('raw_') && name.endsWith('_block')) {
        return `${namespace}:${name.replace(/^raw_/, '')}`
    }

    // Helper to build ingot id safely and fall back to base if ingot is missing.
    const toIngotOrBase = (ns, base) => {
        const trimmed = base?.replace(/_+$/u, '') ?? ''
        const ingotId = `${ns}:${trimmed ? `${trimmed}_ingot` : 'ingot'}`
        const baseId = `${ns}:${trimmed}`
        if (isValidItemId(ingotId)) return ingotId
        if (isValidItemId(baseId)) return baseId
        return ingotId
    }

    // Standard "*_ore" smelting: try ingot, else the base item (e.g., diamond)
    if (name.endsWith('_ore')) {
        let base = name.slice(0, -4)
        base = normalizeOreName(base)
        return toIngotOrBase(namespace, base)
    }
}

DoriosAPI.register.itemComponent('smelting', {
    onMineBlock({ block, minedBlockPermutation }) {
        const smeltId = getSmeltedId(minedBlockPermutation.type.id)
        if (!smeltId) return

        const { x, y, z } = block.location
        const center = { x: x + 0.5, y: y + 0.2, z: z + 0.5 }

        const drops = block.dimension.getEntities({
            type: 'item',
            maxDistance: 2,
            location: center
        })

        for (const entity of drops) {
            const stack = entity.getComponent('minecraft:item')?.itemStack
            if (!stack) continue

            if (getSmeltedId(stack.typeId) !== smeltId) continue

            const amount = stack.amount
            entity.remove()
            block.dimension.spawnItem(new ItemStack(smeltId, amount), center)
        }
    }
})

// Expose helpers through DoriosAPI for other addons (when available)
if (globalThis.DoriosAPI) {
    globalThis.DoriosAPI.smelting = {
        registerOrePrefix,
        registerSmeltingException,
        registerSmeltingRule,
    }
}

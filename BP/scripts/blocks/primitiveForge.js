import { ItemStack } from '@minecraft/server';
import * as DoriosLib from '../DoriosLib/index.js';
import { furnaceRecipes } from '../config/recipes/furnace.js';
import { solidFuels } from '../config/recipes/fuel.js';
const FORGE_ID = 'utilitycraft:primitive_forge';
const FORMED = 'utilitycraft:formed';
const PART = 'utilitycraft:forge_part';
// Recipe durations in game ticks, independent of the owner tick interval.
const PROCESS_TICKS = 40;
const STEEL_TICKS = 160;
const BATCH_SIZE = 1;
// Preserve the existing saved fuel units (1,200 units per 1,000 DE).
const FUEL_UNITS_PER_RECIPE = 1200;
// Keep the previous full steel batch's burn rate for every active cycle,
// regardless of recipe duration, input count or batch size.
const FUEL_UNITS_PER_TICK = 30;
const STEP_TICKS = 4;
const INPUT = 0, SECONDARY = 1, PROGRESS = 3, FUEL_BAR = 4, FUEL = 5;
// Keep the original output slot and append the other three to preserve saved items.
const OUTPUTS = [2, 6, 7, 8];
const INPUTS = [INPUT, SECONDARY, FUEL];
const RECIPE_DE = 1000;

function configureInventory(entity) {
    const config = DoriosLib.container.getConfig(entity);
    if (config?.type === 'simple'
        && config.inputConfig.length === INPUTS.length && INPUTS.every(slot => config.inputConfig.includes(slot))
        && config.outputConfig.length === OUTPUTS.length && OUTPUTS.every(slot => config.outputConfig.includes(slot))) return;
    DoriosLib.container.setConfig(entity, {
        version: 1, type: 'simple', inputConfig: INPUTS, outputConfig: OUTPUTS,
    });
}

function availableOutputs(inventory, output) {
    const stacks = [], empty = [];
    for (const slot of OUTPUTS) {
        const item = inventory.getItem(slot);
        if (!item) empty.push({ slot, space: output.maxAmount });
        else if (item.isStackableWith(output) && item.amount < item.maxAmount) {
            stacks.push({ slot, item, space: item.maxAmount - item.amount });
        }
    }
    // Fill compatible stacks before opening another slot.
    return [...stacks, ...empty];
}

function forgeRecipes(inventory) {
    const first = inventory.getItem(INPUT), second = inventory.getItem(SECONDARY);
    const combinedKey = first && second ? `${first.typeId}|${second.typeId}` : undefined;
    const combined = combinedKey && furnaceRecipes[combinedKey];
    const entries = combined
        ? [{ key: combinedKey, recipe: combined, inputs: [
            { slot: INPUT, typeId: first.typeId, required: combined.required ?? 1 },
            { slot: SECONDARY, typeId: second.typeId, required: combined.secondary_required ?? 1 },
        ] }]
        : [INPUT, SECONDARY].flatMap(slot => {
            const item = inventory.getItem(slot);
            const recipe = item && furnaceRecipes[item.typeId];
            return recipe ? [{ key: item.typeId, recipe, inputs: [
                { slot, typeId: item.typeId, required: recipe.required ?? 1 },
            ] }] : [];
        });
    const duration = combined?.output === 'utilitycraft:raw_steel' ? STEEL_TICKS : PROCESS_TICKS;
    return {
        duration,
        signature: entries.length ? JSON.stringify([entries, duration]) : '',
        jobs: entries.map(entry => ({
            ...entry,
            output: new ItemStack(entry.recipe.output),
            amount: entry.recipe.amount ?? 1,
        })),
    };
}

function availableBatch(inventory, job) {
    return Math.min(BATCH_SIZE, ...job.inputs.map(input => {
        const item = inventory.getItem(input.slot);
        return item?.typeId === input.typeId ? Math.floor(item.amount / input.required) : 0;
    }));
}

function planBatch(inventory, jobs, batches) {
    // Reserve shared output space before processing either input. A second result
    // must see the first result's reservation, even when both use an empty slot.
    const outputs = new Map(OUTPUTS.map(slot => [slot, inventory.getItem(slot)]));
    const writes = new Map(), counts = [];
    for (let index = 0; index < jobs.length; index++) {
        const job = jobs[index];
        const entries = availableOutputs({ getItem: slot => outputs.get(slot) }, job.output);
        const space = entries.reduce((sum, entry) => sum + entry.space, 0);
        const capacity = Math.min(availableBatch(inventory, job), Math.floor(space / job.amount));
        const count = batches ? batches[index] : capacity;
        // An active shared cycle pauses until all its reserved results fit.
        if (count > capacity) return undefined;
        counts.push(count);
        let pending = count * job.amount;
        for (const entry of entries) {
            if (pending <= 0) break;
            const added = Math.min(entry.space, pending);
            const result = entry.item ?? job.output.clone();
            result.amount = (entry.item?.amount ?? 0) + added;
            outputs.set(entry.slot, result);
            writes.set(entry.slot, result);
            pending -= added;
        }
    }
    return { counts, writes };
}

function positions(origin) {
    const result = [];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
        result.push({ x: origin.x + x, y: origin.y + y, z: origin.z + z });
    }
    return result;
}

// Every possible 2x2x2 containing the newly placed block, in stable order.
function candidates(location) {
    return positions({ x: location.x - 1, y: location.y - 1, z: location.z - 1 });
}

function frontPosition(origin, facing) {
    const offset = { north: [0, -1.04], south: [0, 1.04], east: [1.04, 0], west: [-1.04, 0] }[facing];
    return { x: origin.x + 1 + offset[0], y: origin.y + 0.75, z: origin.z + 1 + offset[1] };
}

function contains(origin, position) {
    return ['x', 'y', 'z'].every(axis => position[axis] >= origin[axis] && position[axis] < origin[axis] + 2);
}

const STRUCTURE = 'utilitycraft:forge_structure';
const PROGRESS_PROPERTY = 'utilitycraft:forge_progress';
const OWNER = 'utilitycraft:forge_owner';
const OWNER_PART = { north: 0, south: 1, east: 4, west: 0 };

function getBlock(dimension, position) {
    try { return dimension.getBlock(position); } catch { return undefined; }
}

function readStructure(entity) {
    const raw = entity.getDynamicProperty(STRUCTURE);
    return raw ? JSON.parse(raw) : undefined;
}

function updateDisplay(inventory, progress, fuelRemaining, fuelTotal, duration = PROCESS_TICKS) {
    const frame = Math.min(22, Math.floor(22 * progress / duration)).toString().padStart(2, '0');
    const arrow = `utilitycraft:progress_right_big_bar_${frame}`;
    if (inventory.getItem(PROGRESS)?.typeId !== arrow || inventory.getItem(PROGRESS)?.lockMode !== 'none') {
        inventory.setItem(PROGRESS, new ItemStack(arrow));
    }
    const fuelFrame = fuelTotal > 0 ? Math.max(0, Math.ceil(13 * fuelRemaining / fuelTotal)) : 0;
    const fuel = `utilitycraft:fuel_bar_${fuelFrame}`;
    if (inventory.getItem(FUEL_BAR)?.typeId !== fuel) inventory.setItem(FUEL_BAR, new ItemStack(fuel));
}

function form(block) {
    if (block.permutation.getState(FORMED)) return;
    const dimension = block.dimension;
    const facing = block.permutation.getState('minecraft:cardinal_direction') ?? 'north';
    for (const origin of candidates(block.location)) {
        const parts = positions(origin).map(position => getBlock(dimension, position));
        if (!parts.every(part => part?.typeId === FORGE_ID && !part.permutation.getState(FORMED))) continue;
        const front = frontPosition(origin, facing);
        // The front may be in another chunk. Never spawn into an unloaded chunk.
        if (!getBlock(dimension, { x: Math.floor(front.x), y: Math.floor(front.y), z: Math.floor(front.z) })) continue;
        let entity;
        try {
            entity = dimension.spawnEntity(FORGE_ID, front);
            entity.setDynamicProperty(STRUCTURE, JSON.stringify({ origin, facing }));
            entity.setRotation({ x: 0, y: { north: 180, south: 0, east: -90, west: 90 }[facing] });
            entity.nameTag = `entity.${FORGE_ID}.name`;
            configureInventory(entity);
            updateDisplay(entity.getComponent('minecraft:inventory').container, 0, 0, 0);
            parts.forEach((part, index) => part.setPermutation(part.permutation
                .withState(FORMED, true).withState(PART, index).withState(OWNER, index === OWNER_PART[facing])
                .withState('minecraft:cardinal_direction', facing)));
        } catch (error) {
            // Formation is synchronous: roll back a partially initialized structure.
            entity?.remove();
            for (const part of parts) part.setPermutation(part.permutation.withState(FORMED, false).withState(PART, 0).withState(OWNER, false));
            console.warn(`[UtilityCraft] Could not form primitive forge: ${error}`);
            return;
        }
        dimension.playSound('random.anvil_use', front);
        return;
    }
}

function dismantle(entity, structure) {
    const inventory = entity.getComponent('minecraft:inventory')?.container;
    // Clear each real slot after dropping it; never drop the progress UI item.
    if (inventory) for (const slot of [...INPUTS, ...OUTPUTS]) {
        const item = inventory.getItem(slot);
        if (item) {
            entity.dimension.spawnItem(item, entity.location);
            inventory.setItem(slot, undefined);
        }
    }
    for (const position of positions(structure.origin)) {
        const block = getBlock(entity.dimension, position);
        if (block?.typeId === FORGE_ID) block.setPermutation(block.permutation
            .withState(FORMED, false).withState(PART, 0).withState(OWNER, false).withState('utilitycraft:on', false));
    }
    entity.remove();
}

// Match Better Smelters' closed-furnace cadence: 10% chance every 20 ticks.
function furnaceParticles(entity, structure, working) {
    const elapsed = working ? (Number(entity.getDynamicProperty('utilitycraft:forge_particle_ticks')) || 0) + STEP_TICKS : 0;
    entity.setDynamicProperty('utilitycraft:forge_particle_ticks', elapsed >= 20 ? 0 : elapsed);
    if (elapsed < 20 || Math.random() <= 0.9) return;
    const { origin, facing } = structure;
    const offset = { north: [0, -1.001], south: [0, 1.001], east: [1.001, 0], west: [-1.001, 0] }[facing];
    const spread = (Math.random() - 0.5) * 0.2;
    const position = {
        x: origin.x + 1 + offset[0] + (offset[0] === 0 ? spread : 0),
        y: origin.y + 0.2 + Math.random() * 0.1,
        z: origin.z + 1 + offset[1] + (offset[1] === 0 ? spread : 0),
    };
    entity.dimension.spawnParticle('minecraft:basic_flame_particle', position);
    entity.dimension.spawnParticle('minecraft:basic_smoke_particle', { ...position, y: position.y + 0.1 });
}

function consume(inventory, slot, amount = 1) {
    const item = inventory.getItem(slot);
    if (item.amount === amount) inventory.setItem(slot, undefined);
    else { item.amount -= amount; inventory.setItem(slot, item); }
}

function tick(entity, owner) {
    const structure = readStructure(entity);
    if (!structure) { entity.remove(); return; }
    const parts = positions(structure.origin).map(position => getBlock(entity.dimension, position));
    // An unavailable chunk is unknown, not a broken multiblock.
    if (parts.some(part => !part)) return;
    if (!parts.every((part, index) => part.typeId === FORGE_ID
        && part.permutation.getState(FORMED) && part.permutation.getState(PART) === index)) {
        dismantle(entity, structure);
        return;
    }
    if (!owner) return;
    const inventory = entity.getComponent('minecraft:inventory')?.container;
    if (!inventory) return;
    // Refresh persisted extraction slots for forges assembled before the 2x2 output grid.
    configureInventory(entity);
    let signature = entity.getDynamicProperty('utilitycraft:forge_recipe');
    let progress = Number(entity.getDynamicProperty(PROGRESS_PROPERTY)) || 0;
    const savedBatches = entity.getDynamicProperty('utilitycraft:forge_batches');
    // Limit saved cycles to one recipe per input without discarding paid progress.
    let batches = savedBatches ? JSON.parse(savedBatches).map(count => Math.min(BATCH_SIZE, count)) : undefined;
    const legacyBatch = Math.min(BATCH_SIZE, Number(entity.getDynamicProperty('utilitycraft:forge_batch')) || 0);
    let duration = PROCESS_TICKS;
    let remaining = Number(entity.getDynamicProperty('utilitycraft:forge_fuel_remaining')) || 0;
    let total = Number(entity.getDynamicProperty('utilitycraft:forge_fuel_total')) || 0;
    let working = false;
    let budget = STEP_TICKS;
    // Carry the unused fraction of a tick into the next batch, preserving the configured recipe duration.
    while (budget > 0.000001) {
        const selected = forgeRecipes(inventory);
        const { jobs } = selected;
        duration = selected.duration;
        if (signature !== selected.signature) {
            // Preserve an already-paid single-input or alloy cycle in existing
            // worlds when upgrading from the previous batch format.
            const legacySignature = jobs.length === 1
                ? JSON.stringify([jobs[0].key, jobs[0].recipe, duration]) : undefined;
            if (legacyBatch > 0 && signature === legacySignature) {
                batches = [legacyBatch];
            } else {
                progress = 0;
                batches = undefined;
            }
            signature = selected.signature;
        }
        if (!jobs.length) break;
        // Keep both batch sizes fixed until the shared cycle finishes. Removing
        // reserved ingredients restarts the cycle; adding more never enlarges it.
        if (batches && jobs.some((job, index) => batches[index] > availableBatch(inventory, job))) {
            progress = 0;
            batches = undefined;
        }
        const plan = planBatch(inventory, jobs, batches);
        if (!plan) break;
        const operations = plan.counts.reduce((sum, count) => sum + count, 0);
        if (!operations) break;
        batches = plan.counts;
        if (remaining <= 0.000001) {
            const item = inventory.getItem(FUEL);
            const fuel = item && solidFuels.find(f => f.id.includes('*')
                ? new RegExp(`^${f.id.replace(/\*/g, '.*')}$`).test(item.typeId)
                : item.typeId.includes(f.id));
            if (!(fuel?.de > 0)) break;
            consume(inventory, FUEL);
            remaining = total = fuel.de * FUEL_UNITS_PER_RECIPE / RECIPE_DE;
        }
        const work = Math.min(budget, remaining / FUEL_UNITS_PER_TICK, duration - progress);
        working = true;
        progress += work;
        budget -= work;
        remaining = Math.max(0, remaining - work * FUEL_UNITS_PER_TICK);
        if (progress >= duration - 0.000001) {
            for (let index = 0; index < jobs.length; index++) {
                if (!batches[index]) continue;
                for (const input of jobs[index].inputs) {
                    consume(inventory, input.slot, input.required * batches[index]);
                }
            }
            for (const [slot, result] of plan.writes) inventory.setItem(slot, result);
            progress = 0;
            batches = undefined;
        }
    }
    furnaceParticles(entity, structure, working);
    entity.setDynamicProperty('utilitycraft:forge_batches', batches ? JSON.stringify(batches) : undefined);
    entity.setDynamicProperty('utilitycraft:forge_batch', undefined);
    for (const part of parts) if (part.permutation.getState('utilitycraft:on') !== working) {
        part.setPermutation(part.permutation.withState('utilitycraft:on', working));
    }
    entity.setDynamicProperty('utilitycraft:forge_recipe', signature);
    entity.setDynamicProperty('utilitycraft:forge_fuel_remaining', remaining);
    entity.setDynamicProperty('utilitycraft:forge_fuel_total', total);
    entity.setDynamicProperty(PROGRESS_PROPERTY, progress);
    updateDisplay(inventory, progress, remaining, total, duration);
}

DoriosLib.registry.blockComponent(FORGE_ID, {
    onPlace({ block }) { form(block); },
    onTick({ block }) {
        if (!block.permutation.getState(FORMED)) return;
        for (const entity of block.dimension.getEntities({ type: FORGE_ID, location: block.location, maxDistance: 4 })) {
            const structure = readStructure(entity);
            if (structure && contains(structure.origin, block.location)) {
                tick(entity, block.permutation.getState(OWNER));
                return;
            }
        }
    },
    onPlayerBreak({ block }) {
        for (const entity of block.dimension.getEntities({ type: FORGE_ID, location: block.location, maxDistance: 4 })) {
            const structure = readStructure(entity);
            if (structure && contains(structure.origin, block.location)) {
                // Let every chunk load before releasing membership and inventory.
                const parts = positions(structure.origin).map(position => getBlock(entity.dimension, position));
                if (parts.every(Boolean)) dismantle(entity, structure);
            }
        }
    },
});

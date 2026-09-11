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
const BATCH_SIZE = 4;
// Preserve the existing saved fuel units (1,200 units per 1,000 DE).
const FUEL_UNITS_PER_RECIPE = 1200;
const STEP_TICKS = 4;
const INPUT = 0, SECONDARY = 1, OUTPUT = 2, PROGRESS = 3, FUEL_BAR = 4, FUEL = 5;
const RECIPE_DE = 1000;

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
            DoriosLib.container.setConfig(entity, {
                version: 1, type: 'simple', inputConfig: [INPUT, SECONDARY, FUEL], outputConfig: [OUTPUT],
            });
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
    if (inventory) for (const slot of [INPUT, SECONDARY, FUEL, OUTPUT]) {
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
    const mainSlot = inventory.getItem(INPUT) ? INPUT : SECONDARY;
    const input = inventory.getItem(mainSlot);
    const secondary = mainSlot === INPUT ? inventory.getItem(SECONDARY) : undefined;
    const key = secondary ? `${input?.typeId}|${secondary.typeId}` : input?.typeId;
    const recipe = furnaceRecipes[key];
    const duration = secondary && recipe?.output === 'utilitycraft:raw_steel' ? STEEL_TICKS : PROCESS_TICKS;
    const signature = recipe ? JSON.stringify([key, recipe, duration]) : '';
    let progress = Number(entity.getDynamicProperty(PROGRESS_PROPERTY)) || 0;
    let batch = Number(entity.getDynamicProperty('utilitycraft:forge_batch')) || 0;
    if (entity.getDynamicProperty('utilitycraft:forge_recipe') !== signature) { progress = 0; batch = 0; }
    const required = recipe?.required ?? 1, secondaryRequired = secondary ? (recipe?.secondary_required ?? 1) : 0;
    const amount = recipe?.amount ?? 1;
    let remaining = Number(entity.getDynamicProperty('utilitycraft:forge_fuel_remaining')) || 0;
    let total = Number(entity.getDynamicProperty('utilitycraft:forge_fuel_total')) || 0;
    let working = false;
    let budget = STEP_TICKS;
    // Carry the unused fraction of a tick into the next batch, preserving the configured recipe duration.
    while (recipe && budget > 0.000001) {
        const main = inventory.getItem(mainSlot), extra = secondary ? inventory.getItem(SECONDARY) : undefined, result = inventory.getItem(OUTPUT);
        if (main?.typeId !== input.typeId || extra?.typeId !== secondary?.typeId) break;
        const available = Math.min(BATCH_SIZE, Math.floor(main.amount / required),
            secondaryRequired ? Math.floor(extra.amount / secondaryRequired) : BATCH_SIZE);
        const space = !result ? new ItemStack(recipe.output).maxAmount
            : result.typeId === recipe.output ? result.maxAmount - result.amount : 0;
        if (!available || space < amount) break;
        // Adding inputs never enlarges a batch already in progress.
        if (batch > available) { progress = 0; batch = 0; }
        if (!batch) batch = Math.min(available, Math.floor(space / amount));
        if (space < amount * batch) break;
        if (remaining <= 0.000001) {
            const item = inventory.getItem(FUEL);
            const fuel = item && solidFuels.find(f => f.id.includes('*')
                ? new RegExp(`^${f.id.replace(/\*/g, '.*')}$`).test(item.typeId)
                : item.typeId.includes(f.id));
            if (!(fuel?.de > 0)) break;
            consume(inventory, FUEL);
            remaining = total = fuel.de * FUEL_UNITS_PER_RECIPE / RECIPE_DE;
        }
        const fuelRate = batch * FUEL_UNITS_PER_RECIPE / duration;
        const work = Math.min(budget, remaining / fuelRate, duration - progress);
        working = true;
        progress += work;
        budget -= work;
        remaining = Math.max(0, remaining - work * fuelRate);
        if (progress >= duration - 0.000001) {
            consume(inventory, mainSlot, required * batch);
            if (secondaryRequired) consume(inventory, SECONDARY, secondaryRequired * batch);
            if (result) { result.amount += amount * batch; inventory.setItem(OUTPUT, result); }
            else inventory.setItem(OUTPUT, new ItemStack(recipe.output, amount * batch));
            progress = 0;
            batch = 0;
        }
    }
    furnaceParticles(entity, structure, working);
    entity.setDynamicProperty('utilitycraft:forge_batch', batch);
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

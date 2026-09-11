import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

const source = await build({
    stdin: { contents: 'import "./BP/scripts/config/recipes/primitiveForge.js"; import "./BP/scripts/blocks/primitiveForge.js";', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'bedrock-test-runtime', setup(builder) {
        builder.onResolve({ filter: /^@minecraft\/server$|DoriosLib\/index\.js$|config\/recipes\/fuel\.js$/ }, args => ({ path: args.path, namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === '@minecraft/server'
            ? 'export const { ItemStack, ItemLockMode, system, world } = globalThis.runtime;'
            : args.path.endsWith('/furnace.js') ? 'export const { furnaceRecipes } = globalThis.runtime;'
            : args.path.endsWith('/fuel.js') ? 'export const { solidFuels } = globalThis.runtime;'
            : 'export const { registry, container } = globalThis.runtime;' }));
    } }],
});
const ID = 'utilitycraft:primitive_forge', FORMED = 'utilitycraft:formed';
class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = 64; this.lockMode = 'none'; }
}
const clone = value => value ? Object.assign(new ItemStack(value.typeId, value.amount), value) : undefined;
const key = p => `${p.x},${p.y},${p.z}`;
function permutation(states = {}) {
    return { getState: name => states[name], withState: (name, value) => permutation({ ...states, [name]: value }) };
}
function fixture(flushRegistrations = true, random = Math.random) {
    const blocks = new Map(), entities = [], drops = [], particles = [], unloaded = new Set();
    let hooks, interval, removeListener;
    let recipeListeners = [], recipeQueue = [];
    const dimension = {
        getBlock(position) {
            if (unloaded.has(key(position))) return undefined;
            return blocks.get(key(position)) ?? { typeId: 'minecraft:air', location: position };
        },
        getEntities: () => entities.filter(entity => !entity.removed),
        spawnItem(item) { drops.push(clone(item)); }, playSound() {},
        spawnParticle(typeId, position) { particles.push({ typeId, position }); },
        spawnEntity(typeId, location) {
            const items = [], properties = new Map();
            const inventory = { getItem: index => clone(items[index]), setItem: (index, value) => { items[index] = clone(value); } };
            const entity = { typeId, id: String(entities.length), location, dimension, inventory,
                setDynamicProperty: (key, value) => properties.set(key, value), getDynamicProperty: key => properties.get(key),
                getComponent: () => ({ container: inventory }), setRotation(value) { this.rotation = value; },
                remove() { this.removed = true; removeListener?.({ removedEntityId: this.id }); },
            };
            entities.push(entity); return entity;
        },
    };
    const runtime = {
        furnaceRecipes: {
            'minecraft:raw_iron': { output: 'minecraft:iron_ingot' },
        },
        solidFuels: [{ id: 'coal', de: 8000 }, { id: 'stick', de: 500 }],
        ItemStack, ItemLockMode: { slot: 'slot', none: 'none' },
        system: { runInterval: callback => { interval = callback; }, afterEvents: { scriptEventReceive: { subscribe: callback => recipeListeners.push(callback) } } },
        world: { getDimension: id => id === 'overworld' ? dimension : { getEntities: () => [] },
            afterEvents: { entityRemove: { subscribe: callback => { removeListener = callback; } } } },
        registry: { blockComponent: (_, value) => { hooks = value; }, registerFurnaceRecipe: payload => recipeQueue.push(payload) }, container: { setConfig: () => true },
    };
    const registerRecipes = payload => recipeListeners.forEach(callback => callback({
        id: 'utilitycraft:register_furnace_recipe', message: JSON.stringify(payload),
    }));
    const reload = () => {
        recipeListeners = []; recipeQueue = [];
        vm.runInNewContext(source.outputFiles[0].text, { runtime, console, Math: Object.assign(Object.create(Math), { random }) });
        // Simulate the shared queue dispatch after module evaluation/world load.
        assert.ok(recipeQueue.every(payload => Object.keys(payload).every(key => !key.includes('|'))), 'forge defaults must not use the registration queue');
        if (flushRegistrations) recipeQueue.forEach(registerRecipes);
    };
    reload();
    function place(position, facing = 'north') {
        const block = { typeId: ID, location: position, dimension,
            permutation: permutation({ [FORMED]: false, 'utilitycraft:forge_part': 0, 'utilitycraft:on': false, 'minecraft:cardinal_direction': facing }),
            setPermutation(value) { this.permutation = value; },
        };
        blocks.set(key(position), block); hooks.onPlace({ block }); return block;
    }
    return { blocks, entities, drops, particles, unloaded, dimension, place, reload, registerRecipes,
        tick: (count = 1) => { for (let i = 0; i < count; i++) for (const block of blocks.values()) if (block.permutation.getState('utilitycraft:forge_owner')) hooks.onTick({ block }); },
        break(position) { const block = blocks.get(key(position)); blocks.delete(key(position)); hooks.onPlayerBreak({ block }); },
    };
}
const positions = [];
for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) positions.push({ x, y, z });
function form(fixture) { positions.forEach(position => fixture.place(position)); return fixture.entities[0]; }
function load(entity, fuel = 'minecraft:coal') {
    entity.inventory.setItem(0, new ItemStack('utilitycraft:iron_dust', 3));
    entity.inventory.setItem(1, new ItemStack(fuel, 3));
    entity.inventory.setItem(5, new ItemStack('minecraft:coal', 3));
}

for (const facing of ['north', 'south', 'east', 'west']) for (let last = 0; last < 8; last++) {
    const f = fixture();
    positions.filter((_, i) => i !== last).forEach(position => f.place(position));
    assert.equal(f.entities.length, 0, 'seven blocks must never activate');
    f.place(positions[last], facing);
    assert.equal(f.entities.length, 1);
    const entity = f.entities[0];
    const owners = [...f.blocks.values()].filter(block => block.permutation.getState('utilitycraft:forge_owner'));
    assert.equal(owners.length, 1);
    assert.equal(owners[0].location[{ north: 'z', south: 'z', east: 'x', west: 'x' }[facing]], ['south', 'east'].includes(facing) ? 1 : 0);
    assert.equal(JSON.parse(entity.getDynamicProperty('utilitycraft:forge_structure')).facing, facing);
    const expected = { north: [1, -.04], south: [1, 2.04], east: [2.04, 1], west: [-.04, 1] }[facing];
    assert.ok(Math.abs(entity.location.x - expected[0]) < 1e-8 && Math.abs(entity.location.z - expected[1]) < 1e-8);
    assert.equal(entity.location.y + .25, 1, 'hitbox center must match front center vertically');
    // A neighboring wall cannot steal the existing structure; a second cube can form.
    for (const position of positions.filter(p => p.x === 0)) f.place({ ...position, x: 2 });
    assert.equal(f.entities.length, 1);
    for (const position of positions.filter(p => p.x === 0)) f.place({ ...position, x: 3 });
    assert.equal(f.entities.length, 2);
}

for (const fuel of ['minecraft:coal', 'minecraft:charcoal']) {
    const f = fixture(), entity = form(f); load(entity, fuel);
    entity.inventory.setItem(0, new ItemStack('utilitycraft:iron_dust', 10));
    entity.inventory.setItem(1, new ItemStack(fuel, 10));
    f.tick(20);
    assert.equal(entity.inventory.getItem(3).typeId, 'utilitycraft:progress_right_big_bar_11');
    f.reload(); f.tick(19);
    assert.equal(entity.inventory.getItem(2), undefined);
    f.tick();
    assert.equal(entity.inventory.getItem(2).amount, 4);
    assert.equal(entity.inventory.getItem(0).amount, 6);
    assert.equal(entity.inventory.getItem(1).amount, 6);
    assert.equal(entity.getDynamicProperty('utilitycraft:forge_fuel_remaining'), 4800);
    entity.inventory.setItem(2, new ItemStack('utilitycraft:raw_steel', 64));
    f.tick(20);
    assert.equal(entity.getDynamicProperty('utilitycraft:forge_fuel_remaining'), 4800);
    entity.inventory.setItem(2, undefined);
    f.unloaded.add('1,1,1'); f.tick(20);
    assert.equal(entity.removed, undefined);
    assert.equal(entity.inventory.getItem(2), undefined);
    f.unloaded.clear(); f.tick(40);
    assert.equal(entity.inventory.getItem(2).amount, 4);
    f.break(positions[0]); f.tick(5);
    assert.equal(f.drops.length, 4);
    assert.ok(f.drops.every(item => !item.typeId.includes('_bar_')));
    assert.ok([...f.blocks.values()].every(block => !block.permutation.getState(FORMED)));
    f.place(positions[0]); assert.equal(f.dimension.getEntities().length, 1);
}
{
    const f = fixture(), entity = form(f);
    entity.inventory.setItem(0, new ItemStack('minecraft:raw_iron', 9));
    entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
    f.tick(9); assert.equal(entity.inventory.getItem(2), undefined);
    f.tick(); assert.equal(entity.inventory.getItem(2).amount, 4);
    f.tick(10); assert.equal(entity.inventory.getItem(2).amount, 8);
    f.tick(20); assert.equal(entity.inventory.getItem(2).amount, 8, 'coal covers eight units, not eight batches');
    entity.inventory.setItem(5, new ItemStack('minecraft:stick', 2));
    f.tick(10); assert.equal(entity.inventory.getItem(2).amount, 9, 'two half fuels complete a partial batch');
}
{
    const f = fixture(), entity = form(f); load(entity);
    entity.inventory.setItem(5, undefined); f.tick(20);
    assert.equal(entity.inventory.getItem(2), undefined);
    entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
    f.tick(20);
    entity.inventory.setItem(0, new ItemStack('minecraft:raw_iron'));
    entity.inventory.setItem(1, undefined);
    f.tick(9); assert.equal(entity.inventory.getItem(2), undefined, 'recipe switch resets progress');
    f.tick(); assert.equal(entity.inventory.getItem(2).typeId, 'minecraft:iron_ingot');
}
{
    const f = fixture(), entity = form(f); load(entity);
    entity.inventory.setItem(0, new ItemStack('utilitycraft:iron_dust', 8));
    entity.inventory.setItem(1, new ItemStack('minecraft:coal', 2));
    f.tick(40);
    assert.equal(entity.inventory.getItem(2).amount, 2, 'secondary input limits partial batches');
    assert.equal(entity.inventory.getItem(0).amount, 6);
}
{
    const f = fixture(), entity = form(f); load(entity);
    entity.inventory.setItem(2, new ItemStack('utilitycraft:raw_steel', 63));
    f.tick(40);
    assert.equal(entity.inventory.getItem(2).amount, 64);
    assert.equal(entity.inventory.getItem(0).amount, 2, 'output capacity limits batch');
    f.blocks.delete('1,1,1'); f.tick(); assert.equal(entity.removed, true);
}
{
    const f = fixture(), entity = form(f); load(entity);
    entity.inventory.setItem(0, new ItemStack('utilitycraft:iron_dust'));
    entity.inventory.setItem(1, new ItemStack('minecraft:coal'));
    f.tick(20);
    entity.inventory.setItem(0, new ItemStack('utilitycraft:iron_dust', 4));
    entity.inventory.setItem(1, new ItemStack('minecraft:coal', 4));
    f.tick(20);
    assert.equal(entity.inventory.getItem(2).amount, 1, 'adding inputs must not enlarge a partly paid batch');
}
for (const path of ['BP/blocks/primitive_forge.json', 'BP/entities/machines/primitive_forge.json',
    'BP/recipes/primitive_forge.json', 'RP/ui/machines/primitive_forge.json',
    'RP/ui/_ui_defs.json', 'RP/ui/chest_screen.json']) JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('Forge checks passed: 32 formation/orientation cases, 2s/8s timing at 4-tick intervals, four-unit batches, slower steel, partial batches, per-unit fuel, reload, chunks and dismantling.');

const forgeBlock = JSON.parse(fs.readFileSync('BP/blocks/primitive_forge.json', 'utf8'))['minecraft:block'];
assert.deepEqual(forgeBlock.components['minecraft:tick'].interval_range, [1000000, 1000000]);
assert.deepEqual(forgeBlock.permutations.find(p => p.components['minecraft:tick']).components['minecraft:tick'].interval_range, [4, 4]);

for (const carbon of ['minecraft:coal', 'minecraft:charcoal', 'utilitycraft:coal_dust', 'utilitycraft:charcoal_dust']) {
    for (const reversed of [false, true]) {
        const f = fixture(), entity = form(f);
        entity.inventory.setItem(0, new ItemStack(reversed ? carbon : 'utilitycraft:iron_dust', 4));
        entity.inventory.setItem(1, new ItemStack(reversed ? 'utilitycraft:iron_dust' : carbon, 4));
        entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
        f.tick(39); assert.equal(entity.inventory.getItem(2), undefined);
        f.tick(); assert.equal(entity.inventory.getItem(2).amount, 4);
        assert.equal(entity.inventory.getItem(2).typeId, 'utilitycraft:raw_steel');
        assert.equal(entity.inventory.getItem(0), undefined);
        assert.equal(entity.inventory.getItem(1), undefined);
    }
}
{
    const f = fixture(), entity = form(f);
    entity.inventory.setItem(1, new ItemStack('minecraft:raw_iron'));
    entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
    f.tick(10);
    assert.equal(entity.inventory.getItem(2).typeId, 'minecraft:iron_ingot', 'one input in either slot uses furnace recipes');
}
{
    const f = fixture(), entity = form(f);
    entity.inventory.setItem(0, new ItemStack('minecraft:raw_iron'));
    entity.inventory.setItem(1, new ItemStack('minecraft:dirt'));
    entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
    f.tick(40);
    assert.equal(entity.inventory.getItem(2), undefined, 'unknown pairs must never fall back to furnace recipes');
    assert.equal(entity.inventory.getItem(5).amount, 1);
}
console.log('All eight real forge recipe variants and single-/double-input registry routing passed.');

{
    const f = fixture(), entity = form(f);
    const pair = 'minecraft:raw_iron|minecraft:dirt';
    entity.inventory.setItem(0, new ItemStack('minecraft:raw_iron', 8));
    entity.inventory.setItem(1, new ItemStack('minecraft:dirt', 12));
    entity.inventory.setItem(5, new ItemStack('minecraft:coal'));
    f.tick(10); assert.equal(entity.inventory.getItem(2), undefined);
    f.registerRecipes({ [pair]: { output: 'minecraft:gold_ingot', required: 2, secondary_required: 3, amount: 2 } });
    f.tick(10);
    assert.equal(entity.inventory.getItem(2).amount, 8);
    assert.equal(entity.inventory.getItem(2).typeId, 'minecraft:gold_ingot');
    assert.equal(entity.inventory.getItem(0), undefined);
    assert.equal(entity.inventory.getItem(1), undefined);
    f.registerRecipes({ [pair]: { output: 'minecraft:iron_ingot' } });
    entity.inventory.setItem(0, new ItemStack('minecraft:raw_iron'));
    entity.inventory.setItem(1, new ItemStack('minecraft:dirt'));
    entity.inventory.setItem(2, undefined);
    f.tick(10);
    assert.equal(entity.inventory.getItem(2).typeId, 'minecraft:iron_ingot', 'scriptevent replaces an existing combination');
}
console.log('Real furnace scriptevent handler: startup registrations, custom combinations, quantities and overrides passed.');

{
    // No world-load queue or script event is dispatched for this fixture.
    const f = fixture(false), entity = form(f); load(entity);
    f.tick(40);
    assert.equal(entity.inventory.getItem(2).typeId, 'utilitycraft:raw_steel');
    assert.equal(entity.inventory.getItem(2).amount, 3);
}
console.log('Forge defaults work immediately without queue dispatch or scriptevents.');

// Particle cadence is independent of the processing tick and emits once per structure.
for (const facing of ['north', 'south', 'east', 'west']) {
    const f = fixture(true, () => 0.95);
    positions.forEach(position => f.place(position, facing));
    const entity = f.entities[0];
    load(entity);
    f.tick(4);
    assert.equal(f.particles.length, 0);
    f.tick();
    assert.deepEqual(f.particles.map(p => p.typeId), ['minecraft:basic_flame_particle', 'minecraft:basic_smoke_particle']);
    const p = f.particles[0].position;
    assert.ok(p.y >= 0.2 && p.y <= 0.3);
    const axis = ['north', 'south'].includes(facing) ? 'z' : 'x';
    assert.ok(['north', 'west'].includes(facing) ? p[axis] < 0 : p[axis] > 2);
    entity.inventory.setItem(0, undefined);
    entity.inventory.setItem(1, undefined);
    f.tick(10);
    assert.equal(f.particles.length, 2, 'idle forge must not emit particles');
}
const quietForge = fixture(true, () => 0.9);
load(form(quietForge));
quietForge.tick(5);
assert.equal(quietForge.particles.length, 0, 'same 10% threshold as Better Smelters');
console.log('Particle cadence, active-only emission, chance threshold and all four front positions passed.');

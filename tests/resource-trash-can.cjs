const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const definitions = {}, handlers = {}, deferred = [];
const makeTank = () => ({ amount: 0, type: 'empty', cap: 0, setCap(n) { this.cap = n; }, set(n) { this.amount = n; }, setType(t) { this.type = t; }, display() { throw Error('No displays allowed'); } });
const storage = key => ({ initializeMultiple(entity, count) { assert(entity.scoreboardIdentity, 'Storage needs a scoreboard identity'); entity[key] ??= Array.from({ length: count }, makeTank); assert.equal(count, 2); return entity[key]; } });
const ctx = {
    worldLoaded: true,
    initializeEntity: vm.runInNewContext(read('BP/scripts/DoriosCore/utils/entity.js').match(/export function initializeEntity\(entity\) \{[\s\S]*?\n\}/)[0].replace('export ', '') + '\ninitializeEntity'),
    DoriosLib: { registry: { blockComponent: (id, handler) => { handlers[id] = handler; } } },
    system: { run: cb => deferred.push(cb) },
    FluidStorage: storage('liquids'), GasStorage: storage('gases'),
    EnergyStorage: function(entity) { assert(entity.scoreboardIdentity); return entity.energy ??= makeTank(); },
    registerIOInterface: (id, definition) => { definitions[id] = definition; },
    ensureItemIOConfig: (entity, id) => { entity.itemsIO = definitions[id].items; },
    ensureFluidIOConfig: (entity, id) => { entity.liquidsIO = definitions[id].liquids; },
    ensureGasIOConfig: (entity, id) => { entity.gasesIO = definitions[id].gases; },
};
vm.runInNewContext(read('BP/scripts/machinery/machines/trashCan.js').replace(/^import[\s\S]*?;\s*/gm, ''), ctx);
const handler = handlers['utilitycraft:resource_trash_can'];
let checks = 0;
for (const variant of ['liquid', 'gas', 'energy', 'ultimate']) {
    const definition = JSON.parse(read('BP/blocks/utility_blocks/' + variant + '_trash_can.json'))['minecraft:block'];
    const params = definition.components['utilitycraft:resource_trash_can'];
    const container = { size: 27, items: Array(27).fill('item'), clearAll() { this.items.fill(undefined); } };
    const entity = { typeId: 'utilitycraft:resource_trash_can', isValid: true, runCommand(command) { assert.equal(command, 'scoreboard players set @s energy 0'); this.scoreboardIdentity = { id: 1 }; }, triggerEvent(event) { this.event = event; }, getComponent: id => id === 'minecraft:inventory' ? { container } : undefined, remove() { this.removed = true; } };
    const unrelated = { typeId: 'utilitycraft:machine_area_outline', remove() { throw Error('Removed unrelated entity'); } };
    const dimension = { spawnEntity(id, pos) { assert.equal(id, entity.typeId); assert.deepEqual(JSON.parse(JSON.stringify(pos)), { x: 0.5, y: 0.25, z: 0.5 }); return entity; }, getEntitiesAtBlockLocation: () => [unrelated, entity] };
    const block = { typeId: definition.description.identifier, location: { x: 0, y: 0, z: 0 }, center: () => ({ x: 0.5, y: 0.5, z: 0.5 }), dimension };
    assert.equal(entity.scoreboardIdentity, undefined);
    handler.onPlace({ block }, { params });
    assert(entity.scoreboardIdentity);
    deferred.splice(0).forEach(cb => cb());
    assert.equal(entity.event, 'utilitycraft:' + variant);
    for (const key of ['liquids', 'gases']) {
        if (!params[key]) { assert.equal(entity[key], undefined); continue; }
        assert.equal(entity[key].length, 2);
        assert.deepEqual(Array.from(entity[key + 'IO'].anyInputIndices), [0, 1]);
        assert.deepEqual(Array.from(entity[key + 'IO'].anyOutputIndices), []);
        entity[key].forEach((tank, i) => { assert.equal(tank.cap, 1000000000); tank.set(tank.cap); tank.setType(i ? 'second' : 'first'); });
    }
    if (params.energy) { assert.equal(entity.energy.cap, 1000000000); entity.energy.set(entity.energy.cap); } else assert.equal(entity.energy, undefined);
    if (params.items) { assert.equal(entity.itemsIO.anyInputSlots.length, 27); assert.equal(entity.itemsIO.anyOutputSlots.length, 0); }
    handler.onTick({ block }, { params });
    for (const key of ['liquids', 'gases']) for (const tank of entity[key] ?? []) { assert.equal(tank.amount, 0); assert.equal(tank.type, 'empty'); assert.equal(tank.cap, 1000000000); tank.setType('different'); tank.set(1); }
    if (params.energy) assert.equal(entity.energy.amount, 0);
    if (params.items) assert(container.items.every(x => x === undefined)); else assert(container.items.every(x => x === 'item'));
    handler.onTick({ block }, { params });
    for (const key of ['liquids', 'gases']) for (const tank of entity[key] ?? []) assert.equal(tank.type, 'empty');
    // Recover entities left without a scoreboard identity by the original placement failure.
    entity.scoreboardIdentity = undefined;
    if (entity.liquids) entity.liquids.forEach(tank => { tank.cap = 0; });
    if (entity.gases) entity.gases.forEach(tank => { tank.cap = 0; });
    handler.onTick({ block }, { params });
    deferred.splice(0).forEach(cb => cb());
    assert(entity.scoreboardIdentity);
    for (const key of ['liquids', 'gases']) for (const tank of entity[key] ?? []) assert.equal(tank.cap, 1000000000);
    handler.onPlayerBreak({ block, dimension });assert(entity.removed);
    checks++;
}
const entity = JSON.parse(read('BP/entities/machines/resource_trash_can.json'))['minecraft:entity'];
assert.equal(entity.components['minecraft:collision_box'].width, 0.01);
assert.equal(entity.components['minecraft:collision_box'].height, 0.01);
assert(!entity.components['minecraft:interact']);assert(!entity.components['minecraft:inventory']);
assert.equal(entity.component_groups['utilitycraft:ultimate']['minecraft:inventory'].inventory_size, 27);
assert(!read('BP/scripts/machinery/machines/trashCan.js').includes('.display('));
console.log(`${checks} trash variant lifecycle checks passed; two-type reset, input-only policies, energy/inventory disposal and no-display behavior verified`);

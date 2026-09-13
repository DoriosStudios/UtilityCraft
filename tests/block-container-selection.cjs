const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const strip = s => s.replace(/^import[\s\S]*?;\s*/gm, '').replace(/export /g, '');
const properties = new Map([['utilitycraft:selection_empty', false]]);
const events = {}, scheduled = [], players = [], outlines = [];
let interval, intervalTicks, moves = 0, modes = 0, queries = 0, drops = 0, releases = 0;
const hidden = () => properties.get("utilitycraft:selection_empty");
const block = {
    location: { x: -2, y: 10, z: -3 }, isAir: false,
    center: () => ({ x: -1.5, y: 10.5, z: -2.5 }),
    hasTag: tag => tag === "dorios:machine",
    setPermutation() { throw new Error("Block permutations must never be changed"); },
};
let loaded = true;
const dimension = {
    id: 'overworld', getBlock: () => loaded ? block : undefined,
    getEntitiesAtBlockLocation() { queries++; return [...outlines.filter(e => e.isValid), machine]; },
    spawnEntity(typeId, location) {
        assert.equal(typeId, 'utilitycraft:block_container_outline');
        const entity = { id: 'outline-' + outlines.length, typeId, location, isValid: true,
            getComponent: () => ({ hasTypeFamily: () => false }),
            remove() { this.isValid = false; } };
        outlines.push(entity);
        return entity;
    },
};
block.dimension = dimension;
const machine = {
    id: 'machine', typeId: 'utilitycraft:machine_entity', isValid: true, dimension,
    location: { x: -1.5, y: 10.25, z: -2.5 },
    getComponent: () => ({ hasTypeFamily: family => family === 'utilitycraft:block_container' }),
    getProperty: key => properties.get(key),
    teleport(location) { this.location = location; moves++; },
    triggerEvent(name) { properties.set('utilitycraft:selection_empty', name.endsWith('_empty')); modes++; },
    remove() { this.isValid = false; },
};
const signal = name => ({ subscribe(callback) { events[name] = callback; } });
const context = {
    console,
    world: {
        getAllPlayers: () => players,
        afterEvents: Object.fromEntries(['entitySpawn', 'entityLoad', 'dataDrivenEntityTrigger', 'entityHitEntity'].map(n => [n, signal(n)])),
        beforeEvents: { playerBreakBlock: signal('playerBreakBlock') },
    },
    system: {
        currentTick: 100,
        runInterval(callback, ticks) { interval = callback; intervalTicks = ticks; },
        run(callback) { scheduled.push(callback); },
        runTimeout(callback) { scheduled.push(callback); },
    },
    dropAllItems() { drops++; },
    TickScheduler: { releaseTickGroup() { releases++; } },
};
vm.createContext(context);
vm.runInContext(strip(read('BP/scripts/UtilityCore/blockContainerTarget.js')), context);
vm.runInContext(strip(read('BP/scripts/UtilityCore/blockContainerSelection.js')), context);
assert.equal(intervalTicks, 4);
const flush = () => { while (scheduled.length) scheduled.shift()(); };
const makePlayer = id => ({
    id, typeId: 'minecraft:player', isValid: true, isSneaking: false, dimension,
    overrides: new Set(), entityHits: [], calls: 0,
    getHeadLocation: () => ({ x: -1.5, y: 11, z: -5 }),
    getBlockFromViewDirection() { this.calls++; return this.noTarget ? undefined : { block, faceLocation: { x: 0.5, y: 1, z: 0 } }; },
    getEntitiesFromViewDirection() { this.calls++; return this.entityHits; },
    setPropertyOverrideForEntity(entity) { this.overrides.add(entity.id); },
    removePropertyOverrideForEntity(entity) { this.overrides.delete(entity.id); },
    onScreenDisplay: { setActionBar() {} }, playSound() {},
});
const a = makePlayer('a'), b = makePlayer('b');
players.push(a);
interval();
assert.equal(moves, 1, 'old entity is migrated in place');
assert.equal(a.calls, 2, 'only two raycasts per player per pass');
assert.equal(machine.location.y, 10.001);
const firstOutline = outlines.at(-1);
assert(a.overrides.has(firstOutline.id));
assert(!a.overrides.has(machine.id));
assert.deepEqual(firstOutline.location, block.center());
assert.equal(hidden(), false);
interval();
assert.equal(moves, 1, 'no repeated teleports');
assert.equal(queries, 1, 'cached block lookup');
assert.equal(modes, 0, 'no redundant collision events');
assert.equal(a.calls, 4);
assert.equal(firstOutline.isValid, false, 'previous temporary outline is removed');
assert.equal(outlines.filter(e => e.isValid).length, 1);
a.isSneaking = true;
interval();
assert.equal(hidden(), true);
assert.equal(properties.get('utilitycraft:selection_empty'), true);
assert.equal(outlines.filter(e => e.isValid).length, 0, 'crouching removes the separate outline');
players.push(b);
interval();
assert.equal(hidden(), false, 'standing viewer wins');
const bOutline = outlines.at(-1);
assert(b.overrides.has(bOutline.id));
assert(!a.overrides.has(bOutline.id));
players.pop();
interval();
assert.equal(hidden(), true, 'disconnect restores crouched viewer mining');
assert.equal(bOutline.isValid, false, 'disconnect cleans up the outline');
a.noTarget = true;
interval();
assert.equal(hidden(), false, 'leaving restores entity collision');
a.noTarget = false;
a.entityHits = [{ distance: 1, entity: { id: 'mob', typeId: 'minecraft:pig', isValid: true } }];
interval();
assert.equal(hidden(), false, 'nearby mob obstructs targeting');
a.entityHits = [{ distance: 8, entity: machine }];
interval();
assert.equal(hidden(), true, 'far entity does not hide the nearer block');
const cancel = { block, player: { ...a, isSneaking: false }, cancel: false };
events.playerBreakBlock(cancel);
assert.equal(cancel.cancel, true);
flush();
const allow = { block, player: a, cancel: false };
events.playerBreakBlock(allow);
assert.equal(allow.cancel, false, 'crouched player can mine the real block');
// A near unsupported entity occludes the block and is never migrated.
assert.equal(vm.runInContext('chooseTarget({x:0,y:0,z:0}, {block:{location:{x:0,y:0,z:2}},faceLocation:{x:0,y:0,z:0}}, {distance:3,entity:{id:"behind"}}).entity', context), undefined);
// Exact hit surface distance, negative coordinates, and target ordering.
assert.equal(vm.runInContext('blockHitDistance({x:0,y:0,z:0}, {block:{location:{x:0,y:0,z:3}},faceLocation:{x:0,y:0,z:0}})', context), 3);
assert.equal(vm.runInContext('ownerLocation(containerLocation({x:-3,y:-64,z:-9})).y', context), -64);
// Unavailable chunks must not destroy inventories.
loaded = false;
events.dataDrivenEntityTrigger({ entity: machine });
flush();
assert.equal(drops, 0);
loaded = true;
block.isAir = true;
events.dataDrivenEntityTrigger({ entity: machine });
events.dataDrivenEntityTrigger({ entity: machine });
assert.equal(drops, 0, 'deferred cleanup lets normal breaking finish');
flush();
assert.equal(drops, 1);
assert.equal(releases, 1);
assert.equal(machine.isValid, false);
// Normal destruction removing the entity before the orphan callback cannot drop twice.
machine.isValid = true;
events.dataDrivenEntityTrigger({ entity: machine });
machine.isValid = false;
flush();
assert.equal(drops, 1);
// The reused DoriosCore helper really filters UI tags and clears dropped slots.
const dropSource = read('BP/scripts/DoriosCore/utils/entity.js').match(/export function dropAllItems\(entity\) \{[\s\S]*?\n\}/)[0];
const realDrop = vm.runInNewContext(strip(dropSource) + '\ndropAllItems', { Constants: { UI_ITEM_TAGS: ['utilitycraft:ui'] } });
const item = (typeId, tags) => ({ typeId, hasTag: tag => tags.includes(tag), getTags: () => tags });
const contents = [item('minecraft:diamond', []), item('utilitycraft:bar', ['utilitycraft:ui']), item('utilitycraft:label', ['dorios:ui_label'])];
const dropped = [];
realDrop({ location: {}, dimension: { spawnItem: value => dropped.push(value.typeId) }, getComponent: () => ({ container: { size: contents.length, getItem: i => contents[i], setItem: (i, value) => { contents[i] = value; } } }) });
assert.deepEqual(dropped, ['minecraft:diamond']);
assert.equal(contents[0], undefined);
players.length = 0;
const previousQueries = queries;
interval();
assert.equal(queries, previousQueries, 'no player means no container queries');
const definition = JSON.parse(read('BP/entities/machines/machine_entity.json'))['minecraft:entity'];
for (const group of [definition.components, ...Object.values(definition.component_groups)]) {
    if (group['minecraft:type_family']) assert(group['minecraft:type_family'].family.includes('utilitycraft:block_container'));
}
assert.equal(definition.components['minecraft:inside_block_notifier'].block_list[0].entered_block_event.event, 'utilitycraft:container_check_air');
assert.equal(definition.components['minecraft:collision_box'].height, 1);
assert.equal(definition.component_groups['utilitycraft:selection_empty']['minecraft:collision_box'].width, 0);
assert.equal(definition.description.properties['utilitycraft:selection_visible'], undefined);
const outlineDefinition = JSON.parse(read('BP/entities/machines/block_container_outline.json'))['minecraft:entity'];
assert.equal(outlineDefinition.description.properties['utilitycraft:selection_visible'].default, false);
assert.equal(outlineDefinition.description.properties['utilitycraft:selection_visible'].client_sync, true);
assert.equal(outlineDefinition.components['minecraft:collision_box'].height, 0);
assert.equal(outlineDefinition.components['minecraft:inventory'], undefined);
assert(outlineDefinition.components['minecraft:timer'].time * 20 > intervalTicks);
assert.equal(outlineDefinition.component_groups.despawn['minecraft:instant_despawn'] !== undefined, true);
const client = JSON.parse(read('RP/entity/block_container_outline.json'))['minecraft:client_entity'].description;
assert.equal(client.identifier, outlineDefinition.description.identifier);
assert(!fs.existsSync(path.join(root, "RP/entity/machine_entity.json")));
const geometry = JSON.parse(read('RP/models/entity/block_container_outline.geo.json'))['minecraft:geometry'][0];
assert.equal(geometry.description.identifier, client.geometry.default);
assert.equal(geometry.description.visible_bounds_width, 4);
assert.equal(client.render_controllers[0], 'controller.render.default');
assert(fs.existsSync(path.join(root, 'RP', client.textures.default + '.png')));
const animation = JSON.parse(read('RP/animations/block_container_outline.animation.json')).animations[client.animations.size];
assert(animation.bones.outline.scale.includes('utilitycraft:selection_visible'));
// Preserve ATA's full outline implementation, including UVs and camera-distance scaling.
// Only names/paths and the lifetime needed for UC's four-tick refresh may differ.
const ataRoot = path.join(root, '../ATA/packs/advanced_furnaces-1.5');
const adaptATA = source => source
    .replaceAll('rc_af:outline_selection', 'utilitycraft:block_container_outline')
    .replaceAll('rc_af:visible', 'utilitycraft:selection_visible')
    .replaceAll('rc_af:despawn', 'utilitycraft:outline_expire')
    .replaceAll('geometry.rc_af.outline_selection', 'geometry.utilitycraft_block_container_outline')
    .replaceAll('animation.rc_af.outline_selection.size', 'animation.utilitycraft.block_container_outline')
    .replaceAll('textures/rc_af/common/entity/collision', 'textures/entity/block_container_outline')
    .replaceAll('rc_fb:outline', 'utilitycraft:outline');
for (const [source, destination] of [
    ['rc_af_bp/entities/rc_af/outline_selection.bpe.json', 'BP/entities/machines/block_container_outline.json'],
    ['rc_af_rp/entity/rc_af/outline_selection.rpe.json', 'RP/entity/block_container_outline.json'],
    ['rc_af_rp/animations/rc_af/outline_selection.animation.json', 'RP/animations/block_container_outline.animation.json'],
    ['rc_af_rp/models/entity/outline_selection.geo.json', 'RP/models/entity/block_container_outline.geo.json'],
]) {
    const expected = JSON.parse(adaptATA(fs.readFileSync(path.join(ataRoot, source), 'utf8')));
    if (expected['minecraft:entity']) expected['minecraft:entity'].components['minecraft:timer'].time = 0.3;
    assert.deepEqual(JSON.parse(read(destination)), expected, destination);
}
assert.deepEqual(fs.readFileSync(path.join(root, 'RP/textures/entity/block_container_outline.png')),
    fs.readFileSync(path.join(ataRoot, 'rc_af_rp/textures/rc_af/common/entity/collision.png')));
console.log('PASS: global selection, migration, cached lookup, multiplayer, obstruction, transitions and safe orphan cleanup');

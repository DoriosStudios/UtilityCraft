const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const strip = s => s.replace(/^import[\s\S]*?;\s*/gm, '').replace(/export /g, '');
const properties = new Map([['utilitycraft:selection_empty', false]]);
const scheduled = [], players = [], outlines = [];
let hitEntityHandler, interval, intervalTicks, moves = 0, modes = 0, queries = 0, drops = 0, releases = 0;
const hidden = () => properties.get("utilitycraft:selection_empty");
const block = {
    location: { x: -2, y: 10, z: -3 }, isAir: false,
    center: () => ({ x: -1.5, y: 10.5, z: -2.5 }),
    hasTag() { throw new Error('Selection must not require block tags'); },
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
    familyEnabled: true, scale: 1,
    getComponent(type) {
        if (type === 'minecraft:scale') return { value: this.scale };
        return { hasTypeFamily: family => this.familyEnabled && family === 'utilitycraft:block_container' };
    },
    getProperty: key => properties.get(key),
    teleport(location) { this.location = location; moves++; },
    triggerEvent(name) { properties.set('utilitycraft:selection_empty', name.endsWith('_empty')); modes++; },
    remove() { this.isValid = false; },
};
const context = {
    console,
    world: {
        getAllPlayers: () => players,
        afterEvents: { entityHitEntity: { subscribe(callback) { hitEntityHandler = callback; } } },
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
assert.equal(intervalTicks, 2);
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
assert.equal(machine.location.y, 10);
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
assert.equal(hidden(), true, 'entity hits cannot obstruct block selection');
a.entityHits = [{ distance: 8, entity: machine }];
interval();
assert.equal(hidden(), true, 'far entity does not hide the nearer block');
// Entity definitions are the complete addon opt-in; no ID registry or block tags.
const addonEntities = {
    'UtilityCraft-Digital-Storage': ['blueprint_terminal', 'crafting_terminal', 'export_buffer', 'import_buffer', 'storage_cell_drive', 'storage_center', 'storage_terminal', 'storage_transfer_station'],
    'UtilityCraft-Heavy-Machinery': ['combustion_chamber', 'gas_turbine', 'multiblock_machine', 'nuclear_reactor', 'thermo_reactor', 'power_condenser'],
};
const readAddon = (repo, name) => JSON.parse(fs.readFileSync(path.join(root, '..', repo, 'BP/entities', name + '.json'), 'utf8').replace(/^\uFEFF/, '').replace(/\/\/[^\r\n]*/g, ''))['minecraft:entity'];
for (const [repo, names] of Object.entries(addonEntities)) for (const name of names) {
    const e = readAddon(repo, name);
    for (const group of [e.components, ...Object.values(e.component_groups)]) {
        if (group['minecraft:type_family']) assert(group['minecraft:type_family'].family.includes('utilitycraft:block_container'));
    }
    assert.equal(e.components['minecraft:collision_box'].height, 1);
    assert.equal(e.component_groups['utilitycraft:selection_empty']['minecraft:collision_box'].width, 0);
    assert.equal(e.events['utilitycraft:selection_full'].set_property['utilitycraft:selection_empty'], false);
    assert.equal(e.events['utilitycraft:selection_empty'].set_property['utilitycraft:selection_empty'], true);
    machine.typeId = e.description.identifier;
    a.entityHits = [{ distance: 1, entity: machine }];
    machine.location.y = 10.25;
    interval();
    assert.equal(machine.location.y, 10, 'addon entity migrates when targeted');
    a.isSneaking = false; interval(); assert.equal(hidden(), false);
    a.isSneaking = true; interval(); assert.equal(hidden(), true);
    a.entityHits = []; interval(); assert.equal(hidden(), true, 'hidden addon entity resolves from its block');
    if (repo.includes('Digital')) assert.equal(e.description.properties['utilitycraft:orphan_cleanup'].default, false);
    else assert.equal(e.components['minecraft:inside_block_notifier'].block_list[0].entered_block_event.event, 'utilitycraft:container_check_air');
}
machine.typeId = 'another_addon:unknown_controller';
interval(); assert.equal(hidden(), true, 'an arbitrary new identifier works with the family');
machine.scale = 0.1;
interval(); assert.equal(hidden(), false, 'inactive multiblock keeps its scale-based block access');
machine.scale = 1;
machine.familyEnabled = false;
const oldLocation = machine.location;
interval(); assert.equal(machine.location, oldLocation, 'nonparticipants are not moved');
machine.familyEnabled = true;
for (const [repo, names] of Object.entries({
    'UtilityCraft-Digital-Storage': ['storage_vault', 'wireless_storage_terminal'],
    'UtilityCraft-Heavy-Machinery': ['gas_turbine_gas', 'gas_turbine_rotor'],
})) for (const name of names) assert(!readAddon(repo, name).components['minecraft:type_family'].family.includes('utilitycraft:block_container'));
// Negative coordinates remain inside the owning block.
assert.equal(vm.runInContext('ownerLocation(containerLocation({x:-3,y:-64,z:-9})).y', context), -64);
// Orphan cleanup is triggered by discovery in the global pass, not world events.
a.entityHits = [{ distance: 1, entity: machine }];
// Unavailable chunks must not destroy inventories.
loaded = false;
interval();
flush();
assert.equal(drops, 0);
loaded = true;
block.isAir = true;
properties.set('utilitycraft:orphan_cleanup', false);
interval(); flush();
assert.equal(drops, 0, 'virtual inventories retain addon-owned cleanup');
assert.equal(machine.isValid, true);
properties.delete('utilitycraft:orphan_cleanup');
interval();
interval();
assert.equal(drops, 0, 'deferred cleanup lets normal breaking finish');
flush();
assert.equal(drops, 1);
assert.equal(releases, 1);
assert.equal(machine.isValid, false);
// Normal destruction removing the entity before the orphan callback cannot drop twice.
machine.isValid = true;
interval();
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
console.log('PASS: global selection with hit feedback only, discovery migration, cached lookup, multiplayer and safe orphan cleanup');

// Normal and restored hitboxes use the same full size in all three packs.
const fullDefinitions = [definition, ...Object.entries(addonEntities).flatMap(([repo, names]) => names.map(name => readAddon(repo, name)))];
for (const entity of fullDefinitions) {
    for (const box of [entity.components['minecraft:collision_box'], entity.component_groups['utilitycraft:selection_full']['minecraft:collision_box']]) {
        assert.equal(box.width, 1);
        assert.equal(box.height, 1);
    }
    const hiddenBox = entity.component_groups['utilitycraft:selection_empty']['minecraft:collision_box'];
    assert.equal(hiddenBox.width, 0);
    assert.equal(hiddenBox.height, 0);
}
console.log('PASS: all 15 compatible entities have 1 x 1 normal and 0 x 0 hidden hitboxes');

// Even if the block query returns a neighbor first, only the owner is selected.
machine.isValid = true;
machine.location = {x:-1.5,y:10,z:-2.5};
a.noTarget = false;
a.entityHits = [];
a.isSneaking = true;
players.push(a);
block.isAir = false;
const neighbor = {...machine, id:'neighbor', location:{x:-1.5,y:11,z:-2.5},
    triggerEvent() { throw new Error('Neighbor must not be selected'); }};
dimension.getEntitiesAtBlockLocation = () => [neighbor, machine];
interval();
assert.equal(vm.runInContext('viewers.get("a").entity.id', context), machine.id);
// Alternating visible entity hits never changes the block-driven target or mode.
const modeCount = modes;
for (let i = 0; i < 10; i++) {
    a.entityHits = [{distance:i % 2 ? 0.1 : 3, entity:i % 2 ? neighbor : machine}];
    interval();
    assert.equal(vm.runInContext('viewers.get("a").entity.id', context), machine.id);
    assert.equal(hidden(), true);
}
assert.equal(modes, modeCount, 'entity hit changes cannot toggle either machine');
// Without a block hit, a healthy entity cannot become a selection target.
a.noTarget = true;
interval();
assert.equal(vm.runInContext('viewers.has("a")', context), false);
assert.equal(hidden(), false);
// A failed cleanup raycast must not suppress valid block selection.
a.noTarget = false;
const entityRaycast = a.getEntitiesFromViewDirection;
a.getEntitiesFromViewDirection = () => { throw new Error('unavailable cleanup raycast'); };
interval();
assert.equal(vm.runInContext('viewers.get("a").entity.id', context), machine.id);
a.getEntitiesFromViewDirection = entityRaycast;
console.log('PASS: block-only selection ignores alternating entity hits and cleanup failures');

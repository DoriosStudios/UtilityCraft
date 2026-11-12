const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const toolId = 'utilitycraft:copy_paste_tool';
const property = 'utilitycraft:copy_paste_data';
const script = transformSync(fs.readFileSync(path.join(__dirname,
  '../BP/scripts/machinery/copyPasteTool.js'), 'utf8'), { format: 'cjs' }).code;

function setup() {
  const callbacks = {}, queued = [], intervals = [], messages = [], sounds = [];
  const signal = name => ({ subscribe(fn) { callbacks[name] = fn; } });
  let stored, component, shown = 0, closeForm;
  const item = { typeId: toolId, getDynamicProperty: () => stored,
    setDynamicProperty: (_, value) => { stored = value; } };
  const inventory = { size: 9, getItem: () => item, setItem() {} };
  const dimension = { id: 'overworld', getBlock: () => block,
    getEntitiesAtBlockLocation: () => [entity] };
  const block = { typeId: 'utilitycraft:test_generator', location: { x: -3, y: 2, z: 4 },
    dimension, isAir: false, permutation: { getState() {} }, hasTag: () => false };
  const families = new Set(['utilitycraft:block_container', 'dorios:energy_source']);
  const entity = { isValid: true, dimension, location: { x: -2.5, y: 2, z: 4.5 },
    mode: 'round', getDynamicProperty() { return this.mode; },
    setDynamicProperty(_, mode) { this.mode = mode; },
    getComponent: () => ({ hasTypeFamily: family => families.has(family) }) };
  const player = { id: 'player', typeId: 'minecraft:player', isValid: true,
    selectedSlotIndex: 0, isSneaking: false, dimension,
    getComponent: () => ({ container: inventory }),
    getBlockFromViewDirection: () => ({ block }), getEntitiesFromViewDirection: () => [],
    onScreenDisplay: { setActionBar: value => messages.push(value) }, playSound: sound => sounds.push(sound) };
  const system = { currentTick: 100, run: fn => queued.push(fn),
    runInterval: fn => intervals.push(fn) };
  const world = { getAllPlayers: () => [player],
    beforeEvents: { playerInteractWithBlock: signal('block'), playerInteractWithEntity: signal('entity') },
    afterEvents: { playerLeave: signal('leave') } };
  class Form {
    title() { return this; } body() { return this; } button() { return this; }
    show() { shown++; return new Promise(resolve => { closeForm = resolve; }); }
  }
  const directions = ['north', 'south', 'east', 'west', 'up', 'down'];
  const defaults = new Proxy({}, { get: () => () => undefined });
  const modules = {
    '@minecraft/server': { system, world },
    '@minecraft/server-ui': { ActionFormData: Form },
    'DoriosLib/index.js': { registry: { itemComponent: (_, value) => { component = value; } },
      text: { formatIdentifier: value => value } },
    '../DoriosCore/utils/directions.js': { DIRECTIONS: directions, RELATIVE_IO_FACES: directions,
      getBlockFacingDirection: () => 'north', resolveRelativeFaceDirection: (_, face) => face },
    '../UtilityCore/blockContainerTarget.js': { BLOCK_CONTAINER_FAMILY: 'utilitycraft:block_container',
      SELECTION_REACH: 6, ownerLocation: p => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) },
    '../DoriosCore/machinery/outputTracker.js': { OutputTracker: defaults },
  };
  vm.runInNewContext(script, { require: id => modules[id] ?? defaults, console });
  return { player, block, entity, dimension, families, system, messages, sounds, item,
    get document() { return stored && JSON.parse(stored); },
    set document(value) { stored = JSON.stringify(value); },
    get shown() { return shown; }, close: () => closeForm({ canceled: true }),
    air() { player.getBlockFromViewDirection = () => undefined; },
    use() { component.onUse({ source: player }); },
    interact(kind, overrides = {}) {
      const event = { player, itemStack: item, target: entity, block, isFirstEvent: true, cancel: false, ...overrides };
      callbacks[kind](event);
      return event;
    },
    tick() { system.currentTick++; for (const fn of queued.splice(0)) fn(); },
    hud() { intervals.forEach(fn => fn()); },
  };
}

for (const kind of ['block', 'entity']) {
  for (const sneaking of [false, true]) {
    test(`${kind}: copy and paste while ${sneaking ? 'sneaking' : 'standing'} cancel native UI`, () => {
      const h = setup();
      h.player.isSneaking = sneaking;
      assert.equal(h.interact(kind).cancel, true);
      assert.equal(h.document, undefined, 'before-event must not mutate inventory');
      h.tick();
      assert.equal(h.document.copied.sections.energyTransfer.mode, 'round');
      h.document = { ...h.document, mode: 'paste' };
      h.entity.mode = 'nearest';
      h.system.currentTick += 3;
      assert.equal(h.interact(kind).cancel, true);
      h.tick();
      assert.equal(h.entity.mode, 'round');
      assert.equal(h.shown, 0);
      assert.deepEqual(h.sounds, ['random.orb', 'place.iron']);
    });
  }
}

test('overlapping callbacks and held block events execute once', () => {
  const h = setup();
  h.player.isSneaking = true;
  h.use();
  h.interact('entity');
  h.interact('block');
  h.tick();
  h.interact('entity');
  assert.equal(h.interact('block', { isFirstEvent: false }).cancel, true);
  h.tick();
  assert.deepEqual(h.sounds, ['random.orb']);
  assert.equal(h.shown, 0);
});

test('only sneaking in air opens a single menu; active forms suppress new actions', async () => {
  const h = setup();
  h.air();
  h.use(); h.tick();
  assert.equal(h.shown, 0);
  h.player.isSneaking = true;
  h.use(); h.use(); h.tick();
  assert.equal(h.shown, 1);
  h.system.currentTick += 10;
  h.use(); h.interact('block'); h.tick();
  assert.equal(h.shown, 1);
  assert.equal(h.document, undefined);
  h.close();
  await new Promise(resolve => setImmediate(resolve));
  h.system.currentTick += 3;
  h.interact('entity'); h.tick();
  assert(h.document.copied);
});

test('targets never open settings, including unrelated entities', () => {
  const h = setup();
  h.player.isSneaking = true;
  h.use(); h.tick();
  h.air();
  h.player.getEntitiesFromViewDirection = () => [{ entity: h.entity }];
  h.use(); h.tick();
  assert.equal(h.shown, 0);
  h.families.clear();
  assert.equal(h.interact('entity').cancel, false);
});

test('a targeted interaction takes priority over a pending air callback', () => {
  const h = setup();
  h.air(); h.player.isSneaking = true;
  h.use(); h.interact('entity'); h.tick();
  assert(h.document.copied);
  assert.equal(h.shown, 0);
});

test('deferred actions stop if the player switches slots, dimensions, or the target changes', () => {
  for (const change of [
    h => h.player.selectedSlotIndex++,
    h => { h.player.dimension = { id: 'nether' }; },
    h => { h.block.typeId = 'minecraft:stone'; },
    h => { h.item.typeId = 'minecraft:stick'; },
    h => { h.player.isValid = false; },
  ]) {
    const h = setup();
    h.interact('entity'); change(h); h.tick();
    assert.equal(h.document, undefined);
  }
});

test('other tools and previously canceled interactions are left alone', () => {
  const h = setup();
  for (const kind of ['block', 'entity']) {
    assert.equal(h.interact(kind, { itemStack: { typeId: 'utilitycraft:wrench' } }).cancel, false);
    h.interact(kind, { cancel: true });
  }
  h.tick();
  assert.equal(h.document, undefined);
});

test('held mode display preserves copy feedback for three seconds', () => {
  const h = setup();
  h.hud();
  assert.equal(h.messages.at(-1).rawtext.at(-1).translate, 'ui.utilitycraft:copy_paste_tool.mode_copy');
  h.interact('entity'); h.tick();
  const feedback = h.messages.at(-1);
  h.hud();
  assert.equal(h.messages.at(-1), feedback);
  h.system.currentTick += 60;
  h.document = { ...h.document, mode: 'paste' };
  h.hud();
  assert.equal(h.messages.at(-1).rawtext.at(-1).translate, 'ui.utilitycraft:copy_paste_tool.mode_paste');
});

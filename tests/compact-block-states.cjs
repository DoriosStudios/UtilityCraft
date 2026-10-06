const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(process.env.UC_TEST_ROOT || path.join(__dirname, '..'));
const namespace = process.env.UC_TEST_NAMESPACE || 'utilitycraft';
const read = file => fs.readFileSync(path.join(root, process.env.UC_TEST_SCRIPT_PREFIX && file.startsWith('BP/scripts/') ? file.replace('BP/scripts/', process.env.UC_TEST_SCRIPT_PREFIX) : file), 'utf8').replace(/\r\n/g, '\n');
const strip = text => text.replace(/^import[^\n]*\r?\n/gm, '').replace(/^export /gm, '');
const state = name => `${namespace}:${name}`;
function runtime(store = new Map()) {
    const handlers = {}, given = [], actions = [];
    let hand, formResult = { canceled: true };
    const context = vm.createContext({
        world: { getDynamicProperty: k => store.get(k), setDynamicProperty(k, v) { v === undefined ? store.delete(k) : store.set(k, v); } },
        DoriosLib: { registry: { blockComponent(id, h) { handlers[id.split(':')[1]] = h; } },
            block: { getState: (b, k) => b.permutation.getState(k), setState: (b, k, v) => b.setPermutation(b.permutation.withState(k, v)) },
            player: { giveItem(p, item) { given.push(item.item); } } },
        ItemStack: class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } },
        ModalFormData: class { title() { return this; } toggle() { return this; } slider() { return this; } async show() { return formResult; } },
    });
    vm.runInContext(strip(read('BP/scripts/blocks/compactState.js')), context);
    for (const kind of ['mortar', 'crucible', 'fan']) vm.runInContext(strip(read(`BP/scripts/blocks/${kind}.js`)), context);
    const player = { isSneaking: false, getComponent: () => ({ getEquipment: () => hand }), runCommand(c) { actions.push(c); }, onScreenDisplay: { setActionBar() {} } };
    function permutation(states) { return { getState: key => states[key], withState: (k, v) => permutation({ ...states, [k]: v }) }; }
    function block(kind, dimension = 'minecraft:overworld', location = { x: -12, y: 64, z: 3 }) {
        const b = { typeId: state(kind), isValid: true, location, heat: 'minecraft:torch',
            permutation: permutation({ [state('cobble')]: 0, [state('lava')]: 0, [state('content')]: 0, [state('pestle_frame')]: 0, [state('range')]: 0, [state('state')]: false, 'minecraft:facing_direction': 'north' }),
            setPermutation(p) { this.permutation = p; }, below() { return { typeId: this.heat }; },
            dimension: { id: dimension, playSound() {}, spawnItem() {}, getBlock: () => ({ typeId: 'minecraft:air' }), getEntitiesAtBlockLocation: () => [] } };
        return b;
    }
    return { context, store, handlers, given, actions, block,
        content: b => b.typeId === state('crucible') ? [b.permutation.getState(state('cobble')), b.permutation.getState(state('lava'))] : Array.from(context.readContent(b)),
        setContent: (b, a, f) => b.typeId === state('crucible') ? b.setPermutation(b.permutation.withState(state('cobble'), a).withState(state('lava'), f)) : context.writeContent(b, a, f),
        progress: (b, kind, max = 15) => context.readBlockValue(b, kind, max),
        interact(b, item) { hand = item ? { typeId: item } : undefined; handlers[b.typeId.split(':')[1]].onPlayerInteract({ block: b, player }); },
        form(value) { formResult = { formValues: value }; }
    };
}

test('mortar keeps empty rotations independent and requires eight loaded turns per leaf', () => {
    const r = runtime(), b = r.block('mortar');
    for (let i = 0; i < 3; i++) r.interact(b);
    for (let i = 0; i < 4; i++) r.interact(b, 'minecraft:oak_leaves');
    r.interact(b, 'minecraft:oak_leaves');
    assert.deepEqual(r.content(b), [4, 0]);
    for (let i = 0; i < 7; i++) r.interact(b);
    assert.deepEqual(r.content(b), [4, 0]);
    // Recreate the script runtime with only persistent world data retained.
    const resumed = runtime(r.store);
    resumed.interact(b);
    assert.deepEqual(resumed.content(b), [3, 1]);
    assert.equal(b.permutation.getState(state('pestle_frame')), 3);
    for (let i = 0; i < 24; i++) resumed.interact(b);
    assert.deepEqual(resumed.content(b), [0, 4]);
    resumed.interact(b, 'minecraft:bucket');
    assert.deepEqual(resumed.content(b), [0, 0]);
    assert.deepEqual(resumed.given, ['minecraft:water_bucket']);
    assert.equal(r.store.size, 0);
});

test('crucible preserves all heat rates, input capacity and bucket interactions', () => {
    for (const [heat, rate] of [['minecraft:torch', 1], ['minecraft:fire', 2], ['minecraft:soul_fire', 3], ['minecraft:lava', 4], [state('blaze_block'), 6]]) {
        const r = runtime(), b = r.block('crucible'); b.heat = heat;
        r.interact(b, 'minecraft:netherrack');
        r.interact(b, 'minecraft:cobblestone');
        assert.deepEqual(r.content(b), [4, 0]);
        for (let i = 0; i < Math.ceil(16 / rate) - 1; i++) r.handlers.crucible.onTick({ block: b });
        assert.deepEqual(r.content(b), [4, 0]);
        runtime(r.store).handlers.crucible.onTick({ block: b });
        assert.deepEqual(r.content(b), [3, 1]);
        for (let i = 0; i < Math.ceil(16 / rate) * 3; i++) r.handlers.crucible.onTick({ block: b });
        r.interact(b, 'minecraft:bucket');
        assert.deepEqual(r.content(b), [0, 0]);
        assert.deepEqual(r.given, ['minecraft:lava_bucket']);
        r.interact(b, 'minecraft:lava_bucket');
        assert.deepEqual(r.content(b), [0, 4]);
        r.interact(b, 'minecraft:water_bucket');
        assert.deepEqual(r.content(b), [0, 0]);
    }
});

test('persistent values are isolated by dimension, coordinates and block kind, and cleared on break/place', () => {
    const r = runtime();
    for (const kind of ['mortar', 'crucible', 'fan']) {
        const b = r.block(kind), otherDim = r.block(kind, 'minecraft:nether'), otherPos = r.block(kind, 'minecraft:overworld', { x: -11, y: 64, z: 3 });
        r.context.writeBlockValue(b, kind, 3);
        assert.equal(r.progress(otherDim, kind), 0); assert.equal(r.progress(otherPos, kind), 0);
        r.handlers[kind].onBreak({ block: b }); assert.equal(r.progress(b, kind), 0);
        r.context.writeBlockValue(b, kind, 5); r.handlers[kind].onPlace({ block: b }); assert.equal(r.progress(b, kind), 0);
    }
    assert.equal(r.store.size, 0);
});

test('fan persists its selected range, resets excessive range after upgrade removal and ignores canceled forms', async () => {
    const r = runtime(), b = r.block('fan');
    b.setPermutation(b.permutation.withState(state('range'), 4));
    r.form([true, 11]); r.interact(b); await Promise.resolve();
    assert.equal(r.progress(b, 'fan'), 11);
    const resumed = runtime(r.store);
    resumed.interact(b); await Promise.resolve();
    assert.equal(resumed.progress(b, 'fan'), 11);
    b.setPermutation(b.permutation.withState(state('range'), 0));
    resumed.handlers.fan.onTick({ block: b });
    assert.equal(resumed.progress(b, 'fan'), 3);
});

test('fluid extraction drains only whole lava levels and preserves queued cobble', () => {
    const r = runtime(), b = r.block('crucible'); r.setContent(b, 2, 2);
    const source = read('BP/scripts/UtilityCore/networks/fluids.js');
    const functions = source.slice(source.indexOf('function readSpecialFluidSource('), source.indexOf('/** @param {Block} block */\nfunction getAttachedFluidEndpoint'));
    r.context.safeGetBlock = () => b;
    vm.runInContext(functions, r.context);
    assert.equal(r.context.readSpecialFluidSource(b.dimension, b.location).amount, 500);
    r.context.drainSpecialFluidSource(b, 250);
    assert.deepEqual(r.content(b), [2, 1]);
    r.context.drainSpecialFluidSource(b, 100);
    assert.deepEqual(r.content(b), [2, 1]);
    r.context.drainSpecialFluidSource(b, 1000);
    assert.deepEqual(r.content(b), [2, 0]);
    assert.equal(r.context.readSpecialFluidSource(b.dimension, b.location), undefined);
});

const blockFiles = { mortar: 'utility_blocks/mortar.json', crucible: 'addons/basics/crucible.json', fan: 'machinery/mob_grinding/fan.json' };
function definition(kind) { return JSON.parse(read('BP/blocks/' + blockFiles[kind]).replace(/\/\/[^\n]*/g, '').replace(/,\s*([}\]])/g, '$1'))['minecraft:block']; }
function evaluate(expr, states) { return Function('return (' + expr.replace(/q.block_state\('([^']+)'\)/g, (_, key) => JSON.stringify(states[key])).replaceAll('math.max', 'Math.max') + ')')(); }

test('compact content preserves every mortar level, material and frame and crucible material/light/collision', () => {
    const r = runtime(), b = r.block('mortar'), mortar = definition('mortar'), crucible = definition('crucible');
    for (let solid = 0; solid <= 4; solid++) for (let fluid = 0; fluid <= 4 - solid; fluid++) {
        r.setContent(b, solid, fluid); assert.deepEqual(r.content(b), [solid, fluid]);
        const states = { [state('cobble')]: solid, [state('lava')]: fluid, [state('content')]: b.permutation.getState(state('content')) };
        const bones = mortar.components['minecraft:geometry'].bone_visibility;
        for (let n = 1; n <= 4; n++) assert.equal(Boolean(evaluate(bones['content_' + n], states)), Math.max(solid, fluid) === n);
        for (let frame = 0; frame < 8; frame++) for (let n = 0; n < 8; n++) assert.equal(Boolean(evaluate(bones['pestle_' + n], { ...states, [state('pestle_frame')]: frame })), frame === n);
        const water = mortar.permutations.find(p => p.components['minecraft:material_instances']);
        assert.equal(Boolean(evaluate(water.condition, states)), fluid > 0 && fluid >= solid);
        const selected = crucible.permutations.filter(p => evaluate(p.condition, states));
        assert.equal(selected.length, solid + fluid === 0 ? 0 : 1);
        if (selected.length) {
            const c = selected[0].components, lava = fluid > 0 && fluid >= solid, level = lava ? fluid : solid;
            assert.equal(c['minecraft:material_instances']['*'].texture, `utilitycraft_crucible_${lava ? 'lava' : 'cobble'}_${level}`);
            assert.equal(c['minecraft:light_emission'] ?? 0, lava ? [0, 3, 7, 11, 15][fluid] : 0);
            assert.equal(c['minecraft:collision_box'][0].size[1], lava ? 6 : [0, 9, 11, 13, 15][solid]);
        }
    }
});

test('permutation budgets are 480, 25 and 60', () => {
    for (const [kind, directions, expected] of [['mortar', 4, 480], ['crucible', 1, 25], ['fan', 6, 60]]) {
        assert.equal(Object.values(definition(kind).description.states).reduce((n, values) => n * values.length, directions), expected);
    }
});

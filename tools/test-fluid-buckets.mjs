import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const withoutImports = source => source.replace(/^import .*;\r?\n/gm, '');
const types = ['heavy_water', 'sulfuric_acid', 'xp', 'crude_oil', 'petroleum', 'diesel', 'saline_coolant'];
let items, holders;
vm.runInNewContext(withoutImports(read('BP/scripts/config/fluids/items.js')), {
    DoriosLib: { registry: {
        registerFluidItem(value) { items = value; },
        registerFluidHolder(value) { holders = value; },
    } },
});
const FluidStorage = vm.runInNewContext(withoutImports(read('BP/scripts/DoriosCore/machinery/fluidStorage.js'))
    .replace('export class FluidStorage', 'class FluidStorage') + '\nFluidStorage;', {
    Constants: { EMPTY_FLUID_TYPE: 'empty' },
});
FluidStorage.itemFluidStorages = items;
FluidStorage.itemFluidHolders = holders;
// Keep the production transfer methods; replace only the world-backed storage.
function tank(type, amount, capacity = 2000) {
    return Object.assign(Object.create(FluidStorage.prototype), {
        type, amount, capacity,
        getType() { return this.type; },
        setType(value) { this.type = value; },
        get() { return this.amount; },
        getFreeSpace() { return this.capacity - this.amount; },
        add(value) { this.amount += value; },
        consume(value) { this.amount -= value; },
    });
}
const atlas = json('RP/textures/item_texture.json').texture_data;
const catalog = read('BP/item_catalog/crafting_item_catalog.json');
const base = PNG.sync.read(fs.readFileSync('RP/textures/items/misc/bucket_water.png'));
for (const type of types) {
    const id = `utilitycraft:${type}_bucket`;
    const item = json(`BP/items/utility_items/${type}_bucket.json`)['minecraft:item'];
    assert.equal(item.description.identifier, id);
    assert.equal(item.components['minecraft:max_stack_size'], 1);
    assert.ok(catalog.includes(`"${id}"`));
    const png = PNG.sync.read(fs.readFileSync(`RP/${atlas[item.components['minecraft:icon']].textures}.png`));
    assert.equal(png.width, 16);
    assert.equal(png.height, 16);
    if (type !== 'saline_coolant') {
        for (let i = 0; i < base.data.length; i += 4) {
            const [r, g, b, a] = base.data.subarray(i, i + 4);
            assert.equal(png.data[i + 3], a);
            if (!(a && b > r + 20 && b > g + 20)) {
                assert.deepEqual(png.data.subarray(i, i + 4), base.data.subarray(i, i + 4));
            }
        }
        assert.notDeepEqual(png.data, base.data);
    }
    for (const locale of ['en_US', 'es_MX', 'pt_BR']) {
        const lines = read(`RP/texts/${locale}.lang`).split(/\r?\n/).filter(line => line.startsWith(`item.${id}=`));
        assert.equal(lines.length, 1);
        assert.ok(lines[0].endsWith('\\n\u00a7o\u00a79@UtilityCraft'));
        assert.ok(!lines[0].includes('?'));
    }
    const full = tank(type, 1500);
    assert.equal(full.fluidItem('minecraft:bucket'), id);
    assert.equal(full.get(), 500);
    assert.equal(full.fluidItem(id), 'minecraft:bucket');
    assert.equal(full.get(), 1500);
    const short = tank(type, 999);
    assert.equal(short.fluidItem('minecraft:bucket'), false);
    assert.equal(short.get(), 999);
    const blocked = tank(type, 1500);
    assert.equal(blocked.fluidItem(id), false);
    assert.equal(blocked.get(), 1500);
    const incompatible = tank('water', 1000);
    assert.equal(incompatible.fluidItem(id), false);
    assert.equal(incompatible.get(), 1000);
    const empty = tank('empty', 0);
    assert.equal(empty.fluidItem(id), 'minecraft:bucket');
    assert.equal(empty.getType(), type);
    assert.equal(empty.get(), 1000);
    console.log(`${type}: assets, names, round trip and blocked transfers passed`);
}
for (const type of ['water', 'lava', 'milk']) {
    assert.equal(holders['minecraft:bucket'].types[type], `minecraft:${type}_bucket`);
}
assert.equal(holders['minecraft:glass_bottle'].required, 8);
assert.equal(holders['minecraft:glass_bottle'].types.xp, 'minecraft:experience_bottle');
assert.equal(items['minecraft:experience_bottle'].amount, 8);
console.log('Vanilla buckets and 8 mB experience bottles preserved.');

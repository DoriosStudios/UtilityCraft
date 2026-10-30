const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p).replace(/^\s*\/\/.*$/gm, ''));
const ids = ['energy_cell', 'fluid_cell', 'gas_cell', 'processing_module', 'efficiency_module', 'speed_module'];
const files = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);

test('shared components can be crafted and rendered with UtilityCraft alone', () => {
    const defined = new Set();
    for (const file of [...files('BP/items'), ...files('BP/blocks')].filter(p => p.endsWith('.json'))) {
        const data = json(file);
        const description = (data['minecraft:item'] || data['minecraft:block'])?.description;
        if (description) defined.add(description.identifier);
    }
    const blocks = json('RP/blocks.json');
    const atlas = json('RP/textures/terrain_texture.json').texture_data;
    const catalog = json('BP/item_catalog/crafting_item_catalog.json')['minecraft:crafting_items_catalog'];
    const entries = catalog.categories.flatMap(c => c.groups.flatMap(g => g.items));
    for (const id of ids) {
        const typeId = `utilitycraft:${id}`;
        const block = json(`BP/blocks/multiblock/components/${id}.json`)['minecraft:block'];
        assert.equal(block.description.identifier, typeId);
        assert('tag:dorios:multiblock_component' in block.components, `${id}: missing scanner tag`);
        assert(blocks[typeId], `${id}: missing RP registration`);
        assert.equal(entries.filter(entry => entry === typeId).length, 1, `${id}: Creative entry`);
        for (const material of Object.values(block.components['minecraft:material_instances'])) {
            const texture = atlas[material.texture];
            assert(texture, `${id}: missing atlas key ${material.texture}`);
            assert.equal(typeof texture.textures, 'string');
            assert(fs.existsSync(path.join(root, 'RP', texture.textures + '.png')), `${id}: missing texture`);
        }
        const recipe = json(`BP/recipes/multiblock/components/${id}.json`)['minecraft:recipe_shaped'];
        assert.equal(recipe.result.item, typeId);
        assert(recipe.tags.includes('utilitycraft_workbench'));
        for (const ingredient of [...Object.values(recipe.key), ...recipe.unlock]) {
            assert(ingredient.item.startsWith('minecraft:') || defined.has(ingredient.item),
                `${id}: ingredient/unlock requires another addon: ${ingredient.item}`);
        }
    }
});

test('the live crafter registrations match all six Workbench grids without overrides', () => {
    const registrations = [];
    const context = {
        DoriosLib: { registry: { registerCrafterRecipe: batch => registrations.push(...Object.entries(batch)) } },
        system: { afterEvents: { scriptEventReceive: { subscribe() {} } } },
    };
    vm.runInNewContext(read('BP/scripts/config/recipes/crafter.js')
        .replace(/^import .*;\r?\n/gm, '').replace(/export const /g, 'const '), context);
    for (const id of ids) {
        const recipe = json(`BP/recipes/multiblock/components/${id}.json`)['minecraft:recipe_shaped'];
        const grid = recipe.pattern.flatMap(row => [...row].map(symbol => recipe.key[symbol]?.item.split(':')[1] || 'air')).join(',');
        const matches = registrations.filter(([key]) => key === grid);
        assert.equal(matches.length, 1, `${id}: grid overridden by another batch`);
        assert.equal(matches[0][1].output, recipe.result.item);
        assert.equal(matches[0][1].amount, recipe.result.count || 1);
        assert.equal(registrations.filter(([, value]) => value.output === recipe.result.item).length, 1,
            `${id}: obsolete crafting recipe still registered`);
    }
});

test('every supported locale supplies component names and UC tooltips exactly once', () => {
    for (const locale of json('RP/texts/languages.json')) {
        const lines = read(`RP/texts/${locale}.lang`).split(/\r?\n/);
        for (const id of ids) {
            const names = lines.filter(line => line.startsWith(`tile.utilitycraft:${id}.name=`));
            const tips = lines.filter(line => line.startsWith(`tile.utilitycraft:${id}.tooltip=`));
            assert.equal(names.length, 1, `${locale}: ${id} name`);
            assert(names[0].split('=')[1].trim());
            assert(!names[0].includes('\\n'), `${locale}: tooltip embedded in name`);
            assert.deepEqual(tips, [`tile.utilitycraft:${id}.tooltip=§r§o§9@UtilityCraft`]);
        }
        assert.equal(lines.filter(line => line.startsWith('utilitycraft:itemGroup.components_modules=')).length, 1);
    }
});

const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const strip = text => text.replace(/^import[^\n]*\n/gm, '').replace(/export /g, '');
const formatter = read('BP/scripts/DoriosCore/machinery/energyStorage.js').match(/static formatEnergyToText\(value\) \{[\s\S]*?\n  \}/)[0];
const storageCode = 'class EnergyStorage {' + formatter + '}\n'
    + strip(read('BP/scripts/DoriosCore/machinery/resourceLore.js')) + '\n'
    + strip(read('BP/scripts/DoriosCore/machinery/itemEnergyStorage.js'));
function harness() {
    let callback, writes = 0;
    const queued = [], items = new Map();
    const container = { size: 36, getItem: slot => items.get(slot), setItem(slot, item) { writes++; items.set(slot, item); } };
    const player = { isValid: true, getComponent: () => ({ container }) };
    const context = {
        console,
        world: { afterEvents: { playerInventoryItemChange: { subscribe(fn) { callback = fn; } } } },
        system: { run(fn) { queued.push(fn); }, runInterval() { throw Error('No intervals'); } },
    };
    vm.runInNewContext(storageCode + '\n' + strip(read('BP/scripts/UtilityCore/itemEnergyStorage.js')), context);
    return { items, get writes() { return writes; },
        change(slot, item = items.get(slot)) { callback({ player, slot, itemStack: item }); },
        flush() { while (queued.length) queued.shift()(); },
    };
}
function item(typeId = 'another_addon:tool', damage = 0, tagged = true, maxDurability = 1200) {
    const durability = { damage, maxDurability };
    return { typeId, durability, lore: ['Custom lore'],
        hasTag: tag => tagged && tag === 'utilitycraft:energy_container',
        getComponent: () => durability, getLore() { return this.lore; }, setLore(lore) { this.lore = lore; },
    };
}
test('tagged items from any addon initialize empty once using their own durability', () => {
    const h = harness(), stack = item(); h.items.set(12, stack); h.change(12); h.flush();
    assert.equal(stack.durability.damage, 1100); assert.equal(stack.lore[0], 'Custom lore');
    assert.equal(h.writes, 1); h.change(12); h.flush(); assert.equal(h.writes, 1);
    stack.durability.damage = 100; h.change(12); h.flush(); assert.equal(h.writes, 1);
});
test('untagged items are ignored and writes wait until after the inventory transaction', () => {
    const h = harness(); h.items.set(0, item('minecraft:diamond', 0, false)); h.change(0); h.flush();
    assert.equal(h.writes, 0);
    const fresh = item(); h.change(4, fresh); h.items.set(4, fresh); h.flush();
    assert.equal(fresh.durability.damage, 1100);
    h.change(5, item()); h.items.set(5, item('other:replacement', 0, false)); h.flush();
    assert.equal(h.writes, 1);
});
test('UtilityCore loads the handler globally', () => {
    assert.ok(read('BP/scripts/UtilityCore/index.js').includes('./itemEnergyStorage.js'));
});

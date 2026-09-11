const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const strip = s => s.replace(/^import[^;]+;\s*/gm, '').replace(/export /g, '');
const fuels = vm.runInNewContext(strip(read('BP/scripts/config/recipes/gas_fuel.js')) + '\ngasFuels');
let handler, io;
const context = {
    gasFuels: fuels,
    DoriosLib: { registry: { blockComponent: (id, value) => { handler = value; } }, time: { formatDuration: x => String(x) } },
    EnergyStorage: { formatEnergyToText: x => String(x) },
    GasStorage: { initializeSingle: e => e.gas },
    registerIOInterfaceForBlockTag: (tag, value) => { io = value; },
    Generator: function(block) { return block.generator; },
};
vm.runInNewContext(strip(read('BP/scripts/machinery/generators/gas_generator.js')), context);
function setup(tier, type, amount, free = Infinity) {
    const config = JSON.parse(read(`BP/blocks/machinery/generators/gas_generator/${tier}_gas_generator.json`))['minecraft:block'].components['utilitycraft:gas_generator'].generator;
    let stored = 0, used = 0, label, on = false;
    const data = {};
    const gas = { getType: () => amount > 0 ? type : 'empty', get: () => amount,
        consume: n => { assert(Number.isInteger(n)); assert(n <= amount); amount -= n; used += n; }, display: slot => assert.equal(slot, 2) };
    const entity = { gas, getDynamicProperty: k => data[k], setDynamicProperty: (k, v) => { data[k] = v; } };
    const energy = { transferToNetwork: () => {}, getFreeSpace: () => free, add: n => { assert(n <= free); stored += n; if (Number.isFinite(free)) free -= n; }, getPercent: () => 0 };
    const generator = { valid: true, entity, energy, rate: config.rate_speed_base * 4, baseRate: config.rate_speed_base,
        processIO: () => {}, displayEnergy: () => {}, setLabel: x => { label = x; }, on: () => { on = true; }, off: () => { on = false; } };
    return { tick: () => handler.onTick({ block: { generator } }, { params: {} }), result: () => ({ stored, used, amount, label, on }), gas, setFuel: (t, a) => { type = t; amount = a; }, setFree: x => { free = x; } };
}
let checks = 0;
for (const tier of ['basic', 'advanced', 'expert', 'ultimate']) {
    for (const type of Object.keys(fuels)) {
        const sim = setup(tier, type, 10);
        for (let tick = 0; tick < 10000 && sim.result().amount > 0; tick++) sim.tick();
        assert.equal(sim.result().used, 10);
        assert.equal(sim.result().stored, 10 * fuels[type].energy);
        checks++;
    }
    const sim = setup(tier, 'methane_gas', 100000);
    for (let i = 0; i < 1000; i++) sim.tick();
    const cfg = JSON.parse(read(`BP/blocks/machinery/generators/gas_generator/${tier}_gas_generator.json`))['minecraft:block'].components['utilitycraft:gas_generator'].generator;
    const target = cfg.rate_speed_base * 4000;
    assert(Math.abs(target - sim.result().stored) < fuels.methane_gas.energy);
    checks++;
}
for (const [type, amount, free, status] of [['oxygen_gas', 100, Infinity, 'Invalid Fuel'], ['hydrogen_gas', 0, Infinity, 'No Fuel'], ['methane_gas', 100, 100, 'Energy Full']]) {
    const sim = setup('ultimate', type, amount, free);sim.tick();
    assert.equal(sim.result().used, 0);assert.equal(sim.result().stored, 0);assert(sim.result().label.includes(status));checks++;
}
const sim = setup('ultimate', 'hydrogen_gas', 1);sim.tick();sim.setFuel('methane_gas', 1);sim.tick();assert.equal(sim.result().stored, fuels.hydrogen_gas.energy + fuels.methane_gas.energy);checks++;
assert.deepEqual(Array.from(io.gases.anyInputIndices), [0]);assert.deepEqual(Array.from(io.gases.buttonSlots), [3, 8]);assert(!io.liquids);checks++;
// Real recipe modules: standalone defaults and addon registration use the same runtime hashmap.
for (const [name, symbol, method, expected] of [['electrolyzer', 'electrolyzerRecipes', 'registerElectrolyzerRecipe', 2], ['chemical_converter', 'chemicalConverterRecipes', 'registerChemicalConverterRecipe', 3]]) {
    const queue = [], callbacks = [];
    const event = 'utilitycraft:register_' + name + '_recipe';
    const ctx = { console, system: { afterEvents: { scriptEventReceive: { subscribe: cb => callbacks.push(cb) } } }, DoriosLib: { registry: { [method]: p => queue.push(p) } } };
    vm.runInNewContext(strip(read('BP/scripts/config/recipes/' + name + '.js')), ctx);
    for (const p of queue.splice(0)) callbacks.forEach(cb => cb({ id: event, message: JSON.stringify(p) }));
    const map = vm.runInNewContext(symbol, ctx);assert.equal(Object.keys(map).length, 1);
    vm.runInNewContext(strip(fs.readFileSync(path.join(root, '../UtilityCraft-Heavy-Machinery/BP/scripts/config/recipes/' + name + '.js'), 'utf8')), ctx);
    for (const p of queue) callbacks.forEach(cb => cb({ id: event, message: JSON.stringify(p) }));
    assert.equal(Object.keys(map).length, expected);checks++;
}
assert(fuels.hydrogen_gas.energy * 1000 > 512000);
assert(fuels.methane_gas.energy * 1000 > 512000 + 256000 + 800);
console.log(`${checks} gas generation and recipe integration checks passed`);

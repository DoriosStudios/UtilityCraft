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
    const addonRecipeFile = name === 'chemical_converter' ? 'chemicalConverter' : name;
    vm.runInNewContext(strip(fs.readFileSync(path.join(root, '../UtilityCraft-Heavy-Machinery/BP/scripts/config/recipes/' + addonRecipeFile + '.js'), 'utf8')), ctx);
    for (const p of queue) callbacks.forEach(cb => cb({ id: event, message: JSON.stringify(p) }));
    assert.equal(Object.keys(map).length, expected);checks++;
}
const defaults = name => JSON.parse(read(`BP/scripts/config/recipes/${name}.js`).match(/const defaultRecipes = (\{[\s\S]*?\n\});/)[1]);
const electrolysis = defaults('electrolyzer')['water|empty'];
const methane = defaults('chemical_converter')['utilitycraft:charcoal_dust|empty|hydrogen_gas'];
const limit = vm.runInNewContext(strip(read('BP/scripts/machinery/machines/recipeEnergy.js')) + '\napplyRecipeEnergyLimit');
let upgrades;
vm.runInNewContext(strip(read('BP/scripts/UtilityCore/upgradeRegister.js')), {
    DoriosLib: { registry: { registerMachineUpgrade: value => { upgrades = value; } } },
});
// Hydrogen returns 5-10% above base production cost, before water supply costs.
const hydrogenReturn = fuels.hydrogen_gas.energy * electrolysis.output1.amount / electrolysis.cost;
assert(hydrogenReturn >= 1.05 && hydrogenReturn <= 1.1);
checks++;
// All built-in upgrade combinations: speed penalties remain, Hydrogen's return
// is bounded, and the adjusted tick rate preserves processing speed.
for (let speed = 0; speed <= 8; speed++) for (let efficiency = 0; efficiency <= 8; efficiency++) {
    const s = upgrades['utilitycraft:speed_upgrade'].levels[speed] ?? {};
    const e = upgrades['utilitycraft:energy_upgrade'].levels[efficiency] ?? {};
    const consumption = (1 + (s.energy_cost ?? 0)) / (1 + (e.energy_efficiency ?? 0));
    for (const recipe of [electrolysis, methane, { cost: 1234 }]) {
        const machine = {
            settings: { machine: { rate_speed_base: 1280 } },
            boosts: { consumption, speed: 1 + (s.speed ?? 0) },
            setRate(rate) { this.baseRate = rate; this.rate = rate * 4; },
        };
        machine.setRate(1280 * machine.boosts.speed * consumption);
        limit(machine, recipe);
        assert.equal(machine.boosts.consumption, Math.max(consumption, recipe.minimum_consumption ?? 0));
        assert(Math.abs(machine.rate / machine.boosts.consumption - 5120 * machine.boosts.speed) < 1e-7);
        if (recipe === electrolysis) assert(fuels.hydrogen_gas.energy * recipe.output1.amount / (recipe.cost * machine.boosts.consumption) < 1.375);
        checks++;
    }
}
// Complete methane chain at base speed, including crushing but excluding farms.
for (const [consumption, crusherConsumption, expectedNet] of [[1, 1, 755200], [0.8, 0.05, 920960]]) {
    const hydrogenCost = electrolysis.cost * methane.required_gas / electrolysis.output1.amount;
    const crushingCost = 800 * methane.required_items / 2 * crusherConsumption;
    const net = fuels.methane_gas.energy * methane.output_gas.amount - (hydrogenCost + methane.cost) * consumption - crushingCost;
    assert.equal(net * 1000 / methane.output_gas.amount, expectedNet);
    checks++;
}
console.log(`${checks} gas generation and recipe integration checks passed`);

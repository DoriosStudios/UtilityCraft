// Deterministic recolor of the existing Saline Coolant pixel art; run from the UC root.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const type = 'heated_saline_coolant_gas';
const read = p => PNG.sync.read(fs.readFileSync(p));
const write = (p, png) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, PNG.sync.write(png)); };
const full = read('RP/textures/ui/saline_coolant_bar/saline_coolant_48.png');
const empty = read('RP/textures/ui/nuclear_waste_gas_bar/nuclear_waste_gas_00.png');
if (full.width !== 48 || full.height !== 48 || empty.width !== 48 || empty.height !== 48) throw Error('Expected 48x48 bars');
for (let y = 0; y < 48; y++) for (let x = 16; x < 32; x++) {
    const i = (y * 48 + x) * 4;
    for (let c = 0; c < 3; c++) full.data[i + c] = Math.round(full.data[i + c] * [0.65, 0.72, 0.68][c]);
}
for (let level = 0; level <= 48; level++) {
    const frame = new PNG({ width: 48, height: 48 }); empty.data.copy(frame.data);
    for (let y = 48 - level; y < 48; y++) full.data.copy(frame.data, (y * 48 + 16) * 4, (y * 48 + 16) * 4, (y * 48 + 32) * 4);
    write('RP/textures/ui/' + type + '_bar/' + type + '_' + String(level).padStart(2, '0') + '.png', frame);
}
const sprite = new PNG({ width: 16, height: 16 });
for (let y = 0; y < 16; y++) full.data.copy(sprite.data, y * 64, (y * 48 + 16) * 4, (y * 48 + 32) * 4);
write('RP/textures/entity/' + type + '.png', sprite);
write('RP/textures/static/images/' + type + '.png', sprite);
console.log('Generated 49 Heated Saline Coolant frames and two 16x16 sprites.');

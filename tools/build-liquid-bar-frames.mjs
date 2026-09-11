import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// Recolor the original Heavy Water pixels; never regenerate or rearrange its ripple pattern.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const empty = PNG.sync.read(fs.readFileSync(path.join(root, 'RP/textures/ui/heavy_water_bar/heavy_water_00.png')));
if (empty.width !== 48 || empty.height !== 48) throw new Error('Expected a 48x48 empty bar');
const reference = PNG.sync.read(fs.readFileSync(path.join(root, 'RP/textures/ui/heavy_water_bar/heavy_water_48.png')));
const palettes = JSON.parse(fs.readFileSync(path.join(root, 'Assets/Textures/liquid_bars/palettes.json'), 'utf8'));
const luminance = (i) => reference.data[i] * 0.2126 + reference.data[i + 1] * 0.7152 + reference.data[i + 2] * 0.0722;
const levels = [];
for (let y = 0; y < 48; y++) for (let x = 16; x < 32; x++) levels.push(luminance((y * 48 + x) * 4));
const low = Math.min(...levels), high = Math.max(...levels);
for (const type of ['crude_oil', 'petroleum', 'diesel']) {
  const source = new PNG({ width: 16, height: 48 });
  const { shadow, highlight } = palettes[type];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 16; x++) {
    const referenceIndex = (y * 48 + x + 16) * 4;
    const targetIndex = (y * 16 + x) * 4;
    const shade = (luminance(referenceIndex) - low) / (high - low);
    for (let channel = 0; channel < 3; channel++) {
      source.data[targetIndex + channel] = Math.round(shadow[channel] + shade * (highlight[channel] - shadow[channel]));
    }
    source.data[targetIndex + 3] = reference.data[referenceIndex + 3];
  }
  fs.writeFileSync(path.join(root, `Assets/Textures/liquid_bars/${type}.png`), PNG.sync.write(source));
  const dir = path.join(root, `RP/textures/ui/${type}_bar`);
  fs.mkdirSync(dir, { recursive: true });
  for (let frame = 0; frame <= 48; frame++) {
    const out = new PNG({ width: 48, height: 48 });
    empty.data.copy(out.data);
    for (let y = 48 - frame; y < 48; y++) {
      source.data.copy(out.data, (y * 48 + 16) * 4, y * 16 * 4, (y + 1) * 16 * 4);
    }
    fs.writeFileSync(path.join(dir, `${type}_${String(frame).padStart(2, '0')}.png`), PNG.sync.write(out));
  }
  console.log(`${type}: generated 49 frames`);
}

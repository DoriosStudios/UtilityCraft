import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const read = file => PNG.sync.read(fs.readFileSync(file));
const base = read('RP/textures/items/misc/bucket_water.png');
const luminance = ([r, g, b]) => r * 0.2126 + g * 0.7152 + b * 0.0722;
const isLiquid = ([r, g, b, a]) => a > 0 && b > r + 20 && b > g + 20;
const shades = [...new Set(Array.from({ length: base.width * base.height }, (_, i) =>
    [...base.data.subarray(i * 4, i * 4 + 4)]).filter(isLiquid).map(pixel => pixel.join(',')))]
    .map(pixel => pixel.split(',').map(Number)).sort((a, b) => luminance(a) - luminance(b));

// Fit the recolor to the original 16x16 sprite: metal, outline and alpha stay exact.
// Take actual colors from each existing liquid, ordered from shadow to highlight.
for (const type of ['heavy_water', 'sulfuric_acid', 'xp', 'crude_oil', 'petroleum', 'diesel']) {
    const fluid = read(`RP/textures/static/images/${type}.png`);
    const colors = Array.from({ length: fluid.width * fluid.height }, (_, i) =>
        [...fluid.data.subarray(i * 4, i * 4 + 4)]).filter(pixel => pixel[3] > 0)
        .sort((a, b) => luminance(a) - luminance(b));
    if (!colors.length || shades.length < 2) throw new Error(`Invalid palette: ${type}`);
    const palette = shades.map((_, i) => colors[Math.round((0.08 + 0.87 * i / (shades.length - 1)) * (colors.length - 1))]);
    const output = new PNG({ width: base.width, height: base.height });
    base.data.copy(output.data);
    for (let i = 0; i < base.data.length; i += 4) {
        const pixel = [...base.data.subarray(i, i + 4)];
        if (!isLiquid(pixel)) continue;
        const shade = shades.findIndex(color => color.every((v, c) => v === pixel[c]));
        output.data.set(palette[shade].slice(0, 3), i);
    }
    fs.writeFileSync(`RP/textures/items/misc/${type}_bucket.png`, PNG.sync.write(output));
    console.log(`${type}: 16x16 bucket recolor`);
}

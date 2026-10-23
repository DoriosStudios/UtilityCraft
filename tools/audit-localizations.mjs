import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const texts = new URL('../RP/texts/', import.meta.url);
const locales = JSON.parse(await readFile(new URL('languages.json', texts), 'utf8'));
const files = (await readdir(texts)).filter(name => name.endsWith('.lang')).sort();
assert.deepEqual(files, locales.map(locale => `${locale}.lang`).sort(), 'languages.json must list every locale');

async function readLocale(locale) {
  const content = await readFile(new URL(`${locale}.lang`, texts), 'utf8');
  assert(!content.includes('\uFFFD'), `${locale}: invalid UTF-8 replacement character`);
  const entries = new Map();
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim() || line.startsWith('##')) continue;
    const separator = line.indexOf('=');
    assert(separator > 0, `${locale}:${index + 1}: expected key=value`);
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    assert(/^[\w]+[.:][^\s=]+$/.test(key), `${locale}: malformed key ${key}`);
    assert(!entries.has(key), `${locale}: duplicate ${key}`);
    assert(value.trim(), `${locale}: empty ${key}`);
    assert(!/__UC\d+__/.test(value), `${locale}: unresolved translation marker in ${key}`);
    assert(!/§(?![0-9a-z])/i.test(value), `${locale}: invalid formatting code in ${key}`);
    if (/^(?:item|tile)\./.test(key) && !key.endsWith('.tooltip')) {
      assert(!value.includes('\\n'), `${locale}: description still embedded in ${key}`);
    }
    entries.set(key, value);
  }
  return entries;
}

const source = await readLocale('en_US');
const tokens = value => (value.match(/%\d+(?:\$[sd])?|%[sd]|\{\d+\}/g) ?? []).sort();
const glyphs = value => (value.match(/[\uE000-\uF8FF]/g) ?? []).sort();
const tooltipId = key => key.replace(/^(?:tile\.|item\.spawn_egg\.entity\.|item\.)/, '').replace(/\.name$/, '');
const nameIds = new Set([...source.keys()].filter(key => /^(?:item|tile)\./.test(key) && !key.endsWith('.tooltip')).map(tooltipId));

for (const locale of locales) {
  const entries = locale === 'en_US' ? source : await readLocale(locale);
  assert.deepEqual([...entries.keys()], [...source.keys()], `${locale}: keys/order differ from en_US`);
  for (const [key, value] of entries) {
    assert.deepEqual(tokens(value), tokens(source.get(key)), `${locale}: parameter mismatch in ${key}`);
    if (key.endsWith('.tooltip')) {
      assert(nameIds.has(key.slice(5, -8)), `${locale}: tooltip has no matching item/block name: ${key}`);
      assert.deepEqual(glyphs(value), glyphs(source.get(key)), `${locale}: upgrade icons differ in ${key}`);
      assert.equal(value.split('\\n').length, source.get(key).split('\\n').length, `${locale}: tooltip line count differs in ${key}`);
    }
  }
  console.log(`${locale}: ${entries.size} keys, matching order, parameters and tooltips`);
}

console.log(`PASS: ${locales.length} locales; ${[...source.keys()].filter(key => key.endsWith('.tooltip')).length} item/block tooltips.`);

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;
const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(toolsDirectory, "..");
const defaultDefinitionsPath = join(toolsDirectory, "data", "compressed_blocks.json");
const overlaysDirectory = join(root, "RP", "textures", "blocks", "compressed_overlay");
const texturesDirectory = join(root, "RP", "textures", "blocks", "compressed");
const blocksDirectory = join(root, "BP", "blocks", "compressed");
const compressRecipesDirectory = join(root, "BP", "recipes", "compressed", "blocks", "compress");
const decompressRecipesDirectory = join(root, "BP", "recipes", "compressed", "blocks", "decompress");
const terrainTexturePath = join(root, "RP", "textures", "terrain_texture.json");
const resourceBlocksPath = join(root, "RP", "blocks.json");
const itemCatalogPath = join(root, "BP", "item_catalog", "crafting_item_catalog.json");
const textsDirectory = join(root, "RP", "texts");
const blockFormatVersion = "1.21.100";
const recipeFormatVersion = "1.20.80";
const tiers = [1, 2, 3, 4];
const tierSuffix = ["", "", "_2", "_3", "_4"];
const defaultUnobtainable = new Set(["utilitycraft:compressed_block"]);

class ToolError extends Error {}

const args = parseArguments(process.argv.slice(2));
try {
  const exitCode = args.command === "generate"
    ? await generate(args)
    : await audit(args);
  process.exitCode = exitCode;
} catch (error) {
  if (!(error instanceof ToolError)) throw error;
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
}

function parseArguments(argv) {
  const command = argv.shift();
  if (!command || !["generate", "audit"].includes(command) || argv.includes("--help")) {
    printHelp();
    if (!command || argv.includes("--help")) process.exit(0);
    throw new ToolError(`Unknown command: ${command}`);
  }
  const result = {
    command,
    definitionsPath: defaultDefinitionsPath,
    check: false,
    only: []
  };
  while (argv.length) {
    const option = argv.shift();
    if (option === "--definitions") {
      const value = argv.shift();
      if (!value) throw new ToolError("--definitions requires a path");
      result.definitionsPath = resolve(value);
    } else if (option === "--check" && command === "generate") {
      result.check = true;
    } else if (option === "--only" && command === "generate") {
      const value = argv.shift();
      if (!value) throw new ToolError("--only requires a block key");
      result.only.push(value);
    } else {
      throw new ToolError(`Unknown option for ${command}: ${option}`);
    }
  }
  return result;
}

function printHelp() {
  console.log(`Usage:
  node tools/manage_compressed_blocks.mjs generate [--definitions path] [--only key] [--check]
  node tools/manage_compressed_blocks.mjs audit [--definitions path]

The generator creates four tiers per definition. Each texture is the base PNG
alpha-composited with compressed_overlay/level_1.png through level_4.png.`);
}

async function loadSource(path) {
  let raw;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new ToolError(`Cannot read ${path}: ${error.message}`);
  }
  if (raw.schema_version !== 1) throw new ToolError("Definitions must use schema_version 1");
  if (!raw.presets || typeof raw.presets !== "object") throw new ToolError("Definitions need presets");
  if (!Array.isArray(raw.blocks)) throw new ToolError("Definitions need a blocks array");

  const presets = new Map();
  for (const [name, value] of Object.entries(raw.presets)) {
    if (!["opaque", "alpha_test", "blend"].includes(value.render_method)) {
      throw new ToolError(`Preset ${name} has an invalid render_method`);
    }
    if (!Array.isArray(value.mining_speeds) || value.mining_speeds.length !== 4 ||
        value.mining_speeds.some(speed => typeof speed !== "number" || speed < 0)) {
      throw new ToolError(`Preset ${name} must define four mining_speeds`);
    }
    if (!Array.isArray(value.tags) || value.tags.some(tag => typeof tag !== "string")) {
      throw new ToolError(`Preset ${name} tags must be strings`);
    }
    if (typeof value.sound !== "string" || !value.sound) {
      throw new ToolError(`Preset ${name} needs a sound`);
    }
    presets.set(name, {
      name,
      renderMethod: value.render_method,
      miningSpeeds: value.mining_speeds,
      tags: value.tags,
      redstoneConductor: value.redstone_conductor !== false,
      sound: value.sound,
      geometry: normalizeGeometry(value.geometry, name)
    });
  }

  const seen = new Set();
  const definitions = raw.blocks.map(value => {
    const key = requireString(value.key, "block key");
    if (!/^[a-z0-9_]+$/.test(key)) throw new ToolError(`Invalid block key: ${key}`);
    if (seen.has(key)) throw new ToolError(`Duplicate block key: ${key}`);
    seen.add(key);
    const type = requireString(value.type, `${key} type`);
    const preset = presets.get(type);
    if (!preset) throw new ToolError(`${key} references unknown type ${type}`);
    const sourceItem = requireIdentifier(value.source_item, `${key} source_item`);
    const baseTextureValue = requireString(value.base_texture, `${key} base_texture`);
    const baseTexture = resolve(root, baseTextureValue);
    if (!isInside(root, baseTexture)) throw new ToolError(`${key} base_texture must stay inside UtilityCraft`);
    const textureStem = value.texture_stem ?? key.replace(/_block$/, "");
    if (!/^[a-z0-9_]+$/.test(textureStem)) throw new ToolError(`${key} has an invalid texture_stem`);
    const names = normalizeNames(value.names, key);
    return { key, type, preset, sourceItem, baseTexture, textureStem, names };
  });

  const unobtainable = new Set([
    ...defaultUnobtainable,
    ...(raw.audit?.allow_unobtainable ?? [])
  ]);
  for (const identifier of unobtainable) requireIdentifier(identifier, "audit.allow_unobtainable");
  return { presets, definitions, unobtainable };
}

function requireString(value, context) {
  if (typeof value !== "string" || !value) throw new ToolError(`Missing or invalid ${context}`);
  return value;
}

function requireIdentifier(value, context) {
  if (typeof value !== "string" || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value)) {
    throw new ToolError(`Invalid identifier for ${context}: ${value}`);
  }
  return value;
}

function normalizeGeometry(value, presetName) {
  if (value === undefined) return "minecraft:geometry.full_block";
  if (typeof value === "string") return requireIdentifier(value, `preset ${presetName} geometry`);
  if (!value || typeof value !== "object") throw new ToolError(`Preset ${presetName} has invalid geometry`);
  const identifier = requireString(value.identifier, `preset ${presetName} geometry identifier`);
  const geometry = { identifier };
  if (value.culling !== undefined) {
    geometry.culling = requireIdentifier(value.culling, `preset ${presetName} geometry culling`);
  }
  return geometry;
}

function normalizeNames(value, key) {
  if (!value || typeof value !== "object" || !Array.isArray(value.en_US)) {
    throw new ToolError(`${key} must define names.en_US`);
  }
  const result = {};
  for (const [locale, names] of Object.entries(value)) {
    if (!/^[a-z]{2}_[A-Z]{2}$/.test(locale)) throw new ToolError(`${key} has invalid locale ${locale}`);
    if (!Array.isArray(names) || names.length !== 4 || names.some(name => typeof name !== "string" || !name)) {
      throw new ToolError(`${key} names.${locale} must contain four complete names`);
    }
    result[locale] = names;
  }
  return result;
}

function compressedId(key, tier) {
  return `utilitycraft:compressed_${key}${tierSuffix[tier]}`;
}

function compressedTextureKey(key, tier) {
  return `utilitycraft_compressed_${key}${tierSuffix[tier]}`;
}

async function generate(options) {
  const { definitions: allDefinitions } = await loadSource(options.definitionsPath);
  const requested = new Set(options.only);
  const known = new Set(allDefinitions.map(definition => definition.key));
  const unknown = [...requested].filter(key => !known.has(key));
  if (unknown.length) throw new ToolError(`Unknown --only key(s): ${unknown.join(", ")}`);
  const definitions = requested.size
    ? allDefinitions.filter(definition => requested.has(definition.key))
    : allDefinitions;

  const writer = createWriter(options.check);
  const terrain = JSON.parse(await readFile(terrainTexturePath, "utf8"));
  const catalog = JSON.parse(await readFile(itemCatalogPath, "utf8"));
  let resourceBlocks = await readFile(resourceBlocksPath, "utf8");
  const overlays = new Map();
  for (const tier of tiers) overlays.set(tier, await readPng(join(overlaysDirectory, `level_${tier}.png`)));

  for (const definition of definitions) {
    const base = await readPng(definition.baseTexture);
    for (const tier of tiers) {
      const overlay = overlays.get(tier);
      assertMatchingDimensions(base, overlay, definition.key, tier);
      const suffix = tierSuffix[tier];
      const texture = alphaComposite(base, overlay);
      await writer.writeBinary(join(texturesDirectory, `${definition.textureStem}${suffix}.png`), PNG.sync.write(texture));
      await writer.writeJson(join(blocksDirectory, `compressed_${definition.key}${suffix}.json`), buildBlock(definition, tier), 2);
      await writer.writeJson(join(compressRecipesDirectory, `${definition.key}${suffix}.json`), buildCompressRecipe(definition, tier), 2);
      await writer.writeJson(join(decompressRecipesDirectory, `${definition.key}${suffix}.json`), buildDecompressRecipe(definition, tier), 2);
      terrain.texture_data[compressedTextureKey(definition.key, tier)] = {
        textures: `textures/blocks/compressed/${definition.textureStem}${suffix}`
      };
    }
    addToCompressedCatalog(catalog, tiers.map(tier => compressedId(definition.key, tier)));
    resourceBlocks = upsertResourceBlockSounds(resourceBlocks, definition);
    await updateLocalizations(writer, definition);
  }

  if (definitions.length) {
    await writer.writeText(terrainTexturePath, `${JSON.stringify(terrain, null, "\t")}\n`);
    await writer.writeText(itemCatalogPath, `${JSON.stringify(catalog, null, 4)}\n`);
    await writer.writeText(resourceBlocksPath, resourceBlocks);
  }

  if (options.check && writer.changed.length) {
    console.error("Generated files are out of date:");
    for (const path of writer.changed) console.error(`- ${relative(root, path)}`);
    return 1;
  }
  console.log(`${options.check ? "Would update" : "Updated"} ${writer.changed.length} file(s) for ${definitions.length} compressed block family/families.`);
  return 0;
}

function createWriter(check) {
  const changed = [];
  async function writeBinary(path, data) {
    const current = existsSync(path) ? await readFile(path) : null;
    if (current?.equals(data)) return;
    changed.push(path);
    if (!check) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    }
  }
  return {
    changed,
    writeBinary,
    writeText: (path, text) => writeBinary(path, Buffer.from(text, "utf8")),
    writeJson: (path, value, indent) => writeBinary(path, Buffer.from(`${JSON.stringify(value, null, indent)}\n`, "utf8"))
  };
}

async function readPng(path) {
  try {
    return PNG.sync.read(await readFile(path));
  } catch (error) {
    throw new ToolError(`Cannot read PNG ${relative(root, path)}: ${error.message}`);
  }
}

function assertMatchingDimensions(base, overlay, key, tier) {
  if (base.width !== overlay.width || base.height !== overlay.height) {
    throw new ToolError(`${key}: base is ${base.width}x${base.height}, but level_${tier}.png is ${overlay.width}x${overlay.height}`);
  }
}

function alphaComposite(base, overlay) {
  const output = new PNG({ width: base.width, height: base.height, colorType: 6 });
  for (let index = 0; index < base.data.length; index += 4) {
    const baseAlpha = base.data[index + 3] / 255;
    const overlayAlpha = overlay.data[index + 3] / 255;
    const outputAlpha = overlayAlpha + baseAlpha * (1 - overlayAlpha);
    for (let channel = 0; channel < 3; channel++) {
      output.data[index + channel] = outputAlpha === 0 ? 0 : Math.round(
        (overlay.data[index + channel] * overlayAlpha +
          base.data[index + channel] * baseAlpha * (1 - overlayAlpha)) / outputAlpha
      );
    }
    output.data[index + 3] = Math.round(outputAlpha * 255);
  }
  return output;
}

function buildBlock(definition, tier) {
  const components = {};
  if (definition.preset.redstoneConductor) {
    components["minecraft:redstone_conductivity"] = { redstone_conductor: true };
  }
  components["minecraft:geometry"] = definition.preset.geometry;
  components["minecraft:material_instances"] = {
    "*": {
      texture: compressedTextureKey(definition.key, tier),
      render_method: definition.preset.renderMethod
    }
  };
  components["minecraft:destructible_by_mining"] = {
    seconds_to_destroy: definition.preset.miningSpeeds[tier - 1]
  };
  for (const tag of definition.preset.tags) components[tag] = {};
  return {
    format_version: blockFormatVersion,
    "minecraft:block": {
      description: {
        identifier: compressedId(definition.key, tier),
        menu_category: { category: "construction" }
      },
      components
    }
  };
}

function buildCompressRecipe(definition, tier) {
  const ingredient = tier === 1 ? definition.sourceItem : compressedId(definition.key, tier - 1);
  const output = compressedId(definition.key, tier);
  return {
    format_version: recipeFormatVersion,
    "minecraft:recipe_shapeless": {
      description: { identifier: output },
      tags: ["crafting_table"],
      ingredients: [{ item: ingredient, count: 9 }],
      result: { item: output },
      unlock: [{ item: ingredient }]
    }
  };
}

function buildDecompressRecipe(definition, tier) {
  const ingredient = compressedId(definition.key, tier);
  const output = tier === 1 ? definition.sourceItem : compressedId(definition.key, tier - 1);
  return {
    format_version: recipeFormatVersion,
    "minecraft:recipe_shapeless": {
      description: { identifier: `utilitycraft:decompress_compressed_${definition.key}${tierSuffix[tier]}` },
      tags: ["crafting_table"],
      ingredients: [{ item: ingredient }],
      result: { item: output, count: 9 },
      unlock: [{ item: ingredient }]
    }
  };
}

function findCompressedCatalogGroup(catalog) {
  const matches = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (value.group_identifier?.name === "dorios:itemGroup.name.compressed") matches.push(value);
    Object.values(value).forEach(visit);
  }
  visit(catalog);
  if (matches.length !== 1 || !Array.isArray(matches[0].items)) {
    throw new ToolError(`Expected exactly one compressed item catalog group, found ${matches.length}`);
  }
  return matches[0];
}

function addToCompressedCatalog(catalog, identifiers) {
  const group = findCompressedCatalogGroup(catalog);
  for (const identifier of identifiers) if (!group.items.includes(identifier)) group.items.push(identifier);
}

function upsertResourceBlockSounds(text, definition) {
  const missing = [];
  for (const tier of tiers) {
    const identifier = compressedId(definition.key, tier);
    const simpleEntry = new RegExp(`("${escapeRegex(identifier)}"\\s*:\\s*\\{\\s*"sound"\\s*:\\s*")[^"]+("\\s*\\})`, "m");
    if (simpleEntry.test(text)) {
      text = text.replace(simpleEntry, `$1${definition.preset.sound}$2`);
    } else if (new RegExp(`"${escapeRegex(identifier)}"\\s*:`).test(text)) {
      throw new ToolError(`Cannot safely update complex RP/blocks.json entry for ${identifier}`);
    } else {
      missing.push(identifier);
    }
  }
  if (!missing.length) return text;
  const entries = missing.map(identifier =>
    `\t"${identifier}": {\n\t\t"sound": "${definition.preset.sound}"\n\t},`
  ).join("\n");
  const endMarker = "// END GENERATED COMPRESSED BLOCK SOUNDS";
  if (text.includes(endMarker)) return text.replace(endMarker, `${entries}\n${endMarker}`);
  const anchor = "// Elevators";
  if (!text.includes(anchor)) throw new ToolError("Cannot find // Elevators anchor in RP/blocks.json");
  return text.replace(anchor,
    `// BEGIN GENERATED COMPRESSED BLOCK SOUNDS\n${entries}\n// END GENERATED COMPRESSED BLOCK SOUNDS\n${anchor}`
  );
}

async function updateLocalizations(writer, definition) {
  const files = (await readdir(textsDirectory)).filter(name => name.endsWith(".lang")).sort();
  const locales = new Set(files.map(name => name.slice(0, -5)));
  const unknown = Object.keys(definition.names).filter(locale => !locales.has(locale));
  if (unknown.length) throw new ToolError(`${definition.key} has unknown locales: ${unknown.join(", ")}`);
  for (const file of files) {
    const locale = file.slice(0, -5);
    const names = definition.names[locale] ?? definition.names.en_US;
    const path = join(textsDirectory, file);
    let text = await readFile(path, "utf8");
    for (const tier of tiers) {
      const key = `tile.${compressedId(definition.key, tier)}.name`;
      const line = `${key}=${names[tier - 1]}`;
      const pattern = new RegExp(`^${escapeRegex(key)}=.*$`, "m");
      text = pattern.test(text)
        ? text.replace(pattern, line)
        : `${text}${text.endsWith("\n") ? "" : "\n"}${line}\n`;
      const tooltipKey = `tile.${compressedId(definition.key, tier)}.tooltip`;
      const tooltipLine = `${tooltipKey}=\u00a7r\u00a7o\u00a79@UtilityCraft`;
      const tooltipPattern = new RegExp(`^${escapeRegex(tooltipKey)}=.*$`, "m");
      text = tooltipPattern.test(text)
        ? text.replace(tooltipPattern, tooltipLine)
        : text.replace(line, `${line}\n${tooltipLine}`);
    }
    await writer.writeText(path, text);
  }
}

async function audit(options) {
  const { unobtainable } = await loadSource(options.definitionsPath);
  const errors = [];
  const allBlockIds = new Set();
  const compressedBlocks = new Map();
  const usedTextureKeys = new Set();
  for (const path of await listFiles(join(root, "BP", "blocks"), ".json")) {
    let block;
    try {
      block = JSON.parse(await readFile(path, "utf8"))["minecraft:block"];
    } catch {
      continue;
    }
    const identifier = block?.description?.identifier;
    if (typeof identifier !== "string") continue;
    allBlockIds.add(identifier);
    const materials = block.components?.["minecraft:material_instances"];
    if (materials && typeof materials === "object") {
      for (const material of Object.values(materials)) {
        if (typeof material?.texture === "string") usedTextureKeys.add(material.texture);
      }
    }
    if (dirname(path) === blocksDirectory) {
      compressedBlocks.set(identifier, path);
      if (!isSupportedCompressedGeometry(block.components?.["minecraft:geometry"])) {
        errors.push(`${relative(root, path)} does not use a supported compressed-block geometry`);
      }
    }
  }

  const terrain = JSON.parse(await readFile(terrainTexturePath, "utf8")).texture_data;
  const atlasKeys = new Set(Object.keys(terrain));
  for (const key of difference(usedTextureKeys, atlasKeys)) errors.push(`Texture key missing from terrain_texture.json: ${key}`);
  for (const key of difference(atlasKeys, usedTextureKeys)) {
    if (key.startsWith("utilitycraft_compressed")) errors.push(`Unused compressed terrain texture key: ${key}`);
  }
  const atlasPaths = new Set();
  for (const entry of Object.values(terrain)) {
    const textures = entry?.textures;
    if (typeof textures === "string") atlasPaths.add(textures);
    else if (Array.isArray(textures)) textures.filter(value => typeof value === "string").forEach(value => atlasPaths.add(value));
  }
  for (const path of await listFiles(texturesDirectory, ".png", false)) {
    const atlasPath = `textures/blocks/compressed/${fileStem(path)}`;
    if (!atlasPaths.has(atlasPath)) errors.push(`Compressed PNG is not registered in the terrain atlas: ${relative(root, path)}`);
  }

  const catalogText = await readFile(itemCatalogPath, "utf8");
  const catalogIdentifiers = new Set([...catalogText.matchAll(/"(?<id>utilitycraft:[^"]+)"/g)]
    .map(match => match.groups.id));
  for (const identifier of difference(new Set(compressedBlocks.keys()), catalogIdentifiers)) {
    errors.push(`Compressed block missing from item catalog: ${identifier}`);
  }

  const localizationKeys = await readLocalizationKeys();
  for (const identifier of compressedBlocks.keys()) {
    for (const [locale, keys] of localizationKeys) {
      if (!keys.has(`tile.${identifier}.name`) && !keys.has(`item.${identifier}`)) {
        errors.push(`${locale}.lang has no localization for ${identifier}`);
      }
    }
  }

  const resourceBlocksText = await readFile(resourceBlocksPath, "utf8");
  const soundIds = new Set([...resourceBlocksText.matchAll(/"(?<id>utilitycraft:[^"]+)"\s*:\s*\{\s*"sound"\s*:/g)]
    .map(match => match.groups.id));
  for (const identifier of difference(new Set(compressedBlocks.keys()), soundIds)) {
    errors.push(`Compressed block has no sound in RP/blocks.json: ${identifier}`);
  }

  const compressOutputs = await readRecipeItems(compressRecipesDirectory, "result");
  const decompressInputs = await readRecipeItems(decompressRecipesDirectory, "ingredient");
  for (const identifier of difference(new Set(compressedBlocks.keys()), compressOutputs, unobtainable)) {
    errors.push(`Compressed block has no compression recipe: ${identifier}`);
  }
  for (const identifier of difference(new Set(compressedBlocks.keys()), decompressInputs, unobtainable)) {
    errors.push(`Compressed block has no decompression recipe: ${identifier}`);
  }

  if (errors.length) {
    console.error(`Compressed block audit failed with ${errors.length} issue(s):`);
    errors.sort().forEach(error => console.error(`- ${error}`));
    return 1;
  }
  console.log(`Compressed block audit passed for ${compressedBlocks.size} blocks.`);
  return 0;
}

function isSupportedCompressedGeometry(geometry) {
  return geometry === "minecraft:geometry.full_block" ||
    (geometry?.identifier === "geometry.utilitycraft_glass" && geometry?.culling === "utilitycraft:glass");
}

async function listFiles(directory, extension, recursive = true) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && recursive) result.push(...await listFiles(path, extension, true));
    else if (entry.isFile() && path.endsWith(extension)) result.push(path);
  }
  return result;
}

async function readLocalizationKeys() {
  const result = new Map();
  for (const file of (await readdir(textsDirectory)).filter(name => name.endsWith(".lang"))) {
    const keys = new Set();
    for (const line of (await readFile(join(textsDirectory, file), "utf8")).split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator > 0 && !line.startsWith("#")) keys.add(line.slice(0, separator));
    }
    result.set(file.slice(0, -5), keys);
  }
  return result;
}

async function readRecipeItems(directory, target) {
  const items = new Set();
  for (const path of await listFiles(directory, ".json", false)) {
    let document;
    try {
      document = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    const recipe = Object.entries(document).find(([key]) => key.startsWith("minecraft:recipe_"))?.[1];
    if (!recipe) continue;
    let item;
    if (target === "result") item = recipe.result?.item;
    else if (Array.isArray(recipe.ingredients)) item = recipe.ingredients[0]?.item;
    else if (recipe.key) item = Object.values(recipe.key)[0]?.item;
    if (typeof item === "string") items.add(item);
  }
  return items;
}

function difference(source, ...excludedSets) {
  return [...source].filter(value => excludedSets.every(excluded => !excluded.has(value))).sort();
}

function fileStem(path) {
  const name = path.split(/[\\/]/).pop();
  return name.slice(0, name.lastIndexOf("."));
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


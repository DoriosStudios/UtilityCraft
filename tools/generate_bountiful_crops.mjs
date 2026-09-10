import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const sourcePath = join(toolsDirectory, "data", "bountiful_crops.json");
const cropBlocksRoot = join(projectRoot, "BP", "blocks", "addons", "bc", "crops");
const cropLootRoot = join(projectRoot, "BP", "loot_tables", "bc", "crops");
const seedLootRoot = join(projectRoot, "BP", "loot_tables", "bc", "seeds");
const itemsRoot = join(projectRoot, "BP", "items");
const behaviorBonsaiReferencePath = join(
  projectRoot,
  "BP",
  "entities",
  "bonsais",
  "oak_tree.json"
);
const behaviorBonsaisRoot = join(projectRoot, "BP", "entities", "bonsais", "bountiful_crops");
const resourceBonsaisRoot = join(projectRoot, "RP", "entity", "bonsais", "bountiful_crops");
const blockModelsRoot = join(projectRoot, "RP", "models", "blocks", "bountiful_crops");
const bonsaiModelsRoot = join(projectRoot, "RP", "models", "entity", "bountiful_crops");
const terrainAtlasPath = join(projectRoot, "RP", "textures", "terrain_texture.json");
const resourceBlocksPath = join(projectRoot, "RP", "blocks.json");
const textsRoot = join(projectRoot, "RP", "texts");
const seedSynthesizerUiPath = join(
  projectRoot,
  "RP",
  "ui",
  "recipes",
  "seed_synthesizer.json"
);
const runtimeOutputPath = join(
  projectRoot,
  "BP",
  "scripts",
  "config",
  "recipes",
  "bountifulCrops.generated.js"
);

const BONSAI_DURATION_SECONDS_BY_TIER = Object.freeze({
  1: 120,
  2: 180,
  3: 300,
  4: 600
});

const HIGHEST_SOIL_TIER = 5;

const BONSAI_GEOMETRIES = Object.freeze({
  "geometry.utilitycraft_crop": {
    sourceFile: "crop.geo.json",
    outputFile: "crop_bonsai.geo.json",
    identifier: "geometry.utilitycraft_crop_bonsai"
  },
  "geometry.utilitycraft_special_crop": {
    sourceFile: "crop_special.geo.json",
    outputFile: "special_crop_bonsai.geo.json",
    identifier: "geometry.utilitycraft_special_crop_bonsai"
  },
  "geometry.utilitycraft_block_crop": {
    sourceFile: "block_crop.geo.json",
    outputFile: "block_crop_bonsai.geo.json",
    identifier: "geometry.utilitycraft_block_crop_bonsai"
  },
  "geometry.utilitycraft_wither_crop": {
    sourceFile: "wither_crop.geo.json",
    outputFile: "wither_crop_bonsai.geo.json",
    identifier: "geometry.utilitycraft_wither_crop_bonsai"
  }
});

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const definitions = normalizeDefinitions(source);
await updateSeedItems(definitions);
await validateItemDefinitions(definitions);
await generateRuntimeModule(definitions);
await generateLootTables(definitions);
await updateCropBlocks(definitions);
await updateResourceBlocks(definitions);
await updateBlockTranslations(definitions);
await generateBonsaiAssets(definitions);
await updateSeedSynthesizerUi(definitions);

console.log(`Generated ${definitions.length} Bountiful Crops definitions.`);

function normalizeDefinitions(rawSource) {
  if (!rawSource || typeof rawSource !== "object") throw new TypeError("Invalid crop source");
  if (!Array.isArray(rawSource.crops)) throw new TypeError("crops must be an array");

  const uniqueKeys = new Set();
  const uniqueSeedIds = new Set();
  const uniqueLootFiles = new Set();

  return rawSource.crops.map(rawCrop => {
    const tierSettings = rawSource.tiers?.[String(rawCrop.tier)];
    if (!tierSettings) throw new Error(`Missing tier settings for ${rawCrop.key}`);
    validateGrowthInterval(tierSettings.growthInterval, rawCrop.key);
    if (!(tierSettings.seedChance > 0 && tierSettings.seedChance < 1)) {
      throw new Error(`Invalid seed chance for tier ${rawCrop.tier}`);
    }
    if (typeof rawCrop.soil !== "string" || !rawCrop.soil.includes(":")) {
      throw new Error(`Invalid soil in ${rawCrop.key}`);
    }
    if (!Array.isArray(rawCrop.drops) || rawCrop.drops.length === 0) {
      throw new Error(`Crop ${rawCrop.key} must define at least one drop`);
    }

    assertUnique(uniqueKeys, rawCrop.key, "key");
    assertUnique(uniqueSeedIds, rawCrop.seedId, "seedId");
    assertUnique(uniqueLootFiles, rawCrop.lootFile, "lootFile");

    const drops = rawCrop.drops.map(drop => {
      if (typeof drop.item !== "string" || !drop.item.includes(":")) {
        throw new Error(`Invalid drop item in ${rawCrop.key}`);
      }
      const chance = Number(drop.chance ?? 1);
      if (!(chance > 0 && chance <= 1)) throw new Error(`Invalid drop chance in ${rawCrop.key}`);
      validateAmount(drop.amount, rawCrop.key);
      return { item: drop.item, amount: drop.amount, chance };
    });

    const bonsaiDurationSeconds = BONSAI_DURATION_SECONDS_BY_TIER[rawCrop.tier];
    if (!bonsaiDurationSeconds) throw new Error(`Missing bonsai duration for tier ${rawCrop.tier}`);

    return {
      ...rawCrop,
      growthInterval: [...tierSettings.growthInterval],
      seedChance: Number(tierSettings.seedChance),
      bonsaiEntityId: `utilitycraft:${rawCrop.key}_bonsai`,
      bonsaiDurationSeconds,
      drops
    };
  });
}

function assertUnique(values, value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${label}`);
  if (values.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
  values.add(value);
}

function validateAmount(amount, key) {
  if (Number.isInteger(amount) && amount > 0) return;
  if (
    Array.isArray(amount) &&
    amount.length === 2 &&
    Number.isInteger(amount[0]) &&
    Number.isInteger(amount[1]) &&
    amount[0] > 0 &&
    amount[1] >= amount[0]
  ) return;
  throw new Error(`Invalid drop amount in ${key}`);
}

function validateGrowthInterval(interval, key) {
  if (
    !Array.isArray(interval) ||
    interval.length !== 2 ||
    !Number.isInteger(interval[0]) ||
    !Number.isInteger(interval[1]) ||
    interval[0] <= 0 ||
    interval[1] < interval[0]
  ) throw new Error(`Invalid growth interval in ${key}`);
}

async function generateRuntimeModule(crops) {
  const serialized = JSON.stringify(crops, null, 2);
  const moduleSource = `// This file is generated by tools/generate_bountiful_crops.mjs.\n` +
`// Edit tools/data/bountiful_crops.json, then run the generator.\n\n` +
`export const BOUNTIFUL_CROP_DEFINITIONS = Object.freeze(${serialized});\n\n` +
`export const BOUNTIFUL_CROPS_BY_BLOCK = Object.freeze(Object.fromEntries(\n` +
`  BOUNTIFUL_CROP_DEFINITIONS.map(definition => [definition.seedId, definition])\n` +
`));\n\n` +
`export const bountifulPlantsData = Object.freeze(Object.fromEntries(\n` +
`  BOUNTIFUL_CROP_DEFINITIONS.map(definition => [definition.seedId, {\n` +
`    cost: definition.cost,\n` +
`    bonsai: {\n` +
`      entityTypeId: definition.bonsaiEntityId,\n` +
`      durationSeconds: definition.bonsaiDurationSeconds\n` +
`    },\n` +
`    drops: [\n` +
`      ...definition.drops.map(drop => ({\n` +
`        item: drop.item,\n` +
`        amount: Array.isArray(drop.amount) ? [...drop.amount] : drop.amount,\n` +
`        chance: drop.chance\n` +
`      })),\n` +
`      { item: definition.seedId, amount: 1, chance: definition.seedChance }\n` +
`    ]\n` +
`  }])\n` +
`));\n`;

  await writeFile(runtimeOutputPath, moduleSource, "utf8");
}

async function generateLootTables(crops) {
  for (const crop of crops) {
    const maturePools = crop.drops.map(drop => createDropPool(drop));
    maturePools.push({
      rolls: 1,
      conditions: [{ condition: "random_chance", chance: crop.seedChance }],
      entries: [{ type: "item", name: crop.seedId }]
    });

    await writeJson(join(cropLootRoot, `${crop.lootFile}.json`), { pools: maturePools });
    await writeJson(join(seedLootRoot, `${crop.lootFile}.json`), {
      pools: [{ rolls: 1, entries: [{ type: "item", name: crop.seedId }] }]
    });
  }

  const expectedFiles = new Set(crops.map(crop => `${crop.lootFile}.json`));
  await validateExactJsonFiles(cropLootRoot, expectedFiles, "mature loot table");
  await validateExactJsonFiles(seedLootRoot, expectedFiles, "seed loot table");
}

function createDropPool(drop) {
  const entry = { type: "item", name: drop.item };
  if (drop.amount !== 1) {
    entry.functions = [{
      function: "set_count",
      count: Array.isArray(drop.amount)
        ? { min: drop.amount[0], max: drop.amount[1] }
        : drop.amount
    }];
  }

  const pool = { rolls: 1, entries: [entry] };
  if (drop.chance < 1) pool.conditions = [{ condition: "random_chance", chance: drop.chance }];
  return pool;
}

async function updateCropBlocks(crops) {
  const definitionsByCanonicalBlock = new Map(crops.map(crop => [crop.seedId, crop]));
  const files = await collectJsonFiles(cropBlocksRoot);
  const canonicalFiles = new Map();

  for (const filePath of files) {
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const block = document["minecraft:block"];
    const identifier = block?.description?.identifier;
    if (definitionsByCanonicalBlock.has(identifier)) {
      canonicalFiles.set(identifier, filePath);
      continue;
    }
    throw new Error(`Unregistered crop block: ${identifier ?? relative(projectRoot, filePath)}`);
  }

  for (const definition of crops) {
    const canonicalPath = canonicalFiles.get(definition.seedId);
    if (!canonicalPath) throw new Error(`Missing crop block: ${definition.seedId}`);

    const canonicalDocument = JSON.parse(await readFile(canonicalPath, "utf8"));
    const canonicalBlock = canonicalDocument["minecraft:block"];

    configureCropBlock(canonicalBlock, definition);
    if (Object.hasOwn(canonicalBlock.components, "utilitycraft:retrocompatibility")) {
      throw new Error(`Obsolete retrocompatibility component: ${definition.seedId}`);
    }
    canonicalBlock.components["utilitycraft:crop"] = {};
    canonicalBlock.components["minecraft:tick"] = {
      interval_range: [...definition.growthInterval],
      looping: true
    };

    await writeJson(canonicalPath, canonicalDocument);
  }
}

function configureCropBlock(block, definition) {
  block.components["minecraft:loot"] = `loot_tables/bc/seeds/${definition.lootFile}.json`;

  const placementConditions = block.components["minecraft:placement_filter"]?.conditions;
  if (!Array.isArray(placementConditions) || !placementConditions[0]) {
    throw new Error(`Missing placement filter: ${block.description.identifier}`);
  }
  placementConditions[0].block_filter = [{
    tags: createCompatibleSoilTagQuery(definition.tier)
  }];

  const maturePermutation = block.permutations.find(permutation =>
    typeof permutation.condition === "string" && permutation.condition.includes("age')==5")
  );
  if (!maturePermutation) {
    throw new Error(`Missing mature permutation: ${block.description.identifier}`);
  }
  maturePermutation.components["minecraft:loot"] = `loot_tables/bc/crops/${definition.lootFile}.json`;
}

function createCompatibleSoilTagQuery(minimumTier) {
  const tags = [];
  for (let tier = minimumTier; tier <= HIGHEST_SOIL_TIER; tier++) {
    tags.push(`'utilitycraft:soil_tier_${tier}'`);
  }
  return `query.any_tag(${tags.join(", ")})`;
}

async function validateItemDefinitions(crops) {
  const itemFiles = await collectJsonFiles(itemsRoot);
  const items = new Map();

  for (const filePath of itemFiles) {
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const item = document["minecraft:item"];
    const identifier = item?.description?.identifier;
    if (identifier) items.set(identifier, item);
  }

  for (const crop of crops) {
    const seedItem = items.get(crop.seedId);
    if (!seedItem) throw new Error(`Missing seed item: ${crop.seedId}`);
    const blockPlacer = seedItem.components?.["minecraft:block_placer"];
    if (blockPlacer?.block !== crop.seedId) {
      throw new Error(`Seed does not place its matching crop block: ${crop.seedId}`);
    }
    if (blockPlacer.replace_block_item !== true) {
      throw new Error(`Seed does not replace canonical crop item: ${crop.seedId}`);
    }
    if (seedItem.description?.menu_category?.group !== "minecraft:itemGroup.name.seed") {
      throw new Error(`Seed uses an invalid creative group: ${crop.seedId}`);
    }

    for (const drop of crop.drops) {
      if (drop.item.startsWith("utilitycraft:") && !items.has(drop.item)) {
        throw new Error(`Missing custom drop item: ${drop.item}`);
      }
    }
  }
}

async function updateSeedSynthesizerUi(crops) {
  const document = JSON.parse(await readFile(seedSynthesizerUiPath, "utf8"));

  for (const crop of crops) {
    const seedName = crop.seedId.split(":")[1];
    const panelName = `seed_${seedName}_results`;
    const panel = document[panelName];
    if (!panel || !Array.isArray(panel.controls)) {
      throw new Error(`Missing Seed Synthesizer drop panel: ${panelName}`);
    }

    const strips = panel.controls
      .map(control => Object.entries(control).find(([name]) =>
        name.endsWith("@uc.seed_drop_result_strip")
      ))
      .filter(Boolean);

    if (strips.length !== crop.drops.length + 1) {
      throw new Error(`Unexpected drop row count in ${panelName}`);
    }

    crop.drops.forEach((drop, index) => {
      const [controlName, row] = strips[index];
      validateDropRow(controlName, drop.item, index, panelName);
      row["$result_chance_text"] = formatUiChance(drop.chance);
      row["$result_amount_text"] = formatUiAmount(drop.amount);
    });

    const [seedControlName, seedRow] = strips.at(-1);
    validateDropRow(seedControlName, crop.seedId, crop.drops.length, panelName);
    seedRow["$result_chance_text"] = formatUiChance(crop.seedChance);
    seedRow["$result_amount_text"] = "x1";
  }

  await writeFile(
    seedSynthesizerUiPath,
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8"
  );
}

function validateDropRow(controlName, itemId, index, panelName) {
  const itemName = itemId.split(":")[1];
  const expectedPrefix = `${itemName}_${index}_strip@`;
  if (!controlName.startsWith(expectedPrefix)) {
    throw new Error(
      `Drop row mismatch in ${panelName}: expected ${expectedPrefix}, found ${controlName}`
    );
  }
}

function formatUiChance(chance) {
  return `${Number((chance * 100).toFixed(4))}%%`;
}

function formatUiAmount(amount) {
  return Array.isArray(amount) ? `x${amount[0]}-${amount[1]}` : `x${amount}`;
}

async function updateSeedItems(crops) {
  const definitionsBySeed = new Map(crops.map(crop => [crop.seedId, crop]));
  const itemFiles = await collectJsonFiles(itemsRoot);
  const foundSeeds = new Set();

  for (const filePath of itemFiles) {
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const item = document["minecraft:item"];
    const identifier = item?.description?.identifier;
    if (!definitionsBySeed.has(identifier)) continue;

    document.format_version = "1.21.90";
    item.description.menu_category ??= { category: "nature" };
    item.description.menu_category.group = "minecraft:itemGroup.name.seed";
    item.components["minecraft:block_placer"] = {
      block: identifier,
      replace_block_item: true
    };
    foundSeeds.add(identifier);
    await writeJson(filePath, document);
  }

  for (const crop of crops) {
    if (!foundSeeds.has(crop.seedId)) throw new Error(`Missing seed item: ${crop.seedId}`);
  }
}

async function updateResourceBlocks(crops) {
  const startMarker = "// BEGIN GENERATED BOUNTIFUL CROP SEED BLOCKS";
  const endMarker = "// END GENERATED BOUNTIFUL CROP SEED BLOCKS";
  let content = await readFile(resourceBlocksPath, "utf8");
  content = content.replace(
    /^\t"utilitycraft:[^"]+_crop": \{\r?\n\t\t"sound": "[^"]+"\r?\n\t\},?\r?\n/gm,
    ""
  );
  content = content.replace(
    new RegExp(`\\n,\\n${startMarker}[\\s\\S]*?${endMarker}\\n(?=\\})`),
    ""
  );

  const entries = crops.map(crop =>
    `\t${JSON.stringify(crop.seedId)}: {\n\t\t"sound": "grass"\n\t}`
  );
  const section = `\n,\n${startMarker}\n${entries.join(",\n")}\n${endMarker}\n`;
  const closingBrace = content.lastIndexOf("}");
  if (closingBrace < 0) throw new Error("Invalid RP/blocks.json");
  content = `${content.slice(0, closingBrace).trimEnd()}${section}${content.slice(closingBrace)}`;
  await writeFile(resourceBlocksPath, content, "utf8");
}

async function updateBlockTranslations(crops) {
  const languageFiles = (await readdir(textsRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith(".lang"));

  for (const entry of languageFiles) {
    const filePath = join(textsRoot, entry.name);
    const originalContent = await readFile(filePath, "utf8");
    let content = originalContent.replace(
      /^tile\.utilitycraft:[^=]*_crop\.name=.*(?:\r?\n|$)/gm,
      ""
    );
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const values = new Map();
    for (const line of lines) {
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      values.set(line.slice(0, separator), line.slice(separator + 1));
    }

    const additions = [];
    for (const crop of crops) {
      const localName = crop.seedId.split(":")[1];
      const itemKey = `item.utilitycraft:${localName}`;
      const tileKey = `tile.utilitycraft:${localName}.name`;
      if (values.has(tileKey)) continue;
      additions.push(`${tileKey}=${values.get(itemKey) ?? humanizeSeedName(localName)}`);
    }

    if (additions.length > 0) {
      content = `${content.trimEnd()}\n\n## Bountiful Crops seed blocks\n${additions.join("\n")}\n`;
    }
    if (content !== originalContent) await writeFile(filePath, content, "utf8");
  }
}

function humanizeSeedName(localName) {
  return localName
    .replace(/_seeds$/, " Seeds")
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function generateBonsaiAssets(crops) {
  await Promise.all([
    mkdir(behaviorBonsaisRoot, { recursive: true }),
    mkdir(resourceBonsaisRoot, { recursive: true }),
    mkdir(bonsaiModelsRoot, { recursive: true })
  ]);

  await generateBonsaiGeometryCopies();

  const behaviorReference = await readFile(behaviorBonsaiReferencePath, "utf8");
  const referenceIdentifier = '"identifier": "utilitycraft:oak_tree"';
  if (!behaviorReference.includes(referenceIdentifier)) {
    throw new Error("Crop bonsai behavior reference has an unexpected identifier");
  }
  if (!behaviorReference.includes('"default": 60.0')) {
    throw new Error("Crop bonsai behavior reference must preserve a float growth default");
  }
  const terrainAtlas = JSON.parse(await readFile(terrainAtlasPath, "utf8"));
  const cropBlockFiles = await collectJsonFiles(cropBlocksRoot);
  const matureVisualsByBlock = new Map();

  for (const filePath of cropBlockFiles) {
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const block = document["minecraft:block"];
    const identifier = block?.description?.identifier;
    const maturePermutation = block?.permutations?.find(permutation =>
      typeof permutation.condition === "string" && permutation.condition.includes("age')==5")
    );
    if (!identifier || !maturePermutation) continue;

    const geometry = maturePermutation.components?.["minecraft:geometry"]
      ?? block.components?.["minecraft:geometry"];
    const material = maturePermutation.components?.["minecraft:material_instances"]?.["*"];
    const textureKey = material?.texture;
    const textureDefinition = terrainAtlas.texture_data?.[textureKey];
    const texturePath = Array.isArray(textureDefinition?.textures)
      ? textureDefinition.textures[0]
      : textureDefinition?.textures;

    if (typeof geometry !== "string") throw new Error(`Invalid mature geometry: ${identifier}`);
    if (typeof texturePath !== "string") throw new Error(`Invalid mature texture: ${identifier}`);
    matureVisualsByBlock.set(identifier, { geometry, texturePath });
  }

  for (const crop of crops) {
    const visuals = matureVisualsByBlock.get(crop.seedId);
    if (!visuals) throw new Error(`Missing mature visuals: ${crop.seedId}`);
    const geometry = BONSAI_GEOMETRIES[visuals.geometry];
    if (!geometry) throw new Error(`Unsupported mature geometry ${visuals.geometry}: ${crop.seedId}`);

    const fileName = `${crop.key}_bonsai.json`;
    await writeFile(
      join(behaviorBonsaisRoot, fileName),
      behaviorReference.replace(
        referenceIdentifier,
        `"identifier": "${crop.bonsaiEntityId}"`
      ),
      "utf8"
    );
    await writeJson(
      join(resourceBonsaisRoot, fileName),
      createBonsaiClientEntity(crop.bonsaiEntityId, geometry.identifier, visuals.texturePath)
    );
  }

  const expectedEntityFiles = new Set(crops.map(crop => `${crop.key}_bonsai.json`));
  await validateExactJsonFiles(behaviorBonsaisRoot, expectedEntityFiles, "crop bonsai behavior entity");
  await validateExactJsonFiles(resourceBonsaisRoot, expectedEntityFiles, "crop bonsai client entity");
  await validateExactJsonFiles(
    bonsaiModelsRoot,
    new Set(Object.values(BONSAI_GEOMETRIES).map(geometry => geometry.outputFile)),
    "crop bonsai geometry"
  );
}

async function generateBonsaiGeometryCopies() {
  for (const geometry of Object.values(BONSAI_GEOMETRIES)) {
    const source = JSON.parse(await readFile(join(blockModelsRoot, geometry.sourceFile), "utf8"));
    const copy = structuredClone(source);
    const model = copy["minecraft:geometry"]?.[0];
    if (!model) throw new Error(`Invalid source geometry: ${geometry.sourceFile}`);

    model.description.identifier = geometry.identifier;
    model.description.visible_bounds_width = 2;
    model.description.visible_bounds_height = 1.5;
    model.description.visible_bounds_offset = [0, 0.25, 0];

    for (const bone of model.bones ?? []) {
      if (!bone.parent) bone.parent = "tree";
      scaleVectorProperty(bone, "pivot");
      for (const cube of bone.cubes ?? []) {
        scaleVectorProperty(cube, "origin");
        scaleVectorProperty(cube, "size");
        scaleVectorProperty(cube, "pivot");
        if (typeof cube.inflate === "number") cube.inflate *= 0.25;
      }
    }
    model.bones = [{ name: "tree", pivot: [0, 0, 0] }, ...(model.bones ?? [])];
    await writeJson(join(bonsaiModelsRoot, geometry.outputFile), copy);
  }
}

function scaleVectorProperty(target, property) {
  if (!Array.isArray(target?.[property])) return;
  target[property] = target[property].map(value =>
    typeof value === "number" ? value * 0.25 : value
  );
}

function createBonsaiClientEntity(identifier, geometry, texture) {
  return {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier,
        materials: { default: "entity_alphatest" },
        textures: { default: texture },
        geometry: { default: geometry },
        render_controllers: ["controller.render.default"],
        animations: {
          controller: "controller.animation.utilitycraft_bonsai_dynamic",
          grow_dynamic: "animation.utilitycraft_bonsai.grow_dynamic"
        },
        scripts: { animate: ["controller"] }
      }
    }
  };
}

async function validateExactJsonFiles(directory, expectedFiles, label) {
  const actualFiles = new Set(
    (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => entry.name)
  );

  for (const fileName of expectedFiles) {
    if (!actualFiles.has(fileName)) throw new Error(`Missing ${label}: ${fileName}`);
  }
  for (const fileName of actualFiles) {
    if (!expectedFiles.has(fileName)) throw new Error(`Unregistered ${label}: ${fileName}`);
  }
}

async function collectJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJsonFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

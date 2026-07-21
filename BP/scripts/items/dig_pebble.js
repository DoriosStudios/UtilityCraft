import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack } from "@minecraft/server";

const DEFAULT_DIG_DROPS = [
    { drop: "utilitycraft:gravel_fragments", min: 1, max: 2, prob: 50 },
    { drop: "utilitycraft:stone_pebble", min: 1, max: 2, prob: 50 },
    { drop: "utilitycraft:dirt_handful", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:sand_handful", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:andesite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:diorite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:granite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "minecraft:bone_meal", min: 1, max: 1, prob: 10 }
];

const DEFAULT_DIG_DROPS_BY_BLOCK = {
    "minecraft:dirt": DEFAULT_DIG_DROPS,
    "minecraft:grass_block": DEFAULT_DIG_DROPS,
    "minecraft:mud": [
        { drop: "utilitycraft:mud_ball", min: 1, max: 1, prob: 50 }
    ],
    "minecraft:red_sand": [
        { drop: "utilitycraft:red_sand_handful", min: 1, max: 1, prob: 50 }
    ],
    "minecraft:hardened_clay": [
        { drop: "utilitycraft:red_sand_handful", min: 1, max: 1, prob: 50 }
    ]
};

const DEFAULT_DIG_BLOCKS = Object.keys(DEFAULT_DIG_DROPS_BY_BLOCK);

function normalizeChance(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed > 1) return Math.max(0, Math.min(1, parsed / 100));
    return Math.max(0, Math.min(1, parsed));
}

function normalizeDrops(drops, fallback = DEFAULT_DIG_DROPS) {
    if (!Array.isArray(drops) || drops.length === 0) return fallback;

    const valid = drops
        .filter(entry => entry && typeof entry.drop === "string")
        .map(entry => ({
            drop: entry.drop,
            min: Math.max(1, Math.floor(Number(entry.min ?? 1))),
            max: Math.max(1, Math.floor(Number(entry.max ?? 1))),
            prob: Math.max(0, Math.min(100, Number(entry.prob ?? 100)))
        }));

    return valid.length > 0 ? valid : fallback;
}

function normalizeBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return DEFAULT_DIG_BLOCKS;

    const valid = blocks.filter(blockId => typeof blockId === "string" && blockId.length > 0);
    return valid.length > 0 ? valid : DEFAULT_DIG_BLOCKS;
}

function getDropsForBlock(params, blockId) {
    const configuredByBlock = params?.dropsByBlock;
    if (configuredByBlock && typeof configuredByBlock === "object") {
        const configuredDrops = configuredByBlock[blockId];
        if (Array.isArray(configuredDrops)) return normalizeDrops(configuredDrops, []);
    }

    if (Array.isArray(params?.drops)) return normalizeDrops(params.drops);
    return DEFAULT_DIG_DROPS_BY_BLOCK[blockId] ?? [];
}

DoriosLib.registry.itemComponent("utilitycraft:dig_pebble", {
    onUseOn({ block, source, itemStack }, { params }) {
        if (!block || !source) return;

        const requireSneaking = params?.requireSneaking ?? true;
        if (requireSneaking && !source.isSneaking) return;

        const allowedBlocks = normalizeBlocks(params?.blocks);
        const blockId = block.typeId;
        if (!allowedBlocks.includes(blockId)) return;

        const drops = getDropsForBlock(params, blockId);

        const location = {
            x: block.location.x + 0.5,
            y: block.location.y + 1,
            z: block.location.z + 0.5
        };

        for (const drop of drops) {
            if (Math.random() * 100 > drop.prob) continue;

            const amount = DoriosLib.math.randomInt(drop.min, drop.max);
            if (amount <= 0) continue;
            block.dimension.spawnItem(new ItemStack(drop.drop, amount), location);
        }

        if (DoriosLib.player.isCreative(source) || !itemStack) return;

        const durabilityCost = Math.max(0, Math.floor(Number(params?.durabilityCost ?? 1)));
        if (durabilityCost <= 0) return;

        const durabilityChance = normalizeChance(params?.durabilityChance ?? 1, 1);

        const result = DoriosLib.item.durability.damage(itemStack, durabilityCost, durabilityChance);
        if (!result.broken) {
            DoriosLib.entity.setEquipment(source, { slot: "Mainhand", item: itemStack })
        } else {
            DoriosLib.entity.setEquipment(source, { slot: "Mainhand", item: undefined })
            source.playSound('random.break')
        }
    }
});


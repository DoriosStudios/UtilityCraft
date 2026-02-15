import { ItemStack } from "@minecraft/server";

const DEFAULT_DIG_DROPS = [
    { drop: "utilitycraft:gravel_fragments", min: 1, max: 2, prob: 50 },
    { drop: "utilitycraft:stone_pebble", min: 1, max: 2, prob: 50 },
    { drop: "utilitycraft:dirt_handful", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:andesite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:diorite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "utilitycraft:granite_pebble", min: 1, max: 1, prob: 20 },
    { drop: "minecraft:bone_meal", min: 1, max: 1, prob: 10 }
];

const DEFAULT_DIG_BLOCKS = [
    "minecraft:dirt",
    "minecraft:grass_block"
];

function normalizeChance(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed > 1) return Math.max(0, Math.min(1, parsed / 100));
    return Math.max(0, Math.min(1, parsed));
}

function normalizeDrops(drops) {
    if (!Array.isArray(drops) || drops.length === 0) return DEFAULT_DIG_DROPS;

    const valid = drops
        .filter(entry => entry && typeof entry.drop === "string")
        .map(entry => ({
            drop: entry.drop,
            min: Math.max(1, Math.floor(Number(entry.min ?? 1))),
            max: Math.max(1, Math.floor(Number(entry.max ?? 1))),
            prob: Math.max(0, Math.min(100, Number(entry.prob ?? 100)))
        }));

    return valid.length > 0 ? valid : DEFAULT_DIG_DROPS;
}

function normalizeBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return DEFAULT_DIG_BLOCKS;

    const valid = blocks.filter(blockId => typeof blockId === "string" && blockId.length > 0);
    return valid.length > 0 ? valid : DEFAULT_DIG_BLOCKS;
}

DoriosAPI.register.itemComponent("dig_pebble", {
    onUseOn({ block, source, itemStack }, { params }) {
        if (!block || !source) return;

        const requireSneaking = params?.requireSneaking ?? true;
        if (requireSneaking && !source.isSneaking) return;

        const allowedBlocks = normalizeBlocks(params?.blocks);
        const blockId = block.typeId;
        if (!allowedBlocks.includes(blockId)) return;

        const drops = normalizeDrops(params?.drops);

        const location = {
            x: block.location.x + 0.5,
            y: block.location.y + 1,
            z: block.location.z + 0.5
        };

        for (const drop of drops) {
            if (Math.random() * 100 > drop.prob) continue;

            const amount = DoriosAPI.math.randomInterval(drop.min, drop.max);
            if (amount <= 0) continue;
            block.dimension.spawnItem(new ItemStack(drop.drop, amount), location);
        }

        if (source.isInCreative() || !itemStack) return;

        const durabilityCost = Math.max(0, Math.floor(Number(params?.durabilityCost ?? 1)));
        if (durabilityCost <= 0) return;

        const durabilityChance = normalizeChance(params?.durabilityChance ?? 1, 1);

        if (itemStack.durability?.damage?.(durabilityCost, durabilityChance)) {
            source.setEquipment("Mainhand", itemStack)
        } else {
            source.setEquipment("Mainhand",)
            source.playSound('random.break')
        }
    }
});


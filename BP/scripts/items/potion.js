import { system, world } from "@minecraft/server";

const POTION_SIGNATURE = Object.freeze({
    trackedPotionIds: new Set([
        "minecraft:potion",
        "minecraft:splash_potion",
        "minecraft:lingering_potion"
    ]),
    lore: Object.freeze({
        effectPrefix: "§r§7- Effect: ",
        typePrefix: "§r§7- Type: ",
        idPrefix: "§r§7- ID: ",
        managedPrefixes: [
            "§r§7- Effect: ",
            "§r§7- Type: ",
            "§r§7- ID: ",
            "§r§8uc:sig="
        ]
    }),
    propertyIds: Object.freeze({
        signature: "utilitycraft:potion_signature",
        typeId: "utilitycraft:potion_type",
        delivery: "utilitycraft:potion_delivery",
        effect: "utilitycraft:potion_effect",
        visualId: "utilitycraft:potion_visual_id",
        timeTier: "utilitycraft:potion_time_tier",
        potencyTier: "utilitycraft:potion_potency_tier"
    })
});

const PROPERTY_BINDINGS = Object.freeze([
    [POTION_SIGNATURE.propertyIds.signature, "signature"],
    [POTION_SIGNATURE.propertyIds.typeId, "typeId"],
    [POTION_SIGNATURE.propertyIds.delivery, "delivery"],
    [POTION_SIGNATURE.propertyIds.effect, "effect"],
    [POTION_SIGNATURE.propertyIds.visualId, "visualId"],
    [POTION_SIGNATURE.propertyIds.timeTier, "timeTier", Number],
    [POTION_SIGNATURE.propertyIds.potencyTier, "potencyTier", Number]
]);

const POTION_MAP_INTERVAL = 10;

const EFFECT_CODE_MAP = Object.freeze({
    none: "00",
    empty: "00",
    water: "00",
    awkward: "00",
    mundane: "00",
    thick: "00",
    uncraftable: "00",
    speed: "01",
    slowness: "02",
    haste: "03",
    mining_fatigue: "04",
    strength: "05",
    instant_health: "06",
    instant_damage: "07",
    jump_boost: "08",
    nausea: "09",
    regeneration: "10",
    resistance: "11",
    fire_resistance: "12",
    water_breathing: "13",
    invisibility: "14",
    blindness: "15",
    night_vision: "16",
    hunger: "17",
    weakness: "18",
    poison: "19",
    wither: "20",
    health_boost: "21",
    absorption: "22",
    saturation: "23",
    levitation: "24",
    fatal_poison: "25",
    slow_falling: "26",
    conduit_power: "27",
    bad_omen: "28",
    village_hero: "29",
    darkness: "30",
    trial_omen: "31",
    raid_omen: "32",
    wind_charged: "33",
    weaving: "34",
    oozing: "35",
    infested: "36",
    breath_of_the_nautilus: "37",
    turtle_master: "38",
    luck: "90",
    unluck: "91",
    dolphins_grace: "92",
    glowing: "93",
    unknown: "99"
});

const EFFECT_ALIAS_MAP = Object.freeze({
    speed: "speed",
    swiftness: "speed",
    move_speed: "speed",
    slowness: "slowness",
    move_slowdown: "slowness",
    haste: "haste",
    mining_fatigue: "mining_fatigue",
    strength: "strength",
    instant_health: "instant_health",
    healing: "instant_health",
    heal: "instant_health",
    instant_damage: "instant_damage",
    harming: "instant_damage",
    harm: "instant_damage",
    jump_boost: "jump_boost",
    leaping: "jump_boost",
    jump: "jump_boost",
    nausea: "nausea",
    regeneration: "regeneration",
    resistance: "resistance",
    fire_resistance: "fire_resistance",
    water_breathing: "water_breathing",
    invisibility: "invisibility",
    blindness: "blindness",
    night_vision: "night_vision",
    hunger: "hunger",
    weakness: "weakness",
    poison: "poison",
    wither: "wither",
    decay: "wither",
    health_boost: "health_boost",
    absorption: "absorption",
    saturation: "saturation",
    levitation: "levitation",
    fatal_poison: "fatal_poison",
    slow_falling: "slow_falling",
    conduit_power: "conduit_power",
    bad_omen: "bad_omen",
    trial_omen: "trial_omen",
    raid_omen: "raid_omen",
    village_hero: "village_hero",
    hero_of_the_village: "village_hero",
    wind_charged: "wind_charged",
    wind_charging: "wind_charged",
    weaving: "weaving",
    oozing: "oozing",
    infested: "infested",
    infestation: "infested",
    breath_of_the_nautilus: "breath_of_the_nautilus",
    turtle_master: "turtle_master",
    luck: "luck",
    unluck: "unluck",
    dolphins_grace: "dolphins_grace",
    glowing: "glowing",
    none: "none",
    empty: "empty",
    water: "water",
    awkward: "awkward",
    mundane: "mundane",
    thick: "thick",
    uncraftable: "uncraftable"
});

const POTION_LORE_VISUAL_MAP = Object.freeze({
    // Base and no-effect variants
    none: { effectLabel: "No Effect", timeLabel: "Instant" },
    empty: { effectLabel: "No Effect", timeLabel: "Instant" },
    water: { effectLabel: "No Effect", timeLabel: "Instant" },
    awkward: { effectLabel: "No Effect", timeLabel: "Instant" },
    mundane: { effectLabel: "No Effect", timeLabel: "Instant" },
    long_mundane: { effectLabel: "No Effect", timeLabel: "Instant" },
    thick: { effectLabel: "No Effect", timeLabel: "Instant" },
    uncraftable: { effectLabel: "No Effect", timeLabel: "Instant" },

    // Main potion variants
    speed: { effectLabel: "Speed", timeLabel: "3:00" },
    long_speed: { effectLabel: "Speed", timeLabel: "8:00" },
    strong_speed: { effectLabel: "Speed II", timeLabel: "1:30" },

    slowness: { effectLabel: "Slowness", timeLabel: "1:30" },
    long_slowness: { effectLabel: "Slowness", timeLabel: "4:00" },
    strong_slowness: { effectLabel: "Slowness IV", timeLabel: "0:20" },

    strength: { effectLabel: "Strength", timeLabel: "3:00" },
    long_strength: { effectLabel: "Strength", timeLabel: "8:00" },
    strong_strength: { effectLabel: "Strength II", timeLabel: "1:30" },

    instant_health: { effectLabel: "Instant Health", timeLabel: "Instant" },
    strong_instant_health: { effectLabel: "Instant Health II", timeLabel: "Instant" },

    instant_damage: { effectLabel: "Instant Damage", timeLabel: "Instant" },
    strong_instant_damage: { effectLabel: "Instant Damage II", timeLabel: "Instant" },

    jump_boost: { effectLabel: "Jump Boost", timeLabel: "3:00" },
    long_jump_boost: { effectLabel: "Jump Boost", timeLabel: "8:00" },
    strong_jump_boost: { effectLabel: "Jump Boost II", timeLabel: "1:30" },

    regeneration: { effectLabel: "Regeneration", timeLabel: "0:45" },
    long_regeneration: { effectLabel: "Regeneration", timeLabel: "2:00" },
    strong_regeneration: { effectLabel: "Regeneration II", timeLabel: "0:22" },

    fire_resistance: { effectLabel: "Fire Resistance", timeLabel: "3:00" },
    long_fire_resistance: { effectLabel: "Fire Resistance", timeLabel: "8:00" },

    water_breathing: { effectLabel: "Water Breathing", timeLabel: "3:00" },
    long_water_breathing: { effectLabel: "Water Breathing", timeLabel: "8:00" },

    invisibility: { effectLabel: "Invisibility", timeLabel: "3:00" },
    long_invisibility: { effectLabel: "Invisibility", timeLabel: "8:00" },

    night_vision: { effectLabel: "Night Vision", timeLabel: "3:00" },
    long_night_vision: { effectLabel: "Night Vision", timeLabel: "8:00" },

    weakness: { effectLabel: "Weakness", timeLabel: "1:30" },
    long_weakness: { effectLabel: "Weakness", timeLabel: "4:00" },

    poison: { effectLabel: "Poison", timeLabel: "0:45" },
    long_poison: { effectLabel: "Poison", timeLabel: "2:00" },
    strong_poison: { effectLabel: "Poison II", timeLabel: "0:22" },

    slow_falling: { effectLabel: "Slow Falling", timeLabel: "1:30" },
    long_slow_falling: { effectLabel: "Slow Falling", timeLabel: "4:00" },

    turtle_master: { effectLabel: "Turtle Master", timeLabel: "0:20" },
    long_turtle_master: { effectLabel: "Turtle Master", timeLabel: "0:40" },
    strong_turtle_master: { effectLabel: "Turtle Master II", timeLabel: "0:20" },

    luck: { effectLabel: "Luck", timeLabel: "5:00" },
    wither: { effectLabel: "Wither II", timeLabel: "0:40" },

    wind_charged: { effectLabel: "Wind Charged", timeLabel: "3:00" },
    weaving: { effectLabel: "Weaving", timeLabel: "3:00" },
    oozing: { effectLabel: "Oozing", timeLabel: "3:00" },
    infested: { effectLabel: "Infested", timeLabel: "3:00" }
});

const EFFECT_DURATION_TIER_HINTS = Object.freeze({
    speed: { normal: [3600], extended: [9600] },
    slowness: { normal: [400, 1800], extended: [800, 4800] },
    strength: { normal: [3600], extended: [9600] },
    jump_boost: { normal: [3600], extended: [9600] },
    regeneration: { normal: [900], extended: [2400] },
    poison: { normal: [900], extended: [2400] },
    weakness: { normal: [1800], extended: [4800] },
    fire_resistance: { normal: [3600], extended: [9600] },
    water_breathing: { normal: [3600], extended: [9600] },
    invisibility: { normal: [3600], extended: [9600] },
    night_vision: { normal: [3600], extended: [9600] },
    resistance: { normal: [400], extended: [800] },
    slow_falling: { normal: [1800], extended: [4800] },
    turtle_master: { normal: [400], extended: [800] },
    wither: { normal: [800], extended: [] },
    infested: { normal: [3600], extended: [] },
    oozing: { normal: [3600], extended: [] },
    weaving: { normal: [3600], extended: [] },
    wind_charged: { normal: [3600], extended: [] },
    luck: { normal: [6000], extended: [] }
});

DoriosAPI.register.itemComponent("potion", {
    onUse({ source, itemStack }) {
        if (!source || source.typeId !== "minecraft:player") return;

        const target = source.getEntitiesFromViewDirection({ maxDistance: 3 })?.[0]?.entity;
        if (target?.typeId !== "minecraft:zombie_villager_v2") return;

        target.triggerEvent("villager_converted");

        if (source.isInCreative?.()) return;

        consumeOneFromSelectedSlot(source, itemStack?.typeId ?? "utilitycraft:antidote_potion");
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        mapPotionMetadataInInventory(player);
    }
}, POTION_MAP_INTERVAL);

function mapPotionMetadataInInventory(player) {
    const inventory = player?.getComponent?.("minecraft:inventory")?.container;
    if (!inventory) return;

    for (let slot = 0; slot < inventory.size; slot++) {
        let slotRef;
        try {
            slotRef = inventory.getSlot(slot);
        } catch {
            continue;
        }

        if (!slotRef) continue;

        let stack;
        try {
            stack = slotRef.getItem();
        } catch {
            continue;
        }

        if (!stack || !POTION_SIGNATURE.trackedPotionIds.has(stack.typeId)) continue;

        const potionData = buildPotionSignatureData(stack);
        if (!potionData) continue;

        applyPotionSignatureLore(slotRef, potionData);
        applyPotionSignatureProperties(slotRef, potionData);
    }
}

function buildPotionSignatureData(stack) {
    try {
        const potion = stack.getComponent("minecraft:potion");
        if (!potion) return undefined;

        const typeId = stack.typeId;
        const delivery = normalizeSignaturePart(potion.potionDeliveryType?.id ?? "none");
        const rawEffectId = normalizeSignaturePart(potion.potionEffectType?.id ?? "unknown");
        const durationTicks = Number(potion.potionEffectType?.durationTicks ?? 0);

        const parsedEffect = parsePotionEffectId(rawEffectId);
        const typeDigit = resolveTypeDigit(delivery, typeId);
        const typeLabel = resolveTypeLabel(typeDigit);
        const effectCode = resolveEffectCode(parsedEffect.effectKey);
        const visualLoreData = resolvePotionLoreVisual(parsedEffect, durationTicks, typeDigit);
        const effectLabel = visualLoreData.effectLabel;
        const timeTier = resolveTimeTier(parsedEffect, durationTicks);
        const potencyTier = resolvePotencyTier(parsedEffect, rawEffectId);
        const timeLabel = visualLoreData.timeLabel;
        const extraDigit = resolveExtraDigit(typeId, rawEffectId, timeTier, potencyTier, typeDigit);
        const visualId = `${typeDigit}${effectCode}${timeTier}${potencyTier}${extraDigit}`;
        const signature = `${typeId}|${delivery}|${rawEffectId}|${timeTier}|${potencyTier}|${visualId}`;

        return {
            signature,
            typeId,
            delivery,
            effect: rawEffectId,
            timeTier,
            potencyTier,
            visualId,
            typeLabel,
            effectLabel,
            timeLabel
        };
    } catch {
        return undefined;
    }
}

function normalizeSignaturePart(value) {
    if (typeof value !== "string" || value.length === 0) return "none";
    return value.toLowerCase();
}

function normalizePotionEffectId(effectId) {
    return normalizeSignaturePart(effectId)
        .replace(/^minecraft:/, "")
        .replace(/-/g, "_");
}

function normalizeEffectKey(effectKey) {
    const normalized = normalizePotionEffectId(effectKey)
        .replace(/^_+|_+$/g, "");

    if (!normalized) return "unknown";
    return EFFECT_ALIAS_MAP[normalized] ?? normalized;
}

function parsePotionEffectId(effectId) {
    const lower = normalizePotionEffectId(effectId);

    const isExtended =
        lower.includes("long") ||
        lower.includes("extended");

    const isStrong =
        lower.includes("strong") ||
        lower.endsWith("_ii") ||
        lower.includes("_ii_") ||
        lower.includes("level_2");

    const effectKey = normalizeEffectKey(lower
        .replace(/(^|_)long(_|$)/g, "_")
        .replace(/(^|_)extended(_|$)/g, "_")
        .replace(/(^|_)strong(_|$)/g, "_")
        .replace(/(^|_)ii(_|$)/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, ""));

    const isInstant = effectKey === "instant_health" || effectKey === "instant_damage";
    const variantKey = resolvePotionVariantKey(effectKey, isExtended, isStrong);

    return {
        effectKey: effectKey || "unknown",
        variantKey,
        isExtended,
        isStrong,
        isInstant
    };
}

function resolvePotionVariantKey(effectKey, isExtended, isStrong) {
    const normalizedKey = normalizeEffectKey(effectKey);
    if (isStrong) return `strong_${normalizedKey}`;
    if (isExtended) return `long_${normalizedKey}`;
    return normalizedKey;
}

function resolvePotionLoreVisual(parsedEffect, durationTicks, typeDigit) {
    const mappedVisual =
        POTION_LORE_VISUAL_MAP[parsedEffect.variantKey] ??
        POTION_LORE_VISUAL_MAP[parsedEffect.effectKey];

    const fallbackEffectLabel = resolveEffectLabel(parsedEffect.effectKey);
    const fallbackTimeLabel = resolveTimeLabel(parsedEffect, durationTicks);
    const baseTimeLabel = mappedVisual?.timeLabel ?? fallbackTimeLabel;
    const timeLabel =
        typeDigit === "3"
            ? resolveLingeringTimeLabel(baseTimeLabel, durationTicks)
            : baseTimeLabel;

    if (!mappedVisual) {
        return {
            effectLabel: fallbackEffectLabel,
            timeLabel
        };
    }

    return {
        effectLabel: mappedVisual.effectLabel ?? fallbackEffectLabel,
        timeLabel
    };
}

function resolveLingeringTimeLabel(baseTimeLabel, durationTicks) {
    if (baseTimeLabel === "Instant" || baseTimeLabel === "Unknown") return baseTimeLabel;

    let totalSeconds = parseTimeLabelToSeconds(baseTimeLabel);

    if (totalSeconds === undefined) {
        const duration = Number.isFinite(durationTicks) ? Math.max(0, Math.floor(durationTicks)) : 0;
        if (duration <= 0) return baseTimeLabel;
        totalSeconds = Math.floor(duration / 20);
    }

    return formatSecondsAsTimeLabel(Math.floor(totalSeconds / 4));
}

function parseTimeLabelToSeconds(timeLabel) {
    if (typeof timeLabel !== "string") return undefined;

    const match = /^(\d+):(\d{2})$/.exec(timeLabel.trim());
    if (!match) return undefined;

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
    return minutes * 60 + seconds;
}

function formatSecondsAsTimeLabel(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolveTypeDigit(delivery, typeId) {
    const normalizedDelivery = normalizeSignaturePart(delivery);

    if (normalizedDelivery.includes("linger") || typeId === "minecraft:lingering_potion") return "3";
    if (normalizedDelivery.includes("splash") || typeId === "minecraft:splash_potion") return "2";
    return "1";
}

function resolveTypeLabel(typeDigit) {
    switch (typeDigit) {
        case "1": return "Drink";
        case "2": return "Splash";
        case "3": return "Lingering";
        default: return "Unknown";
    }
}

function resolveEffectCode(effectKey) {
    return EFFECT_CODE_MAP[effectKey] ?? "99";
}

function resolveEffectLabel(effectKey) {
    if (["none", "empty", "water", "awkward", "mundane", "thick", "uncraftable"].includes(effectKey)) {
        return "No Effect";
    }

    const formatIdToText = globalThis.DoriosAPI?.utils?.formatIdToText;
    if (typeof formatIdToText === "function") {
        return formatIdToText(effectKey);
    }

    return effectKey
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ") || "Unknown";
}

function resolveTimeTier(parsedEffect, durationTicks) {
    if (parsedEffect.isInstant) return "1";
    if (parsedEffect.isExtended) return "2";

    const duration = Number.isFinite(durationTicks) ? Math.max(0, Math.floor(durationTicks)) : 0;
    const tierHints = EFFECT_DURATION_TIER_HINTS[parsedEffect.effectKey];

    if (!tierHints || duration <= 0) return "1";

    if (tierHints.extended.includes(duration)) return "2";
    if (tierHints.normal.includes(duration)) return "1";

    const maxNormal = Math.max(...tierHints.normal);
    return duration > maxNormal ? "2" : "1";
}

function resolvePotencyTier(parsedEffect, rawEffectId) {
    const normalized = normalizeSignaturePart(rawEffectId);
    if (parsedEffect.isStrong) return "2";
    if (normalized.includes("iii") || normalized.includes("level_3")) return "3";
    return "1";
}

function resolveTimeLabel(parsedEffect, durationTicks) {
    if (parsedEffect.isInstant) return "Instant";

    const duration = Number.isFinite(durationTicks) ? Math.max(0, Math.floor(durationTicks)) : 0;
    if (duration <= 0) return "Unknown";

    const totalSeconds = Math.floor(duration / 20);
    const formatTimeFull = globalThis.DoriosAPI?.utils?.formatTimeFull;
    if (typeof formatTimeFull === "function") {
        return formatTimeFull(totalSeconds);
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolveExtraDigit(typeId, rawEffectId, timeTier, potencyTier, typeDigit) {
    const seed = `${typeId}|${rawEffectId}|${timeTier}|${potencyTier}|${typeDigit}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) % 10;
    }
    return String(hash);
}

function applyPotionSignatureLore(slotRef, potionData) {
    let currentLore = [];
    try {
        currentLore = slotRef.getLore() ?? [];
    } catch {
        return;
    }

    const filteredLore = currentLore.filter((line) => !POTION_SIGNATURE.lore.managedPrefixes.some((prefix) => line.startsWith(prefix)));
    const presentationLines = [
        `${POTION_SIGNATURE.lore.effectPrefix}${potionData.effectLabel} (${potionData.timeLabel})`,
        `${POTION_SIGNATURE.lore.typePrefix}${potionData.typeLabel}`,
        `${POTION_SIGNATURE.lore.idPrefix}${potionData.visualId}`
    ];

    const nextLore = [...filteredLore, ...presentationLines];

    while (nextLore.length > 20) {
        nextLore.shift();
    }

    if (nextLore.length >= 3) {
        nextLore[nextLore.length - 3] = presentationLines[0];
        nextLore[nextLore.length - 2] = presentationLines[1];
        nextLore[nextLore.length - 1] = presentationLines[2];
    }

    if (areStringArraysEqual(currentLore, nextLore)) return;

    try {
        slotRef.setLore(nextLore);
    } catch {
        // Ignore lore write failures (e.g. foreign capped lore), dynamic properties still preserve mapping.
    }
}

function applyPotionSignatureProperties(slotRef, potionData) {
    for (const [propertyId, dataKey, transform] of PROPERTY_BINDINGS) {
        const rawValue = potionData[dataKey];
        const value = typeof transform === "function" ? transform(rawValue) : rawValue;
        safeSetDynamicProperty(slotRef, propertyId, value);
    }
}

function safeSetDynamicProperty(slotRef, id, value) {
    try {
        if (slotRef.getDynamicProperty(id) === value) return;
        slotRef.setDynamicProperty(id, value);
    } catch {
        // Ignore unsupported dynamic-property scenarios.
    }
}

function areStringArraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function consumeOneFromSelectedSlot(player, expectedTypeId) {
    const inventory = player?.getComponent?.("minecraft:inventory")?.container;
    if (!inventory) return;

    const slot = player.selectedSlotIndex ?? 0;
    const current = inventory.getItem(slot);
    if (!current || current.typeId !== expectedTypeId) return;

    if (current.amount > 1) {
        current.amount -= 1;
        inventory.setItem(slot, current);
        return;
    }

    inventory.setItem(slot, undefined);
}

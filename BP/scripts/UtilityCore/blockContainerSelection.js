import { system, world } from "@minecraft/server";
import { dropAllItems } from "../DoriosCore/utils/entity.js";
import { TickScheduler } from "../DoriosCore/machinery/tickScheduler.js";
import {
    BLOCK_CONTAINER_FAMILY, SELECTION_INTERVAL, SELECTION_REACH,
    ownerLocation, containerLocation, needsPositionCorrection, sameBlock,
} from "./blockContainerTarget.js";

const OUTLINE_ID = "utilitycraft:block_container_outline";
const VISIBLE = "utilitycraft:selection_visible";
const EMPTY = "utilitycraft:selection_empty";
const viewers = new Map();
let active = new Map();
const pendingOrphans = new Set();

function valid(entity) { return entity?.isValid === true; }
function compatible(entity) {
    return valid(entity)
        && entity.getComponent("minecraft:type_family")?.hasTypeFamily(BLOCK_CONTAINER_FAMILY);
}
// A container can belong to any non-air block; only its entity family opts in.
function supported(block) {
    return block && !block.isAir;
}
function selectable(entity) {
    // Inactive multiblock controllers shrink themselves to leave their block accessible.
    return compatible(entity) && (entity.getComponent("minecraft:scale")?.value ?? 1) >= 1;
}
function blockKey(block) {
    const { x, y, z } = block.location;
    return `${block.dimension.id}:${x},${y},${z}`;
}

function checkOrphan(entity) {
    if (!valid(entity) || pendingOrphans.has(entity.id)) return;
    // Addons with virtual inventories retain ownership of their cleanup lifecycle.
    if (entity.getProperty("utilitycraft:orphan_cleanup") === false) return;
    pendingOrphans.add(entity.id);
    // Machine.onDestroy / Generator.onDestroy finish their deferred resource drop first.
    system.runTimeout(() => {
        pendingOrphans.delete(entity.id);
        try {
            if (!compatible(entity)) return;
            const block = entity.dimension.getBlock(ownerLocation(entity.location));
            if (!block?.isAir) return; // Unavailable chunks are never treated as air.
            TickScheduler.releaseTickGroup(entity);
            dropAllItems(entity);
            entity.remove();
        } catch { /* The chunk may have unloaded. Retry when encountered again. */ }
    }, 2);
}

// Entity hits are only cleanup candidates; they never participate in selection.
function cleanOrphansInView(player) {
    for (const { entity } of player.getEntitiesFromViewDirection({ maxDistance: SELECTION_REACH })) {
        try {
            if (compatible(entity)
                && entity.dimension.getBlock(ownerLocation(entity.location))?.isAir) checkOrphan(entity);
        } catch { /* An unavailable entity must not interrupt selection or other cleanup. */ }
    }
}

function positionContainer(entity, block) {
    const expected = containerLocation(block.location);
    if (needsPositionCorrection(entity.location, expected)) entity.teleport(expected);
}

function setMode(target, empty) {
    const { entity } = target;
    if (!valid(entity)) return;
    // Recenter the entity before restoring its normal hitbox.
    if (!empty) positionContainer(entity, target.block);
    if (entity.getProperty(EMPTY) !== empty) {
        entity.triggerEvent(empty ? "utilitycraft:selection_empty" : "utilitycraft:selection_full");
    }
}

function prepare(entity) {
    if (!compatible(entity)) return;
    const block = entity.dimension.getBlock(ownerLocation(entity.location));
    if (!block) return;
    if (block.isAir) { checkOrphan(entity); return; }
    positionContainer(entity, block);
    const target = { entity, block };
    if (!selectable(entity)) return;
    return target;
}

function resolve(player, previous, cache) {
    const block = player.getBlockFromViewDirection({
        maxDistance: SELECTION_REACH, includePassableBlocks: true,
    })?.block;
    if (!supported(block)) return;
    const key = blockKey(block);
    if (cache.has(key)) return cache.get(key);
    let entity = previous?.entity;
    if (!compatible(entity) || entity.dimension.id !== block.dimension.id
        || !sameBlock(ownerLocation(entity.location), block.location)) {
        entity = block.dimension.getEntitiesAtBlockLocation(block.location).find(candidate =>
            compatible(candidate) && sameBlock(ownerLocation(candidate.location), block.location));
    }
    const target = prepare(entity);
    cache.set(key, target);
    return target;
}

function removeOutline(outline) {
    if (valid(outline)) outline.remove();
}

function createOutline(player, target) {
    if (!target || player.isSneaking) return;
    const outline = target.block.dimension.spawnEntity(OUTLINE_ID, target.block.center());
    try {
        player.setPropertyOverrideForEntity(outline, VISIBLE, true);
        return outline;
    } catch (error) {
        removeOutline(outline);
        throw error;
    }
}

// One global pass: two raycasts per player, never a scan over placed machines.
system.runInterval(() => {
    const next = new Map();
    const online = new Set();
    const cache = new Map();
    for (const player of world.getAllPlayers()) {
        online.add(player.id);
        try { cleanOrphansInView(player); } catch { /* Cleanup is independent of selection. */ }
        const previous = viewers.get(player.id);
        let outline;
        try {
            const target = resolve(player, previous, cache);
            removeOutline(previous?.outline);
            outline = createOutline(player, target);
            if (!target) { viewers.delete(player.id); continue; }
            viewers.set(player.id, { ...target, outline });
            const entry = next.get(target.entity.id) ?? { ...target, standing: false };
            entry.standing ||= !player.isSneaking;
            next.set(target.entity.id, entry);
        } catch {
            try { removeOutline(previous?.outline); removeOutline(outline); } catch {}
            viewers.delete(player.id);
        }
    }
    for (const [id, viewer] of viewers) if (!online.has(id)) {
        try { removeOutline(viewer.outline); } catch {}
        viewers.delete(id);
    }
    for (const [id, target] of active) {
        if (!next.has(id)) {
            try { setMode(target, false); } catch { /* The entity may have unloaded. */ }
        }
    }
    for (const target of next.values()) {
        try { setMode(target, !target.standing); } catch {}
    }
    active = next;
}, SELECTION_INTERVAL);

// Feedback only: hitting a container does not change selection or collision.
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity }) => {
    if (player.typeId === "minecraft:player" && selectable(hitEntity)) {
        player.onScreenDisplay.setActionBar("Sneak to mine");
    }
});

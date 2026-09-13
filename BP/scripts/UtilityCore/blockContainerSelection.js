import { system, world } from "@minecraft/server";
import { dropAllItems } from "../DoriosCore/utils/entity.js";
import { TickScheduler } from "../DoriosCore/machinery/tickScheduler.js";
import {
    BLOCK_CONTAINER_FAMILY, SELECTION_INTERVAL, SELECTION_REACH,
    ownerLocation, containerLocation, needsPositionCorrection, sameBlock, chooseTarget,
} from "./blockContainerTarget.js";

const OUTLINE_ID = "utilitycraft:block_container_outline";
const VISIBLE = "utilitycraft:selection_visible";
const EMPTY = "utilitycraft:selection_empty";
const ORPHAN_EVENT = "utilitycraft:container_check_air";
const viewers = new Map();
let active = new Map();
const pendingOrphans = new Set();
const hints = new Map();

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

function setMode(target, empty) {
    const { entity } = target;
    if (!valid(entity)) return;
    if (entity.getProperty(EMPTY) !== empty) {
        entity.triggerEvent(empty ? "utilitycraft:selection_empty" : "utilitycraft:selection_full");
    }
}

function prepare(entity, reset = false) {
    if (!compatible(entity)) return;
    const block = entity.dimension.getBlock(ownerLocation(entity.location));
    if (!block) return;
    if (block.isAir) { checkOrphan(entity); return; }
    const expected = containerLocation(block.location);
    if (needsPositionCorrection(entity.location, expected)) entity.teleport(expected);
    const target = { entity, block };
    if (reset) setMode(target, false);
    if (!selectable(entity)) return;
    return target;
}

function resolve(player, previous, cache) {
    const head = player.getHeadLocation();
    const blockHit = player.getBlockFromViewDirection({
        maxDistance: SELECTION_REACH, includePassableBlocks: true,
    });
    // Do not filter out other entities before choosing the nearest target:
    // a mob in front of the machine should still obstruct it.
    const hits = player.getEntitiesFromViewDirection({ maxDistance: SELECTION_REACH });
    let entityHit;
    for (const hit of hits) {
        if (hit.entity.id !== player.id && (!entityHit || hit.distance < entityHit.distance)) entityHit = hit;
    }
    const hit = chooseTarget(head, blockHit, entityHit);
    if (hit?.entity) return prepare(hit.entity);
    const block = hit?.block;
    if (!supported(block)) return;
    const key = blockKey(block);
    if (cache.has(key)) return cache.get(key);
    let entity = previous?.entity;
    if (!compatible(entity) || entity.dimension.id !== block.dimension.id
        || !sameBlock(ownerLocation(entity.location), block.location)) {
        entity = block.dimension.getEntitiesAtBlockLocation(block.location).find(compatible);
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

function hint(player) {
    if ((hints.get(player.id) ?? -100) + 20 > system.currentTick) return;
    hints.set(player.id, system.currentTick);
    player.onScreenDisplay.setActionBar("Sneak to break this machine");
    player.playSound("note.bass");
}

// One global pass: two raycasts per player, never a scan over placed machines.
system.runInterval(() => {
    const next = new Map();
    const online = new Set();
    const cache = new Map();
    for (const player of world.getAllPlayers()) {
        online.add(player.id);
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
    for (const id of hints.keys()) if (!online.has(id)) hints.delete(id);
    for (const [id, target] of active) {
        if (!next.has(id)) {
            try { setMode(target, false); } catch { /* Reset on entity load. */ }
        }
    }
    for (const target of next.values()) {
        try { setMode(target, !target.standing); } catch {}
    }
    active = next;
}, SELECTION_INTERVAL);

// Event-driven migration: no periodic world-wide entity enumeration.
function initialize({ entity }) {
    if (!compatible(entity)) return;
    system.run(() => { try { prepare(entity, true); } catch {} });
}
world.afterEvents.entitySpawn.subscribe(initialize);
world.afterEvents.entityLoad.subscribe(initialize);
world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity }) => checkOrphan(entity), {
    eventTypes: [ORPHAN_EVENT],
});
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity }) => {
    if (player.typeId === "minecraft:player" && selectable(hitEntity)) hint(player);
});
world.beforeEvents.playerBreakBlock.subscribe(event => {
    if (!supported(event.block)) return;
    const entity = event.block.dimension.getEntitiesAtBlockLocation(event.block.location).find(compatible);
    if (!selectable(entity)) return;
    // Enforce sneak even during the four-tick transition window.
    if (!event.player.isSneaking || active.get(entity.id)?.standing) {
        event.cancel = true;
        system.run(() => { if (valid(event.player)) hint(event.player); });
    }
});

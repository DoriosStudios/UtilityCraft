import { world } from '@minecraft/server';

// One enum covers all solid/fluid pairs with a shared capacity of four.
// Ordering is part of the saved block format: do not reorder these entries.
export const CONTENTS = Object.freeze([
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 0], [2, 1], [2, 2], [3, 0], [3, 1], [4, 0]
].map(pair => Object.freeze(pair)));

export function readContent(block) {
    return CONTENTS[block.permutation.getState('utilitycraft:content')] ?? CONTENTS[0];
}

export function contentCode(solid, fluid) {
    const code = CONTENTS.findIndex(pair => pair[0] === solid && pair[1] === fluid);
    if (code < 0) throw new Error('Invalid compact block content');
    return code;
}

export function writeContent(block, solid, fluid) {
    block.setPermutation(block.permutation.withState('utilitycraft:content', contentCode(solid, fluid)));
}

function storageKey(block, kind) {
    const { x, y, z } = block.location;
    return `utilitycraft:block_data:${kind}:${block.dimension.id}:${x},${y},${z}`;
}

export function readBlockValue(block, kind, max) {
    const value = world.getDynamicProperty(storageKey(block, kind));
    return Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
}

export function writeBlockValue(block, kind, value) {
    const key = storageKey(block, kind);
    const stored = value === 0 ? undefined : value;
    if (world.getDynamicProperty(key) !== stored) world.setDynamicProperty(key, stored);
}

// Use onPlace/onBreak on each owner; no polling or world scans are needed.
export function clearBlockValue(block, kind) {
    writeBlockValue(block, kind, 0);
}

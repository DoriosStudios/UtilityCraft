// Pure target math, shared by the global selector and its regression tests.
export const BLOCK_CONTAINER_FAMILY = "utilitycraft:block_container";
export const SELECTION_INTERVAL = 4;
export const SELECTION_REACH = 6;
const EPSILON = 0.01;

export function ownerLocation(location) {
    return { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
}

export function containerLocation(blockLocation) {
    // Keep the feet inside the owning cell, including at negative coordinates.
    return { x: blockLocation.x + 0.5, y: blockLocation.y + 0.001, z: blockLocation.z + 0.5 };
}

export function needsPositionCorrection(actual, expected) {
    return Math.abs(actual.x - expected.x) > 0.0001
        || Math.abs(actual.y - expected.y) > 0.0001
        || Math.abs(actual.z - expected.z) > 0.0001;
}

export function sameBlock(left, right) {
    return left.x === right.x && left.y === right.y && left.z === right.z;
}

export function blockHitDistance(head, hit) {
    if (!hit) return Infinity;
    const { block, faceLocation } = hit;
    return Math.hypot(
        block.location.x + faceLocation.x - head.x,
        block.location.y + faceLocation.y - head.y,
        block.location.z + faceLocation.z - head.z,
    );
}

export function chooseTarget(head, blockHit, entityHit) {
    const distance = blockHitDistance(head, blockHit);
    // The container can overlap its own block by a tiny amount after migration.
    if (entityHit && entityHit.distance <= distance + EPSILON) return { entity: entityHit.entity };
    return blockHit ? { block: blockHit.block } : undefined;
}

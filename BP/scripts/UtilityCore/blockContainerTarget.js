// Pure target math, shared by the global selector and its regression tests.
export const BLOCK_CONTAINER_FAMILY = "utilitycraft:block_container";
export const SELECTION_INTERVAL = 2;
export const SELECTION_REACH = 6;

export function ownerLocation(location) {
    return { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
}

export function containerLocation(blockLocation) {
    // Keep the entity origin inside its owning cell.
    return { x: blockLocation.x + 0.5, y: blockLocation.y, z: blockLocation.z + 0.5 };
}

export function needsPositionCorrection(actual, expected) {
    return Math.abs(actual.x - expected.x) > 0.0001
        || Math.abs(actual.y - expected.y) > 0.0001
        || Math.abs(actual.z - expected.z) > 0.0001;
}

export function sameBlock(left, right) {
    return left.x === right.x && left.y === right.y && left.z === right.z;
}

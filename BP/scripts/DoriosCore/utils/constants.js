/**
 * Default spawn offset used for UtilityCraft machine helper entities.
 */
export const DEFAULT_MACHINE_SPAWN_OFFSET = { x: 0, y: -0.25, z: 0 };

/**
 * Script event used to register special slot metadata for machine entities.
 */
export const SPECIAL_CONTAINER_EVENT_ID = "dorios:special_container";

/**
 * Dynamic property used to persist special container slot metadata.
 */
export const SPECIAL_CONTAINER_PROPERTY_ID = "dorios:special_container";

/**
 * Script event used to register Item Ducts slot data.
 */
export const ITEM_DUCTS_REGISTER_EVENT_ID = "item_ducts:register";

/**
 * Script event used to refresh adjacent pipe networks.
 */
export const UPDATE_PIPES_EVENT_ID = "dorios:updatePipes";

/**
 * Block tag that marks energy-compatible blocks or ports.
 */
export const ENERGY_BLOCK_TAG = "dorios:energy";

/**
 * Block tag that marks item-compatible blocks or ports.
 */
export const ITEM_BLOCK_TAG = "dorios:item";

/**
 * Block tag that marks fluid-compatible blocks or ports.
 */
export const FLUID_BLOCK_TAG = "dorios:fluid";

/**
 * Item tags reserved for UtilityCraft UI-only inventory elements.
 */
export const UI_ITEM_TAGS = [
  "utilitycraft:ui_element",
  "utilitycraft:ui.element",
];

/**
 * Rotation order for vanilla `minecraft:facing_direction`.
 */
export const FACING_DIRECTIONS = ["up", "down", "north", "south", "east", "west"];

/**
 * Rotation order for vanilla `minecraft:cardinal_direction`.
 */
export const CARDINAL_DIRECTIONS = ["north", "south", "east", "west"];

/**
 * Precomputed 24-axis rotation table used by UtilityCraft axis blocks.
 *
 * Keys follow the shape: `clickedFace -> currentAxis -> currentRotation`.
 */
export const ROTATION_MAP = {
  up: {
    north: {
      0: { axis: "west", rotation: 0 },
      1: { axis: "west", rotation: 1 },
      2: { axis: "west", rotation: 2 },
      3: { axis: "west", rotation: 3 },
    },
    west: {
      0: { axis: "south", rotation: 0 },
      1: { axis: "south", rotation: 1 },
      2: { axis: "south", rotation: 2 },
      3: { axis: "south", rotation: 3 },
    },
    south: {
      0: { axis: "east", rotation: 0 },
      1: { axis: "east", rotation: 1 },
      2: { axis: "east", rotation: 2 },
      3: { axis: "east", rotation: 3 },
    },
    east: {
      0: { axis: "north", rotation: 0 },
      1: { axis: "north", rotation: 1 },
      2: { axis: "north", rotation: 2 },
      3: { axis: "north", rotation: 3 },
    },
  },
  down: {
    north: {
      0: { axis: "east", rotation: 0 },
      1: { axis: "east", rotation: 1 },
      2: { axis: "east", rotation: 2 },
      3: { axis: "east", rotation: 3 },
    },
    east: {
      0: { axis: "south", rotation: 0 },
      1: { axis: "south", rotation: 1 },
      2: { axis: "south", rotation: 2 },
      3: { axis: "south", rotation: 3 },
    },
    south: {
      0: { axis: "west", rotation: 0 },
      1: { axis: "west", rotation: 1 },
      2: { axis: "west", rotation: 2 },
      3: { axis: "west", rotation: 3 },
    },
    west: {
      0: { axis: "north", rotation: 0 },
      1: { axis: "north", rotation: 1 },
      2: { axis: "north", rotation: 2 },
      3: { axis: "north", rotation: 3 },
    },
  },
  south: {
    up: {
      0: { axis: "west", rotation: 1 },
      1: { axis: "east", rotation: 0 },
      2: { axis: "west", rotation: 3 },
      3: { axis: "east", rotation: 2 },
    },
    east: {
      0: { axis: "down", rotation: 1 },
      1: { axis: "up", rotation: 2 },
      2: { axis: "down", rotation: 3 },
      3: { axis: "up", rotation: 0 },
    },
    down: {
      0: { axis: "east", rotation: 1 },
      1: { axis: "west", rotation: 2 },
      2: { axis: "east", rotation: 3 },
      3: { axis: "west", rotation: 0 },
    },
    west: {
      0: { axis: "up", rotation: 3 },
      1: { axis: "down", rotation: 2 },
      2: { axis: "up", rotation: 1 },
      3: { axis: "down", rotation: 0 },
    },
  },
  north: {
    up: {
      0: { axis: "east", rotation: 3 },
      1: { axis: "west", rotation: 2 },
      2: { axis: "east", rotation: 1 },
      3: { axis: "west", rotation: 0 },
    },
    east: {
      0: { axis: "up", rotation: 1 },
      1: { axis: "down", rotation: 0 },
      2: { axis: "up", rotation: 3 },
      3: { axis: "down", rotation: 2 },
    },
    down: {
      0: { axis: "west", rotation: 3 },
      1: { axis: "east", rotation: 0 },
      2: { axis: "west", rotation: 1 },
      3: { axis: "east", rotation: 2 },
    },
    west: {
      0: { axis: "down", rotation: 3 },
      1: { axis: "up", rotation: 0 },
      2: { axis: "down", rotation: 1 },
      3: { axis: "up", rotation: 2 },
    },
  },
  east: {
    up: {
      0: { axis: "south", rotation: 0 },
      1: { axis: "south", rotation: 1 },
      2: { axis: "south", rotation: 2 },
      3: { axis: "south", rotation: 3 },
    },
    south: {
      0: { axis: "down", rotation: 0 },
      1: { axis: "down", rotation: 3 },
      2: { axis: "down", rotation: 2 },
      3: { axis: "up", rotation: 1 },
    },
    down: {
      0: { axis: "north", rotation: 2 },
      1: { axis: "north", rotation: 1 },
      2: { axis: "north", rotation: 0 },
      3: { axis: "north", rotation: 3 },
    },
    north: {
      0: { axis: "up", rotation: 2 },
      1: { axis: "up", rotation: 3 },
      2: { axis: "up", rotation: 0 },
      3: { axis: "up", rotation: 1 },
    },
  },
  west: {
    down: {
      0: { axis: "north", rotation: 2 },
      1: { axis: "north", rotation: 3 },
      2: { axis: "north", rotation: 0 },
      3: { axis: "north", rotation: 1 },
    },
    north: {
      0: { axis: "up", rotation: 2 },
      1: { axis: "up", rotation: 1 },
      2: { axis: "up", rotation: 0 },
      3: { axis: "up", rotation: 3 },
    },
    up: {
      0: { axis: "south", rotation: 2 },
      1: { axis: "south", rotation: 3 },
      2: { axis: "south", rotation: 0 },
      3: { axis: "south", rotation: 1 },
    },
    south: {
      0: { axis: "down", rotation: 2 },
      1: { axis: "down", rotation: 3 },
      2: { axis: "down", rotation: 0 },
      3: { axis: "down", rotation: 1 },
    },
  },
};

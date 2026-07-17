// @ts-check

import {
  CommandPermissionLevel,
  CustomCommandParamType,
  EquipmentSlot,
} from "@minecraft/server";

/** Command permission names accepted by DoriosLib registrars. */
export const PERMISSION_LEVELS = {
  any: CommandPermissionLevel.Any,
  gamedirector: CommandPermissionLevel.GameDirectors,
  gameDirectors: CommandPermissionLevel.GameDirectors,
  admin: CommandPermissionLevel.Admin,
  host: CommandPermissionLevel.Host,
  owner: CommandPermissionLevel.Owner,
};

/** Command parameter names accepted by DoriosLib registrars. */
export const COMMAND_PARAMETER_TYPES = {
  string: CustomCommandParamType.String,
  int: CustomCommandParamType.Integer,
  integer: CustomCommandParamType.Integer,
  float: CustomCommandParamType.Float,
  bool: CustomCommandParamType.Boolean,
  boolean: CustomCommandParamType.Boolean,
  enum: CustomCommandParamType.Enum,
  block: CustomCommandParamType.BlockType,
  item: CustomCommandParamType.ItemType,
  location: CustomCommandParamType.Location,
  entity: CustomCommandParamType.EntitySelector,
  target: CustomCommandParamType.EntitySelector,
  entityType: CustomCommandParamType.EntityType,
  player: CustomCommandParamType.PlayerSelector,
};

/** Equipment slots exposed by the current Script API. */
export const EQUIPMENT_SLOTS = Object.values(EquipmentSlot);

/** Unit vectors for the six Minecraft block directions. */
export const DIRECTION_VECTORS = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

/** Dimension identifiers and build-height bounds used by UtilityCraft logic. */
export const DIMENSIONS = {
  overworld: { id: "minecraft:overworld", minY: -64, maxY: 320 },
  nether: { id: "minecraft:nether", minY: 0, maxY: 128 },
  end: { id: "minecraft:the_end", minY: 0, maxY: 256 },
};

/**
 * Block types that addon tools should not attempt to destroy.
 *
 * This is an addon safety policy because Script API does not currently expose
 * a general `unbreakable` property for BlockType.
 */
export const UNBREAKABLE_BLOCKS = [
  "minecraft:allow",
  "minecraft:barrier",
  "minecraft:bedrock",
  "minecraft:border_block",
  "minecraft:chain_command_block",
  "minecraft:command_block",
  "minecraft:deny",
  "minecraft:end_portal",
  "minecraft:end_portal_frame",
  "minecraft:jigsaw",
  "minecraft:portal",
  "minecraft:reinforced_deepslate",
  "minecraft:repeating_command_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
];

/** Vanilla block types that provide container-like storage. */
export const VANILLA_CONTAINER_BLOCKS = [
  "minecraft:barrel",
  "minecraft:blast_furnace",
  "minecraft:black_shulker_box",
  "minecraft:blue_shulker_box",
  "minecraft:brewing_stand",
  "minecraft:brown_shulker_box",
  "minecraft:chest",
  "minecraft:chiseled_bookshelf",
  "minecraft:crafter",
  "minecraft:cyan_shulker_box",
  "minecraft:decorated_pot",
  "minecraft:dispenser",
  "minecraft:dropper",
  "minecraft:ender_chest",
  "minecraft:furnace",
  "minecraft:gray_shulker_box",
  "minecraft:green_shulker_box",
  "minecraft:hopper",
  "minecraft:light_blue_shulker_box",
  "minecraft:light_gray_shulker_box",
  "minecraft:lime_shulker_box",
  "minecraft:magenta_shulker_box",
  "minecraft:orange_shulker_box",
  "minecraft:pink_shulker_box",
  "minecraft:purple_shulker_box",
  "minecraft:red_shulker_box",
  "minecraft:smoker",
  "minecraft:trapped_chest",
  "minecraft:undyed_shulker_box",
  "minecraft:white_shulker_box",
  "minecraft:yellow_shulker_box",
];

/**
 * Checks whether addon tools should treat a block type as unbreakable.
 *
 * @param {string} typeId
 * @returns {boolean}
 */
export function isUnbreakableBlock(typeId) {
  return UNBREAKABLE_BLOCKS.includes(typeId);
}

/**
 * Checks whether a block type is a known vanilla container.
 *
 * @param {string} typeId
 * @returns {boolean}
 */
export function isVanillaContainerBlock(typeId) {
  return VANILLA_CONTAINER_BLOCKS.includes(typeId);
}

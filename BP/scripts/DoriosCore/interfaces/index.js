import { ItemStack, system, world } from "@minecraft/server";
import { ContainerSessionManager } from "../containerSessions/index.js";
import { tryGetBlockFromEntity } from "../utils/entity.js";
import {
  DEFAULT_INTERFACE_BUTTON_ITEM_ID,
  SLOT_CODE_LENGTH,
  SLOT_CODE_MARKER,
  SLOT_CODE_RESET,
} from "./constants.js";

const interfaces = new Map();
const blockInterfaces = new Map();
const entityInterfaces = new Map();

/**
 * Checks whether an entity handle can still be safely used.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Entity handle.
 * @returns {boolean} True when the entity is valid.
 */
function isValidEntity(entity) {
  try {
    return entity?.isValid === true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a container slot for interface button metadata.
 *
 * @param {unknown} slot Raw slot value.
 * @returns {number|undefined} Slot index from 0 to 255.
 */
function normalizeSlot(slot) {
  const value = Math.floor(Number(slot));
  return Number.isFinite(value) && value >= 0 && value <= 255 ? value : undefined;
}

/**
 * Converts a button array/object into a map keyed by button id.
 *
 * @param {Record<string, object>|object[]|undefined} buttons Raw button definitions.
 * @returns {Map<string, object>} Normalized button map.
 */
function normalizeButtons(buttons) {
  const entries = Array.isArray(buttons) ? buttons.map((button, index) => [button?.id ?? String(index), button]) : Object.entries(buttons ?? {});
  const normalized = new Map();

  for (const [id, button] of entries) {
    if (!button) continue;

    const slot = normalizeSlot(button.slot);
    if (slot === undefined) continue;

    normalized.set(String(id), {
      ...button,
      id: String(id),
      slot,
    });
  }

  return normalized;
}

/**
 * Gets an entity inventory container.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Entity to inspect.
 * @returns {import("@minecraft/server").Container|undefined} Inventory container.
 */
function getContainer(entity) {
  try {
    return entity?.getComponent?.("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

/**
 * Builds the callback context passed to interface buttons.
 *
 * @param {object} data Context parts.
 * @param {import("@minecraft/server").Entity} data.entity Interface backing entity.
 * @param {import("@minecraft/server").Block|undefined} data.block Block represented by the entity.
 * @param {string} data.interfaceId Registered interface id.
 * @param {object} data.interfaceDefinition Interface definition.
 * @param {string} data.buttonId Button id.
 * @param {object} data.button Button definition.
 * @param {import("@minecraft/server").Player|undefined} data.player Player that pressed the button.
 * @returns {object} Button callback context.
 */
function getContext({ entity, block, interfaceId, interfaceDefinition, buttonId, button, player }) {
  return {
    entity,
    block,
    player,
    interfaceId,
    interface: interfaceDefinition,
    buttonId,
    button,
    slot: button.slot,
  };
}

/**
 * Resolves the item id used by a button.
 *
 * @param {object} interfaceDefinition Interface definition.
 * @param {object} button Button definition.
 * @returns {string} Button item type id.
 */
function getButtonItemId(interfaceDefinition, button) {
  return button.itemId ?? interfaceDefinition.itemId ?? DEFAULT_INTERFACE_BUTTON_ITEM_ID;
}

/**
 * Resolves the visible button name. A callback return value can override the
 * registered dynamic/static label for the next render.
 *
 * @param {object} context Button context.
 * @returns {string} Visible name tag text.
 */
function getButtonNameTag(context) {
  if (typeof context.nameTag === "string") return context.nameTag;

  const value = context.button.nameTag;
  if (typeof value === "function") return value(context);
  if (typeof value === "string") return value;
  return "";
}

/**
 * Gets every interface linked to the entity/block pair.
 *
 * @param {import("@minecraft/server").Entity|undefined} entity Interface backing entity.
 * @param {import("@minecraft/server").Block|undefined} block Block represented by the entity.
 * @returns {string[]} Interface ids.
 */
function getLinkedInterfaceIds(entity, block) {
  const ids = new Set();
  const entityTypeId = entity?.typeId;
  const blockTypeId = block?.typeId;

  if (typeof blockTypeId === "string") {
    for (const id of blockInterfaces.get(blockTypeId) ?? []) ids.add(id);
  }

  if (typeof entityTypeId === "string") {
    for (const id of entityInterfaces.get(entityTypeId) ?? []) ids.add(id);
  }

  return [...ids];
}

/**
 * Links one interface id to a block or entity type id.
 *
 * @param {Map<string, Set<string>>} map Link registry.
 * @param {string} targetId Block/entity type id.
 * @param {string} interfaceId Interface id.
 * @returns {boolean} True when the link was stored.
 */
function linkInterface(map, targetId, interfaceId) {
  if (typeof targetId !== "string" || targetId.length === 0) return false;
  if (typeof interfaceId !== "string" || interfaceId.length === 0) return false;

  const ids = map.get(targetId) ?? new Set();
  ids.add(interfaceId);
  map.set(targetId, ids);
  return true;
}

/**
 * Reads an item stack type id.
 *
 * @param {import("@minecraft/server").ItemStack|undefined} item Item stack.
 * @returns {string|undefined} Item type id.
 */
function getItemTypeId(item) {
  return typeof item?.typeId === "string" ? item.typeId : undefined;
}

/**
 * Checks whether a container item still represents a registered button.
 *
 * @param {import("@minecraft/server").ItemStack|undefined} item Current slot item.
 * @param {object} interfaceDefinition Interface definition.
 * @param {object} button Button definition.
 * @returns {boolean} True when item id and encoded slot match.
 */
function itemMatchesButton(item, interfaceDefinition, button) {
  return getItemTypeId(item) === getButtonItemId(interfaceDefinition, button) && decodeInterfaceSlot(item.nameTag) === button.slot;
}

/**
 * Encodes a slot index into invisible Minecraft formatting codes.
 *
 * @param {number} slot Slot index from 0 to 255.
 * @returns {string} Encoded prefix, such as `§a§7§r`.
 */
export function encodeInterfaceSlot(slot) {
  const normalized = normalizeSlot(slot);
  if (normalized === undefined) return "";

  const hex = normalized.toString(16).padStart(2, "0");
  return `${SLOT_CODE_MARKER}${hex[0]}${SLOT_CODE_MARKER}${hex[1]}${SLOT_CODE_RESET}`;
}

/**
 * Decodes the hidden slot prefix from a button item name tag.
 *
 * @param {string|undefined} nameTag Item name tag.
 * @returns {number|undefined} Decoded slot.
 */
export function decodeInterfaceSlot(nameTag) {
  if (typeof nameTag !== "string" || nameTag.length < SLOT_CODE_LENGTH) return undefined;
  if (nameTag[0] !== SLOT_CODE_MARKER || nameTag[2] !== SLOT_CODE_MARKER || nameTag.slice(4, 6) !== SLOT_CODE_RESET) {
    return undefined;
  }

  const hex = `${nameTag[1]}${nameTag[3]}`;
  if (!/^[0-9a-f]{2}$/i.test(hex)) return undefined;

  return parseInt(hex, 16);
}

/**
 * Removes an encoded slot prefix from a button item name tag.
 *
 * @param {string} nameTag Item name tag.
 * @returns {string} Visible name tag text.
 */
export function stripInterfaceSlotCode(nameTag) {
  return decodeInterfaceSlot(nameTag) === undefined ? nameTag : nameTag.slice(SLOT_CODE_LENGTH);
}

/**
 * Event-driven button interface system for entity container UIs.
 *
 * Interfaces declare the slots they own and the callbacks to execute when a
 * player drops a button item from the UI. The item only stores hidden slot
 * metadata in its name tag; the open entity is resolved from runtime container
 * sessions.
 */
export class InterfaceManager {
  /**
   * Registers a reusable interface definition.
   *
   * @param {string} interfaceId Interface id.
   * @param {{ itemId?: string, buttons?: Record<string, object>|object[] }} [definition={}] Interface definition.
   * @returns {boolean} True when the interface was registered.
   */
  static registerInterface(interfaceId, definition = {}) {
    if (typeof interfaceId !== "string" || interfaceId.length === 0) return false;

    interfaces.set(interfaceId, {
      id: interfaceId,
      itemId: definition.itemId ?? DEFAULT_INTERFACE_BUTTON_ITEM_ID,
      buttons: normalizeButtons(definition.buttons),
    });
    return true;
  }

  /**
   * Links an interface to a block type id.
   *
   * @param {string} blockTypeId Block type id.
   * @param {string} interfaceId Interface id.
   * @returns {boolean} True when linked.
   */
  static linkBlockInterface(blockTypeId, interfaceId) {
    return linkInterface(blockInterfaces, blockTypeId, interfaceId);
  }

  /**
   * Links an interface to a backing entity type id.
   *
   * @param {string} entityTypeId Entity type id.
   * @param {string} interfaceId Interface id.
   * @returns {boolean} True when linked.
   */
  static linkEntityInterface(entityTypeId, interfaceId) {
    return linkInterface(entityInterfaces, entityTypeId, interfaceId);
  }

  /**
   * Prefixes a visible name tag with hidden slot metadata.
   *
   * @param {number} slot Button slot.
   * @param {string} [nameTag=""] Visible name tag text.
   * @returns {string} Encoded name tag.
   */
  static createSlotNameTag(slot, nameTag = "") {
    return `${encodeInterfaceSlot(slot)}${nameTag ?? ""}`;
  }

  /**
   * Writes all registered buttons for an entity's linked interfaces.
   *
   * @param {import("@minecraft/server").Entity|undefined} entity Interface backing entity.
   * @param {import("@minecraft/server").Player|undefined} player Player opening the UI, when available.
   * @returns {boolean} True when at least one button was written.
   */
  static ensureEntityInterfaces(entity, player) {
    if (!isValidEntity(entity)) return false;

    const block = tryGetBlockFromEntity(entity);
    const container = getContainer(entity);
    if (!container) return false;

    let changed = false;
    const buttons = this.getEntityButtons(entity, block);

    for (const { interfaceId, interfaceDefinition, buttonId, button } of buttons) {
      const context = getContext({ entity, block, interfaceId, interfaceDefinition, buttonId, button, player });
      changed = this.setButton(container, context) || changed;
    }
    return changed;
  }

  /**
   * Writes one button item into its configured slot.
   *
   * @param {import("@minecraft/server").Container} container Target container.
   * @param {object} context Button context.
   * @returns {boolean} Always true after writing the button.
   */
  static setButton(container, context) {
    const item = new ItemStack(getButtonItemId(context.interface, context.button), 1);
    item.nameTag = this.createSlotNameTag(context.slot, getButtonNameTag(context));
    container.setItem(context.slot, item);
    return true;
  }

  /**
   * Gets all buttons linked to an entity/block pair.
   *
   * @param {import("@minecraft/server").Entity} entity Interface backing entity.
   * @param {import("@minecraft/server").Block} [block=tryGetBlockFromEntity(entity)] Block represented by the entity.
   * @returns {{ interfaceId:string, interfaceDefinition:object, buttonId:string, button:object }[]} Linked buttons.
   */
  static getEntityButtons(entity, block = tryGetBlockFromEntity(entity)) {
    const buttons = [];

    for (const interfaceId of getLinkedInterfaceIds(entity, block)) {
      const interfaceDefinition = interfaces.get(interfaceId);
      if (!interfaceDefinition) continue;

      for (const [buttonId, button] of interfaceDefinition.buttons.entries()) {
        buttons.push({ interfaceId, interfaceDefinition, buttonId, button });
      }
    }

    return buttons;
  }

  /**
   * Finds a linked interface entity at a block position.
   *
   * @param {import("@minecraft/server").Block|undefined} block Block to inspect.
   * @returns {import("@minecraft/server").Entity|undefined} Interface entity.
   */
  static getInterfaceEntityFromBlock(block) {
    if (!block?.dimension || !block.location) return undefined;

    let entities = [];
    try {
      entities = block.dimension.getEntitiesAtBlockLocation(block.location);
    } catch {
      return undefined;
    }

    for (const entity of entities) {
      if (!isValidEntity(entity)) continue;
      if (this.getEntityButtons(entity, block).length > 0) return entity;
    }

    return undefined;
  }

  /**
   * Handles a button item dropped by a player.
   *
   * @param {import("@minecraft/server").Player} player Player that dropped the item.
   * @returns {boolean} True when a button callback was handled.
   */
  static handlePlayerButtonDrop(player) {
    if (!isValidEntity(player) || player.typeId !== "minecraft:player") return false;

    let entity = ContainerSessionManager.getOpenEntity(player);
    if (!isValidEntity(entity)) {
      const resolved = this.resolveDroppedButtonFromOpenEntities(player);
      if (!resolved) return false;

      entity = resolved.entity;
      ContainerSessionManager.open(player, entity);
      return this.handlePressedButtons(player, resolved);
    }

    const block = tryGetBlockFromEntity(entity);
    const container = getContainer(entity);
    if (!container) return false;

    const pressedButtons = this.getMissingButtons(entity, block, container);
    return this.handlePressedButtons(player, { entity, block, container, pressedButtons });
  }

  /**
   * Executes and restores a pressed button when exactly one candidate exists.
   *
   * @param {import("@minecraft/server").Player} player Player that pressed the button.
   * @param {{ entity: import("@minecraft/server").Entity, block: import("@minecraft/server").Block|undefined, container: import("@minecraft/server").Container, pressedButtons: object[] }} data Press candidate data.
   * @returns {boolean} True when one button was handled.
   */
  static handlePressedButtons(player, { entity, block, container, pressedButtons }) {
    if (pressedButtons.length !== 1) {
      if (pressedButtons.length > 1) {
        for (const pressed of pressedButtons) {
          this.setButton(container, getContext({ ...pressed, entity, block, player }));
        }
      }
      return false;
    }

    const pressed = pressedButtons[0];
    const context = getContext({ ...pressed, entity, block, player });

    try {
      const nameTag = pressed.button.onPress?.(context);
      if (typeof nameTag === "string") context.nameTag = nameTag;
    } catch (error) {
      console.warn(`[InterfaceManager] button ${pressed.interfaceId}:${pressed.buttonId} failed: ${error?.message ?? error}`);
    }

    this.setButton(container, context);
    return true;
  }

  /**
   * Resolves the opened entity for a player that does not yet have a session.
   *
   * This is needed because container open events may not include the player.
   * The resolver only succeeds when exactly one open entity has one missing
   * registered button.
   *
   * @param {import("@minecraft/server").Player} player Player that dropped a button item.
   * @returns {{ entity: import("@minecraft/server").Entity, block: import("@minecraft/server").Block|undefined, container: import("@minecraft/server").Container, pressedButtons: object[] }|undefined} Resolved drop target.
   */
  static resolveDroppedButtonFromOpenEntities(player) {
    const candidates = [];

    for (const entity of ContainerSessionManager.getOpenEntities()) {
      const block = tryGetBlockFromEntity(entity);
      const container = getContainer(entity);
      if (!container) continue;

      const pressedButtons = this.getMissingButtons(entity, block, container);
      if (pressedButtons.length === 1) {
        candidates.push({ entity, block, container, pressedButtons });
      }
    }

    return candidates.length === 1 ? candidates[0] : undefined;
  }

  /**
   * Finds registered buttons that are missing from their slots.
   *
   * @param {import("@minecraft/server").Entity} entity Interface backing entity.
   * @param {import("@minecraft/server").Block|undefined} block Block represented by the entity.
   * @param {import("@minecraft/server").Container} container Entity inventory container.
   * @returns {object[]} Missing button descriptors.
   */
  static getMissingButtons(entity, block, container) {
    const missing = [];

    for (const buttonData of this.getEntityButtons(entity, block)) {
      const current = container.getItem(buttonData.button.slot);
      if (itemMatchesButton(current, buttonData.interfaceDefinition, buttonData.button)) continue;
      missing.push(buttonData);
    }

    return missing;
  }

  /**
   * Handles the `entityItemDrop` event. In this API version the dropped item
   * entity can be invalid, so this method uses the player source and container
   * runtime state instead.
   *
   * @param {import("@minecraft/server").EntityItemDropAfterEvent} event Drop event.
   * @returns {boolean} True when handled immediately.
   */
  static handleEntityItemDrop(event) {
    const player = event?.entity;
    if (!isValidEntity(player) || player.typeId !== "minecraft:player") return false;

    if (this.handlePlayerButtonDrop(player)) return true;

    system.run(() => {
      this.handlePlayerButtonDrop(player);
    });
    return false;
  }
}

world.afterEvents.entityContainerOpened.subscribe((event) => {
  InterfaceManager.ensureEntityInterfaces(event?.entity, event?.player ?? event?.source ?? event?.sourceEntity);
});

world.afterEvents.entityItemDrop.subscribe((event) => {
  InterfaceManager.handleEntityItemDrop(event);
});

export {
  IOInterface,
  ensureBlockIOInterface,
  hasRegisteredIOInterface,
  registerIOInterface,
  registerIOInterfaceForBlockTag,
} from "./IOInterface.js";
export {
  DEFAULT_FLUID_IO_MODE,
  FLUID_CONTAINER_FAMILY,
  FLUID_CONFIG_EVENT_NAMESPACE,
  FLUID_CONFIG_KEY,
  FLUID_CONFIG_VERSION,
  SET_FLUID_CONFIG_EVENT_ID,
  cloneFluidConfig,
  cycleFluidIODirectionMode,
  ensureFluidIOConfig,
  getFluidConfig,
  getFluidConfigRevision,
  getFluidIODefinition,
  getFluidIODirectionMode,
  getFluidStatus,
  getInputFluidIndices,
  getOutputFluidIndices,
  normalizeFluidConfig,
  registerFluidIODefinition,
  setFluidConfig,
} from "./fluidIO.js";
export {
  DEFAULT_GAS_IO_MODE,
  GAS_CONTAINER_FAMILY,
  GAS_CONFIG_EVENT_NAMESPACE,
  GAS_CONFIG_KEY,
  GAS_CONFIG_VERSION,
  SET_GAS_CONFIG_EVENT_ID,
  cloneGasConfig,
  cycleGasIODirectionMode,
  ensureGasIOConfig,
  getGasConfig,
  getGasConfigRevision,
  getGasIODefinition,
  getGasIODirectionMode,
  getGasStatus,
  getInputGasIndices,
  getOutputGasIndices,
  normalizeGasConfig,
  registerGasIODefinition,
  setGasConfig,
} from "./gasIO.js";

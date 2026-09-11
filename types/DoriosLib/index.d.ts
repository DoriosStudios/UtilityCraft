import type {
  Block,
  BlockCustomComponent,
  CommandPermissionLevel,
  Container,
  CustomCommandOrigin,
  CustomCommandParamType,
  Dimension,
  Entity,
  EntityEquippableComponent,
  EntityHealthComponent,
  EquipmentSlot,
  ItemCustomComponent,
  ItemDurabilityComponent,
  ItemStack,
  Player,
  RawMessage,
  Vector3,
} from "@minecraft/server";

/** A value accepted by a Minecraft block state. */
export type BlockStateValue = boolean | number | string;

/** The six absolute faces accepted by DoriosLib container IO. */
export type ContainerFace = "up" | "down" | "north" | "south" | "east" | "west";

/** Rounding strategy used by {@link math.scaleTo}. */
export type ScaleMode = "floor" | "ceil" | "round" | "none";

/** Resource categories supported by link-node IO overrides. */
export type LinkNodeIOResource = "items" | "liquids" | "gases";

/** Access direction selected from a link-node IO override. */
export type LinkNodeIOOperation = "input" | "output";

/** A JSON-compatible object dispatched to a UtilityCraft runtime registry. */
export type RegistrationPayload = Record<string, unknown>;

/** Runtime block compatibility accepted by Item Ducts. */
export interface ItemDuctCompatibilityRegistration {
  /** Fully qualified compatible block identifier. */
  typeId: string;
  /** Slots exposed to ducts for insertion. */
  insertSlots?: number[];
  /** Slots exposed to ducts for extraction. */
  extractSlots?: number[];
  /** Absolute block faces allowed for insertion. */
  insertFaces?: ContainerFace[];
  /** Absolute block faces allowed for extraction. */
  extractFaces?: ContainerFace[];
}

/** Link-node IO definition published by the addon that owns a controller. */
export interface LinkNodeIORegistration {
  /** Fully qualified controller block identifier. */
  blockTypeId: string;
  /** Controller-specific item, liquid, and gas routing groups. */
  config: RegistrationPayload;
}

/** Result returned by safe JSON helpers. */
export type JsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

/** Item-slot rules that apply equally from every face. */
export interface SimpleItemConfig {
  /** DoriosLib item-configuration schema version. */
  version: 1;
  /** Selects the face-independent configuration format. */
  type: "simple";
  /** Slots that automation may insert into. */
  inputConfig: number[];
  /** Slots that automation may extract from. */
  outputConfig: number[];
}

/** Per-face slot selections used by a complex item configuration. */
export type FaceSlotConfig = Partial<Record<ContainerFace, number[]>>;

/** Item-slot rules that may vary by absolute block face. */
export interface ComplexItemConfig {
  /** DoriosLib item-configuration schema version. */
  version: 1;
  /** Selects the face-aware configuration format. */
  type: "complex";
  /** Input fallback used when no face is supplied. */
  anyInputSlots: number[];
  /** Output fallback used when no face is supplied. */
  anyOutputSlots: number[];
  /** Input slots available from each explicitly configured face. */
  inputConfig: FaceSlotConfig;
  /** Output slots available from each explicitly configured face. */
  outputConfig: FaceSlotConfig;
}

/** Supported item IO document formats. */
export type ItemConfig = SimpleItemConfig | ComplexItemConfig;

/** A resolved inventory and the block, entity, or raw container that owns it. */
export interface ResolvedContainer {
  /** How the inventory was resolved. */
  kind: "block" | "entity" | "raw";
  /** Original owner returned by the resolver. */
  owner: Block | Entity | Container;
  /** Inventory used by insertion and transfer operations. */
  container: Container;
  /** Physical block, when one participates in the resolution. */
  block?: Block;
  /** Logical inventory entity, including an entity reached through a link node. */
  entity?: Entity;
  /** Indicates that a physical link-node block resolved to a logical entity. */
  via?: "link_node";
}

/** Any value accepted by DoriosLib container operations. */
export type ContainerTarget = Block | Entity | Container | ResolvedContainer;

/** Options for inserting a copied item stack into a target inventory. */
export interface InsertOptions {
  /** Stack to copy into the target. The supplied stack is not mutated. */
  item: ItemStack;
  /** Absolute input face. Omit it to use the target's no-face fallback. */
  face?: ContainerFace;
  /** Explicit ordered input slots. When supplied, these restrict normal IO slots. */
  slots?: ReadonlyArray<number>;
  /** Maximum number of items to attempt to insert. */
  maxAmount?: number;
}

/** Options for transferring items from one exact source slot. */
export interface TransferOptions {
  /** Exact occupied slot selected by the caller in the source inventory. */
  sourceSlot: number;
  /** Destination block, entity, raw container, or prior resolution. */
  target: ContainerTarget;
  /** Absolute destination input face. */
  targetFace?: ContainerFace;
  /** Explicit ordered destination slots; overrides `targetFace` when supplied. */
  targetSlots?: ReadonlyArray<number>;
  /** Maximum number of items to move. */
  maxAmount?: number;
}

/** Options used to query the accessible slots of a container. */
export interface SlotQueryOptions {
  /** Absolute face. Omit it to use the face-independent fallback. */
  face?: ContainerFace;
  /** Ignore passive default faces and return only explicitly configured IO. */
  automatic?: boolean;
}

/** Public classification of an entity's item IO state. */
export type ContainerStatus = "basic" | "simple" | "complex" | "invalid" | "unsupported";

/** Minimum-version requirement declared for another Dorios addon. */
export interface DependencyRequirement {
  /** Minimum accepted version. */
  version?: string;
  /** Human-readable dependency name. */
  name?: string;
  /** Additional warning displayed when validation fails. */
  warning?: string;
}

/** Metadata announced through the shared Dorios dependency service. */
export interface AddonMetadata {
  /** Human-readable addon name. */
  name: string;
  /** Stable addon identifier used as the registry key. */
  identifier: string;
  /** Installed addon version. */
  version: string;
  /** Addon author or organization. */
  author?: string;
  /** Dependencies keyed by their stable addon identifier. */
  dependencies?: Record<string, DependencyRequirement>;
}

/** One missing or outdated dependency reported by validation. */
export interface DependencyIssue {
  identifier: string;
  name: string;
  required: string | undefined;
  found: string | undefined;
  warning: string | undefined;
}

/** Complete result of dependency validation. */
export interface ValidationResult {
  /** True when every requirement is installed at an accepted version. */
  ok: boolean;
  /** Required addons that were not discovered. */
  missing: DependencyIssue[];
  /** Discovered addons whose versions are too old. */
  outdated: DependencyIssue[];
}

/** Runtime options used when an addon joins dependency discovery. */
export interface InitializeDependencyOptions {
  /** Ticks to wait after world load before local validation. @defaultValue 300 */
  validationDelayTicks?: number;
  /** Whether a successful report is broadcast. @defaultValue false */
  announceSuccess?: boolean;
  /** Replaces the default report handling for this addon. */
  onResult?: (result: ValidationResult, addon: AddonMetadata) => void;
}

/** One occupied entity-inventory slot. */
export interface InventoryEntry {
  slot: number;
  item: ItemStack;
}

/** Options used to set or clear an entity inventory slot. */
export interface SetItemOptions {
  slot: number;
  item: ItemStack | undefined;
}

/** Options used to create an item directly in an entity inventory slot. */
export interface SetNewItemOptions {
  slot: number;
  typeId: string;
  /** @defaultValue 1 */
  amount?: number;
  nameTag?: string;
  lore?: Array<RawMessage | string>;
}

/** Options used to add an item to an entity inventory. */
export interface TryAddItemOptions {
  item: string | ItemStack;
  /** Used only when `item` is an identifier. @defaultValue 1 */
  amount?: number;
  /** Drops a remainder at the entity location. @defaultValue false */
  dropRemainder?: boolean;
}

/** Result of adding an item to an inventory. */
export interface AddItemResult {
  /** Amount successfully inserted. */
  added: number;
  /** Stack that did not fit, unless it was dropped. */
  remainder: ItemStack | undefined;
  /** Whether the remainder was spawned in the world. */
  dropped: boolean;
}

/** Options used to change the amount in one occupied inventory slot. */
export interface ChangeItemAmountOptions {
  slot: number;
  /** Signed amount added to the current stack amount. */
  amount: number;
}

/** Normalized entity health information. */
export interface HealthInfo {
  current: number;
  min: number;
  max: number;
  missing: number;
  /** Percentage from the effective minimum to maximum, rounded to two decimals. */
  percentage: number;
}

/** Options used to set or clear one equipment slot. */
export interface SetEquipmentOptions {
  slot: EquipmentSlot | string;
  item: ItemStack | undefined;
}

/** Options for attaching an entity to a player through the shared tick manager. */
export interface PlayerTrackingOptions {
  /** Position used as the base of the attachment. @defaultValue "head" */
  anchor?: "head" | "location";
  /** Distance along the player's view direction. @defaultValue 0.5 */
  viewOffset?: number;
  /** Multiplier applied to the player's current velocity. @defaultValue 5 */
  velocityFactor?: number;
  /** Absolute world-space offset added after view and velocity prediction. */
  offset?: Vector3;
  /** Whether solid blocks may reject the teleport. @defaultValue false */
  checkForBlocks?: boolean;
  /** Whether the tracked entity keeps its own velocity. @defaultValue false */
  keepVelocity?: boolean;
}

/** Options used by {@link item.create}. */
export interface CreateItemOptions {
  typeId: string;
  /** @defaultValue 1 */
  amount?: number;
  nameTag?: string;
  lore?: Array<RawMessage | string>;
}

/** Normalized item durability information. */
export interface DurabilityInfo {
  damage: number;
  max: number;
  remaining: number;
  /** Remaining durability percentage rounded to two decimals. */
  percentage: number;
}

/** Result returned after applying item durability attempts. */
export interface DamageResult {
  /** Damage points that passed chance and Unbreaking checks. */
  applied: number;
  /** Whether the resulting damage reached maximum durability. */
  broken: boolean;
  /** Remaining durability after the operation. */
  remaining: number;
}

/** A physical link-node endpoint and its unique logical entity. */
export interface ResolvedLinkNode {
  block: Block;
  entity: Entity;
}

/** Complete input/output selection published for one link-node resource. */
export interface LinkNodeIOSelection {
  /** Input indices, or null to remove the override. */
  input: number[] | null;
  /** Output indices, or null to remove the override. */
  output: number[] | null;
}

/** Validated link-node IO update returned by the parser. */
export interface LinkNodeIOUpdate {
  version: 1;
  /** Canonical `x,y,z` node key. */
  node: string;
  /** Integer block location parsed from `node`. */
  location: Vector3;
  resource: LinkNodeIOResource;
  input: number[] | null;
  output: number[] | null;
}

/** Player-specific options used by {@link player.giveItem}. */
export interface GiveItemOptions {
  item: string | ItemStack;
  /** Used only when `item` is an identifier. @defaultValue 1 */
  amount?: number;
  /** Drops any remainder in the world. @defaultValue true */
  dropRemainder?: boolean;
  /** Drop position; defaults to one block above the player. */
  dropLocation?: Vector3;
}

/** UtilityCraft coolant properties forwarded by DoriosLib. */
export interface CoolantRegistration {
  /** Consumption divisor used by coolant-powered machines. */
  efficiency: number;
  /** Compatibility tier for machines that enforce coolant tiers. @defaultValue 0 */
  tier?: number;
}

/** One parameter in a DoriosLib custom-command definition. */
export interface CommandParameter {
  name: string;
  type: keyof typeof constants.COMMAND_PARAMETER_TYPES;
  /** Places the parameter after all mandatory parameters. @defaultValue false */
  optional?: boolean;
  /** Registered enum values; required when `type` is `"enum"`. */
  values?: string[];
}

/** Custom command collected by a DoriosLib registrar. */
export interface CommandDefinition {
  /** Local or fully qualified command name, depending on the registrar used. */
  name: string;
  description?: string;
  /** Permission alias or native Script API permission value. @defaultValue "any" */
  permissionLevel?: keyof typeof constants.PERMISSION_LEVELS | CommandPermissionLevel;
  /** @defaultValue false */
  cheatsRequired?: boolean;
  parameters?: CommandParameter[];
  /** Runs on the following system tick; thrown errors are sent to the registrar handler. */
  callback: (origin: CustomCommandOrigin, ...args: unknown[]) => void;
}

/** Options used to create an isolated component/command registrar. */
export interface RegistrarOptions {
  /** Namespace applied to local identifiers. */
  namespace: string;
  /** Handles errors thrown by registered command callbacks. */
  onError?: (error: unknown, context: string) => void;
}

/** Chainable startup registrar for custom components and commands. */
export interface Registrar {
  block(id: string, handlers: BlockCustomComponent): Registrar;
  item(id: string, handlers: ItemCustomComponent): Registrar;
  command(definition: CommandDefinition): Registrar;
  /** Subscribes the collected definitions to startup. Returns false after the first call. */
  install(): boolean;
  isInstalled(): boolean;
}

/** Options accepted by safe JSON serialization helpers. */
export interface JsonStringifyOptions {
  /** Numeric indentation width or an indentation string. */
  indent?: number | string;
}

/** Current DoriosLib version. */
export const VERSION: "2.0.0";

/** Block-state, direction, adjacency, and type helpers. */
export namespace block {
  /** Returns a block-state value, or undefined when the block/state is unavailable. */
  function getState(block: Block, stateId: string): BlockStateValue | undefined;

  /** Sets one block state. Returns false when the state/value is invalid. */
  function setState(block: Block, stateId: string, value: BlockStateValue): boolean;

  /** Applies several block states to one permutation in insertion order. */
  function setStates(block: Block, states: Record<string, BlockStateValue>): boolean;

  /**
   * Resolves the unit vector represented by a direction state.
   * Falls back to UtilityCraft's axis convention for the default state id.
   */
  function getFacingVector(
    block: Block,
    stateId?: string,
  ): Vector3 | undefined;

  /** Returns the adjacent block in the resolved facing direction. */
  function getFacingBlock(block: Block, stateId?: string): Block | undefined;

  /** Returns every available block adjacent to the six absolute faces. */
  function getAdjacentBlocks(block: Block): Block[];

  /** Returns the first entity occupying the block's unit volume. */
  function getEntity(block: Block): Entity | undefined;

  /** Checks whether a block type identifier is registered. */
  function isType(typeId: string): boolean;
}

/** Metadata used by this DoriosLib installation. */
export namespace config {
  /** UtilityCraft metadata announced to the Dorios dependency service. */
  const ADDON_METADATA: AddonMetadata;
  /** UtilityCraft's dependency-validation startup options. */
  const DEPENDENCY_OPTIONS: InitializeDependencyOptions;
}

/** Shared Script API aliases, direction data, and block policies. */
export namespace constants {
  /** Permission aliases accepted by command definitions. */
  const PERMISSION_LEVELS: {
    any: CommandPermissionLevel.Any;
    gamedirector: CommandPermissionLevel.GameDirectors;
    gameDirectors: CommandPermissionLevel.GameDirectors;
    admin: CommandPermissionLevel.Admin;
    host: CommandPermissionLevel.Host;
    owner: CommandPermissionLevel.Owner;
  };

  /** Parameter-type aliases accepted by command definitions. */
  const COMMAND_PARAMETER_TYPES: {
    string: CustomCommandParamType.String;
    int: CustomCommandParamType.Integer;
    integer: CustomCommandParamType.Integer;
    float: CustomCommandParamType.Float;
    bool: CustomCommandParamType.Boolean;
    boolean: CustomCommandParamType.Boolean;
    enum: CustomCommandParamType.Enum;
    block: CustomCommandParamType.BlockType;
    item: CustomCommandParamType.ItemType;
    location: CustomCommandParamType.Location;
    entity: CustomCommandParamType.EntitySelector;
    target: CustomCommandParamType.EntitySelector;
    entityType: CustomCommandParamType.EntityType;
    player: CustomCommandParamType.PlayerSelector;
  };

  /** Equipment slots exposed by the installed Script API. */
  const EQUIPMENT_SLOTS: EquipmentSlot[];

  /** Unit vectors for all six Minecraft directions. */
  const DIRECTION_VECTORS: Record<ContainerFace, Vector3>;

  /** Vanilla dimension ids and build-height bounds used by UtilityCraft logic. */
  const DIMENSIONS: {
    overworld: { id: "minecraft:overworld"; minY: -64; maxY: 320 };
    nether: { id: "minecraft:nether"; minY: 0; maxY: 128 };
    end: { id: "minecraft:the_end"; minY: 0; maxY: 256 };
  };

  /** Mutable safety-policy list of block ids addon tools should not destroy. */
  const UNBREAKABLE_BLOCKS: string[];
  /** Mutable list of vanilla blocks known to provide container storage. */
  const VANILLA_CONTAINER_BLOCKS: string[];
  function isUnbreakableBlock(typeId: string): boolean;
  function isVanillaContainerBlock(typeId: string): boolean;
}

/** Container resolution, item IO configuration, insertion, and transfer helpers. */
export namespace container {
  const CONTAINER_FAMILY: "dorios:container";
  const DIRECTIONS: ContainerFace[];
  const IO_CONFIG_PROPERTY: "utilitycraft:io_config";
  const ITEM_CONFIG_KEY: "items";
  const ITEM_CONFIG_VERSION: 1;
  const SCRIPT_EVENT_NAMESPACE: "dorios_container";
  const SET_CONFIG_EVENT_ID: "dorios_container:set_config";

  /** Installs cross-addon IO updates and cache cleanup listeners. */
  function initialize(): boolean;
  /** Removes listeners and clears cached configuration. */
  function shutdown(): boolean;
  function isInitialized(): boolean;

  /** Publishes a complete, validated item IO document through a script event. */
  function setConfig(entity: Entity, config: ItemConfig): boolean;

  /**
   * Resolves a block, entity, raw Script API container, or previous resolution.
   * Blocks are resolved before entities; link-node blocks may resolve to their logical entity.
   */
  function resolve(target: ContainerTarget): ResolvedContainer | undefined;

  /** Resolves a container at an exact world position. */
  function resolveAt(dimension: Dimension, location: Vector3): ResolvedContainer | undefined;

  /** Returns a mutable snapshot of an entity's valid item IO configuration. */
  function getConfig(entity: Entity): ItemConfig | undefined;

  /** Returns the local cache revision for an entity configuration. */
  function getConfigRevision(entity: Entity): number;

  /** Classifies the entity's item IO capability and current document. */
  function getStatus(entity: Entity): ContainerStatus;

  /** Returns configured input slots, or anyInputSlots for a passive default face. */
  function getInputSlots(target: ContainerTarget, options?: SlotQueryOptions): ReadonlyArray<number>;

  /** Returns configured output slots, or anyOutputSlots for a passive default face. */
  function getOutputSlots(target: ContainerTarget, options?: SlotQueryOptions): ReadonlyArray<number>;

  /** Inserts as much as possible and returns the inserted item count. */
  function insert(target: ContainerTarget, options: InsertOptions): number;

  /** Moves items from one exact source slot and returns the transferred count. */
  function transfer(source: ContainerTarget, options: TransferOptions): number;

  /** Checks whether an entity exposes the `dorios:container` family. */
  function isCompatible(entity: Entity): boolean;

  /** Removes one cached entity IO document. */
  function invalidate(entityOrId: Entity | string): boolean;
}

/** Cross-addon Dorios dependency discovery and version validation. */
export namespace dependencies {
  const SCRIPT_EVENT_ID: "dorios:dependency_checker";

  /**
   * Announces and validates an addon. Returns a function that removes it from
   * local validation; shared listeners remain installed.
   */
  function initialize(metadata: AddonMetadata, options?: InitializeDependencyOptions): () => void;

  /** Returns a cloned metadata snapshot for one discovered addon. */
  function get(identifier: string): AddonMetadata | undefined;

  /** Returns cloned metadata snapshots for all discovered addons. */
  function getAll(): AddonMetadata[];

  /** Validates an addon's declared requirements against a registry snapshot. */
  function validate(
    metadata: AddonMetadata,
    available?: ReadonlyMap<string, AddonMetadata>,
  ): ValidationResult;

  /** Compares semantic-version-like strings. */
  function compareVersions(left: string, right: string): -1 | 0 | 1;

  /** Builds a Minecraft-formatted dependency report. */
  function formatReport(addon: AddonMetadata, result: ValidationResult): string;

  /** Broadcasts a failed report, or a successful report when requested. */
  function report(
    addon: AddonMetadata,
    result: ValidationResult,
    options?: { announceSuccess?: boolean },
  ): void;
}

/** Entity inventory, health, and equipment helpers. */
export namespace entity {
  /**
   * Starts or updates an attachment managed by DoriosLib's shared one-tick interval.
   */
  function startPlayerTracking(
    entity: Entity,
    player: Player,
    options?: PlayerTrackingOptions,
  ): boolean;

  /** Stops tracking without removing the entity. */
  function stopPlayerTracking(entityOrId: Entity | string): boolean;

  /** Checks whether an entity currently has an active player attachment. */
  function isPlayerTracking(entityOrId: Entity | string): boolean;

  function getInventory(entity: Entity): Container | undefined;
  function getInventoryEntries(entity: Entity): InventoryEntry[];
  function getItems(entity: Entity): ItemStack[];
  function getItem(entity: Entity, slot: number): ItemStack | undefined;
  function setItem(entity: Entity, options: SetItemOptions): boolean;

  /** Creates an ItemStack and places it in the selected inventory slot. */
  function setNewItem(entity: Entity, options: SetNewItemOptions): boolean;

  /** Adds an item and optionally drops any remainder at the entity location. */
  function tryAddItem(entity: Entity, options: TryAddItemOptions): AddItemResult;

  /** Adds a signed amount to one occupied slot without crossing zero or max stack size. */
  function changeItemAmount(entity: Entity, options: ChangeItemAmountOptions): boolean;

  /** Finds the first type-id match or natively stack-compatible item. */
  function findItem(entity: Entity, query: string | ItemStack): InventoryEntry | undefined;

  function countItem(entity: Entity, typeId: string): number;
  function hasItem(entity: Entity, typeId: string, amount?: number): boolean;

  /** Removes up to `amount` items and returns the amount actually removed. */
  function removeItem(entity: Entity, typeId: string, amount?: number): number;

  /** Clears non-excluded stacks and returns the number of cleared slots. */
  function clearInventory(entity: Entity, excludedTypeIds?: Iterable<string>): number;

  /** Drops non-excluded inventory stacks and returns the number of dropped stacks. */
  function dropAllItems(entity: Entity, excludedTypeIds?: Iterable<string>): number;

  function findFirstEmptySlot(entity: Entity): number | undefined;
  function setInFirstEmptySlot(entity: Entity, item: ItemStack): number | undefined;
  function isInventoryFull(entity: Entity): boolean;
  function getHealthComponent(entity: Entity): EntityHealthComponent | undefined;
  function getHealth(entity: Entity): number | undefined;

  /** Sets health after clamping it to the component's effective bounds. */
  function setHealth(entity: Entity, value: number): boolean;

  function addHealth(entity: Entity, delta: number): boolean;
  function getHealthInfo(entity: Entity): HealthInfo | undefined;
  function getEquippable(entity: Entity): EntityEquippableComponent | undefined;
  function getEquipment(entity: Entity, slot: EquipmentSlot | string): ItemStack | undefined;
  function setEquipment(entity: Entity, options: SetEquipmentOptions): boolean;
}

/** Item creation, type checks, and durability operations. */
export namespace item {
  /** Item durability helpers. */
  export namespace durability {
    function getComponent(item: ItemStack): ItemDurabilityComponent | undefined;
    function getInfo(item: ItemStack): DurabilityInfo | undefined;

    /** Repairs up to `amount` damage and returns the damage actually repaired. */
    function repair(item: ItemStack, amount?: number): number;

    /**
     * Applies durability attempts after a custom chance and Unbreaking.
     * The caller must remove the stack when the returned `broken` flag is true.
     */
    function damage(
      item: ItemStack,
      amount?: number,
      chance?: number,
      random?: () => number,
    ): DamageResult;
  }

  /** Creates and configures an ItemStack; native validation errors propagate. */
  function create(options: CreateItemOptions): ItemStack;
  function isType(typeId: string): boolean;
}

/** Physical/logical link-node resolution and per-node IO overrides. */
export namespace linkNode {
  const LINK_NODE_BLOCK_TAG: "dorios:link_node";
  const LINK_NODE_TAG_PREFIX: "dorios:link_node:[";
  const LINK_NODE_IO_CONFIG_KEY: "linkNodes";
  const LINK_NODE_IO_VERSION: 1;
  const LINK_NODE_IO_EVENT_NAMESPACE: "dorios_link_node";
  const SET_LINK_NODE_IO_EVENT_ID: "dorios_link_node:set_io";

  /** Floors finite coordinates and builds the canonical entity tag. */
  function createLinkNodeTag(location: Vector3): string;

  /** Floors finite coordinates and builds the canonical `x,y,z` key. */
  function createLinkNodeKey(location: Vector3): string;

  function parseLinkNodeKey(key: string): Vector3 | undefined;
  function parseLinkNodeTag(tag: string): Vector3 | undefined;
  function isLinkNode(block: Block | undefined): boolean;
  function getLinkNodeLocations(entity: Entity): Vector3[];
  function isLinkedEntity(block: Block | undefined, entity: Entity | undefined): boolean;

  /** Resolves exactly one compatible entity; zero or ambiguous matches return undefined. */
  function resolveLinkNode(
    block: Block,
    predicate?: (entity: Entity) => boolean,
  ): ResolvedLinkNode | undefined;

  /** Gets a block at the position and resolves it as a link node. */
  function resolveLinkNodeAt(
    dimension: Dimension,
    location: Vector3,
    predicate?: (entity: Entity) => boolean,
  ): ResolvedLinkNode | undefined;

  function initializeLinkNodeIO(): boolean;
  function shutdownLinkNodeIO(): boolean;
  function isLinkNodeIOInitialized(): boolean;

  /**
   * Returns an explicit index selection. Undefined means no override exists;
   * an empty array means the request or stored document is invalid.
   */
  function getLinkNodeIOOverride(
    entity: Entity,
    location: Vector3,
    resource: LinkNodeIOResource,
    operation: LinkNodeIOOperation,
  ): ReadonlyArray<number> | undefined;

  function getLinkNodeIORevision(entity: Entity): number;
  function invalidateLinkNodeIO(entityOrId: Entity | string): boolean;

  /** Publishes complete input/output overrides for one node resource. */
  function setLinkNodeIO(
    entity: Entity,
    location: Vector3,
    resource: LinkNodeIOResource,
    selection: LinkNodeIOSelection,
  ): true;

  /** Parses and validates a serialized update without applying it. */
  function parseLinkNodeIOUpdate(message: string): LinkNodeIOUpdate | undefined;
}

/** Numeric, vector, random, scaling, and Roman-numeral helpers. */
export namespace math {
  function clamp(value: number, min: number, max: number): number;
  function roundTo(value: number, decimals?: number): number;
  function scaleTo(current: number, max: number, scale: number, mode?: ScaleMode): number;

  /** Returns a random integer in the inclusive interval `[min, max]`. */
  function randomInt(min: number, max: number, random?: () => number): number;

  /** Returns a random number in `[min, max)`. */
  function randomFloat(min: number, max: number, random?: () => number): number;

  function distance(a: Vector3, b: Vector3): number;

  /** Returns a new position offset by `vector * amount`. */
  function offset(position: Vector3, vector: Vector3, amount?: number): Vector3;

  /** Converts a valid canonical Roman numeral; returns 0 for invalid input. */
  function romanToInteger(numeral: string): number;

  /** Converts integers from 1 through 3999; returns an empty string otherwise. */
  function integerToRoman(value: number): string;
}

/** Safe world, player-message, action-bar, and JSON display helpers. */
export namespace messages {
  function broadcast(message: RawMessage | string): void;
  function send(player: Player, message: RawMessage | string): void;
  function actionBar(player: Player, message: RawMessage | string): void;

  /** Sends a title followed by pretty-printed JSON, one chat line at a time. */
  function printJson(player: Player, title: string, value: unknown): void;
}

/** Player game-mode, item-giving, and equipment helpers. */
export namespace player {
  function isCreative(player: Player): boolean;
  function isSurvival(player: Player): boolean;

  /** Gives an item and drops any remainder by default. */
  function giveItem(player: Player, options: GiveItemOptions): AddItemResult;

  function getEquipment(entity: Entity, slot: EquipmentSlot | string): ItemStack | undefined;
  function setEquipment(entity: Entity, options: SetEquipmentOptions): boolean;
}

/** Runtime payload dispatch and startup component/command registration. */
export namespace registry {
  const COMMAND_PARAMETER_TYPES: typeof constants.COMMAND_PARAMETER_TYPES;
  const PERMISSION_LEVELS: typeof constants.PERMISSION_LEVELS;
  const PARAMETER_TYPES: typeof constants.COMMAND_PARAMETER_TYPES;

  /** Script-event ids targeted by payload registration helpers. */
  const REGISTRATION_EVENT_IDS: Readonly<{
    AUTO_FISHER_DROP: "utilitycraft:register_autofisher_drop";
    BONSAI: "utilitycraft:register_bonsai";
    COOLANT: "utilitycraft:register_coolant";
    CRAFTER_RECIPE: "utilitycraft:register_crafter_recipe";
    CRUSHER_RECIPE: "utilitycraft:register_crusher_recipe";
    FLUID_HOLDER: "utilitycraft:register_fluid_holder";
    FLUID_ITEM: "utilitycraft:register_fluid_item";
    FUEL: "utilitycraft:register_fuel";
    FURNACE_RECIPE: "utilitycraft:register_furnace_recipe";
    GAS_HOLDER: "utilitycraft:register_gas_holder";
    GAS_ITEM: "utilitycraft:register_gas_item";
    INFUSER_RECIPE: "utilitycraft:register_infuser_recipe";
    ITEM_DUCT_REGISTER: "item_ducts:register";
    ITEM_DUCT_UNREGISTER: "item_ducts:unregister";
    LINK_NODE_IO: "dorios_link_node:register_io";
    MELTER_RECIPE: "utilitycraft:register_melter_recipe";
    MACHINE_UPGRADE: "utilitycraft:register_machine_upgrade";
    PLANT: "utilitycraft:register_plant";
    ELECTROLYZER_RECIPE: "utilitycraft:register_electrolyzer_recipe";
    CHEMICAL_CONVERTER_RECIPE: "utilitycraft:register_chemical_converter_recipe";
    PRESS_RECIPE: "utilitycraft:register_press_recipe";
    SIEVE_DROP: "utilitycraft:register_sieve_drop";
    SPECIAL_CONTAINER_SLOTS: "utilitycraft:register_special_container_slots";
  }>;

  function registerAutoFisherDrop(payload: RegistrationPayload | RegistrationPayload[]): void;
  /** Legacy bonsai registration; new integrations should prefer `registerPlant`. */
  function registerBonsai(payload: RegistrationPayload): void;
  function registerCoolant(payload: Record<string, CoolantRegistration>): void;
  function registerCrafterRecipe(payload: RegistrationPayload): void;
  function registerCrusherRecipe(payload: RegistrationPayload): void;
  function registerFluidHolder(payload: RegistrationPayload): void;
  function registerFluidItem(payload: RegistrationPayload): void;
  function registerFuel(payload: RegistrationPayload): void;
  function registerFurnaceRecipe(payload: RegistrationPayload): void;
  function registerGasHolder(payload: RegistrationPayload): void;
  function registerGasItem(payload: RegistrationPayload): void;
  function registerInfuserRecipe(payload: RegistrationPayload): void;
  function registerItemDuctCompatibility(payload: ItemDuctCompatibilityRegistration): void;
  function registerItemDuctChest(typeId: string): void;
  function unregisterItemDuctCompatibility(typeId: string): void;
  function registerLinkNodeIO(payload: LinkNodeIORegistration): void;
  function registerMelterRecipe(payload: RegistrationPayload): void;
  function registerMachineUpgrade(payload: RegistrationPayload): void;
  function registerPlant(payload: RegistrationPayload): void;
  function registerElectrolyzerRecipe(payload: RegistrationPayload): void;
  function registerChemicalConverterRecipe(payload: RegistrationPayload): void;
  function registerPressRecipe(payload: RegistrationPayload): void;
  function registerSieveDrop(payload: RegistrationPayload): void;
  function registerSpecialContainerSlots(payload: RegistrationPayload): void;

  /** Creates an isolated namespaced registrar. */
  function createRegistrar(options: string | RegistrarOptions): Registrar;

  /** Adds a fully qualified block component to DoriosLib's shared registrar. */
  function blockComponent(id: string, handlers: BlockCustomComponent): void;

  /** Adds a fully qualified item component to DoriosLib's shared registrar. */
  function itemComponent(id: string, handlers: ItemCustomComponent): void;

  /** Adds a fully qualified command to DoriosLib's shared registrar. */
  function customCommand(definition: CommandDefinition): void;

  /** Installs every shared registrar once. Call during initial script evaluation. */
  function install(): boolean;
}

/** Minecraft formatting codes and identifier formatting helpers. */
export namespace text {
  const FORMAT: {
    black: "§0";
    darkBlue: "§1";
    darkGreen: "§2";
    darkAqua: "§3";
    darkRed: "§4";
    darkPurple: "§5";
    gold: "§6";
    gray: "§7";
    darkGray: "§8";
    blue: "§9";
    green: "§a";
    aqua: "§b";
    red: "§c";
    lightPurple: "§d";
    yellow: "§e";
    white: "§f";
    obfuscated: "§k";
    bold: "§l";
    strikethrough: "§m";
    underline: "§n";
    italic: "§o";
    reset: "§r";
  };

  function capitalizeFirst(value: string): string;
  function formatIdentifier(identifier: string): string;
}

/** Tick constants, duration formatting, scheduling, and asynchronous waits. */
export namespace time {
  const TICKS_PER_SECOND: 20;
  const TICKS: {
    second: 20;
    minute: 1200;
    hour: 72000;
    day: 1728000;
  };

  /** Formats seconds as `m:ss` or `h:mm:ss`. */
  function formatClock(seconds: number): string;

  /** Formats seconds using the two largest relevant units. */
  function formatDuration(seconds: number): string;

  function runAfterTicks(ticks: number, callback: () => void): number;
  function runAfterSeconds(seconds: number, callback: () => void): number;
  function runAfterMinutes(minutes: number, callback: () => void): number;
  function waitTicks(ticks: number): Promise<void>;
  function waitSeconds(seconds: number): Promise<void>;
  function waitMinutes(minutes: number): Promise<void>;
}

/** General collection, object, and safe JSON helpers. */
export namespace utils {
  /** Safe JSON parsing, serialization, and cloning. */
  export namespace json {
    function tryParse<T = unknown>(
      source: string,
      reviver?: (this: unknown, key: string, value: unknown) => unknown,
    ): JsonResult<T>;

    function parseOr<T>(
      source: string,
      fallback: T,
      reviver?: (this: unknown, key: string, value: unknown) => unknown,
    ): T;

    function tryStringify(value: unknown, options?: JsonStringifyOptions): JsonResult<string>;
    function stringify(value: unknown, options?: JsonStringifyOptions): string;

    /** Creates a deep clone of data representable by JSON. */
    function clone<T>(value: T): T;
  }

  /** Returns arrays unchanged and wraps any other value in a one-element array. */
  function toArray<T>(value: T | T[]): T[];

  /** Checks for a non-null object whose prototype is Object.prototype or null. */
  function isPlainObject(value: unknown): value is Record<string, unknown>;
}

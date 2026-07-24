import type {
  Block,
  BlockPermutation,
  Container,
  Dimension,
  Entity,
  ItemStack,
  Player,
  ScoreboardIdentity,
  Vector3,
} from "@minecraft/server";

/** Axis/facing names supported by UtilityCraft rotation states. */
export type DirectionName = "up" | "down" | "north" | "south" | "east" | "west";
/** Horizontal direction names used by vanilla cardinal rotation states. */
export type CardinalDirectionName = "north" | "south" | "east" | "west";
/** Transfer order used by generator, battery, energy, and fluid network outputs. */
export type TransferMode = "nearest" | "farthest" | "round";
/** Transfer target categories cached by the output tracker. */
export type OutputTransferType = "item" | "fluid" | "gas";
/** Scheduler profile ids used by the machinery refresh speed system. */
export type SchedulerProfileId = "fast" | "normal" | "low";

/** Scoreboard-safe numeric representation for very large resource amounts. */
export interface NormalizedValue {
  /** Mantissa stored in the scoreboard objective. */
  value: number;
  /** Base-10 exponent used to reconstruct the real value. */
  exp: number;
}

/** Inclusive 3D bounds used by multiblock detection and activation. */
export interface Bounds {
  /** Minimum bounds corner. */
  min: Vector3;
  /** Maximum bounds corner. */
  max: Vector3;
}

/** Entity/container settings used when spawning a machine helper entity. */
export interface MachineEntityConfig {
  /** Entity identifier to spawn for the machine container. */
  identifier?: string;
  /** Inventory size event suffix, for example inventory_9. */
  inventory_size: number;
  /** Localization/name suffix used for the helper entity nameTag. */
  name?: string;
  /** Inclusive input slot range. */
  input_range?: [number, number];
  /** Inclusive output slot range. */
  output_range?: [number, number];
  /** Single input slot shortcut. */
  input_slot?: number;
  /** Single output slot shortcut. */
  output_slot?: number;
  /** Keeps the current fluid type even when the tank is empty. */
  fixed_fluid_types?: boolean;
  /** Keeps the current gas type even when the tank is empty. */
  fixed_gas_types?: boolean;
  /** Optional type event suffix triggered after spawn. */
  type?: string;
}

/** Shared config accepted by machines, generators, and multiblock controllers. */
export interface BaseMachineConfig {
  /** Helper entity configuration. */
  entity: MachineEntityConfig;
  /** Optional spawn offset from the owning block center. */
  spawn_offset?: Vector3;
  /** Enables manual placement rotation through DoriosCore Rotation. */
  rotation?: boolean;
  /** Component counts required by a multiblock controller. */
  requirements?: Record<string, Requirement>;
  /** Required casing tag for multiblock scanning. */
  required_case?: string;
  /** Bypass the scheduler for this runtime instance. */
  ignoreTick?: boolean;
}

/** Runtime processing/storage settings for a normal machine. */
export interface MachineRuntimeConfig {
  /** Base energy processed per vanilla tick before scheduler scaling. */
  rate_speed_base?: number;
  /** Energy capacity stored on the helper entity. */
  energy_cap?: number;
  /** Optional fluid capacity stored on the helper entity. */
  fluid_cap?: number;
  /** Number of independent indexed fluid tanks stored by the entity. */
  fluid_types?: number;
  /** Optional gas capacity stored on the helper entity. */
  gas_cap?: number;
  /** Number of independent indexed gas tanks stored by the entity. */
  gas_types?: number;
  /** Ordered inventory slots scanned for registered machine upgrades. */
  upgrades?: number[];
}

/** Runtime generation/storage settings for a generator. */
export interface GeneratorRuntimeConfig {
  /** Base generated energy per vanilla tick before scheduler scaling. */
  rate_speed_base?: number;
  /** Energy capacity stored on the helper entity. */
  energy_cap?: number;
  /** Optional fluid capacity stored on the helper entity. */
  fluid_cap?: number;
  /** Number of independent indexed fluid tanks stored by the entity. */
  fluid_types?: number;
  /** Optional gas capacity stored on the helper entity. */
  gas_cap?: number;
  /** Number of independent indexed gas tanks stored by the entity. */
  gas_types?: number;
}

/** Complete config object accepted by {@link Machine} and {@link MultiblockMachine}. */
export interface MachineSettings extends BaseMachineConfig {
  /** Machine-specific runtime values such as rate, energy cap, and upgrades. */
  machine: MachineRuntimeConfig;
}

/** Complete config object accepted by {@link Generator} and {@link MultiblockGenerator}. */
export interface GeneratorSettings extends BaseMachineConfig {
  /** Generator-specific runtime values such as generation rate and capacities. */
  generator: GeneratorRuntimeConfig;
  /** Optional fill behavior for reactor-like multiblocks. */
  fillBlocksConfig?: FillBlocksConfig;
  /** Optional cleanup behavior when deactivating the multiblock. */
  deactivateConfig?: FillBlocksConfig;
  /** Warning sent when a generator multiblock has no energy capacity. */
  missingEnergyWarning?: string;
}

/** Required component count used by multiblock activation validation. */
export interface Requirement {
  /** Minimum amount of this component required. */
  amount: number;
  /** Warning sent to the player when the requirement is not met. */
  warning: string;
}

/** Block fill/cleanup config for reactor-like multiblocks. */
export interface FillBlocksConfig {
  /** Block id used when filling or emptying multiblock bounds. */
  blockId?: string;
}

/** Minimal placement event shape used by DoriosCore spawn helpers. */
export interface PlacementEventLike {
  /** Block being placed. */
  block: Block;
  /** Player placing or interacting with the block. */
  player: Player;
  /** Permutation that should be placed. */
  permutationToPlace: BlockPermutation;
  /** Optional cancellation flag used by manual rotation placement. */
  cancel?: boolean;
}

/** Minimal block-break event shape used by machine destruction helpers. */
export interface DestroyEventLike {
  /** Block being destroyed. */
  block: Block;
  /** Original block permutation before destruction. */
  brokenBlockPermutation: BlockPermutation;
  /** Player that broke the block, if available. */
  player?: Player;
  /** Dimension where the block was destroyed. */
  dimension: Dimension;
}

/** Minimal player interaction event shape used by multiblock handlers. */
export interface InteractionEventLike {
  /** Controller block being interacted with. */
  block: Block;
  /** Player interacting with the controller. */
  player: Player;
}

/** Options used when storing or drawing a machine progress bar. */
export interface ProgressOptions {
  /** Inventory slot used to draw the progress item. */
  slot?: number;
  /** Maximum progress value used to normalize the display. */
  maxValue?: number;
  /** Progress item suffix. */
  type?: string;
  /** Whether to update the visible progress item. */
  display?: boolean;
  /** Progress dynamic property index. */
  index?: number;
  /** Maximum visual frame. */
  scale?: number;
  /** Uses classic non-padded progress item ids. */
  legacy?: boolean;
}

/** Options used by {@link Machine.showWarning}. */
export interface WarningOptions extends ProgressOptions {
  /** Whether to reset progress when showing the warning. */
  resetProgress?: boolean;
  /** Whether to redraw progress when resetting. */
  displayProgress?: boolean;
}

/** Flat additive perk values resolved from all accepted machine upgrades. */
export interface MachineBoosts {
  /** Custom registered perks remain directly readable by name. */
  [perk: string]: number;
  /** Final processing speed multiplier, including the base value of 1. */
  speed: number;
  /** Final energy-cost multiplier before efficiency, including the base value of 1. */
  energy_cost: number;
  /** Final energy-efficiency multiplier, including the base value of 1. */
  energy_efficiency: number;
  /** Final recipe operations produced per completed process, including the base value of 1. */
  process_batch: number;
  /** Energy consumption multiplier. Lower values are more efficient. */
  consumption: number;
}

/** Registration definition for one exact machine-upgrade item type id. */
export interface MachineUpgradeRegistration {
  /** Semantic category used to prevent equivalent upgrades from stacking. */
  type: string;
  /** Per-level additive perk contributions. Missing levels inherit the previous level. */
  levels: Record<number, Record<string, number>> | Array<Record<string, number>>;
  /** Effective levels contributed by each item in the installed stack. */
  value?: number;
}

/** Machine-upgrade definition compiled for direct runtime lookup. */
export interface CompiledMachineUpgrade {
  itemTypeId: string;
  type: string;
  typeIndex: number;
  value: number;
  maxLevel: number;
  levels: Array<Record<string, number>>;
}

/** Compiled runtime registry for machine upgrade items and their perks. */
export class MachineUpgradeRegistry {
  static register(itemTypeId: string, registration: MachineUpgradeRegistration): CompiledMachineUpgrade;
  static get(itemTypeId: string): CompiledMachineUpgrade | undefined;
  static resolveBoosts(
    container: Container,
    slots: number[] | undefined,
    defaults?: Record<string, number>,
  ): Record<string, number>;
}

/** Constructor options accepted by {@link BasicMachine}. */
export interface BasicMachineOptions {
  /** Base rate designed for normal 20 TPS logic. */
  rate?: number;
  /** Bypasses scheduler throttling. */
  ignoreTick?: boolean;
}

/** One visual item IO mode and the machine slots represented by that mode. */
export interface ItemIOModeConfig {
  /** Name tag used by the resource-pack IO button, such as `input_1`. */
  id: string;
  /** Machine inventory slots that accept items while this mode is active. */
  inputSlots?: number[];
  /** Machine inventory slots that expose items while this mode is active. */
  outputSlots?: number[];
}

/** Static item policy registered for one machine block type. */
export interface ItemIOGroupConfig {
  /** Optional six UI button slots, explicit or as an inclusive start/end range. */
  buttonSlots?: number[] | [number, number];
  /** Explicit insertion fallback used when no source face is known. */
  anyInputSlots: number[];
  /** Explicit extraction fallback used when no destination face is known. */
  anyOutputSlots: number[];
  /** Ordered visual modes cycled independently on each face. */
  modes: ItemIOModeConfig[];
}

/** One visual fluid IO mode and the indexed tanks represented by that mode. */
export interface FluidIOModeConfig {
  /** Name tag used by the resource-pack IO button, such as `input_1`. */
  id: string;
  /** Fluid tank indices that accept fluid while this mode is active. */
  inputIndices?: number[];
  /** Fluid tank indices that expose fluid while this mode is active. */
  outputIndices?: number[];
}

/** Static indexed-fluid policy registered for one machine block type. */
export interface LiquidIOGroupConfig {
  /** Optional six UI button slots, explicit or as an inclusive start/end range. */
  buttonSlots?: number[] | [number, number];
  /** Explicit insertion fallback used when no source face is known. */
  anyInputIndices: number[];
  /** Explicit extraction fallback used when no destination face is known. */
  anyOutputIndices: number[];
  /** Ordered visual modes cycled independently on each face. */
  modes: FluidIOModeConfig[];
}

/** One visual gas IO mode and the indexed tanks represented by that mode. */
export interface GasIOModeConfig {
  id: string;
  inputIndices?: number[];
  outputIndices?: number[];
}

/** Static indexed-gas policy registered for one machine block type. */
export interface GasIOGroupConfig {
  buttonSlots?: number[] | [number, number];
  anyInputIndices: number[];
  anyOutputIndices: number[];
  modes: GasIOModeConfig[];
}

/** Complete IO registration for one machine block type. */
export interface IOInterfaceConfig {
  /** Slot-based item policy and optional item face buttons. */
  items?: ItemIOGroupConfig;
  /** Indexed-fluid policy and optional fluid face buttons. */
  liquids?: LiquidIOGroupConfig;
  /** Indexed-gas policy stored separately from liquids. */
  gases?: GasIOGroupConfig;
}

/** Per-tick limits used by {@link BasicMachine.processIO}. */
export interface ProcessIOLimits {
  maxInputSlotsScannedPerTick?: number;
  maxOutputSlotsMovedPerTick?: number;
  maxFluidMovedPerTick?: number;
  maxGasMovedPerTick?: number;
}

/** Transfer counts returned by {@link BasicMachine.processIO}. */
export interface ProcessIOSummary {
  itemsMoved: number;
  inputSlotsScanned: number;
  fluidMoved: number;
  gasMoved: number;
}

/** Registers one machine's item policy and optional item/liquid IO buttons. */
export function registerIOInterface(blockTypeId: string, config?: IOInterfaceConfig): boolean;

/** Registers a reusable IO template selected by one exact runtime block tag. */
export function registerIOInterfaceForBlockTag(blockTag: string, config?: IOInterfaceConfig): boolean;

/** Resolves and caches a tagged IO fallback when the block type has no exact registration. */
export function ensureBlockIOInterface(block?: Block): boolean;

/** Returns whether one exact block type already owns an IO registration. */
export function hasRegisteredIOInterface(blockTypeId: string): boolean;

/** Namespace-style IO interface export. */
export const IOInterface: {
  ensureBlockIOInterface: typeof ensureBlockIOInterface;
  hasRegisteredIOInterface: typeof hasRegisteredIOInterface;
  registerIOInterface: typeof registerIOInterface;
  registerIOInterfaceForBlockTag: typeof registerIOInterfaceForBlockTag;
};

/** Per-face fluid tank-index arrays stored by Complex fluid containers. */
export type FaceFluidIndexConfig = Partial<Record<DirectionName, number[]>>;

/** Face-independent fluid policy stored by a Simple fluid container. */
export interface SimpleFluidConfig {
  version: 1;
  type: "simple";
  inputConfig: number[];
  outputConfig: number[];
}

/** Face-aware fluid policy stored under `utilitycraft:io_config.liquids`. */
export interface ComplexFluidConfig {
  version: 1;
  type: "complex";
  anyInputIndices: number[];
  anyOutputIndices: number[];
  inputConfig: FaceFluidIndexConfig;
  outputConfig: FaceFluidIndexConfig;
}

export type FluidConfig = SimpleFluidConfig | ComplexFluidConfig;

/** Normalized registered fluid IO mode. */
export interface FluidIOMode {
  id: string;
  inputIndices: number[];
  outputIndices: number[];
}

/** Normalized static fluid policy returned by the registration API. */
export interface FluidIODefinition {
  anyInputIndices: number[];
  anyOutputIndices: number[];
  modes: FluidIOMode[];
}

export const FLUID_CONFIG_VERSION: 1;
export const FLUID_CONFIG_KEY: "liquids";
export const FLUID_CONTAINER_FAMILY: "dorios:fluid_container";
export const FLUID_CONFIG_EVENT_NAMESPACE: "dorios_fluid";
export const SET_FLUID_CONFIG_EVENT_ID: "dorios_fluid:set_config";
export const DEFAULT_FLUID_IO_MODE: "disabled";

export function registerFluidIODefinition(blockTypeId: string, value: LiquidIOGroupConfig): FluidIODefinition;
export function getFluidIODefinition(blockTypeId: string): FluidIODefinition | undefined;
export function ensureFluidIOConfig(entity: Entity, blockTypeId: string): boolean;
export function setFluidConfig(entity: Entity, config: FluidConfig): boolean;
export function getFluidConfig(entity: Entity): FluidConfig | undefined;
export function getFluidConfigRevision(entity: Entity): number;
export function getFluidStatus(entity: Entity): "basic" | "simple" | "complex" | "invalid" | "unsupported";
export function getInputFluidIndices(entity: Entity, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getOutputFluidIndices(entity: Entity, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getFluidIODirectionMode(entity: Entity, blockTypeId: string, direction: string): string;
export function cycleFluidIODirectionMode(entity: Entity, blockTypeId: string, direction: string): string;
export function normalizeFluidConfig(value: unknown, count: number): FluidConfig;
export function cloneFluidConfig(config: FluidConfig): FluidConfig;

/** Fluid storage endpoint resolved from a machine entity, port, or tank block. */
export interface ResolvedFluidContainer {
  kind: "entity" | "tank";
  block: Block | undefined;
  entity: Entity | undefined;
}

export type FluidContainerTarget = Block | Entity | ResolvedFluidContainer;

export interface FluidTransferOptions {
  sourceIndex: number;
  target: FluidContainerTarget;
  targetFace?: DirectionName;
  targetIndices?: ReadonlyArray<number>;
  maxAmount?: number;
}

export interface FluidInsertOptions {
  type: string;
  amount: number;
  face?: DirectionName;
  indices?: ReadonlyArray<number>;
  exact?: boolean;
}

export function resolveFluidContainer(target: FluidContainerTarget): ResolvedFluidContainer | undefined;
export function resolveFluidContainerAt(dimension: Dimension, location: Vector3): ResolvedFluidContainer | undefined;
export function getFluidInputIndices(target: FluidContainerTarget, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getFluidOutputIndices(target: FluidContainerTarget, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getFluidContainerRevision(target: FluidContainerTarget): number;
export function transferFluid(source: FluidContainerTarget, options: FluidTransferOptions): number;
export function insertFluid(target: FluidContainerTarget, options: FluidInsertOptions): number;
export function getFluidStorage(target: FluidContainerTarget, fluidIndex: number): FluidStorage | undefined;

/** Per-face gas tank-index arrays stored by Complex gas containers. */
export type FaceGasIndexConfig = Partial<Record<DirectionName, number[]>>;

export interface SimpleGasConfig {
  version: 1;
  type: "simple";
  inputConfig: number[];
  outputConfig: number[];
}

/** Face-aware gas policy stored under `utilitycraft:io_config.gases`. */
export interface ComplexGasConfig {
  version: 1;
  type: "complex";
  anyInputIndices: number[];
  anyOutputIndices: number[];
  inputConfig: FaceGasIndexConfig;
  outputConfig: FaceGasIndexConfig;
}

export type GasConfig = SimpleGasConfig | ComplexGasConfig;

export interface GasIOMode {
  id: string;
  inputIndices: number[];
  outputIndices: number[];
}

export interface GasIODefinition {
  anyInputIndices: number[];
  anyOutputIndices: number[];
  modes: GasIOMode[];
}

export const GAS_CONFIG_VERSION: 1;
export const GAS_CONFIG_KEY: "gases";
export const GAS_CONTAINER_FAMILY: "dorios:gas_container";
export const GAS_CONFIG_EVENT_NAMESPACE: "dorios_gas";
export const SET_GAS_CONFIG_EVENT_ID: "dorios_gas:set_config";
export const DEFAULT_GAS_IO_MODE: "disabled";

export function registerGasIODefinition(blockTypeId: string, value: GasIOGroupConfig): GasIODefinition;
export function getGasIODefinition(blockTypeId: string): GasIODefinition | undefined;
export function ensureGasIOConfig(entity: Entity, blockTypeId: string): boolean;
export function setGasConfig(entity: Entity, config: GasConfig): boolean;
export function getGasConfig(entity: Entity): GasConfig | undefined;
export function getGasConfigRevision(entity: Entity): number;
export function getGasStatus(entity: Entity): "basic" | "simple" | "complex" | "invalid" | "unsupported";
export function getInputGasIndices(entity: Entity, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getOutputGasIndices(entity: Entity, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getGasIODirectionMode(entity: Entity, blockTypeId: string, direction: string): string;
export function cycleGasIODirectionMode(entity: Entity, blockTypeId: string, direction: string): string;
export function normalizeGasConfig(value: unknown, count: number): GasConfig;
export function cloneGasConfig(config: GasConfig): GasConfig;

export interface ResolvedGasContainer {
  kind: "entity" | "tank";
  block: Block | undefined;
  entity: Entity | undefined;
}

export type GasContainerTarget = Block | Entity | ResolvedGasContainer;

export interface GasTransferOptions {
  sourceIndex: number;
  target: GasContainerTarget;
  targetFace?: DirectionName;
  targetIndices?: ReadonlyArray<number>;
  maxAmount?: number;
}

export interface GasInsertOptions {
  type: string;
  amount: number;
  face?: DirectionName;
  indices?: ReadonlyArray<number>;
  exact?: boolean;
}

export function resolveGasContainer(target: GasContainerTarget): ResolvedGasContainer | undefined;
export function resolveGasContainerAt(dimension: Dimension, location: Vector3): ResolvedGasContainer | undefined;
export function getGasInputIndices(target: GasContainerTarget, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getGasOutputIndices(target: GasContainerTarget, options?: { face?: DirectionName }): ReadonlyArray<number>;
export function getGasContainerRevision(target: GasContainerTarget): number;
export function transferGas(source: GasContainerTarget, options: GasTransferOptions): number;
export function insertGas(target: GasContainerTarget, options: GasInsertOptions): number;
export function getGasStorage(target: GasContainerTarget, gasIndex: number): GasStorage | undefined;

/**
 * Base runtime for UtilityCraft machine-like blocks.
 *
 * Resolves the helper entity from a block, checks the tick scheduler, exposes
 * common container/energy handles, and provides UI helpers such as labels,
 * progress bars, energy displays, slot blocking, and active/off state toggles.
 */
export class BasicMachine {
  /** Whether the helper entity, inventory, and scheduler checks succeeded. */
  valid: boolean;
  /** Helper entity paired with the machine block. */
  entity: Entity;
  /** True when the container UI is open and display slots should update. */
  shouldUpdateUI: boolean;
  /** Energy storage manager bound to the helper entity. */
  energy: EnergyStorage;
  /** Dimension containing the machine block. */
  dimension: Dimension;
  /** Block represented by this runtime instance. */
  block: Block;
  /** Inventory container exposed by the helper entity. */
  container: Container;
  /** Base processing/generation rate before scheduler interval scaling. */
  baseRate: number;
  /** Effective tick interval returned by the scheduler. */
  processingInterval: number;
  /** Scaled runtime rate, usually `baseRate * processingInterval`. */
  rate: number;
  /** Whether the entity's slot-based Complex item config is ready locally. */
  itemIOReady: boolean;
  /** Whether the entity's indexed-fluid Complex config is ready locally. */
  fluidIOReady: boolean;

  /**
   * Creates a base machine runtime for a machine block.
   *
   * If the helper entity or inventory cannot be resolved, or the scheduler says
   * this machine should not process this tick, {@link valid} remains false.
   */
  constructor(block: Block, options: BasicMachineOptions);
  /** Sets a new base rate and recalculates the scheduler-scaled effective rate. */
  setRate(baseRate: number): void;
  /**
   * Writes a text label into the machine UI.
   *
   * A string becomes the item name. A string array uses the first entry as the
   * name and the remaining entries as lore lines.
   */
  setLabel(text: string | string[], slot?: number): void;
  /** Sets the represented block's `utilitycraft:on` state to true. */
  on(): void;
  /** Sets the represented block's `utilitycraft:on` state to false. */
  off(): void;
  /** Adds progress to a dynamic progress channel. */
  addProgress(amount: number, index?: number): void;
  /** Reads the current progress from a dynamic progress channel. */
  getProgress(index?: number): number;
  /** Stores progress and optionally redraws the UI progress bar. */
  setProgress(value: number, maxValue?: number, options?: ProgressOptions): void;
  /** Draws the current progress into an inventory slot as a progress item. */
  displayProgress(maxValue?: number, options?: ProgressOptions): void;
  /** Draws the current energy bar using the attached {@link EnergyStorage}. */
  displayEnergy(slot?: number): void;
  /** Processes configured item slots and fluid indices for every enabled face. */
  processIO(limits?: ProcessIOLimits): ProcessIOSummary;
  /** Fills empty slots with blocker items so players cannot use them. */
  blockSlots(slots: number[]): void;
  /** Removes blocker items from the provided slots. */
  unblockSlots(slots: number[]): void;
}

/**
 * Main runtime class for UtilityCraft processing machines.
 *
 * Extends {@link BasicMachine} with upgrade boosts, item transfer helpers,
 * energy-cost based progress, machine labels, spawn logic, and destroy logic.
 */
export class Machine extends BasicMachine {
  /** Full machine configuration passed into the constructor. */
  settings: MachineSettings;
  /** Global resolved upgrade perks, including custom registered values. */
  boosts: MachineBoosts;

  /** Creates a machine runtime bound to a machine block. */
  constructor(block: Block, settings: MachineSettings);
  /**
   * Handles machine destruction, drops inventory contents, preserves stored
   * energy/fluid in item lore, releases the tick group, and removes the helper entity.
   */
  static onDestroy(event: DestroyEventLike): boolean;
  /**
   * Spawns and initializes a machine helper entity, restoring energy/fluid from
   * the placed item lore and applying optional rotation behavior.
   */
  static spawnEntity(event: PlacementEventLike, config: MachineSettings, callback?: (entity: Entity) => void): void;
  /** Transfers output items to the cached item output target, clearing stale targets. */
  transferItems(): boolean;
  /** Returns whether the configured output slot or range contains items. */
  hasOutputItems(): boolean;
  /** Pulls items from the vanilla container block above the machine into a slot. */
  pullItemsFromAbove(targetSlot: number): boolean;
  /** Sets progress using this machine's configured energy cost as the default max value. */
  setProgress(value: number, options?: ProgressOptions): void;
  /** Displays progress using this machine's configured energy cost by default. */
  displayProgress(options?: ProgressOptions): void;
  /** Displays progress using an explicit max value. */
  displayProgress(maxValue: number, options?: ProgressOptions): void;
  /** Stores the machine energy cost used as the default progress max. */
  setEnergyCost(value: number, index?: number): void;
  /** Reads the machine energy cost used as the default progress max. */
  getEnergyCost(index?: number): number;
  /** Draws the current energy bar. */
  displayEnergy(slot?: number): void;
  /** Shows a warning label, optionally resets progress, and turns the machine off. */
  showWarning(message: string, options?: WarningOptions): void;
  /** Shows the normal running/status label including boosts, cost, and rate. */
  showStatus(message: string): void;
}

/**
 * Runtime class for UtilityCraft generators and batteries.
 *
 * Extends {@link BasicMachine} with generator spawn/destruction logic, adjacent
 * network tagging, and the generator transfer mode UI.
 */
export class Generator extends BasicMachine {
  /** Full generator configuration passed into the constructor. */
  settings: GeneratorSettings;

  /** Creates a generator runtime bound to a generator block. */
  constructor(block: Block, settings: GeneratorSettings);
  /**
   * Handles generator destruction, drops inventory contents, preserves stored
   * energy/fluid in item lore, releases the tick group, and removes the helper entity.
   */
  static onDestroy(event: DestroyEventLike): boolean;
  /** Spawns and initializes a generator helper entity from placement data. */
  static spawnEntity(event: PlacementEventLike, config: GeneratorSettings, callback?: (entity: Entity) => void): void;
  /**
   * Adds six adjacent block positions as network tags on a generator entity.
   *
   * @deprecated Network tags are rebuilt through `updatePipes` from real placed
   * energy blocks. Avoid registering all adjacent positions by default.
   */
  static addNearbyMachines(entity: Entity): void;
  /** Opens the generator transfer mode menu for nearest, farthest, or round mode. */
  static openGeneratorTransferModeMenu(entity: Entity, player: Player): void;
}

/**
 * Scoreboard-backed energy storage manager for machine helper entities.
 *
 * Uses mantissa/exponent scoreboard objectives so large DE values remain safe
 * for Minecraft scoreboards while still behaving like regular numbers in code.
 */
export class EnergyStorage {
  /** Entity whose energy values are managed. */
  entity: Entity;
  /** Scoreboard identity used by the storage objectives. */
  scoreId: ScoreboardIdentity | undefined;
  /** Cached maximum energy capacity. */
  cap: number;

  /** Creates an energy manager for an entity and ensures it has a scoreboard identity. */
  constructor(entity: Entity);
  /** Creates or loads all energy scoreboard objectives. Call once after world load. */
  static initializeObjectives(): void;
  /** Normalizes a large number into a scoreboard-safe mantissa/exponent pair. */
  static normalizeValue(amount: number): NormalizedValue;
  /** Rebuilds the real number from a mantissa/exponent pair. */
  static combineValue(value: number, exp: number): number;
  /** Formats an energy value as DE, kDE, MDE, GDE, TDE, or PDE. */
  static formatEnergyToText(value: number): string;
  /** Parses an energy value from lore/display text. */
  static getEnergyFromText(input: string, index?: number): number | undefined;
  /** Static helper for setting an entity's energy capacity directly. */
  static setCap(entity: Entity, amount: number): void;
  /** Sets this entity's maximum energy capacity. */
  setCap(amount: number): void;
  /** Reads and caches this entity's maximum energy capacity. */
  getCap(): number;
  /** Reads the normalized capacity without losing mantissa/exponent information. */
  getCapNormalized(): NormalizedValue;
  /** Sets the current stored energy. */
  set(amount: number): void;
  /** Gets the current stored energy. */
  get(): number;
  /** Gets the current stored energy as a normalized mantissa/exponent pair. */
  getNormalized(): NormalizedValue;
  /** Returns how much energy can still fit before reaching capacity. */
  getFreeSpace(): number;
  /** Adds energy, clamped to free capacity. Negative values can subtract. */
  add(amount: number): number;
  /** Draws the current energy bar item into an inventory slot. */
  display(slot?: number): void;
  /** Consumes energy if enough is available, respecting creative-tag bypass. */
  consume(amount: number): number;
  /** Returns true when this storage contains at least the requested amount. */
  has(amount: number): boolean;
  /** Returns true when no free energy capacity remains. */
  isFull(): boolean;
  /** Rewrites the current value using the optimal mantissa/exponent scale. */
  rebalance(): void;
  /** Gets current energy as a percentage from 0 to 100. */
  getPercent(): number;
  /** Transfers energy from this storage to another storage. */
  transferTo(other: EnergyStorage, amount: number): number;
  /** Transfers energy from this storage to another entity. */
  transferToEntity(entity: Entity, amount: number): number;
  /** Receives energy from another storage. */
  receiveFrom(other: EnergyStorage, amount: number): number;
  /** Receives energy from another entity. */
  receiveFromEntity(entity: Entity, amount: number): number;
  /**
   * Transfers energy to connected network nodes.
   *
   * Network positions are read from cached dynamic properties/tags and processed
   * according to the selected transfer mode. Stale `pos:`/`net:` tags are removed
   * when their position no longer contains an energy container entity.
   */
  transferToNetwork(speed: number, mode?: TransferMode): number;
}

/** Fluid item that inserts liquid into a tank or machine. */
export interface FluidContainerData {
  /** Amount inserted in mB. */
  amount: number;
  /** Fluid type to insert. */
  type: string;
  /** Optional output item id after insertion. */
  output?: string;
  /** Whether the item fills the target with all available free space. */
  infinite?: boolean;
}

/** Fluid holder item that extracts liquid from a tank or machine. */
export interface FluidHolderData {
  /** Fluid type to output item id map. */
  types: Record<string, string>;
  /** Required stored amount before extraction succeeds. */
  required: number;
}

/** Selected inventory slot data used by fluid item replacement helpers. */
export interface SelectedInventoryItem {
  /** Selected hotbar slot index. */
  slot: number;
  /** Player inventory container. */
  inventory: Container;
  /** Item currently in the selected slot. */
  item: ItemStack | undefined;
}

/**
 * Scoreboard-backed fluid storage manager for machines, tanks, and multiblocks.
 *
 * Supports multiple indexed tanks per entity, fluid type tags, item insertion
 * and extraction, fluid bar display, tank spawning, and network transfer.
 */
export class FluidStorage {
  /** Entity whose fluid values are managed. */
  entity: Entity;
  /** Tank index managed by this instance. */
  index: number;
  /** Scoreboard identity used by the fluid objectives. */
  scoreId: ScoreboardIdentity | undefined;
  /** True when the entity UI is open and display slots should update. */
  shouldUpdateUI: boolean;
  /** Cached fluid type for this tank. */
  type: string;
  /** Cached maximum fluid capacity in mB. */
  cap: number;

  /** Registered item ids that insert fluid into storage. */
  static itemFluidStorages: Record<string, FluidContainerData>;
  /** Registered item ids that extract fluid from storage. */
  static itemFluidHolders: Record<string, FluidHolderData>;

  /** Creates a fluid manager for an entity and tank index. */
  constructor(entity: Entity, index?: number);
  /** Returns true when this entity should preserve fluid type tags while empty. */
  hasFixedFluidType(): boolean;
  /** Initializes and returns tank index 0 for a single-fluid entity. */
  static initializeSingle(entity: Entity): FluidStorage;
  /** Returns true when at least one player has this entity container UI open. */
  static hasOpenUI(entity: Entity): boolean;
  /** Initializes several indexed tanks and returns their managers. */
  static initializeMultiple(entity: Entity, count: number): FluidStorage[];
  /** Creates or loads fluid scoreboard objectives for an indexed tank. */
  static initializeObjectives(index?: number): void;
  /** Returns the maximum amount of fluid tanks supported by an entity. */
  static getMaxLiquids(entity: Entity): number;
  /** Normalizes a large fluid amount into a scoreboard-safe mantissa/exponent pair. */
  static normalizeValue(amount: number): NormalizedValue;
  /** Rebuilds the real amount from a mantissa/exponent pair. */
  static combineValue(value: number, exp: number): number;
  /** Formats a fluid amount as mB, B, KB, MB, GB, TB, PB, or EB. */
  static formatFluid(value: number): string;
  /** Parses a fluid type and amount from lore/display text. */
  static getFluidFromText(input: string): { type: string; amount: number };
  /** Returns registered fluid insertion data for an item id. */
  static getContainerData(id: string): FluidContainerData | null;
  /** Returns the player's selected inventory item and slot metadata. */
  static getSelectedInventoryItem(player: Player): SelectedInventoryItem | null;
  /** Replaces the held fluid item while preserving the selected slot when possible. */
  static replaceHeldFluidItem(player: Player, expectedTypeId: string, nextTypeId?: string): boolean;
  /** Initializes the base fluid scoreboard identity for an entity. */
  static initialize(entity: Entity): void;
  /** Transfers fluid between two world block locations when both support fluids. */
  static transferBetween(dim: Dimension, sourceLoc: Vector3, targetLoc: Vector3, amount?: number): boolean;
  /** Finds a tank matching the requested type, or an empty tank that can accept it. */
  static findType(entity: Entity, type: string): FluidStorage | null;
  /** Handles inserting/extracting fluid based on the item held by a player. */
  static handleFluidItemInteraction(player: Player, entity: Entity, mainHand?: ItemStack): void;
  /** Attempts to insert a fluid type and amount into this tank. */
  tryInsert(type: string, amount: number): boolean;
  /** Handles a fluid item interaction and returns the output item id or false. */
  fluidItem(typeId: string): string | false;
  /** Sets this tank's maximum fluid capacity. */
  setCap(amount: number): void;
  /** Reads and caches this tank's maximum fluid capacity. */
  getCap(): number;
  /** Sets this tank's current fluid amount. */
  set(amount: number): void;
  /** Gets this tank's current fluid amount. */
  get(): number;
  /** Adds or subtracts fluid, clamped by capacity and current amount. */
  add(amount: number): number;
  /** Consumes fluid if enough is available, respecting creative-tag bypass. */
  consume(amount: number): number;
  /** Returns how much fluid can still fit before reaching capacity. */
  getFreeSpace(): number;
  /** Returns true when this tank contains at least the requested amount. */
  has(amount: number): boolean;
  /** Returns true when this tank has no free space remaining. */
  isFull(): boolean;
  /** Reads the fluid type stored in this tank's entity tags. */
  getType(): string;
  /** Sets the fluid type stored in this tank's entity tags. */
  setType(type: string): void;
  /** Transfers fluid to connected network nodes using the selected order. */
  transferToNetwork(speed: number, mode?: TransferMode, nodes?: Vector3[]): number;
  /** Transfers fluid to the cached fluid output target, clearing stale targets. */
  transferFluids(block: Block, amount?: number): boolean;
  /** Transfers fluid from this tank to another tank. */
  transferTo(other: FluidStorage, amount: number): number;
  /** Receives fluid from another tank. */
  receiveFrom(other: FluidStorage, amount: number): number;
  /** Draws the current fluid bar item into an inventory slot. */
  display(slot?: number): void;
  /** Spawns or updates a fluid tank entity at a tank block. */
  static addfluidToTank(block: Block, type: string, amount: number): Entity | undefined | false;
  /** Returns the default capacity for a fluid tank block id. */
  static getTankCapacity(typeId: string): number;
}

/** Item that inserts a registered gas into storage. */
export interface GasContainerData {
  amount: number;
  type: string;
  output?: string;
  infinite?: boolean;
}

/** Item that extracts a registered gas from storage. */
export interface GasHolderData {
  types: Record<string, string>;
  required: number;
}

/** Scoreboard-backed gas storage, fully isolated from {@link FluidStorage}. */
export class GasStorage {
  entity: Entity;
  index: number;
  scoreId: ScoreboardIdentity | undefined;
  shouldUpdateUI: boolean;
  type: string;
  cap: number;

  static itemGasStorages: Record<string, GasContainerData>;
  static itemGasHolders: Record<string, GasHolderData>;

  constructor(entity: Entity, index?: number);
  hasFixedGasType(): boolean;
  static initializeSingle(entity: Entity): GasStorage;
  static hasOpenUI(entity: Entity): boolean;
  static initializeMultiple(entity: Entity, count: number): GasStorage[];
  static initializeObjectives(index?: number): void;
  static getMaxGases(entity: Entity): number;
  static normalizeValue(amount: number): NormalizedValue;
  static combineValue(value: number, exp: number): number;
  static formatGas(value: number): string;
  static getGasFromText(input: string): { type: string; amount: number };
  static getContainerData(id: string): GasContainerData | null;
  static getSelectedInventoryItem(player: Player): SelectedInventoryItem | null;
  static replaceHeldGasItem(player: Player, expectedTypeId: string, nextTypeId?: string): boolean;
  static initialize(entity: Entity): void;
  static transferBetween(dim: Dimension, sourceLoc: Vector3, targetLoc: Vector3, amount?: number): boolean;
  static findType(entity: Entity, type: string): GasStorage | null;
  static handleGasItemInteraction(player: Player, entity: Entity, mainHand?: ItemStack): void;
  tryInsert(type: string, amount: number): boolean;
  gasItem(typeId: string): string | false;
  setCap(amount: number): void;
  getCap(): number;
  set(amount: number): void;
  get(): number;
  add(amount: number): number;
  consume(amount: number): number;
  getFreeSpace(): number;
  has(amount: number): boolean;
  isFull(): boolean;
  getType(): string;
  setType(type: string): void;
  transferToNetwork(speed: number, mode?: TransferMode, nodes?: Vector3[]): number;
  transferGases(block: Block, amount?: number): boolean;
  transferTo(other: GasStorage, amount: number): number;
  receiveFrom(other: GasStorage, amount: number): number;
  display(slot?: number): void;
  static addGasToTank(block: Block, type: string, amount: number): Entity | undefined | false;
  static getTankCapacity(typeId: string): number;
}

/** Config for a machinery scheduler refresh profile. */
export interface SchedulerProfileConfig {
  /** Human-readable profile label. */
  label: string;
  /** Closed-machine processing interval in ticks. */
  closedInterval: number;
}

/** Entity property used to store the closed-background tick group. */
export const TICK_GROUP_PROPERTY_ID: "utilitycraft:tick_group";
/** World dynamic property used to store counts per tick group. */
export const TICK_GROUP_COUNTS_PROPERTY_ID: "utilitycraft:tick_group_counts";

/**
 * Shared static scheduler for UtilityCraft machinery.
 *
 * Closed machines are distributed across five tick groups. Open machine UIs are
 * kept responsive with a fixed interval while closed machines use the selected
 * refresh profile.
 */
export class TickScheduler {
  /** Returns all scheduler profile ids in display order. */
  static getSchedulerProfileIds(): SchedulerProfileId[];
  /** Returns a copy of every scheduler profile config. */
  static getSchedulerProfiles(): Record<SchedulerProfileId, SchedulerProfileConfig>;
  /** Returns the currently active scheduler profile id. */
  static getSchedulerProfile(): SchedulerProfileId;
  /** Persists and activates a scheduler profile, returning the normalized id. */
  static setSchedulerProfile(profile: string): SchedulerProfileId;
  /** Returns a profile config, defaulting to the active profile. */
  static getSchedulerProfileConfig(profile?: string): SchedulerProfileConfig;
  /** Returns the persisted amount of machines assigned to each tick group. */
  static getGroupCounts(): number[];
  /** Persists normalized tick group counts. */
  static setGroupCounts(counts: number[]): number[];
  /** Applies a count delta to a tick group and persists the result. */
  static updateGroupCount(group: number, delta: number): number[];
  /** Returns the tick group with the fewest assigned machines. */
  static getLeastUsedGroup(): number;
  /** Reads the tick group assigned to a machine helper entity. */
  static getTickGroup(entity: Entity): number;
  /** Writes a tick group to a machine helper entity. */
  static setTickGroup(entity: Entity, group: number): number;
  /** Assigns a least-used tick group when the entity has none. */
  static assignTickGroup(entity: Entity): number;
  /** Releases a machine entity from its current tick group. */
  static releaseTickGroup(entity: Entity): number;
  /** Returns true when at least one player has the machine UI open. */
  static hasOpenUI(entity: Entity): boolean;
  /** Returns true when a machine should execute logic on the current tick. */
  static shouldProcessMachine(entity: Entity): boolean;
  /** Returns the effective processing interval used to scale runtime rate. */
  static getProcessingInterval(entity: Entity): number;
  /** Handles the scheduler profile script event payload. */
  static handleSchedulerProfileScriptEvent(message: string): void;
  /** Handles cross-addon tick group count sync events. */
  static handleTickGroupScriptEvent(message: string): void;
}

/**
 * Tracks cached machine output targets for item, fluid, and gas transfer.
 *
 * The tracker refreshes machines when relevant blocks are placed and provides
 * a lazy fallback for machines that existed before the cache was written.
 */
export class OutputTracker {
  /** Returns whether a block can receive the requested transfer type. */
  static isOutputTarget(block: Block | undefined, type: OutputTransferType): boolean;
  /** Reads cached compatibility for all six item/liquid/gas faces. */
  static getIOTargets(entity: Entity | undefined): Record<string, Record<string, boolean>>;
  /** Rebuilds cached compatibility for all resources supported by the block. */
  static refreshIOTargets(block: Block | undefined): Record<string, Record<string, boolean>> | undefined;
  /** Refreshes IO target caches on adjacent machine blocks. */
  static refreshAdjacentIOTargets(block: Block | undefined): void;
  /** Returns whether a cached item/liquid/gas direction is compatible. */
  static isIOTargetEnabled(entity: Entity | undefined, group: "items" | "liquids" | "gases", direction: string): boolean;
  /** Returns the location in front of a machine's output side. */
  static getOutputLocation(block: Block): Vector3 | undefined;
  /** Reads a cached output target from a machine helper entity. */
  static getOutputTarget(entity: Entity, type: OutputTransferType): Vector3 | undefined;
  /** Stores a cached output target on a machine helper entity. */
  static setOutputTarget(entity: Entity, type: OutputTransferType, target: Vector3): void;
  /** Clears a cached output target from a machine helper entity. */
  static clearOutputTarget(entity: Entity, type: OutputTransferType): void;
  /** Recalculates and stores the output target for a machine block. */
  static refreshOutput(block: Block, type: OutputTransferType): Vector3 | undefined;
  /** Refreshes output targets for machine blocks adjacent to a placed target. */
  static refreshAdjacentOutputs(block: Block, type: OutputTransferType): void;
}

/**
 * Rotation utility for manually placed and wrench-rotated blocks.
 *
 * Supports UtilityCraft axis/rotation states plus vanilla cardinal and facing
 * direction states.
 */
export class Rotation {
  /** Places a block manually with `utilitycraft:axis` based on player look direction. */
  static facing(player: Player, block: Block, perm: BlockPermutation): void;
  /** Rotates a block when a wrench is used on it. */
  static handleRotation(block: Block, blockFace: DirectionName | string): void;
  /** Applies full 24-direction axis/rotation logic for UtilityCraft blocks. */
  static rotate_24(block: Block, blockFace: DirectionName | string): void;
}

/** Shared template item used to restore button slots after a press is detected. */
export let ButtonItemStack: ItemStack | null;
/** Initializes the shared button item used by the machine button watcher. */
export function loadButtonItemStack(itemId?: string, ItemStackClass?: typeof ItemStack): ItemStack | null;

/** Event object delivered to machine button callbacks. */
export interface ButtonPressEvent {
  /** Entity whose inventory contains the button slot. */
  entity: Entity;
  /** Block represented by the helper entity, if it can be resolved. */
  block: Block | undefined;
  /** Inventory container containing the button slot. */
  container: Container;
  /** Slot that changed and triggered the press callback. */
  slot: number;
}

/** Callback invoked when a registered machine button slot changes. */
export type ButtonPressCallback = (event: ButtonPressEvent) => string | void;

/** Registered button definition for a machine id. */
export interface ButtonDefinition {
  /** Inventory slot used as a button. */
  slot: number;
  /** Callback executed when the slot changes. */
  onPressEvent: ButtonPressCallback;
}

/** Runtime watcher state for one entity being tracked by {@link ButtonManager}. */
export interface ButtonWatcher {
  /** Entity being watched. */
  entity: Entity;
  /** Machine id whose registered button definitions apply. */
  machineId: string;
  /** Last known item type per watched slot. */
  cacheBySlot: Map<number, string>;
}

/**
 * Static machine UI button manager.
 *
 * Register button slots per machine id, then call {@link ensureWatching} from a
 * machine tick while its UI should be watched. One global interval detects slot
 * changes and restores the configured button item.
 */
export class ButtonManager {
  /** Registered button definitions grouped by machine id. */
  static machineDefinitions: Map<string, ButtonDefinition[]>;
  /** Active runtime watchers grouped by entity id. */
  static activeWatchers: Map<string, ButtonWatcher>;
  /** Current global watcher interval id. */
  static intervalId: number | undefined;
  /** Registers or replaces button definitions for a machine id. */
  static registerMachineButton(machineId: string, slot: number | number[], onPressEvent?: ButtonPressCallback): boolean;
  /** Removes button definitions for a machine id. */
  static unregisterMachineButton(machineId: string, slot: number | number[]): boolean;
  /** Ensures an entity is being watched using the registered machine buttons. */
  static ensureWatching(entity: Entity, machineId: string): boolean;
  /** Stops watching a specific entity. */
  static unwatchEntity(entity: Entity): boolean;
  /** Creates runtime watcher state for an entity. */
  static createWatcher(entity: Entity, machineId: string, container: Container, buttons: ButtonDefinition[]): ButtonWatcher;
  /** Ensures every registered button slot contains the shared button item. */
  static ensureButtonItems(container: Container, buttons: ButtonDefinition[]): void;
  /** Synchronizes a watcher's slot cache with current button definitions. */
  static syncWatcherCache(watcher: Pick<ButtonWatcher, "cacheBySlot">, container: Container, buttons: ButtonDefinition[]): void;
  /** Starts the global watcher loop if it is not running. */
  static start(): void;
  /** Stops the global watcher loop. */
  static stop(): void;
  /** Runs one button detection pass for all active watchers. */
  static tick(): void;
}

/** Result returned by a successful multiblock structure scan. */
export interface DetectedStructure {
  /** Inclusive outer bounds of the detected structure. */
  bounds: Bounds;
  /** Count of detected internal components by id. */
  components: Record<string, number>;
  /** Serialized input/port tags used during activation. */
  inputBlocks: string[];
  /** Optional casing block positions. */
  caseBlocks?: Vector3[];
  /** Vent block positions detected on the top layer. */
  ventBlocks: Vector3[];
  /** Geometric center of the bounds. */
  center: Vector3;
}

/** Base activation context delivered to multiblock activation hooks. */
export interface ActivationContext<TConfig extends BaseMachineConfig = BaseMachineConfig> {
  /** Controller block. */
  block: Block;
  /** Detected component counts. */
  components: Record<string, number>;
  /** Controller config. */
  config: TConfig;
  /** Energy capacity calculated from the detected structure. */
  energyCap: number;
  /** Controller helper entity. */
  entity: Entity;
  /** Player activating the structure. */
  player: Player;
  /** Alias for `config`, kept for machine script ergonomics. */
  settings: TConfig;
  /** Full detected structure data. */
  structure: DetectedStructure;
}

/** Activation context for multiblock machines, including computed factory stats. */
export interface MachineActivationContext extends ActivationContext<MachineSettings> {
  /** Computed processing, speed, efficiency, and energy multiplier data. */
  factoryData: MachineStats;
}

/** Optional callbacks used by multiblock interaction helpers. */
export interface InteractionHandlers<TConfig extends BaseMachineConfig, TContext extends ActivationContext<TConfig>> {
  /** Runs after a missing controller entity is spawned and before activation. */
  initializeEntity?: (entity: Entity, context: { e: InteractionEventLike; player: Player; config: TConfig; settings: TConfig }) => void;
  /** Runs when the player interacts without a wrench. */
  onInteractWithoutWrench?: (context: {
    e: InteractionEventLike;
    entity?: Entity;
    player: Player;
    config: TConfig;
    settings: TConfig;
  }) => unknown;
  /** Runs after validation and before success messages. Return false to cancel activation. */
  onActivate?: (context: TContext) => unknown | Promise<unknown>;
  /** Success messages or a function that builds success messages from the activation context. */
  successMessages?: string[] | ((context: TContext) => string[]);
}

/** Computed runtime multipliers for multiblock machines. */
export interface MachineStats {
  /** Raw detected component counts used for stats. */
  raw: {
    processing: number;
    speed: number;
    efficiency: number;
  };
  /** Processing capacity and its energy penalty. */
  processing: {
    amount: number;
    penalty: number;
  };
  /** Speed multiplier and its energy penalty. */
  speed: {
    multiplier: number;
    penalty: number;
  };
  /** Efficiency multiplier used in energy cost calculations. */
  efficiency: {
    multiplier: number;
  };
  /** Combined energy multiplier from processing, speed, and efficiency. */
  energyMultiplier: number;
}

/**
 * Runtime and helper class for multiblock machines.
 *
 * Provides controller spawn/destruction, wrench interaction handling,
 * validation/activation, computed machine stats, output distribution, and
 * multiblock-friendly progress display.
 */
export class MultiblockMachine extends BasicMachine {
  /** Full multiblock machine config. */
  config: MachineSettings;
  /** Alias for {@link config}. */
  settings: MachineSettings;

  /** Default message shown when a player interacts without a wrench. */
  static defaultOnInteractWithoutWrench(context: { entity?: Entity; player: Player }): void;
  /** Creates a multiblock machine runtime bound to a controller block. */
  constructor(block: Block, config: MachineSettings);
  /** Spawns and initializes a multiblock machine controller helper entity. */
  static spawnEntity(event: PlacementEventLike, config: MachineSettings, callback?: (entity: Entity) => void): void;
  /** Shared wrench interaction pipeline for multiblock machine controllers. */
  static handlePlayerInteract(
    event: InteractionEventLike,
    config: MachineSettings,
    handlers?: InteractionHandlers<MachineSettings, MachineActivationContext>,
  ): Promise<unknown>;
  /** Handles controller destruction and drops stored energy/fluid data into the item lore. */
  static onDestroy(event: DestroyEventLike): boolean;
  /** Detects, validates, activates, and stores state for a multiblock machine controller. */
  static activateMachineController(
    event: InteractionEventLike,
    config: MachineSettings,
    entity: Entity,
    handlers?: Pick<InteractionHandlers<MachineSettings, MachineActivationContext>, "onActivate" | "successMessages">,
  ): Promise<MachineActivationContext | undefined>;
  /** Returns the first failed multiblock requirement, if any. */
  static validateRequirements(components: Record<string, number>, requirements: Record<string, Requirement>): Requirement | undefined;
  /** Distributes output items across empty or matching partial output stacks. */
  static distributeOutput(
    controller: MultiblockMachine,
    outputSlots: number[],
    itemId: string,
    amount: number,
    options?: { suppressErrors?: boolean },
  ): void;
  /** Sets progress using multiblock progress defaults. */
  setProgress(value: number, options?: ProgressOptions): void;
  /** Displays progress using the configured multiblock energy cost. */
  displayProgress(options?: ProgressOptions): void;
  /** Stores the energy cost used as the default progress maximum. */
  setEnergyCost(value: number, index?: number): void;
  /** Reads the energy cost used as the default progress maximum. */
  getEnergyCost(index?: number): number;
  /** Computes processing, speed, efficiency, and energy multipliers from components. */
  static computeMachineStats(components: Record<string, number>): MachineStats;
  /** Writes the standard multiblock machine information label into the controller UI. */
  static setMachineInfoLabel(controller: MultiblockMachine, data: MachineStats & { cost?: number }, status?: string): string;
}

/**
 * Runtime and helper class for multiblock generators.
 *
 * Provides controller spawn, wrench interaction handling, validation, activation,
 * and generator-specific multiblock callbacks.
 */
export class MultiblockGenerator extends Generator {
  /** Full multiblock generator config. */
  config: GeneratorSettings;
  /** Alias for {@link config}. */
  settings: GeneratorSettings;

  /** Default message shown when a player interacts without a wrench. */
  static defaultOnInteractWithoutWrench(context: { entity?: Entity; player: Player }): void;
  /** Creates a multiblock generator runtime bound to a controller block. */
  constructor(block: Block, config: GeneratorSettings);
  /** Spawns and initializes a multiblock generator controller helper entity. */
  static spawnEntity(event: PlacementEventLike, config: GeneratorSettings, callback?: (entity: Entity) => void): void;
  /** Shared wrench interaction pipeline for multiblock generator controllers. */
  static handlePlayerInteract(
    event: InteractionEventLike,
    config: GeneratorSettings,
    handlers?: InteractionHandlers<GeneratorSettings, ActivationContext<GeneratorSettings>>,
  ): Promise<unknown>;
  /** Detects, validates, activates, and stores state for a multiblock generator controller. */
  static activateGeneratorController(
    event: InteractionEventLike,
    config: GeneratorSettings,
    entity: Entity,
    handlers?: Pick<InteractionHandlers<GeneratorSettings, ActivationContext<GeneratorSettings>>, "onActivate" | "successMessages">,
  ): Promise<ActivationContext<GeneratorSettings> | undefined>;
  /** Returns the first failed multiblock requirement, if any. */
  static validateRequirements(components: Record<string, number>, requirements: Record<string, Requirement>): Requirement | undefined;
}

/** Static scanner for multiblock structures starting from a controller block. */
export class StructureDetector {
  /** Detects and validates a multiblock structure from its controller. */
  static detectFromController(event: InteractionEventLike, caseTag: string): Promise<false | DetectedStructure>;
  /** Plays a vertical outline particle effect around detected bounds. */
  static showFormationEffect(bounds: Bounds, dim: Dimension): Promise<void>;
  /** Expands outward from a controller position to find casing bounds. */
  static findMultiblockBounds(start: Vector3, dim: Dimension, caseTag: string): Promise<Bounds | null>;
  /** Scans and validates every block inside detected bounds. */
  static scanStructure(
    min: Vector3,
    max: Vector3,
    dim: Dimension,
    controller: Vector3,
    caseTag: string,
  ): Promise<{ components: Record<string, number>; inputBlocks: string[]; ventBlocks: Vector3[] } | string>;
}

/** Applies active state and metadata to detected multiblock structures. */
export class ActivationManager {
  /** Fills detected bounds layer by layer with a helper block. */
  static fillBlocks(bounds: Bounds, dim: Dimension, blockId?: string): void;
  /** Activates ports, stores metadata, optionally fills bounds, and applies energy cap. */
  static activateMultiblock(
    entity: Entity,
    structure: Partial<DetectedStructure>,
    fillBlocksConfig?: FillBlocksConfig,
  ): number;
  /** Calculates total energy capacity from component counts. */
  static calculateEnergyCapacity(components: Record<string, number>): number;
}

/** Deactivates multiblock structures and cleans controller state. */
export class DeactivationManager {
  /** Empties previously filled multiblock bounds layer by layer. */
  static emptyBlocks(entity: Entity, blockId?: string): void;
  /** Deactivates a structure associated with a controller or internal block. */
  static deactivateMultiblock(block: Block, player?: Player, emptyBlocksConfig?: FillBlocksConfig): Entity | undefined;
  /** Deactivates a multiblock and removes its controller entity shortly after. */
  static handleBreakController(block: Block, player?: Player, emptyBlocksConfig?: FillBlocksConfig): Entity | undefined;
}

/** Utility methods for locating and measuring multiblock controller entities. */
export class EntityManager {
  /** Returns the geometric center of a bounding box. */
  static getCenter(min: Vector3, max: Vector3): Vector3;
  /** Calculates inclusive volume of a bounding box. */
  static getVolume(bounds: Bounds): number;
  /** Returns true when a position lies inside inclusive bounds. */
  static isInsideBounds(pos: Vector3, bounds: Bounds): boolean;
  /** Resolves the controller entity associated with a block. */
  static getEntityFromBlock(block: Block): Entity | undefined;
}

/** Public multiblock facade exported by DoriosCore. */
export const Multiblock: {
  Constants: Record<string, unknown>;
  ActivationManager: typeof ActivationManager;
  DeactivationManager: typeof DeactivationManager;
  EntityManager: typeof EntityManager;
  StructureDetector: typeof StructureDetector;
};

/** Default helper entity identifier used by UtilityCraft machines. */
export const DEFAULT_ENTITY_ID: "utilitycraft:machine_entity";
/** Default machinery refresh scheduler profile. */
export const DEFAULT_SCHEDULER_PROFILE: "fast";
/** Script event id used to update the machinery scheduler profile. */
export const SET_SCHEDULER_PROFILE_EVENT_ID: "utilitycraft:set_scheduler_profile";
/** Legacy script event id used to update the global tick speed. */
export const SET_TICK_SPEED_EVENT_ID: "utilitycraft:set_tick_speed";
/** Increments the open UI viewer counter stored on a machine helper entity. */
export function addOpenUICount(entity: Entity): number;
/** Decrements the open UI viewer counter stored on a machine helper entity. */
export function removeOpenUICount(entity: Entity): number;

/** Shared UtilityCraft text colors used by machine status labels. */
export const MACHINE_TEXT_COLORS: Record<string, string>;
/** Placeholder item used to render text labels inside machine inventories. */
export const LABEL_ITEM_ID: "utilitycraft:arrow_indicator_90";
/** Blocker item used to reserve inventory slots in machine UIs. */
export const BLOCKED_SLOT_ITEM_ID: "utilitycraft:arrow_right_0";
/** Dynamic property prefix used to store machine progress values. */
export const MACHINE_PROGRESS_PROPERTY_PREFIX: "dorios:progress_";
/** Dynamic property prefix used to store machine energy cost values. */
export const MACHINE_ENERGY_COST_PROPERTY_PREFIX: "dorios:energy_cost_";
/** Default maximum progress value used by machines. */
export const DEFAULT_PROGRESS_MAX: 800;
/** Default inventory slot used by machine progress displays. */
export const DEFAULT_PROGRESS_SLOT: 2;
/** Default progress item type for the modern progress UI. */
export const DEFAULT_PROGRESS_TYPE: "progress_right_big_bar";
/** Default progress item type for the legacy progress UI. */
export const LEGACY_PROGRESS_TYPE: "arrow_right";
/** Legacy progress display scale. */
export const LEGACY_PROGRESS_SCALE: 16;
/** Modern progress display scale. */
export const MODERN_PROGRESS_SCALE: 22;
/** Total amount of visual frames available for energy bar items. */
export const ENERGY_BAR_FRAME_COUNT: 48;
/** Item id prefix used by UtilityCraft energy bars. */
export const ENERGY_BAR_ITEM_PREFIX: "utilitycraft:energy_";
/** Tag used by entities that should bypass normal resource consumption. */
export const CREATIVE_TAG: "creative";
/** Tag used by infinite resource storages whose contents must not be consumed. */
export const INFINITE_STORAGE_TAG: "dorios:infinite_storage";
/** Fixed stored amount and capacity assigned to infinite resource storages. */
export const INFINITE_STORAGE_CAPACITY: 1000000000;
/** Objective definitions required by the energy storage system. */
export const ENERGY_OBJECTIVE_DEFINITIONS: readonly [string, string][];
/** Empty item shown when a fluid tank has no stored content. */
export const EMPTY_FLUID_BAR_ITEM_ID: "utilitycraft:empty_fluid_bar";
/** Reserved type marker used by empty fluid tanks. */
export const EMPTY_FLUID_TYPE: "empty";
/** Tag used by entities that must keep a fixed fluid type even when empty. */
export const CONSTANT_FLUID_TYPE_TAG: "dorios:constant_fluid_type";
/** Names of shared scoreboard objectives used by the fluid system. */
export const FLUID_OBJECTIVE_NAMES: { readonly maxLiquids: "maxLiquids" };
/** Command used to bootstrap the base fluid scoreboard identity. */
export const INITIAL_FLUID_SCORE_COMMAND: "scoreboard players set @s fluid_0 0";
/** Default inventory slot used to display fluid bars. */
export const DEFAULT_FLUID_DISPLAY_SLOT: 4;
/** Total amount of visual frames available for fluid bar items. */
export const FLUID_BAR_FRAME_COUNT: 48;
/** Base capacities for UtilityCraft fluid tank blocks. */
export const FLUID_TANK_CAPACITIES: Record<string, number>;
/** Empty bar item used by gas storage displays. */
export const EMPTY_GAS_BAR_ITEM_ID: "utilitycraft:empty_fluid_bar";
/** Reserved type marker used by empty gas tanks. */
export const EMPTY_GAS_TYPE: "empty";
/** Tag used by entities that preserve their gas type while empty. */
export const CONSTANT_GAS_TYPE_TAG: "dorios:constant_gas_type";
/** Gas objective names, separate from liquid objectives. */
export const GAS_OBJECTIVE_NAMES: { readonly maxGases: "maxGases" };
/** Command used to initialize indexed gas storage. */
export const INITIAL_GAS_SCORE_COMMAND: "scoreboard players set @s gas_0 0";
export const DEFAULT_GAS_DISPLAY_SLOT: 4;
export const GAS_BAR_FRAME_COUNT: 48;
export const GAS_TANK_CAPACITIES: Record<string, number>;

export const REGISTER_GAS_ITEM_EVENT_ID: "utilitycraft:register_gas_item";
export const REGISTER_GAS_HOLDER_EVENT_ID: "utilitycraft:register_gas_holder";
export const REGISTER_MACHINE_UPGRADE_EVENT_ID: "utilitycraft:register_machine_upgrade";

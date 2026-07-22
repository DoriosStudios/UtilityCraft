import * as DoriosLib from "DoriosLib/index.js";
import { world, ItemStack, system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { OutputTracker } from "./outputTracker.js";

const OPEN_UI_PLAYERS_PROPERTY_ID = "utilitycraft:players";

/** @type {ScoreboardObjective} */
let maxGasesData;

/**
 * Global map storing loaded gas-related scoreboard objectives per index.
 * Each index represents an independent tank slot (e.g., 0, 1, 2).
 */
const objectives = new Map();

/**
 * Manages scoreboard-based gas values for entities or machines.
 *
 * Provides a unified API to store, retrieve, normalize, and display gas values.
 * Each instance can manage a specific tank index (0, 1, ...).
 *
 * The system uses the same mantissa–exponent structure as the Energy system
 * to support large numbers efficiently while maintaining scoreboard safety.
 */
export class GasStorage {
  /**
   * Creates a new GasStorage instance for a specific entity and tank index.
   *
   * @param {Entity} entity The entity representing the gas container.
   * @param {number} [index=0] The index of the gas tank managed by this instance.
   */
  constructor(entity, index = 0) {
    this.entity = entity;
    this.index = index;
    this.scoreId = entity?.scoreboardIdentity;
    this.shouldUpdateUI = GasStorage.hasOpenUI(entity);

    this.scores = {
      gas: objectives.get(`gas_${index}`),
      gasExp: objectives.get(`gasExp_${index}`),
      gasCap: objectives.get(`gasCap_${index}`),
      gasCapExp: objectives.get(`gasCapExp_${index}`),
    };

    this.type = this.getType();
    this.cap = this.getCap();
    if (this.get() == 0 && !this.hasFixedGasType()) {
      this.setType(Constants.EMPTY_GAS_TYPE);
    }
  }

  /**
   * Checks whether this entity should preserve its gas type tags while empty.
   *
   * @returns {boolean} True when the entity has the constant gas type tag.
   */
  hasFixedGasType() {
    return this.entity.hasTag(Constants.CONSTANT_GAS_TYPE_TAG);
  }

  /**
   * Initializes a single gas tank (index 0) for a machine entity.
   *
   * This should be used for machines that only store one type of gas.
   * It ensures the scoreboard objectives for index 0 exist and
   * returns a ready-to-use GasStorage instance.
   *
   * @param {Entity} entity The machine entity to initialize.
   * @returns {GasStorage} A GasStorage instance managing index 0.
   */
  static initializeSingle(entity) {
    return new GasStorage(entity, 0);
  }

  /**
   * Returns whether at least one player currently has this entity container UI open.
   *
   * @param {Entity} entity The entity to inspect.
   * @returns {boolean} Whether the UI is currently open.
   */
  static hasOpenUI(entity) {
    try {
      const count = Number(entity?.getProperty?.(OPEN_UI_PLAYERS_PROPERTY_ID) ?? 0);
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Initializes multiple gas tanks for an entity and updates maxGases.
   *
   * @param {Entity} entity Machine entity.
   * @param {number} count Amount of supported gases.
   * @returns {GasStorage[]} Array of GasStorage instances.
   */
  static initializeMultiple(entity, count) {
    // Set scoreboard maxGases for this entity

    if (maxGasesData && entity.scoreboardIdentity) {
      maxGasesData.setScore(entity.scoreboardIdentity, count);
    }

    // Initialize tanks
    const tanks = [];
    for (let i = 0; i < count; i++) {
      GasStorage.initializeObjectives(i);
      tanks.push(new GasStorage(entity, i));
    }

    return tanks;
  }

  /**
   * Ensures that the required scoreboard objectives exist for a given tank index.
   *
   * Creates or retrieves four objectives per index:
   * - `gas_{index}` → gas amount (mantissa)
   * - `gasExp_{index}` → gas exponent
   * - `gasCap_{index}` → Capacity (mantissa)
   * - `gasCapExp_{index}` → Capacity exponent
   *
   * @param {number} [index=0] The gas tank index to initialize (default 0).
   * @returns {void}
   */
  static initializeObjectives(index = 0) {
    if (!maxGasesData) {
      maxGasesData = world.scoreboard.getObjective(Constants.GAS_OBJECTIVE_NAMES.maxGases)
        ?? world.scoreboard.addObjective(Constants.GAS_OBJECTIVE_NAMES.maxGases, "Max Gases");
    }

    const definitions = [
      [`gas_${index}`, `gas ${index}`],
      [`gasExp_${index}`, `gas Exp ${index}`],
      [`gasCap_${index}`, `gas Cap ${index}`],
      [`gasCapExp_${index}`, `gas Cap Exp ${index}`],
    ];

    for (const [id, display] of definitions) {
      if (!objectives.has(id)) {
        let obj = world.scoreboard.getObjective(id);
        if (!obj) obj = world.scoreboard.addObjective(id, display);
        objectives.set(id, obj);
      }
    }
  }

  /**
   *
   * Returns the max number of gas tanks an entity supports.
   * Reads the `maxGases` scoreboard; defaults to 1 if unset.
   *
   * @param {Entity} entity Entity with gas tanks
   * @returns {number}
   */
  static getMaxGases(entity) {
    if (!entity) return 1;

    let score = 0;
    if (maxGasesData && entity.scoreboardIdentity) {
      score = maxGasesData.getScore(entity.scoreboardIdentity) || 0;
      if (score > 0) return score;
    }

    let taggedSlots = 0;
    for (const tag of entity.getTags()) {
      const match = tag.match(/^gas(\d+)Type:/);
      if (!match) continue;

      const index = Number(match[1]);
      if (!Number.isNaN(index)) {
        taggedSlots = Math.max(taggedSlots, index + 1);
      }
    }

    return Math.max(1, score, taggedSlots);
  }

  /**
   * Map of items that contain or provide gases.
   *
   * Each key represents an item identifier, and its value
   * defines the resulting gas type, amount, and optional output item.
   *
   * Example:
   * ```js
   * GasStorage.itemGasStorages["minecraft:lava_bucket"]
   * // → { amount: 1000, type: "lava", output: "minecraft:bucket" }
   * ```
   *
   * @constant
   * @type {Record<string, { amount: number, type: string, output?: string }>}
   */
  static itemGasStorages = {};

  /**
   * Definitions for items that can extract gas from a tank.
   *
   * Each key represents an item identifier (e.g. "minecraft:bucket"),
   * and its value specifies:
   * - which gas types it can extract
   * - how much gas is required to produce the resulting filled item
   *
   * Structure:
   * {
   *   "itemId": {
   *      types: { gasType: outputItemId, ... },
   *      required: <amount in mB>
   *   }
   * }
   *
   * Example:
   * {
   *   "minecraft:bucket": {
   *      types: {
   *         water: "minecraft:water_bucket",
   *         lava: "minecraft:lava_bucket",
   *         milk: "minecraft:milk_bucket"
   *      },
   *      required: 1000
   *   }
   * }
   *
   * @constant
   * @type {Record<string, { types: Record<string, string>, required: number }>}
   */
  static itemGasHolders = {};

  // --------------------------------------------------------------------------
  // Normalization utilities
  // --------------------------------------------------------------------------

  /**
   * Normalizes a raw gas amount into a mantissa–exponent pair.
   *
   * This ensures the mantissa never exceeds 1e9 to remain scoreboard-safe.
   *
   * @param {number} amount The raw gas amount.
   * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
   */
  static normalizeValue(amount) {
    let exp = 0;
    let value = amount;
    while (value > 1e9) {
      value /= 1000;
      exp += 3;
    }
    return { value: Math.floor(value), exp };
  }

  /**
   * Combines a mantissa and exponent into a full numeric value.
   *
   * @param {number} value Mantissa value.
   * @param {number} exp Exponent multiplier (power of 10).
   * @returns {number} The reconstructed numeric value.
   */
  static combineValue(value, exp) {
    return (value || 0) * 10 ** (exp || 0);
  }
  /**
   * Formats a gas amount into a human-readable string with units.
   *
   * @param {number} value The gas amount in millibuckets (mB).
   * @returns {string} A formatted string with unit suffix (mB, kB, MB).
   */
  static formatGas(value) {
    const safeValue = Math.max(0, Number(value) || 0);

    if (safeValue >= 1e21) {
      return `${(safeValue / 1e21).toFixed(2)} EB`;
    } // ExaBucket (EB) for extremely large values

    if (safeValue >= 1e18) {
      return `${(safeValue / 1e18).toFixed(2)} PB`;
    } // PetaBucket (PB) for very large values

    if (safeValue >= 1e15) {
      return `${(safeValue / 1e15).toFixed(2)} TB`;
    } // TeraBucket (TB) for large values

    if (safeValue >= 1e12) {
      return `${(safeValue / 1e12).toFixed(2)} GB`;
    } // GigaBucket (GB) for large values

    if (safeValue >= 1e9) {
      return `${(safeValue / 1e9).toFixed(2)} MB`;
    } // MegaBucket (MB) for large values

    if (safeValue >= 1e6) {
      return `${(safeValue / 1e6).toFixed(2)} KB`;
    } // KiloBucket (KB) for medium values

    if (safeValue >= 1e3) {
      return `${(safeValue / 1e3).toFixed(1)} B`;
    } // Bucket (B) for small values

    return `${Math.floor(safeValue)} mB`;
  } // Milibucket (mB) for very small values

  /**
   * Extracts the gas type and amount from a formatted text like:
   * "§r§7  Lava: 52809 kB/ 64000 kB"
   * or "§r§7  Water: 5000.0 mB/32000.0 mB"
   *
   * @param {string} input The lore line.
   * @returns {{ type: string, amount: number }} The gas type and its parsed numeric value.
   */
  static getGasFromText(input) {
    const cleaned = input.replace(/§./g, "").trim();

    const match = cleaned.match(/([^:]+):\s*([\d.]+)\s*(mB|B|kB|MB|GB|TB|PB|EB)/i);
    if (!match) return { type: "empty", amount: 0 };

    const [, rawType, rawValue, unit] = match;

    const multipliers = {
      mB: 1,
      B: 1000,
      kB: 1_000_000,
      MB: 1_000_000_000,
      GB: 1_000_000_000_000,
      TB: 1_000_000_000_000_000,
      PB: 1_000_000_000_000_000_000,
      EB: 1_000_000_000_000_000_000_000,
    };

    let normalizedUnit = unit;
    if (/^mb$/i.test(unit)) {
      normalizedUnit = "mB";
    } else if (/^kb$/i.test(unit)) {
      normalizedUnit = "kB";
    } else {
      normalizedUnit = unit.toUpperCase();
    }
    const amount = parseFloat(rawValue) * (multipliers[normalizedUnit] ?? 1);
    const wrappedType = rawType.trim().match(/^gas\s*\((.+)\)$/i)?.[1] ?? rawType;
    const type = wrappedType.trim().toLowerCase().replace(/\s+/g, "_");

    return { type, amount };
  }

  /**
   * Returns gas container data for a given item identifier.
   *
   * Looks up the internal gas container map and returns
   * the corresponding data if the item can store or provide gas.
   *
   * @param {string} id Item identifier (e.g. "minecraft:lava_bucket").
   * @returns {{ amount: number, type: string, output?: string }|null} Gas data if found, otherwise null.
   */
  static getContainerData(id) {
    return this.itemGasStorages[id] ?? null;
  }

  /**
   * Returns the currently selected inventory stack for a player.
   *
   * @param {Player} player
   * @returns {{ slot: number, inventory: Container, item: ItemStack | undefined } | null}
   */
  static getSelectedInventoryItem(player) {
    if (!player) return null;

    const slot = player.selectedSlotIndex ?? 0;
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return null;

    return {
      slot,
      inventory,
      item: inventory.getItem(slot)
    };
  }

  /**
   * Replaces or preserves the held gas item after a gas interaction.
   *
   * This is safer than decrement + give because it keeps the selected slot stable,
   * works with stacks, and avoids losing items when the result item equals the input.
   *
   * @param {Player} player
   * @param {string} expectedTypeId
   * @param {string | undefined} nextTypeId
   * @returns {boolean}
   */
  static replaceHeldGasItem(player, expectedTypeId, nextTypeId) {
    if (!player || !expectedTypeId) return false;
    if (DoriosLib.player.isCreative(player)) return true;
    if (expectedTypeId === nextTypeId) return true;

    const selected = GasStorage.getSelectedInventoryItem(player);
    if (!selected) return false;

    const { slot, inventory } = selected;
    const current = inventory.getItem(slot);
    if (!current || current.typeId !== expectedTypeId) return false;

    if (current.amount > 1) {
      current.amount -= 1;
      inventory.setItem(slot, current);

      if (!nextTypeId) return true;

      const overflow = inventory.addItem(new ItemStack(nextTypeId, 1));
      if (overflow) {
        player.dimension?.spawnItem?.(overflow, player.location);
      }

      return true;
    }

    inventory.setItem(slot, nextTypeId ? new ItemStack(nextTypeId, 1) : undefined);
    return true;
  }

  // --------------------------------------------------------------------------
  // Core operations
  // --------------------------------------------------------------------------

  /**
   * Initializes scoreboard values for a new gas entity.
   *
   * @param {Entity} entity The entity to initialize.
   * @returns {void}
   */
  static initialize(entity) {
    entity.runCommand(Constants.INITIAL_GAS_SCORE_COMMAND);
  }

  /**
   * Transfers gas between two world locations.
   *
   * ## Behavior
   * - Both source and target blocks must have the tag `"dorios:gas"`.
   * - If the target is a gas tank without an entity, one is spawned empty first.
   * - Gas is transferred between entities using {@link GasStorage.transferTo}.
   * - The {@link GasStorage.add} method automatically handles visual updates.
   *
   * Works with:
   * - Gas tanks (auto-spawns empty entity if missing)
   * - Machines with internal gas storage
   *
   * @param {Dimension} dim The dimension where both positions exist.
   * @param {{x:number, y:number, z:number}} sourceLoc Source block coordinates.
   * @param {{x:number, y:number, z:number}} targetLoc Target block coordinates.
   * @param {number} [amount=100] Maximum amount to transfer (in mB).
   * @returns {boolean} True if a valid transfer occurred, false otherwise.
   */
  static transferBetween(dim, sourceLoc, targetLoc, amount = 100) {
    if (!dim || !sourceLoc || !targetLoc) return false;

    const sourceBlock = dim.getBlock(sourceLoc);
    const targetBlock = dim.getBlock(targetLoc);

    // Validate both endpoints
    if (!sourceBlock?.hasTag("dorios:gas")) return false;
    if (!targetBlock?.hasTag("dorios:gas")) return false;

    // ─── Source entity check ───────────────────────────────
    const sourceEntity = dim.getEntitiesAtBlockLocation(sourceLoc)[0];
    if (!sourceEntity) return false;

    const sourceGas = new GasStorage(sourceEntity, 0);
    if (!sourceGas || sourceGas.get() <= 0) return false;

    // ─── Target entity handling ───────────────────────────────
    let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

    // If the target is a tank, create the entity for the incoming gas type.
    if (!targetEntity && targetBlock.typeId.includes("gas_tank")) {
      const type = sourceGas.getType();
      if (type == Constants.EMPTY_GAS_TYPE) return false;
      targetEntity = GasStorage.addGasToTank(targetBlock, type, 0);
    }

    // If still no entity (non-tank machine), stop
    if (!targetEntity) return false;

    // ─── Perform gas transfer ───────────────────────────────
    const targetGas = new GasStorage(targetEntity, 0);
    if (!targetGas || targetGas.getCap() <= 0) return false;

    const transferred = sourceGas.transferTo(targetGas, amount);
    return transferred > 0;
  }

  /**
   * Finds the first gas tank of the given type or an empty one.
   *
   * @param {Entity} entity Target entity with gas tanks
   * @param {string} type Gas type to search for (e.g. "water", "lava")
   * @returns {GasStorage|null} The matching tank or null if none found
   */
  static findType(entity, type) {
    const max = GasStorage.getMaxGases(entity);
    let emptyTank = null;

    for (let i = 0; i < max; i++) {
      GasStorage.initializeObjectives(i);

      const tank = new GasStorage(entity, i);
      const tankType = tank.getType();

      // If this type already exists in any slot, keep using that slot
      // even when it is full so the entity never duplicates a gas type.
      if (tankType === type) return tank;
      if (!emptyTank && tankType === Constants.EMPTY_GAS_TYPE && tank.getFreeSpace() > 0) {
        emptyTank = tank;
      }
    }

    return emptyTank;
  }

  /**
   * Handles inserting a gas into an entity's gas tanks based on the held item.
   * If mainHand is not provided, it is obtained from the player's main hand slot.
   *
   * @param {Player} player Player interacting
   * @param {Entity} entity Target entity with gas tanks
   * @param {ItemStack} [mainHand] Optional item used for the interaction
   */
  static handleGasItemInteraction(player, entity, mainHand) {
    mainHand = mainHand ?? DoriosLib.entity.getEquipment(player, "Mainhand");
    if (!mainHand) return;

    const containerData = GasStorage.getContainerData(mainHand.typeId);
    if (!containerData || !containerData.type) return;

    const tank = GasStorage.findType(entity, containerData.type);
    if (!tank) return;

    const insert = tank.gasItem(mainHand.typeId);
    if (insert === false) return;

    const type = tank.getType();
    const amount = tank.get();
    const cap = tank.getCap();
    const percent = ((amount / cap) * 100).toFixed(2);

    player.onScreenDisplay.setActionBar(
      `§b${DoriosLib.text.formatIdentifier(type)}: §f${GasStorage.formatGas(amount)}§7 / §f${GasStorage.formatGas(cap)} §7(${percent}%)`,
    );

    if (!DoriosLib.player.isCreative(player)) {
      GasStorage.replaceHeldGasItem(player, mainHand.typeId, insert || undefined);
    }
  }

  /**
   * Attempts to insert a given gas type and amount into the tank.
   *
   * The insertion will only succeed if:
   * - The tank is empty or already contains the same gas type.
   * - There is enough free space to hold the specified amount.
   *
   * If the tank is empty, its type will automatically be set to the inserted gas.
   *
   * @param {string} type The gas type to insert (e.g., "lava", "water").
   * @param {number} amount The amount of gas to insert.
   * @returns {boolean} True if the gas was successfully inserted, false otherwise.
   */
  tryInsert(type, amount) {
    if (amount <= 0) return false;
    const currentType = this.getType();
    if (currentType === Constants.EMPTY_GAS_TYPE || currentType === type) {
      if (amount <= this.getFreeSpace()) {
        if (currentType === Constants.EMPTY_GAS_TYPE) this.setType(type);
        this.add(amount);
        return true;
      }
    }
    return false;
  }

  /**
   * Handles item-to-gas interactions for machines or gas tanks.
   *
   * Supports:
   * - Inserting gas from known container items (`itemGasStorages`)
   * - Extracting gas using gas holders (`itemGasHolders`)
   * - Producing filled items based on stored gas type
   *
   * @param {string} typeId The item identifier being used (e.g., "minecraft:water_bucket", "minecraft:bucket", "gascells:empty_cell").
   * @returns {string|false} Returns the output item ID if successful, or false if the action failed.
   */
  gasItem(typeId) {
    // 1. INSERTION: item adds gas into tank
    const insertData = GasStorage.itemGasStorages[typeId];
    if (insertData) {
      const { type, amount, output, infinite } = insertData;

      if (infinite === true) {
        const currentType = this.getType();
        if (currentType !== Constants.EMPTY_GAS_TYPE && currentType !== type) return false;

        const freeSpace = this.getFreeSpace();
        if (freeSpace <= 0) return false;

        if (currentType === Constants.EMPTY_GAS_TYPE) this.setType(type);
        this.add(freeSpace);
        return output ?? typeId;
      }

      if (!this.tryInsert(type, amount)) return false;

      return output ?? false;
    }

    // 2. EXTRACTION: item converts stored gas into an output container
    const holder = GasStorage.itemGasHolders[typeId];
    if (holder) {
      const storedType = this.getType();
      const outputItem = holder.types?.[storedType];

      // This item cannot extract this gas
      if (!outputItem) return false;

      // Not enough gas for extraction
      if (this.get() < holder.required) return false;

      // Extract and return filled item
      this.consume(holder.required);
      return outputItem;
    }

    // 3. Not handled by this system
    return false;
  }

  /**
   * Sets the gas capacity of this tank.
   *
   * @param {number} amount Maximum gas capacity in mB.
   * @returns {void}
   */
  setCap(amount) {
    const { value, exp } = GasStorage.normalizeValue(amount);
    this.scores.gasCap.setScore(this.scoreId, value);
    this.scores.gasCapExp.setScore(this.scoreId, exp);
    if (this.get() > amount) this.set(amount);
  }

  /**
   * Retrieves the full capacity of this tank.
   *
   * @returns {number} The maximum capacity in mB.
   */
  getCap() {
    const v = this.scores.gasCap.getScore(this.scoreId) || 0;
    const e = this.scores.gasCapExp.getScore(this.scoreId) || 0;
    this.cap = GasStorage.combineValue(v, e);
    return this.cap;
  }

  /**
   * Sets the current amount of gas in this tank.
   *
   * Automatically clamps to the tank capacity and normalizes for scoreboard storage.
   *
   * @param {number} amount Amount to set in mB.
   * @returns {void}
   */
  set(amount) {
    const { value, exp } = GasStorage.normalizeValue(amount);
    this.scores.gas.setScore(this.scoreId, value);
    this.scores.gasExp.setScore(this.scoreId, exp);
    if (this.entity?.typeId?.startsWith("utilitycraft:gas_tank")) {
      DoriosLib.entity.setHealth(this.entity, amount);
    }
  }

  /**
   * Gets the current amount of gas stored in this tank.
   *
   * @returns {number} The current gas amount in mB.
   */
  get() {
    const v = this.scores.gas.getScore(this.scoreId) || 0;
    const e = this.scores.gasExp.getScore(this.scoreId) || 0;
    return GasStorage.combineValue(v, e);
  }

  /**
   * Adds or subtracts a specific amount of gas.
   *
   * Uses scoreboard-safe addition logic.
   * Automatically clamps to tank capacity and updates visible
   * health if the entity is a UtilityCraft gas tank.
   *
   * @param {number} amount Amount to add (negative values subtract).
   * @returns {number} Actual amount added or removed.
   */
  add(amount) {
    if (amount === 0) return 0;

    // Clamp amount to valid range
    const free = this.getFreeSpace();
    if (amount > 0 && free <= 0) return 0;
    if (amount > free) amount = free;

    // Get current mantissa & exponent
    let value = this.scores.gas.getScore(this.scoreId) || 0;
    let exp = this.scores.gasExp.getScore(this.scoreId) || 0;
    const multi = 10 ** exp;

    // Convert to current exponent scale
    const normalizedAdd = Math.floor(amount / multi);

    // Apply add directly if safe
    let newValue = value + normalizedAdd;
    if (Math.abs(newValue) <= 1e9) {
      this.scores.gas.addScore(this.scoreId, normalizedAdd);

      if (exp > 0 && value < 1e6) {
        this.set(this.get() + amount);
      }
    } else {
      this.set(this.get() + amount);
    }

    if (this.entity?.typeId?.startsWith("utilitycraft:gas_tank")) {
      const amountCurrent = this.get();
      if (amountCurrent > 0) {
        system.run(() => {
          DoriosLib.entity.setHealth(this.entity, amountCurrent);
        });
      } else {
        this.entity.remove();
      }
    }

    return amount;
  }

  /**
   * Consumes a specific amount of gas if available.
   *
   * @param {number} amount The amount to consume.
   * Infinite and legacy creative storages report success without changing their amount.
   *
   * @returns {number} The amount actually consumed (0 if insufficient).
   */
  consume(amount) {
    if (this.entity.hasTag(Constants.INFINITE_STORAGE_TAG)) return amount;
    if (this.entity.hasTag(Constants.CREATIVE_TAG)) return amount;
    const current = this.get();
    if (current < amount) return 0;
    this.add(-amount);
    return amount;
  }

  /**
   * Returns the remaining space available in this tank.
   *
   * @returns {number} Remaining free capacity in mB.
   */
  getFreeSpace() {
    return Math.max(0, this.getCap() - this.get());
  }

  /**
   * Checks whether the tank has at least a certain amount of gas.
   *
   * @param {number} amount Amount to check for.
   * @returns {boolean} True if there is enough gas.
   */
  has(amount) {
    return this.get() >= amount;
  }

  /**
   * Checks whether the tank is full.
   *
   * @returns {boolean} True if the tank has no free space remaining.
   */
  isFull() {
    return this.get() >= this.getCap();
  }

  // --------------------------------------------------------------------------
  // Type tag management
  // --------------------------------------------------------------------------

  /**
   * Gets the gas type currently stored in this tank.
   *
   * The type is stored in the entity's tags as `gas{index}Type:{type}`.
   *
   * @returns {string} The stored gas type, or "empty" if none.
   */
  getType() {
    const tag = this.entity.getTags().find((t) => t.startsWith(`gas${this.index}Type:`));
    return tag ? tag.split(":")[1] : Constants.EMPTY_GAS_TYPE;
  }

  /**
   * Sets the gas type for this tank.
   *
   * Removes any previous type tag before adding the new one.
   *
   * @param {string} type The new gas type (e.g. "lava", "water").
   * @returns {void}
   */
  setType(type) {
    const old = this.entity.getTags().find((t) => t.startsWith(`gas${this.index}Type:`));
    if (old) this.entity.removeTag(old);
    this.entity.addTag(`gas${this.index}Type:${type}`);
    this.type = type;
  }

  // --------------------------------------------------------------------------
  // Transfer operations
  // --------------------------------------------------------------------------

  /**
   * Transfers gas from this entity to connected gas containers in its network.
   *
   * ## Behavior
   * - Uses the provided `nodes` array to determine valid transfer targets.
   * - Automatically creates entities for target gas tanks if they are empty (no entity).
   * - If no `nodes` are provided, the method immediately returns 0.
   *
   * ## Transfer Modes
   * - `"nearest"` → Starts from the closest node that accepts gas.
   * - `"farthest"` → Starts from the farthest node first.
   * - `"round"` → Distributes gas evenly across all valid targets.
   *
   * @param {number} speed Total transfer speed limit (mB/tick).
   * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
   * @param {Array<{x:number, y:number, z:number}>} nodes Precomputed network node positions.
   * @returns {number} Total amount of gas transferred (in mB).
   */
  transferToNetwork(speed, mode = "nearest", nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return 0;

    const dim = this.entity.dimension;
    const pos = this.entity.location;
    let available = this.get();
    if (available <= 0 || speed <= 0) return 0;

    let transferred = 0;
    const type = this.getType();
    if (!type || type === Constants.EMPTY_GAS_TYPE) return 0;

    // Select order based on mode
    let orderedTargets = [...nodes];

    // ──────────────────────────────────────────────
    // Process transfers
    // ──────────────────────────────────────────────
    const processTarget = (loc, share = null) => {
      const targetBlock = dim.getBlock(loc);
      if (!targetBlock?.hasTag("dorios:gas")) return 0;

      // If the target is a tank, create the entity for this gas type.
      let targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
      if (!targetEntity && targetBlock.typeId.includes("gas_tank")) {
        GasStorage.addGasToTank(targetBlock, type, 0);
        targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
      }
      if (!targetEntity) return 0;

      const target = GasStorage.findType(targetEntity, type);
      if (!target) return 0;

      const targetType = target.getType();
      const space = target.getFreeSpace();
      if (space <= 0) return 0;

      if (targetType === Constants.EMPTY_GAS_TYPE) target.setType(type);

      const amount = share ? Math.min(share, space, available, speed) : Math.min(space, available, speed);

      const added = target.add(amount);

      if (added > 0) {
        available -= added;
        speed -= added;
        transferred += added;
      }

      return added;
    };

    if (mode === "round") {
      const share = Math.floor(speed / orderedTargets.length);
      for (const loc of orderedTargets) {
        if (available <= 0 || speed <= 0) break;
        processTarget(loc, share);
      }
    } else {
      // Sequential transfer (nearest/farthest)
      for (const loc of orderedTargets) {
        if (available <= 0 || speed <= 0) break;
        const added = processTarget(loc);
      }
    }

    // Subtract total transferred
    if (transferred > 0) this.consume(transferred);

    return transferred;
  }

  /**
   * Transfers gas to this machine's cached gas output target.
   *
   * ## Behavior
   * - Reads the cached target from {@link OutputTracker}.
   * - Determines the **opposite direction vector** (e.g. east → west).
   * - Refreshes the target once from the block axis when no cache exists.
   * - Clears stale targets when they no longer support gas storage.
   * - If the target is a gas tank with no entity, one is spawned empty first.
   * - Uses {@link GasStorage.transferTo} to handle transfer and visual updates.
   *
   * @param {Block} block The source block associated with this gas entity.
   * @param {number} [amount=100] Maximum amount to transfer (in mB).
   * @returns {boolean} True if gas was transferred.
   */
  transferGases(block, amount = 100) {
    if (!block || !this.entity?.isValid) return false;
    if (this.get() <= 0 || this.getType() === Constants.EMPTY_GAS_TYPE) return false;

    const targetLoc = OutputTracker.getOutputTarget(this.entity, "gas") ?? OutputTracker.refreshOutput(block, "gas");
    if (!targetLoc) return false;

    const dim = block.dimension;
    const targetBlock = dim.getBlock(targetLoc);
    if (!OutputTracker.isOutputTarget(targetBlock, "gas")) {
      OutputTracker.clearOutputTarget(this.entity, "gas");
      return false;
    }

    let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

    // If the target is a tank, create the entity for the incoming gas type.
    if (!targetEntity && targetBlock.typeId.includes("gas_tank")) {
      const type = this.getType();
      if (type == Constants.EMPTY_GAS_TYPE) return;
      GasStorage.addGasToTank(targetBlock, type, 0);
      targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];
    }

    if (!targetEntity) {
      OutputTracker.clearOutputTarget(this.entity, "gas");
      return false;
    }

    const targetGas = new GasStorage(targetEntity, 0);
    if (!targetGas || targetGas.getCap() <= 0) {
      OutputTracker.clearOutputTarget(this.entity, "gas");
      return false;
    }

    const transferred = this.transferTo(targetGas, amount);
    return transferred > 0;
  }

  /**
   * Transfers a specific amount of gas from this tank to another.
   *
   * @param {GasStorage} other The target tank to receive the gas.
   * @param {number} amount The amount to transfer in mB.
   * @returns {number} The actual amount transferred.
   */
  transferTo(other, amount) {
    const sourceType = this.getType();
    if (sourceType !== other.getType() && other.getType() !== Constants.EMPTY_GAS_TYPE) return 0;

    const transferable = Math.min(amount, this.get(), other.getFreeSpace());
    if (transferable <= 0) return 0;

    if (other.getType() === Constants.EMPTY_GAS_TYPE) other.setType(sourceType);
    this.consume(transferable);
    other.add(transferable);
    return transferable;
  }

  /**
   * Receives gas from another GasStorage.
   *
   * @param {GasStorage} other The source tank to pull from.
   * @param {number} amount The maximum amount to receive.
   * @returns {number} The actual amount received.
   */
  receiveFrom(other, amount) {
    return other.transferTo(this, amount);
  }

  // --------------------------------------------------------------------------
  // Display logic
  // --------------------------------------------------------------------------

  /**
   * Displays the current gas level in the entity's inventory.
   *
   * Renders a 48-frame progress bar representing how full the tank is.
   * The item used depends on the current gas type.
   *
   * @param {number} [slot=4] Inventory slot index for the display item.
   * @returns {void}
   */
  display(slot = Constants.DEFAULT_GAS_DISPLAY_SLOT) {
    if (!this.shouldUpdateUI) return;

    const inv = this.entity.getComponent("minecraft:inventory")?.container;
    if (!inv) return;

    const gas = this.get();
    const cap = this.getCap();
    const type = this.getType();

    if (type === Constants.EMPTY_GAS_TYPE) {
      let emptyBar = new ItemStack(Constants.EMPTY_GAS_BAR_ITEM_ID);
      emptyBar.nameTag = "§rEmpty";
      inv.setItem(slot, emptyBar);
      return;
    }

    const frame = Math.max(0, Math.min(Constants.GAS_BAR_FRAME_COUNT, Math.floor((gas / cap) * Constants.GAS_BAR_FRAME_COUNT)));
    const frameName = frame.toString().padStart(2, "0");

    const item = new ItemStack(`utilitycraft:${type}_${frameName}`, 1);
    item.nameTag = `§r${DoriosLib.text.formatIdentifier(type)}
§r§7  Stored: ${GasStorage.formatGas(gas)} / ${GasStorage.formatGas(cap)}
§r§7  Percentage: ${((gas / cap) * 100).toFixed(2)}%`;

    inv.setItem(slot, item);
  }

  // --------------------------------------------------------------------------
  // Utility for blocks
  // --------------------------------------------------------------------------

  /**
   * Adds a specified gas to a tank block at a given location.
   *
   * Spawns a gas tank entity if missing and initializes its scoreboards.
   *
   * @param {Block} block The block representing the tank.
   * @param {string} type The type of gas to insert.
   * @param {number} amount Amount of gas to insert in mB.
   * @returns {Entity | undefined} The tank entity if insertion was successful.
  */
  static addGasToTank(block, type, amount) {
    if (!type || type === Constants.EMPTY_GAS_TYPE) return undefined;

    const dim = block.dimension;
    const pos = block.location;
    let entity = dim.getEntitiesAtBlockLocation(pos)
      .find((candidate) => candidate.typeId.startsWith("utilitycraft:gas_tank_"));

    if (!entity) {
      const { x, y, z } = block.location;
      entity = dim.spawnEntity(`utilitycraft:gas_tank_${type}`, {
        x: x + 0.5,
        y,
        z: z + 0.5,
      });
      if (!entity) return false;
      GasStorage.initialize(entity);
      entity.triggerEvent(`${block.typeId.split("_")[0]}`);
    }

    const tank = new GasStorage(entity, 0);
    tank.setCap(GasStorage.getTankCapacity(block.typeId));
    tank.setType(type);
    tank.add(amount);
    return entity;
  }

  /**
   * Returns the default capacity for a given tank block.
   *
   * @param {string} typeId The block type identifier.
   * @returns {number} The tank's base capacity in mB.
   */
  static getTankCapacity(typeId) {
    return Constants.GAS_TANK_CAPACITIES[typeId] ?? Constants.GAS_TANK_CAPACITIES["utilitycraft:basic_gas_tank"];
  }
}

import { world, ItemStack, system } from "@minecraft/server";
import { loadObjectives } from "../utils/scoreboards.js"
import { initializeEntity } from "../utils/entity.js"

/** @type {ScoreboardObjective} */
let maxLiquidsData;

/**
 * Global map storing loaded fluid-related scoreboard objectives per index.
 * Each index represents an independent tank slot (e.g., 0, 1, 2).
 */
const objectives = new Map();

/**
 * Manages scoreboard-based fluid values for entities or machines.
 *
 * Provides a unified API to store, retrieve, normalize, and display fluid values.
 * Each instance can manage a specific tank index (0, 1, ...).
 *
 * The system uses the same mantissa–exponent structure as the Energy system
 * to support large numbers efficiently while maintaining scoreboard safety.
 */
export class FluidStorage {
  /**
   * Creates a new FluidStorage instance for a specific entity and tank index.
   *
   * @param {Entity} entity The entity representing the fluid container.
   * @param {number} [index=0] The index of the fluid tank managed by this instance.
   */
  constructor(entity, index = 0) {
    this.entity = entity;
    this.index = index;
    this.scoreId = entity?.scoreboardIdentity;

    this.scores = {
      fluid: objectives.get(`fluid_${index}`),
      fluidExp: objectives.get(`fluidExp_${index}`),
      fluidCap: objectives.get(`fluidCap_${index}`),
      fluidCapExp: objectives.get(`fluidCapExp_${index}`),
    };

    this.type = this.getType();
    this.cap = this.getCap();
    if (this.get() == 0) this.setType("empty");
  }

  /**
   * Initializes a single fluid tank (index 0) for a machine entity.
   *
   * This should be used for machines that only store one type of fluid.
   * It ensures the scoreboard objectives for index 0 exist and
   * returns a ready-to-use FluidStorage instance.
   *
   * @param {Entity} entity The machine entity to initialize.
   * @returns {FluidStorage} A FluidStorage instance managing index 0.
   */
  static initializeSingle(entity) {
    return new FluidStorage(entity, 0);
  }

  /**
   * Initializes multiple fluid tanks for an entity and updates maxLiquids.
   *
   * @param {Entity} entity Machine entity
   * @param {number} count Amount of supported fluids
   * @returns {FluidStorage[]} Array of FluidStorage instances
   */
  static initializeMultiple(entity, count) {
    // Set scoreboard maxLiquids for this entity

    if (maxLiquidsData && entity.scoreboardIdentity) {
      maxLiquidsData.setScore(entity.scoreboardIdentity, count);
    }

    // Initialize tanks
    const tanks = [];
    for (let i = 0; i < count; i++) {
      FluidStorage.initializeObjectives(i);
      tanks.push(new FluidStorage(entity, i));
    }

    return tanks;
  }

  /**
   * Ensures that the required scoreboard objectives exist for a given tank index.
   *
   * Creates or retrieves four objectives per index:
   * - `fluid_{index}` → fluid amount (mantissa)
   * - `fluidExp_{index}` → fluid exponent
   * - `fluidCap_{index}` → Capacity (mantissa)
   * - `fluidCapExp_{index}` → Capacity exponent
   *
   * @param {number} [index=0] The fluid tank index to initialize (default 0).
   * @returns {void}
   */
  static initializeObjectives(index = 0) {
    const definitions = [
      [`fluid_${index}`, `fluid ${index}`],
      [`fluidExp_${index}`, `fluid Exp ${index}`],
      [`fluidCap_${index}`, `fluid Cap ${index}`],
      [`fluidCapExp_${index}`, `fluid Cap Exp ${index}`],
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
   * Returns the max number of fluid tanks an entity supports.
   * Reads the `maxLiquids` scoreboard; defaults to 1 if unset.
   *
   * @param {Entity} entity Entity with fluid tanks
   * @returns {number}
   */
  static getMaxLiquids(entity) {
    if (!entity) return 1;

    let score = 0;
    if (maxLiquidsData && entity.scoreboardIdentity) {
      score = maxLiquidsData.getScore(entity.scoreboardIdentity) || 0;
      if (score > 0) return score;
    }

    let taggedSlots = 0;
    for (const tag of entity.getTags()) {
      const match = tag.match(/^fluid(\d+)Type:/);
      if (!match) continue;

      const index = Number(match[1]);
      if (!Number.isNaN(index)) {
        taggedSlots = Math.max(taggedSlots, index + 1);
      }
    }

    return Math.max(1, score, taggedSlots);
  }

  /**
   * Map of items that contain or provide fluids.
   *
   * Each key represents an item identifier, and its value
   * defines the resulting fluid type, amount, and optional output item.
   *
   * Example:
   * ```js
   * FluidStorage.itemFluidStorages["minecraft:lava_bucket"]
   * // → { amount: 1000, type: "lava", output: "minecraft:bucket" }
   * ```
   *
   * @constant
   * @type {Record<string, { amount: number, type: string, output?: string }>}
   */
  static itemFluidStorages = {};

  /**
   * Definitions for items that can extract fluid from a tank.
   *
   * Each key represents an item identifier (e.g. "minecraft:bucket"),
   * and its value specifies:
   * - which fluid types it can extract
   * - how much fluid is required to produce the resulting filled item
   *
   * Structure:
   * {
   *   "itemId": {
   *      types: { fluidType: outputItemId, ... },
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
  static itemFluidHolders = {};

  // --------------------------------------------------------------------------
  // Normalization utilities
  // --------------------------------------------------------------------------

  /**
   * Normalizes a raw fluid amount into a mantissa–exponent pair.
   *
   * This ensures the mantissa never exceeds 1e9 to remain scoreboard-safe.
   *
   * @param {number} amount The raw fluid amount.
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
   * Formats a fluid amount into a human-readable string with units.
   *
   * @param {number} value The fluid amount in millibuckets (mB).
   * @returns {string} A formatted string with unit suffix (mB, kB, MB).
   */
  static formatFluid(value) {
    let unit = "mB";
    if (value >= 1e7) {
      unit = "MB";
      value /= 1e6;
    } else if (value >= 1e4) {
      unit = "kB";
      value /= 1e3;
    }
    return `${value.toFixed(1)} ${unit}`;
  }

  /**
   * Extracts the fluid type and amount from a formatted text like:
   * "§r§7  Lava: 52809 kB/ 64000 kB"
   * or "§r§7  Water: 5000.0 mB/32000.0 mB"
   *
   * @param {string} input The lore line.
   * @returns {{ type: string, amount: number }} The fluid type and its parsed numeric value.
   */
  static getFluidFromText(input) {
    const cleaned = input.replace(/§./g, "").trim();

    // Match without "Stored"
    const match = cleaned.match(/(\w+):\s*([\d.]+)\s*(mB|kB|MB|B)/);
    if (!match) return { type: "empty", amount: 0 };

    const [, rawType, rawValue, unit] = match;

    const multipliers = {
      mB: 1,
      B: 1000,
      kB: 1000,
      MB: 1_000_000,
    };

    const amount = parseFloat(rawValue) * (multipliers[unit] ?? 1);
    const type = rawType.toLowerCase();

    return { type, amount };
  }

  /**
   * Returns fluid container data for a given item identifier.
   *
   * Looks up the internal fluid container map and returns
   * the corresponding data if the item can store or provide fluid.
   *
   * @param {string} id Item identifier (e.g. "minecraft:lava_bucket").
   * @returns {{ amount: number, type: string, output?: string }|null} Fluid data if found, otherwise null.
   */
  static getContainerData(id) {
    return this.itemFluidStorages[id] ?? null;
  }

  // --------------------------------------------------------------------------
  // Core operations
  // --------------------------------------------------------------------------

  /**
   * Initializes scoreboard values for a new fluid entity.
   *
   * @param {Entity} entity The entity to initialize.
   * @returns {void}
   */
  static initialize(entity) {
    entity.runCommand(`scoreboard players set @s fluid_0 0`);
  }

  /**
   * Transfers fluid between two world locations.
   *
   * ## Behavior
   * - Both source and target blocks must have the tag `"dorios:fluid"`.
   * - If the target is a fluid tank without an entity, one is spawned empty first.
   * - Fluid is transferred between entities using {@link FluidStorage.transferTo}.
   * - The {@link FluidStorage.add} method automatically handles visual updates.
   *
   * Works with:
   * - Fluid tanks (auto-spawns empty entity if missing)
   * - Machines with internal fluid storage
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
    if (!sourceBlock?.hasTag("dorios:fluid")) return false;
    if (!targetBlock?.hasTag("dorios:fluid")) return false;

    // ─── Source entity check ───────────────────────────────
    const sourceEntity = dim.getEntitiesAtBlockLocation(sourceLoc)[0];
    if (!sourceEntity) return false;

    const sourceFluid = new FluidStorage(sourceEntity, 0);
    if (!sourceFluid || sourceFluid.get() <= 0) return false;

    // ─── Target entity handling ───────────────────────────────
    let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

    // If target is a tank and has no entity → spawn an empty one
    if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
      const type = sourceFluid.getType();
      if (type == "empty") return false;
      targetEntity = FluidStorage.addfluidToTank(targetBlock, type, 0);
    }

    // If still no entity (non-tank machine), stop
    if (!targetEntity) return false;

    // ─── Perform fluid transfer ───────────────────────────────
    const targetFluid = new FluidStorage(targetEntity, 0);
    if (!targetFluid || targetFluid.getCap() <= 0) return false;

    const transferred = sourceFluid.transferTo(targetFluid, amount);
    return transferred > 0;
  }

  /**
   * Finds the first fluid tank of the given type or an empty one.
   *
   * @param {Entity} entity Target entity with fluid tanks
   * @param {string} type Fluid type to search for (e.g. "water", "lava")
   * @returns {FluidStorage|null} The matching tank or null if none found
   */
  static findType(entity, type) {
    const max = FluidStorage.getMaxLiquids(entity);
    let emptyTank = null;

    for (let i = 0; i < max; i++) {
      FluidStorage.initializeObjectives(i);

      const tank = new FluidStorage(entity, i);
      const tankType = tank.getType();

      if (tankType === type && tank.getFreeSpace() > 0) return tank;
      if (!emptyTank && tankType === "empty" && tank.getFreeSpace() > 0) {
        emptyTank = tank;
      }
    }

    return emptyTank;
  }

  /**
   * Handles inserting a fluid into an entity's fluid tanks based on the held item.
   * If mainHand is not provided, it is obtained from the player's main hand slot.
   *
   * @param {Player} player Player interacting
   * @param {Entity} entity Target entity with fluid tanks
   * @param {ItemStack} [mainHand] Optional item used for the interaction
   */
  static handleFluidItemInteraction(player, entity, mainHand) {
    mainHand = mainHand ?? player.getEquipment("Mainhand");
    if (!mainHand) return;

    const containerData = FluidStorage.getContainerData(mainHand.typeId);
    if (!containerData || !containerData.type) return;

    const tank = FluidStorage.findType(entity, containerData.type);
    if (!tank) return;

    const insert = tank.fluidItem(mainHand.typeId);
    if (insert === false) return;

    const type = tank.getType();
    const amount = tank.get();
    const cap = tank.getCap();
    const percent = ((amount / cap) * 100).toFixed(2);

    player.onScreenDisplay.setActionBar(
      `§b${DoriosAPI.utils.formatIdToText(type)}: §f${FluidStorage.formatFluid(amount)}§7 / §f${FluidStorage.formatFluid(cap)} §7(${percent}%)`,
    );

    if (!player.isInCreative()) {
      player.changeItemAmount(player.selectedSlotIndex, -1);
      if (insert) player.giveItem(insert);
    }
  }

  /**
   * Attempts to insert a given liquid type and amount into the tank.
   *
   * The insertion will only succeed if:
   * - The tank is empty or already contains the same liquid type.
   * - There is enough free space to hold the specified amount.
   *
   * If the tank is empty, its type will automatically be set to the inserted liquid.
   *
   * @param {string} type The liquid type to insert (e.g., "lava", "water").
   * @param {number} amount The amount of liquid to insert.
   * @returns {boolean} True if the liquid was successfully inserted, false otherwise.
   */
  tryInsert(type, amount) {
    if (amount <= 0) return false;
    const currentType = this.getType();
    if (currentType === "empty" || currentType === type) {
      if (amount <= this.getFreeSpace()) {
        if (currentType === "empty") this.setType(type);
        this.add(amount);
        return true;
      }
    }
    return false;
  }

  /**
   * Handles item-to-fluid interactions for machines or fluid tanks.
   *
   * Supports:
   * - Inserting fluid from known container items (`itemFluidStorages`)
   * - Extracting fluid using fluid holders (`itemFluidHolders`)
   * - Producing filled items based on stored fluid type
   *
   * @param {string} typeId The item identifier being used (e.g., "minecraft:water_bucket", "minecraft:bucket", "fluidcells:empty_cell").
   * @returns {string|false} Returns the output item ID if successful, or false if the action failed.
   */
  fluidItem(typeId) {
    // 1. INSERTION: item adds fluid into tank
    const insertData = FluidStorage.itemFluidStorages[typeId];
    if (insertData) {
      const { type, amount, output } = insertData;

      if (!this.tryInsert(type, amount)) return false;

      return output ?? false;
    }

    // 2. EXTRACTION: item converts stored fluid into an output container
    const holder = FluidStorage.itemFluidHolders[typeId];
    if (holder) {
      const storedType = this.getType();
      const outputItem = holder.types?.[storedType];

      // This item cannot extract this fluid
      if (!outputItem) return false;

      // Not enough fluid for extraction
      if (this.get() < holder.required) return false;

      // Extract and return filled item
      this.consume(holder.required);
      return outputItem;
    }

    // 3. Not handled by this system
    return false;
  }

  /**
   * Sets the fluid capacity of this tank.
   *
   * @param {number} amount Maximum fluid capacity in mB.
   * @returns {void}
   */
  setCap(amount) {
    const { value, exp } = FluidStorage.normalizeValue(amount);
    this.scores.fluidCap.setScore(this.scoreId, value);
    this.scores.fluidCapExp.setScore(this.scoreId, exp);
    if (this.get() > amount) this.set(amount);
  }

  /**
   * Retrieves the full capacity of this tank.
   *
   * @returns {number} The maximum capacity in mB.
   */
  getCap() {
    const v = this.scores.fluidCap.getScore(this.scoreId) || 0;
    const e = this.scores.fluidCapExp.getScore(this.scoreId) || 0;
    this.cap = FluidStorage.combineValue(v, e);
    return this.cap;
  }

  /**
   * Sets the current amount of fluid in this tank.
   *
   * Automatically clamps to the tank capacity and normalizes for scoreboard storage.
   *
   * @param {number} amount Amount to set in mB.
   * @returns {void}
   */
  set(amount) {
    const { value, exp } = FluidStorage.normalizeValue(amount);
    this.scores.fluid.setScore(this.scoreId, value);
    this.scores.fluidExp.setScore(this.scoreId, exp);
    if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
      this.entity.setHealth(amount);
    }
  }

  /**
   * Gets the current amount of fluid stored in this tank.
   *
   * @returns {number} The current fluid amount in mB.
   */
  get() {
    const v = this.scores.fluid.getScore(this.scoreId) || 0;
    const e = this.scores.fluidExp.getScore(this.scoreId) || 0;
    return FluidStorage.combineValue(v, e);
  }

  /**
   * Adds or subtracts a specific amount of fluid.
   *
   * Uses scoreboard-safe addition logic.
   * Automatically clamps to tank capacity and updates visible
   * health if the entity is a UtilityCraft fluid tank.
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
    let value = this.scores.fluid.getScore(this.scoreId) || 0;
    let exp = this.scores.fluidExp.getScore(this.scoreId) || 0;
    const multi = 10 ** exp;

    // Convert to current exponent scale
    const normalizedAdd = Math.floor(amount / multi);

    // Apply add directly if safe
    let newValue = value + normalizedAdd;
    if (Math.abs(newValue) <= 1e9) {
      this.scores.fluid.addScore(this.scoreId, normalizedAdd);

      if (exp > 0 && value < 1e6) {
        this.set(this.get() + amount);
      }
    } else {
      this.set(this.get() + amount);
    }

    if (this.entity?.typeId?.startsWith("utilitycraft:fluid_tank")) {
      const amountCurrent = this.get();
      if (amountCurrent > 0) {
        system.run(() => {
          this.entity.setHealth(amountCurrent);
        });
      } else {
        this.entity.remove();
      }
    }

    return amount;
  }

  /**
   * Consumes a specific amount of fluid if available.
   *
   * @param {number} amount The amount to consume.
   * @returns {number} The amount actually consumed (0 if insufficient).
   */
  consume(amount) {
    if (this.entity.hasTag("creative")) return amount;
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
   * Checks whether the tank has at least a certain amount of fluid.
   *
   * @param {number} amount Amount to check for.
   * @returns {boolean} True if there is enough fluid.
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
   * Gets the fluid type currently stored in this tank.
   *
   * The type is stored in the entity's tags as `fluid{index}Type:{type}`.
   *
   * @returns {string} The stored fluid type, or "empty" if none.
   */
  getType() {
    const tag = this.entity.getTags().find((t) => t.startsWith(`fluid${this.index}Type:`));
    return tag ? tag.split(":")[1] : "empty";
  }

  /**
   * Sets the fluid type for this tank.
   *
   * Removes any previous type tag before adding the new one.
   *
   * @param {string} type The new fluid type (e.g. "lava", "water").
   * @returns {void}
   */
  setType(type) {
    const old = this.entity.getTags().find((t) => t.startsWith(`fluid${this.index}Type:`));
    if (old) this.entity.removeTag(old);
    this.entity.addTag(`fluid${this.index}Type:${type}`);
    this.type = type;
  }

  // --------------------------------------------------------------------------
  // Transfer operations
  // --------------------------------------------------------------------------

  /**
   * Transfers fluid from this entity to connected fluid containers in its network.
   *
   * ## Behavior
   * - Uses the provided `nodes` array to determine valid transfer targets.
   * - Automatically creates entities for target fluid tanks if they are empty (no entity).
   * - If no `nodes` are provided, the method immediately returns 0.
   *
   * ## Transfer Modes
   * - `"nearest"` → Starts from the closest node that accepts fluid.
   * - `"farthest"` → Starts from the farthest node first.
   * - `"round"` → Distributes fluid evenly across all valid targets.
   *
   * @param {number} speed Total transfer speed limit (mB/tick).
   * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
   * @param {Array<{x:number, y:number, z:number}>} nodes Precomputed network node positions.
   * @returns {number} Total amount of fluid transferred (in mB).
   */
  transferToNetwork(speed, mode = "nearest", nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return 0;

    const dim = this.entity.dimension;
    const pos = this.entity.location;
    let available = this.get();
    if (available <= 0 || speed <= 0) return 0;

    let transferred = 0;
    const type = this.getType();
    if (!type || type === "empty") return 0;

    // Select order based on mode
    let orderedTargets = [...nodes];

    // ──────────────────────────────────────────────
    // Process transfers
    // ──────────────────────────────────────────────
    const processTarget = (loc, share = null) => {
      const targetBlock = dim.getBlock(loc);
      if (!targetBlock?.hasTag("dorios:fluid")) return 0;

      // If the target is a tank with no entity, create one to store the fluid
      let targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
      if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
        FluidStorage.addfluidToTank(targetBlock, type, 0);
        targetEntity = dim.getEntitiesAtBlockLocation(loc)[0];
      }
      if (!targetEntity) return 0;

      const target = FluidStorage.findType(targetEntity, type);
      if (!target) return 0;

      const targetType = target.getType();
      const space = target.getFreeSpace();
      if (space <= 0) return 0;

      if (targetType === "empty") target.setType(type);

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
   * Transfers fluid from this tank or machine toward the opposite
   * direction of its facing axis (`utilitycraft:axis`).
   *
   * ## Behavior
   * - Reads `utilitycraft:axis` from the source block.
   * - Determines the **opposite direction vector** (e.g. east → west).
   * - Locates the target block in that opposite direction.
   * - If the target has the tag `"dorios:fluid"`, tries to transfer fluid to it.
   * - If the target is a fluid tank with no entity, one is spawned empty first.
   * - Uses {@link FluidStorage.transferTo} to handle transfer and visual updates.
   *
   * @param {Block} block The source block associated with this fluid entity.
   * @param {number} [amount=100] Maximum amount to transfer (in mB).
   * @returns {boolean} True if a valid transfer occurred, false otherwise.
   */
  transferFluids(block, amount = 100) {
    if (!block || !this.entity?.isValid) return false;

    const facing = block.getState("utilitycraft:axis");
    if (!facing) return false;

    // Opposite direction vectors
    const opposites = {
      east: [-1, 0, 0],
      west: [1, 0, 0],
      north: [0, 0, 1],
      south: [0, 0, -1],
      up: [0, -1, 0],
      down: [0, 1, 0],
    };

    const offset = opposites[facing];
    if (!offset) return false;

    const { x, y, z } = block.location;
    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };
    const dim = block.dimension;
    const targetBlock = dim.getBlock(targetLoc);
    if (!targetBlock) return false;

    // Only proceed if the target block supports fluids
    if (!targetBlock.hasTag("dorios:fluid") || targetBlock.hasTag("dorios:isTube")) return false;

    let targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];

    // If target is a tank and has no entity, spawn an empty one
    if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
      const type = this.getType();
      if (type == "empty") return;
      FluidStorage.addfluidToTank(targetBlock, type, 0);
      targetEntity = dim.getEntitiesAtBlockLocation(targetLoc)[0];
    }

    if (!targetEntity) return false;

    const targetFluid = new FluidStorage(targetEntity, 0);
    if (!targetFluid || targetFluid.getCap() <= 0) return false;

    const transferred = this.transferTo(targetFluid, amount);
    return transferred > 0;
  }

  /**
   * Transfers a specific amount of fluid from this tank to another.
   *
   * @param {FluidStorage} other The target tank to receive the fluid.
   * @param {number} amount The amount to transfer in mB.
   * @returns {number} The actual amount transferred.
   */
  transferTo(other, amount) {
    if (this.getType() !== other.getType() && other.getType() !== "empty") return 0;

    const transferable = Math.min(amount, this.get(), other.getFreeSpace());
    if (transferable <= 0) return 0;

    this.consume(transferable);
    other.add(transferable);
    if (other.getType() === "empty") other.setType(this.getType());
    return transferable;
  }

  /**
   * Receives fluid from another FluidStorage.
   *
   * @param {FluidStorage} other The source tank to pull from.
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
   * Displays the current fluid level in the entity's inventory.
   *
   * Renders a 48-frame progress bar representing how full the tank is.
   * The item used depends on the current fluid type.
   *
   * @param {number} [slot=4] Inventory slot index for the display item.
   * @returns {void}
   */
  display(slot = 4) {
    const inv = this.entity.getComponent("minecraft:inventory")?.container;
    if (!inv) return;

    const fluid = this.get();
    const cap = this.getCap();
    const type = this.getType();

    if (type === "empty") {
      let emptyBar = new ItemStack("utilitycraft:empty_fluid_bar");
      emptyBar.nameTag = "§rEmpty";
      inv.setItem(slot, emptyBar);
      return;
    }

    const frame = Math.max(0, Math.min(48, Math.floor((fluid / cap) * 48)));
    const frameName = frame.toString().padStart(2, "0");

    const item = new ItemStack(`utilitycraft:${type}_${frameName}`, 1);
    item.nameTag = `§r${DoriosAPI.utils.formatIdToText(type)}
§r§7  Stored: ${FluidStorage.formatFluid(fluid)} / ${FluidStorage.formatFluid(cap)}
§r§7  Percentage: ${((fluid / cap) * 100).toFixed(2)}%`;

    inv.setItem(slot, item);
  }

  // --------------------------------------------------------------------------
  // Utility for blocks
  // --------------------------------------------------------------------------

  /**
   * Adds a specified fluid to a tank block at a given location.
   *
   * Spawns a fluid tank entity if missing and initializes its scoreboards.
   *
   * @param {Block} block The block representing the tank.
   * @param {string} type The type of fluid to insert.
   * @param {number} amount Amount of fluid to insert in mB.
   * @returns {Entity} entity if insertion was successful.
   */
  static addfluidToTank(block, type, amount) {
    const dim = block.dimension;
    const pos = block.location;
    let entity = dim.getEntitiesAtBlockLocation(pos)[0];

    if (!entity) {
      const { x, y, z } = block.location;
      entity = dim.spawnEntity(`utilitycraft:fluid_tank_${type}`, {
        x: x + 0.5,
        y,
        z: z + 0.5,
      });
      if (!entity) return false;
      FluidStorage.initialize(entity);
      entity.triggerEvent(`${block.typeId.split("_")[0]}`);
    }

    const tank = new FluidStorage(entity, 0);
    tank.setCap(FluidStorage.getTankCapacity(block.typeId));
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
    const caps = {
      "utilitycraft:basic_fluid_tank": 8000,
      "utilitycraft:advanced_fluid_tank": 32000,
      "utilitycraft:expert_fluid_tank": 128000,
      "utilitycraft:ultimate_fluid_tank": 512000,
    };
    return caps[typeId] ?? 8000;
  }
}

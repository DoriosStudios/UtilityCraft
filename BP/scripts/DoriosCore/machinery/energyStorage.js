import { world, ItemStack, system } from "@minecraft/server";
import * as Constants from "./constants.js";
import { loadObjectives } from "../utils/scoreboards.js";
import { initializeEntity } from "../utils/entity.js";

/**
 * Utility class to manage scoreboard-based energy values for entities.
 */
export class EnergyStorage {
  /**
   * Creates a new EnergyStorage instance linked to the given entity.
   *
   * @param {Entity} entity The entity this manager is attached to.
   */
  constructor(entity) {
    this.entity = entity;
    this.scoreId = entity?.scoreboardIdentity;
    if (!this.scoreId) {
      initializeEntity(entity);
      this.scoreId = entity?.scoreboardIdentity;
    }
    this.cap = this.getCap();
  }

  //#region Statics

  /**
   * Global scoreboard objectives registry.
   *
   * This object is populated once the world finishes loading.
   * It must NOT be reassigned — only mutated.
   *
   * @type {{
   *   energy?: import("@minecraft/server").ScoreboardObjective,
   *   energyExp?: import("@minecraft/server").ScoreboardObjective,
   *   energyCap?: import("@minecraft/server").ScoreboardObjective,
   *   energyCapExp?: import("@minecraft/server").ScoreboardObjective,
   *   [key: string]: import("@minecraft/server").ScoreboardObjective
   * }}
   */
  static #objectives = Object.create(null);

  /**
   * Initializes and caches all Energy scoreboard objectives.
   *
   * This method retrieves or creates the required objectives and
   * stores them in the internal objectives registry. It must be
   * executed once after the world has finished loading.
   *
   * The objectives loaded are:
   * - energy
   * - energyExp
   * - energyCap
   * - energyCapExp
   *
   */
  static initializeObjectives() {
    loadObjectives(Constants.ENERGY_OBJECTIVE_DEFINITIONS, EnergyStorage.#objectives);
  }

  /**
   * Normalizes a raw number into a scoreboard-safe mantissa and exponent.
   * Ensures that the mantissa does not exceed 1e9 by shifting into the exponent.
   *
   * @param {number} amount The raw number to normalize.
   * @returns {{ value: number, exp: number }} The normalized mantissa (value) and exponent.
   *
   * @example
   * EnergyStorage.normalizeValue(25_600_000);
   * // → { value: 25_600, exp: 3 }
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
   * Combines a mantissa and exponent back into the full number.
   *
   * @param {number} value The mantissa part of the number.
   * @param {number} exp The exponent part of the number.
   * @returns {number} The reconstructed full number.
   *
   * @example
   * EnergyStorage.combineValue(25_600, 3);
   * // → 25_600_000
   */
  static combineValue(value, exp) {
    return value * 10 ** exp;
  }

  /**
  * Formats a numerical Dorios Energy (DE) value into a human-readable string with appropriate unit suffix.
  *
  * @param {number} value The energy value in DE (Dorios Energy).
  * @returns {string} A formatted string representing the value with the appropriate unit (DE, kDE, MDE, GDE, TDE).
  *
  * @example
  * formatEnergyToText(15300); // "15.3 kDE"
  * formatEnergyToText(1048576); // "1.05 MDE"
  */
  static formatEnergyToText(value) {
    const safeValue = Math.max(0, Number(value) || 0);

    if (safeValue >= 1e15) {
      return `${(safeValue / 1e15).toFixed(2)} PDE`;
    }

    if (safeValue >= 1e12) {
      return `${(safeValue / 1e12).toFixed(2)} TDE`;
    }

    if (safeValue >= 1e9) {
      return `${(safeValue / 1e9).toFixed(2)} GDE`;
    }

    if (safeValue >= 1e6) {
      return `${(safeValue / 1e6).toFixed(2)} MDE`;
    }

    if (safeValue >= 1e3) {
      return `${(safeValue / 1e3).toFixed(1)} kDE`;
    }

    return `${Math.floor(safeValue)} DE`;
  }

  /**
   * Parses a formatted energy string (with Minecraft color codes) and returns the numeric value in DE.
   *
   * @param {string} input The string with formatted energy (e.g., "§r§7  Energy: 12.5 kDE / 256 kDE").
   * @param {number} index Which value to extract: 0 = current, 1 = max.
   * @returns {number} The numeric value in base DE.
   *
   * @example
   * parseFormattedEnergy("§r§7  Energy: 12.5 kDE / 256 kDE", 0); // 12500
   * parseFormattedEnergy("§r§7  Energy: 12.5 kDE / 256 kDE", 1); // 256000
   */
  static getEnergyFromText(input, index = 0) {
    // Remove Minecraft formatting codes
    const cleanedInput = input.replace(/§[0-9a-frklmnor]/gi, "");

    const matches = [...cleanedInput.matchAll(/([\d.]+)\s*(PDE|TDE|GDE|MDE|KDE|DE)/gi)];

    if (!matches.length || index < 0 || index >= matches.length) {
      return
      // throw new Error("Invalid input or index: couldn't parse energy values.");
    }

    const [, valueStr, rawUnit] = matches[index];
    const unit = String(rawUnit || "DE").toUpperCase();
    const multipliers = {
      DE: 1,
      KDE: 1e3,
      MDE: 1e6,
      GDE: 1e9,
      TDE: 1e12,
      PDE: 1e15,
    };

    return parseFloat(valueStr) * (multipliers[unit] ?? 1);
  }
  //#endregion

  //#region Caps

  /**
   * Normalizes and sets the energy capacity for a given entity.
   *
   * @static
   * @param {Entity} entity Target entity whose capacity will be updated.
   * @param {number} amount Raw energy capacity value.
   * @returns {void}
   */
  static setCap(entity, amount) {
    if (!entity?.scoreboardIdentity) return;

    const scoreId = entity.scoreboardIdentity;
    const { value, exp } = EnergyStorage.normalizeValue(amount);

    EnergyStorage.#objectives.energyCap.setScore(scoreId, value);
    EnergyStorage.#objectives.energyCapExp.setScore(scoreId, exp);
  }

  /**
   * Sets the maximum energy capacity of the entity.
   * The value is automatically normalized into a mantissa and an exponent,
   * then stored in the corresponding scoreboard objectives.
   *
   * @param {number} amount The raw capacity value to set.
   * @returns {void}
   *
   * @example
   * energy.setCap(25_600_000);
   */
  setCap(amount) {
    const { value, exp } = EnergyStorage.normalizeValue(amount);
    EnergyStorage.#objectives.energyCap.setScore(this.scoreId, value);
    EnergyStorage.#objectives.energyCapExp.setScore(this.scoreId, exp);
  }

  /**
   * Gets the maximum energy capacity of the entity.
   * Reads the mantissa and exponent from the scoreboards,
   * then reconstructs the full number.
   *
   * The result is also stored in `this.cap` for later checks.
   *
   * @returns {number} The maximum energy capacity.
   *
   * @example
   * const cap = energy.getCap();
   * console.log(cap); // → 25600000
   */
  getCap() {
    const value = EnergyStorage.#objectives.energyCap.getScore(this.scoreId) || 0;
    const exp = EnergyStorage.#objectives.energyCapExp.getScore(this.scoreId) || 0;

    this.cap = EnergyStorage.combineValue(value, exp);
    return this.cap;
  }

  /**
   * Gets the maximum energy capacity of the entity as separate
   * mantissa and exponent values without combining them.
   *
   * The result is also stored in `this.cap` as the full combined number.
   *
   * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
   *
   * @example
   * const { value, exp } = energy.getCapNormalized();
   * console.log(value, exp); // → 25600 , 3
   */
  getCapNormalized() {
    const value = EnergyStorage.#objectives.energyCap.getScore(this.scoreId) || 0;
    const exp = EnergyStorage.#objectives.energyCapExp.getScore(this.scoreId) || 0;

    this.cap = EnergyStorage.combineValue(value, exp);
    return { value, exp };
  }
  //#endregion

  /**
   * Sets the current energy of the entity.
   * The value is automatically normalized into a mantissa and an exponent,
   * then stored in the corresponding scoreboard objectives.
   *
   * @param {number} amount The raw energy value to set.
   * @returns {void}
   *
   * @example
   * energy.set(1_250_000);
   */
  set(amount) {
    const { value, exp } = EnergyStorage.normalizeValue(amount);

    EnergyStorage.#objectives.energy.setScore(this.scoreId, value);
    EnergyStorage.#objectives.energyExp.setScore(this.scoreId, exp);
  }

  /**
   * Gets the current energy stored in the entity.
   * Reads the mantissa and exponent from the scoreboards,
   * then reconstructs the full number.
   *
   * @returns {number} The current energy value.
   *
   * @example
   * const current = energy.get();
   * console.log(current); // → 1250000
   */
  get() {
    const value = EnergyStorage.#objectives.energy.getScore(this.scoreId) || 0;
    const exp = EnergyStorage.#objectives.energyExp.getScore(this.scoreId) || 0;
    return EnergyStorage.combineValue(value, exp);
  }

  /**
   * Gets the current energy stored in the entity as separate
   * mantissa and exponent values without combining them.
   *
   * @returns {{ value: number, exp: number }} The normalized mantissa and exponent.
   *
   * @example
   * const { value, exp } = energy.getNormalized();
   * console.log(value, exp); // → 125000 , 1
   */
  getNormalized() {
    return {
      value: EnergyStorage.#objectives.energy.getScore(this.scoreId) || 0,
      exp: EnergyStorage.#objectives.energyExp.getScore(this.scoreId) || 0,
    };
  }

  /**
   * Gets the free energy capacity available in the entity.
   *
   * This is the difference between the maximum capacity (`this.cap`)
   * and the current stored energy.
   *
   * @returns {number} The free capacity (0 if already full).
   *
   * @example
   * const free = energy.getFreeSpace();
   * console.log(free); // → 10240
   */
  getFreeSpace() {
    if (this.cap === undefined) {
      this.getCap();
    }
    const current = this.get();
    return Math.max(0, this.cap - current);
  }

  /**
   * Adds energy to the entity, respecting the maximum capacity.
   * Converts the amount into the current exponent scale.
   *
   * @param {number} amount The amount of energy to add.
   * @returns {number} The actual amount of energy added.
   *
   * @example
   * const added = energy.add(5000);
   * console.log(added); // → 5000 or less if near cap
   */
  add(amount) {
    // Clamp amount to remaining capacity
    const free = this.getFreeSpace();
    if (amount > 0 && free <= 0) return 0;

    if (amount > free) {
      amount = free;
    }

    // Current normalized values
    let { value, exp } = this.getNormalized();
    const multi = 10 ** exp;

    // Convert to current exponent scale
    const normalizedAdd = Math.floor(amount / multi);

    // Add directly if safe
    let newValue = value + normalizedAdd;
    if (newValue <= 1e9) {
      EnergyStorage.#objectives.energy.addScore(this.scoreId, normalizedAdd);

      if (exp > 0 && value < 1e6) {
        this.set(this.get() + amount);
      }
    } else {
      this.set(this.get() + amount);
    }

    return amount;
  }

  /**
   * Displays the current energy as a 48-frame bar item inside the entity's inventory.
   *
   * @param {number} [slot=0] The slot index to place the item in (default is 0).
   * @returns {void}
   *
   * @example
   * energy.display();     // shows bar in slot 0
   * energy.display(5);    // shows bar in slot 5
   */
  display(slot = 0) {
    const container = this.entity.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const energy = this.get();
    const energyCap = this.getCap();
    const energyP = Math.floor((energy / energyCap) * Constants.ENERGY_BAR_FRAME_COUNT) || 0;
    const frame = Math.max(0, Math.min(Constants.ENERGY_BAR_FRAME_COUNT, energyP));
    const frameName = frame.toString().padStart(2, "0");

    const item = new ItemStack(`${Constants.ENERGY_BAR_ITEM_PREFIX}${frameName}`, 1);
    item.nameTag = `§rEnergy
§r§7  Stored: ${EnergyStorage.formatEnergyToText(this.get())} / ${EnergyStorage.formatEnergyToText(this.cap)}
§r§7  Percentage: ${this.getPercent().toFixed(2)}%%`;

    container.setItem(slot, item);
  }

  //#region Utils
  /**
   * Consumes energy from the entity if available.
   * Internally this is just an add with a negative amount.
   *
   * @param {number} amount The amount of energy to consume.
   * @returns {number} The actual amount of energy consumed.
   *
   * @example
   * const used = energy.consume(1000);
   * if (used > 0) console.log(`Consumed ${used} energy`);
   */
  consume(amount) {
    if (this.entity.hasTag(Constants.CREATIVE_TAG)) return amount;
    if (amount <= 0) return 0;

    const current = this.get();
    if (current < amount) return 0;

    // Delegate to add with negative value
    this.add(-amount);
    return amount;
  }

  /**
   * Checks if the entity has at least the given amount of energy.
   *
   * @param {number} amount The required amount.
   * @returns {boolean} True if the entity has enough energy.
   *
   * @example
   * if (energy.has(500)) {
   *   // Do operation
   * }
   */
  has(amount) {
    return this.get() >= amount;
  }

  /**
   * Checks if the entity is at maximum capacity.
   *
   * @returns {boolean} True if energy is at or above the capacity.
   *
   * @example
   * if (energy.isFull()) {
   *   console.log("Battery is full!");
   * }
   */
  isFull() {
    return this.getFreeSpace() === 0;
  }

  /**
   * Rebalances the energy value to ensure the mantissa and exponent
   * are in the optimal range.
   *
   * This is useful after large consumes, to avoid cases where
   * the exponent is high but the mantissa is very small.
   *
   * @returns {void}
   *
   * @example
   * energy.rebalance();
   */
  rebalance() {
    this.set(this.get());
  }

  /**
   * Gets the current energy as a percentage of capacity.
   *
   * @returns {number} The percentage [0-100].
   *
   * @example
   * const percent = energy.getPercent();
   * console.log(`${percent.toFixed(1)}% full`);
   */
  getPercent() {
    if (this.cap === undefined) {
      this.getCap();
    }
    if (this.cap <= 0) return 0;
    return Math.min(100, (this.get() / this.cap) * 100);
  }

  /**
   * Transfers energy from this entity to another Energy manager.
   *
   * @param {Energy} other The target Energy instance.
   * @param {number} amount The maximum amount to transfer.
   * @returns {number} The actual amount transferred.
   *
   * @example
   * const transferred = source.transferTo(target, 1000);
   * console.log(`Transferred ${transferred} energy`);
   */
  transferTo(other, amount) {
    if (!other || amount <= 0) return 0;

    const freeSpace = other.getFreeSpace();
    if (freeSpace <= 0) return 0;

    const maxTransfer = Math.min(amount, this.get(), freeSpace);
    if (maxTransfer <= 0) return 0;

    const actuallyAdded = other.add(maxTransfer);
    if (actuallyAdded <= 0) return 0;

    this.consume(actuallyAdded);

    return actuallyAdded;
  }
  /**
   * Transfers energy from this entity to another entity directly.
   * Creates a temporary Energy manager for the target entity.
   *
   * @param {Entity} entity The target entity.
   * @param {number} amount The maximum amount to transfer.
   * @returns {number} The actual amount transferred.
   *
   * @example
   * const transferred = battery.transferToEntity(machineEntity, 2000);
   * console.log(`Transferred ${transferred} energy`);
   */
  transferToEntity(entity, amount) {
    const other = new EnergyStorage(entity);
    return this.transferTo(other, amount);
  }

  /**
   * Receives energy from another Energy manager.
   *
   * @param {Energy} other The source Energy instance.
   * @param {number} amount The maximum amount to receive.
   * @returns {number} The actual amount received.
   *
   * @example
   * const received = machine.receiveFrom(generator, 1500);
   * console.log(`Received ${received} energy`);
   */
  receiveFrom(other, amount) {
    const consumed = other.consume(amount);
    if (consumed <= 0) return 0;

    const added = this.add(consumed);
    return added;
  }

  /**
   * Receives energy directly from another entity.
   * Creates a temporary Energy manager for the source entity.
   *
   * @param {Entity} entity The source entity.
   * @param {number} amount The maximum amount to receive.
   * @returns {number} The actual amount received.
   *
   * @example
   * const received = machine.receiveFromEntity(generatorEntity, 3000);
   * console.log(`Received ${received} energy`);
   */
  receiveFromEntity(entity, amount) {
    const other = new EnergyStorage(entity);
    return this.receiveFrom(other, amount);
  }
  //#endregion

  /**
   * Transfers energy from this entity to connected energy containers in its network.
   *
   * ## Behavior
   * - Reads network nodes from a cached dynamic property (`dorios:energy_nodes`).
   * - If the property doesn't exist or the entity has the `updateNetwork` tag,
   *   rebuilds the node list from its `pos:[x,y,z]` or `net:[x,y,z]` tags.
   * - Caches the list sorted by distance for performance.
   *
   * ## Transfer Modes
   * - `"nearest"` → Transfers to the closest valid target first.
   * - `"farthest"` → Transfers starting from the farthest target first.
   * - `"round"` → Checks 10 targets per tick, giving energy evenly to all valid ones.
   *
   * @param {number} speed Total transfer speed limit (DE/tick).
   * @param {"nearest"|"farthest"|"round"} [mode="nearest"] Transfer mode.
   * @returns {number} Total amount of energy transferred (in DE).
   */
  transferToNetwork(speed, mode) {
    mode = mode ?? this.entity.getDynamicProperty("transferMode");
    let available = this.get();
    speed = Math.min(available, speed);
    if (available <= 0 || speed <= 0) return 0;

    const dim = this.entity.dimension;
    const pos = this.entity.location;
    const isBattery = this.entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:battery");
    let transferred = 0;

    // ──────────────────────────────────────────────
    // Retrieve or rebuild cached network nodes
    // ──────────────────────────────────────────────
    let nodes = this.entity.getDynamicProperty("dorios:energy_nodes");
    const needsUpdate = this.entity.hasTag("updateNetwork");

    if (!nodes || needsUpdate) {
      const positions = this.entity
        .getTags()
        .filter((tag) => tag.startsWith("pos:[") || tag.startsWith("net:["))
        .map((tag) => {
          const [x, y, z] = tag.slice(5, -1).split(",").map(Number);
          return { x, y, z };
        })
        .sort((a, b) => DoriosAPI.math.distanceBetween(pos, a) - DoriosAPI.math.distanceBetween(pos, b));

      this.entity.setDynamicProperty("dorios:energy_nodes", JSON.stringify(positions));
      this.entity.removeTag("updateNetwork");
      nodes = JSON.stringify(positions);
    }

    /** @type {{x:number,y:number,z:number}[]} */
    const targets = JSON.parse(nodes);
    if (targets.length === 0) return 0;

    // ──────────────────────────────────────────────
    // Select order based on transfer mode
    // ──────────────────────────────────────────────
    let orderedTargets = [...targets];
    if (mode === "farthest") orderedTargets.reverse();

    if (mode === "round") {
      // Filtrar entidades válidas
      const validEntities = [];
      for (const loc of orderedTargets) {
        const [target] = dim.getEntitiesAtBlockLocation(loc);
        if (!target) continue;

        const tf = target.getComponent("minecraft:type_family");
        if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
        if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

        const energy = new EnergyStorage(target);
        if (energy.getFreeSpace() > 0) validEntities.push(energy);
      }

      if (validEntities.length === 0) {
        // avanzar igual aunque no haya válidos
        // this.entity.setDynamicProperty("dorios:energy_round_idx", (idx + 10) % orderedTargets.length);
        return 0;
      }

      // Dividir la energía entre los válidos del grupo actual
      const share = Math.floor(Math.min(speed, available) / validEntities.length);
      // world.sendMessage(`${share}, ${validEntities.length}`)
      for (const energy of validEntities) {
        if (available <= 0 || speed <= 0) break;

        const space = energy.getFreeSpace();
        if (space <= 0) continue;

        const amount = Math.min(share, space);
        const added = energy.add(amount);
        if (added > 0) {
          available -= added;
          speed -= added;
          transferred += added;
        }
      }
    }

    // ──────────────────────────────────────────────
    // NEAREST / FARTHEST modes (Sequential)
    // ──────────────────────────────────────────────
    else {
      for (const loc of orderedTargets) {
        if (available <= 0 || speed <= 0) break;

        const [target] = dim.getEntitiesAtBlockLocation(loc);
        if (!target) continue;

        const tf = target.getComponent("minecraft:type_family");
        if (!tf?.hasTypeFamily("dorios:energy_container")) continue;
        if (isBattery && tf.hasTypeFamily("dorios:battery")) continue;

        const energy = new EnergyStorage(target);
        const space = energy.getFreeSpace();
        if (space <= 0) continue;

        const amount = Math.min(space, available, speed);
        const added = energy.add(amount);
        if (added > 0) {
          available -= added;
          speed -= added;
          transferred += added;
        }
      }
    }

    // ──────────────────────────────────────────────
    // Apply total energy consumption
    // ──────────────────────────────────────────────
    if (transferred > 0) this.consume(transferred);

    return transferred;
  }
}

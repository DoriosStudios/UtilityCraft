import { ItemStack } from "@minecraft/server";
import { advanceTemperature, requireThermalNumber } from "./temperatureModel.js";

/**
 * Persistent thermal body, independent of fuels, coolants and machine limits.
 * One JSON dynamic property per entity/index retains fractional K and HU/K.
 * Initial temperature/capacity options only apply when creating new state.
 */
export class TemperatureStorage {
  /**
   * @param {import('@minecraft/server').Entity} entity
   * @param {number} [index=0]
   * @param {{initialTemperature?: number, heatCapacity?: number}} [options]
   */
  constructor(entity, index = 0, { initialTemperature = 300, heatCapacity = 1 } = {}) {
    if (!Number.isInteger(index) || index < 0) throw new RangeError("index must be a nonnegative integer");
    this.entity = entity;
    this.index = index;
    this.propertyId = `dorios:temperature_${index}`;
    if (entity.getDynamicProperty(this.propertyId) === undefined) {
      this._write({ temperature: initialTemperature, heatCapacity });
    } else {
      this._read();
    }
  }

  static initializeSingle(entity, options) {
    return new TemperatureStorage(entity, 0, options);
  }

  _validate(state) {
    requireThermalNumber(state.temperature, "temperature");
    requireThermalNumber(state.heatCapacity, "heatCapacity");
    if (state.heatCapacity <= 0) throw new RangeError("heatCapacity must be positive");
    return state;
  }

  _read() {
    return this._validate(JSON.parse(this.entity.getDynamicProperty(this.propertyId)));
  }

  _write(state) {
    this._validate(state);
    const serialized = JSON.stringify(state);
    if (this.entity.getDynamicProperty(this.propertyId) !== serialized) {
      this.entity.setDynamicProperty(this.propertyId, serialized);
    }
  }

  /** Current temperature in K. */
  get() { return this._read().temperature; }

  /** Set K directly, without machine limits. Returns the resulting K. */
  set(temperature) {
    this._write({ ...this._read(), temperature });
    return temperature;
  }

  /** Capacity in HU/K, not maximum storage or temperature. */
  getHeatCapacity() { return this._read().heatCapacity; }

  /**
   * Reconfigure capacity, preserving temperature. This is not energy-conserving
   * mixing; machines must account for the energy of added/removed material.
   */
  setHeatCapacity(heatCapacity) {
    this._write({ ...this._read(), heatCapacity });
    return heatCapacity;
  }

  /** Add signed HU immediately; returns the resulting K. */
  addHeat(heat) {
    requireThermalNumber(heat, "heat");
    const state = this._read();
    state.temperature += heat / state.heatCapacity;
    this._write(state);
    return state.temperature;
  }

  /** Remove nonnegative HU; no ambient or machine minimum clamp. */
  removeHeat(heat) {
    requireThermalNumber(heat, "heat");
    if (heat < 0) throw new RangeError("removed heat must be nonnegative");
    return this.addHeat(-heat);
  }

  /**
   * Advance internal generation and simultaneous fixed-temperature contacts.
   * @param {{ticks?: number, heatRate?: number,
   *   contacts?: import('./temperatureModel.js').ThermalContact[]}} [options]
   * @returns {ReturnType<typeof advanceTemperature>}
   */
  advance({ ticks = 1, heatRate = 0, contacts = [] } = {}) {
    const state = this._read();
    const result = advanceTemperature({ ...state, ticks, heatRate, contacts });
    this._write({ ...state, temperature: result.temperature });
    return result;
  }

  /** One fixed-temperature contact; conductance is HU/(tick K). */
  transfer(temperature, ticks = 1, conductance = 1) {
    return this.advance({ ticks, contacts: [{ temperature, conductance }] });
  }

  /**
   * Native 32-frame temperature bar. Range affects only the graphic, never state.
   * Tooltip reports actual K even outside the range. Updates only for open UIs
   * unless force is set (e.g. initial population).
   * @param {number} [slot=4]
   * @param {{minimum?: number, maximum?: number, force?: boolean}} [options]
   * @returns {boolean} Whether an inventory item was written.
   */
  display(slot = 4, { minimum = 0, maximum = 4000, force = false } = {}) {
    requireThermalNumber(minimum, "display minimum");
    requireThermalNumber(maximum, "display maximum");
    if (maximum <= minimum) throw new RangeError("display maximum must exceed minimum");
    if (!Number.isInteger(slot) || slot < 0) throw new RangeError("slot must be a nonnegative integer");
    if (!force) {
      let open = false;
      try { open = Number(this.entity.getProperty("utilitycraft:players") ?? 0) > 0; } catch { /* No UI property. */ }
      if (!open) return false;
    }
    const container = this.entity.getComponent("minecraft:inventory")?.container;
    if (!container) return false;
    const temperature = this.get();
    const fraction = Math.max(0, Math.min(1, (temperature - minimum) / (maximum - minimum)));
    const frame = Math.floor(fraction * 31);
    const typeId = `utilitycraft:temperature_${String(frame).padStart(2, "0")}`;
    const nameTag = `\u00a7r\u00a7f${temperature.toFixed(2)} K`;
    const previous = container.getItem(slot);
    if (previous?.typeId === typeId && previous.nameTag === nameTag && previous.amount === 1) return false;
    const item = new ItemStack(typeId, 1);
    item.nameTag = nameTag;
    container.setItem(slot, item);
    return true;
  }
}

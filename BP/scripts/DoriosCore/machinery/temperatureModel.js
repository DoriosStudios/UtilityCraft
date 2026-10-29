/**
 * @typedef {Object} ThermalContact
 * @property {number} temperature Fixed reservoir temperature in K for this step.
 * @property {number} conductance Nonnegative conductance in HU/(tick K).
 * @property {string} [id] Optional caller label; does not affect the calculation.
 */

export function requireThermalNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}

/**
 * Exact constant-coefficient solution of C dT/dt = P + sum(Gi (Ti - T)).
 * No machine limits, ambient defaults, resource rules or side effects.
 * Contacts are fixed-temperature reservoirs, not other mutable thermal bodies.
 * Positive contact heat enters this body; negative heat leaves it. All contacts
 * act simultaneously. Parameters must stay constant over the represented time.
 *
 * @param {Object} options
 * @param {number} options.temperature Initial K (not clamped).
 * @param {number} options.heatCapacity Positive capacity in HU/K.
 * @param {number} [options.ticks=1] Nonnegative elapsed simulation ticks.
 * @param {number} [options.heatRate=0] Internal HU/t; may be negative.
 * @param {ThermalContact[]} [options.contacts=[]]
 * @returns {{temperature: number, temperatureChange: number, generatedHeat: number,
 *   netHeat: number, equilibriumTemperature: number|null,
 *   contacts: {id: string|undefined, heat: number}[]}}
 */
export function advanceTemperature({ temperature, heatCapacity, ticks = 1, heatRate = 0, contacts = [] }) {
  requireThermalNumber(temperature, "temperature");
  requireThermalNumber(heatCapacity, "heatCapacity");
  requireThermalNumber(ticks, "ticks");
  requireThermalNumber(heatRate, "heatRate");
  if (heatCapacity <= 0) throw new RangeError("heatCapacity must be positive");
  if (ticks < 0) throw new RangeError("ticks must be nonnegative");
  if (!Array.isArray(contacts)) throw new TypeError("contacts must be an array");

  let conductance = 0;
  let initialNetRate = heatRate;
  for (const contact of contacts) {
    requireThermalNumber(contact.temperature, "contact.temperature");
    requireThermalNumber(contact.conductance, "contact.conductance");
    if (contact.conductance < 0) throw new RangeError("contact.conductance must be nonnegative");
    conductance += contact.conductance;
    initialNetRate += contact.conductance * (contact.temperature - temperature);
  }
  requireThermalNumber(conductance, "total conductance");
  requireThermalNumber(initialNetRate, "net heat rate");
  const equilibriumTemperature = conductance > 0
    ? temperature + initialNetRate / conductance
    : heatRate === 0 ? temperature : null;
  if (equilibriumTemperature !== null) requireThermalNumber(equilibriumTemperature, "equilibrium temperature");

  // phi=(1-exp(-x))/x; psi=(1-phi)/x. Series avoid cancellation for
  // short steps and large heat capacities, including x=0 (no conductance).
  const x = requireThermalNumber(conductance / heatCapacity * ticks, "thermal time step");
  const phi = x < 1e-4
    ? 1 - x / 2 + x * x / 6 - x ** 3 / 24 + x ** 4 / 120
    : -Math.expm1(-x) / x;
  const psi = x < 1e-4
    ? 0.5 - x / 6 + x * x / 24 - x ** 3 / 120 + x ** 4 / 720
    : (1 - phi) / x;
  const linearChange = requireThermalNumber(initialNetRate / heatCapacity * ticks, "temperature increment");
  const temperatureChange = linearChange * phi;
  const averageChange = linearChange * psi;
  const nextTemperature = requireThermalNumber(temperature + temperatureChange, "resulting temperature");
  const generatedHeat = requireThermalNumber(heatRate * ticks, "generated heat");
  const exchanges = contacts.map(contact => ({
    id: contact.id,
    heat: requireThermalNumber(
      contact.conductance * ticks * ((contact.temperature - temperature) - averageChange),
      "contact heat",
    ),
  }));
  return {
    temperature: nextTemperature,
    temperatureChange,
    generatedHeat,
    netHeat: requireThermalNumber(heatCapacity * temperatureChange, "net heat"),
    equilibriumTemperature,
    contacts: exchanges,
  };
}

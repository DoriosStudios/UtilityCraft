import * as DoriosLib from "DoriosLib/index.js";
// @ts-check

import {
  CommandPermissionLevel,
  CustomCommandParamType,
  system,
  world,
} from "@minecraft/server";
import {
  COMMAND_PARAMETER_TYPES,
  PERMISSION_LEVELS,
} from "../constants/index.js";

export { COMMAND_PARAMETER_TYPES, PERMISSION_LEVELS };

/** Alias kept for concise command-definition terminology. */
export const PARAMETER_TYPES = COMMAND_PARAMETER_TYPES;

/** Script events exposed by UtilityCraft's runtime registries. */
export const REGISTRATION_EVENT_IDS = Object.freeze({
  AUTO_FISHER_DROP: "utilitycraft:register_autofisher_drop",
  BONSAI: "utilitycraft:register_bonsai",
  COOLANT: "utilitycraft:register_coolant",
  CRAFTER_RECIPE: "utilitycraft:register_crafter_recipe",
  CRUSHER_RECIPE: "utilitycraft:register_crusher_recipe",
  FLUID_HOLDER: "utilitycraft:register_fluid_holder",
  FLUID_ITEM: "utilitycraft:register_fluid_item",
  FUEL: "utilitycraft:register_fuel",
  FURNACE_RECIPE: "utilitycraft:register_furnace_recipe",
  GAS_HOLDER: "utilitycraft:register_gas_holder",
  GAS_ITEM: "utilitycraft:register_gas_item",
  INFUSER_RECIPE: "utilitycraft:register_infuser_recipe",
  MELTER_RECIPE: "utilitycraft:register_melter_recipe",
  MACHINE_UPGRADE: "utilitycraft:register_machine_upgrade",
  PLANT: "utilitycraft:register_plant",
  PRESS_RECIPE: "utilitycraft:register_press_recipe",
  SIEVE_DROP: "utilitycraft:register_sieve_drop",
  SPECIAL_CONTAINER_SLOTS: "utilitycraft:register_special_container_slots",
});

/** @typedef {Record<string, unknown>} RegistrationPayload */

/**
 * @typedef {object} CoolantRegistration
 * @property {number} efficiency Consumption divisor used by coolant-powered machines.
 * @property {number} [tier=0] Compatibility tier for machines that enforce coolant tiers.
 */

/**
 * Registers one or more Auto Fisher drops.
 *
 * @param {RegistrationPayload|RegistrationPayload[]} payload
 */
export function registerAutoFisherDrop(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.AUTO_FISHER_DROP, payload);
}

/**
 * Registers legacy bonsai definitions. Prefer {@link registerPlant} for new integrations.
 *
 * @param {RegistrationPayload} payload
 */
export function registerBonsai(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.BONSAI, payload);
}

/** @param {Record<string, CoolantRegistration>} payload */
export function registerCoolant(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.COOLANT, payload);
}

/** @param {RegistrationPayload} payload */
export function registerCrafterRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.CRAFTER_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerCrusherRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.CRUSHER_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerFluidHolder(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.FLUID_HOLDER, payload);
}

/** @param {RegistrationPayload} payload */
export function registerFluidItem(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.FLUID_ITEM, payload);
}

/** @param {RegistrationPayload} payload */
export function registerFuel(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.FUEL, payload);
}

/** @param {RegistrationPayload} payload */
export function registerFurnaceRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.FURNACE_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerGasHolder(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.GAS_HOLDER, payload);
}

/** @param {RegistrationPayload} payload */
export function registerGasItem(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.GAS_ITEM, payload);
}

/** @param {RegistrationPayload} payload */
export function registerInfuserRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.INFUSER_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerMelterRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.MELTER_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerMachineUpgrade(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.MACHINE_UPGRADE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerPlant(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.PLANT, payload);
}

/** @param {RegistrationPayload} payload */
export function registerPressRecipe(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.PRESS_RECIPE, payload);
}

/** @param {RegistrationPayload} payload */
export function registerSieveDrop(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.SIEVE_DROP, payload);
}

/** @param {RegistrationPayload} payload */
export function registerSpecialContainerSlots(payload) {
  enqueueRegistration(REGISTRATION_EVENT_IDS.SPECIAL_CONTAINER_SLOTS, payload);
}

/** @typedef {{eventId: string, message: string}} QueuedRegistration */

/** @type {QueuedRegistration[]} */
const registrationQueue = [];
let registrationDispatchEnabled = false;
let registrationDispatchScheduled = false;

world.afterEvents.worldLoad.subscribe(() => {
  registrationDispatchEnabled = true;
  scheduleNextRegistration();
});

/**
 * Serializes and queues one UtilityCraft registration payload.
 *
 * @param {string} eventId
 * @param {RegistrationPayload|RegistrationPayload[]} payload
 */
function enqueueRegistration(eventId, payload) {
  if (payload === null || typeof payload !== "object") {
    throw new TypeError(`Registration payload for ${eventId} must be an object`);
  }

  const message = JSON.stringify(payload);
  if (typeof message !== "string") {
    throw new TypeError(`Registration payload for ${eventId} must be JSON serializable`);
  }

  registrationQueue.push({ eventId, message });
  scheduleNextRegistration();
}

/** Schedules exactly one queued registration for the next tick. */
function scheduleNextRegistration() {
  if (
    !registrationDispatchEnabled
    || registrationDispatchScheduled
    || registrationQueue.length === 0
  ) return;

  registrationDispatchScheduled = true;
  system.run(() => {
    const registration = registrationQueue.shift();

    try {
      if (registration) system.sendScriptEvent(registration.eventId, registration.message);
    } catch (error) {
      console.warn(`[DoriosLib:registry] Failed to dispatch ${registration?.eventId}:`, error);
    } finally {
      registrationDispatchScheduled = false;
      scheduleNextRegistration();
    }
  });
}

/** @type {Map<string, Registrar>} */
const sharedRegistrars = new Map();
let sharedRegistryInstalled = false;

/** @typedef {import("@minecraft/server").BlockCustomComponent} BlockCustomComponent */
/** @typedef {import("@minecraft/server").ItemCustomComponent} ItemCustomComponent */

/**
 * @typedef {object} CommandParameter
 * @property {string} name
 * @property {keyof typeof PARAMETER_TYPES} type
 * @property {boolean} [optional=false]
 * @property {string[]} [values] Values used when `type` is `enum`.
 */

/**
 * @typedef {object} CommandDefinition
 * @property {string} name Unqualified command name.
 * @property {string} [description]
 * @property {keyof typeof PERMISSION_LEVELS|CommandPermissionLevel} [permissionLevel="any"]
 * @property {boolean} [cheatsRequired=false]
 * @property {CommandParameter[]} [parameters]
 * @property {(origin: import("@minecraft/server").CustomCommandOrigin, ...args: unknown[]) => void} callback
 */

/**
 * @typedef {object} RegistrarOptions
 * @property {string} namespace
 * @property {(error: unknown, context: string) => void} [onError]
 */

/**
 * @typedef {object} Registrar
 * @property {(id: string, handlers: BlockCustomComponent) => Registrar} block
 * @property {(id: string, handlers: ItemCustomComponent) => Registrar} item
 * @property {(definition: CommandDefinition) => Registrar} command
 * @property {() => boolean} install
 * @property {() => boolean} isInstalled
 */

/**
 * Creates a namespaced registrar. Definitions are collected until `install()`
 * is called, which subscribes one startup listener for all registrations.
 *
 * `install()` must be called during initial script evaluation, before the
 * Minecraft startup event is emitted.
 *
 * @param {string|RegistrarOptions} options Namespace or registrar options.
 * @returns {Registrar}
 */
export function createRegistrar(options) {
  const normalized = typeof options === "string" ? { namespace: options } : options;
  const namespace = validateNamespace(normalized.namespace);
  const onError = normalized.onError ?? defaultErrorHandler;

  /** @type {Array<{id: string, handlers: BlockCustomComponent}>} */
  const blocks = [];
  /** @type {Array<{id: string, handlers: ItemCustomComponent}>} */
  const items = [];
  /** @type {CommandDefinition[]} */
  const commands = [];
  let installed = false;

  /** @type {Registrar} */
  const registrar = {
    block(id, handlers) {
      assertMutable(installed);
      blocks.push({ id: qualify(namespace, id), handlers });
      return registrar;
    },

    item(id, handlers) {
      assertMutable(installed);
      items.push({ id: qualify(namespace, id), handlers });
      return registrar;
    },

    command(definition) {
      assertMutable(installed);
      if (!definition || typeof definition.callback !== "function") {
        throw new TypeError("A command callback is required");
      }
      commands.push({ ...definition, name: qualify(namespace, definition.name) });
      return registrar;
    },

    install() {
      if (installed) return false;
      installed = true;

      system.beforeEvents.startup.subscribe((event) => {
        for (const { id, handlers } of blocks) {
          event.blockComponentRegistry.registerCustomComponent(id, handlers);
        }
        for (const { id, handlers } of items) {
          event.itemComponentRegistry.registerCustomComponent(id, handlers);
        }
        for (const command of commands) {
          installCommand(event.customCommandRegistry, command, namespace, onError);
        }
      });

      return true;
    },

    isInstalled() {
      return installed;
    },
  };

  return registrar;
}

/**
 * Registers a block component in DoriosLib's shared registry.
 * The identifier must include its namespace.
 *
 * @param {string} id
 * @param {BlockCustomComponent} handlers
 */
export function blockComponent(id, handlers) {
  assertSharedMutable();
  const namespace = getIdentifierNamespace(id);
  getSharedRegistrar(namespace).block(id, handlers);
}

/**
 * Registers an item component in DoriosLib's shared registry.
 * The identifier must include its namespace.
 *
 * @param {string} id
 * @param {ItemCustomComponent} handlers
 */
export function itemComponent(id, handlers) {
  assertSharedMutable();
  const namespace = getIdentifierNamespace(id);
  getSharedRegistrar(namespace).item(id, handlers);
}

/**
 * Registers a custom command in DoriosLib's shared registry.
 * The command name must include its namespace.
 *
 * @param {CommandDefinition} definition
 */
export function customCommand(definition) {
  assertSharedMutable();
  const namespace = getIdentifierNamespace(definition?.name);
  getSharedRegistrar(namespace).command(definition);
}

/**
 * Installs every namespace collected by the shared registry.
 * Call once after all feature modules have been evaluated.
 *
 * @returns {boolean} Whether the registry was installed now.
 */
export function install() {
  if (sharedRegistryInstalled) return false;
  sharedRegistryInstalled = true;
  for (const registrar of sharedRegistrars.values()) registrar.install();
  return true;
}

/** @param {string} namespace */
function getSharedRegistrar(namespace) {
  let registrar = sharedRegistrars.get(namespace);
  if (!registrar) {
    registrar = createRegistrar(namespace);
    sharedRegistrars.set(namespace, registrar);
  }
  return registrar;
}

/** @param {string} id */
function getIdentifierNamespace(id) {
  const separator = typeof id === "string" ? id.indexOf(":") : -1;
  if (separator <= 0 || separator === id.length - 1) {
    throw new TypeError(`A fully qualified identifier is required: ${id}`);
  }
  return validateNamespace(id.slice(0, separator));
}

function assertSharedMutable() {
  if (sharedRegistryInstalled) {
    throw new Error("Cannot add definitions after DoriosLib.registry.install()");
  }
}

/**
 * @param {import("@minecraft/server").CustomCommandRegistry} registry
 * @param {CommandDefinition} command
 * @param {string} namespace
 * @param {(error: unknown, context: string) => void} onError
 */
function installCommand(registry, command, namespace, onError) {
  /** @type {import("@minecraft/server").CustomCommandParameter[]} */
  const mandatoryParameters = [];
  /** @type {import("@minecraft/server").CustomCommandParameter[]} */
  const optionalParameters = [];

  for (const parameter of command.parameters ?? []) {
    const target = parameter.optional ? optionalParameters : mandatoryParameters;

    if (parameter.type === "enum") {
      if (!Array.isArray(parameter.values) || parameter.values.length === 0) {
        throw new TypeError(`Enum parameter ${parameter.name} requires values`);
      }
      const enumName = `${namespace}:${localName(command.name)}_${parameter.name}`;
      registry.registerEnum(enumName, parameter.values);
      target.push({ name: enumName, type: CustomCommandParamType.Enum });
      continue;
    }

    const type = PARAMETER_TYPES[parameter.type];
    if (!type) throw new RangeError(`Unknown command parameter type: ${parameter.type}`);
    target.push({ name: parameter.name, type });
  }

  const permissionLevel = typeof command.permissionLevel === "number"
    ? command.permissionLevel
    : PERMISSION_LEVELS[command.permissionLevel ?? "any"];

  /** @type {import("@minecraft/server").CustomCommand} */
  const definition = {
    name: command.name,
    description: command.description ?? "",
    permissionLevel,
    cheatsRequired: command.cheatsRequired ?? false,
    ...(mandatoryParameters.length > 0 ? { mandatoryParameters } : {}),
    ...(optionalParameters.length > 0 ? { optionalParameters } : {}),
  };

  registry.registerCommand(definition, (origin, ...args) => {
    system.run(() => {
      try {
        command.callback(origin, ...args);
      } catch (error) {
        onError(error, `command:${command.name}`);
      }
    });
  });
}

/** @param {string} namespace */
function validateNamespace(namespace) {
  if (!/^[a-z0-9_.-]+$/.test(namespace)) {
    throw new TypeError(`Invalid namespace: ${namespace}`);
  }
  return namespace;
}

/**
 * @param {string} namespace
 * @param {string} id
 */
function qualify(namespace, id) {
  if (!id || typeof id !== "string") throw new TypeError("A non-empty identifier is required");
  if (!id.includes(":")) return `${namespace}:${id}`;
  if (!id.startsWith(`${namespace}:`)) {
    throw new RangeError(`Identifier ${id} does not belong to namespace ${namespace}`);
  }
  return id;
}

/** @param {string} id */
function localName(id) {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}

/** @param {boolean} installed */
function assertMutable(installed) {
  if (installed) throw new Error("Cannot add definitions after registrar.install()");
}

/**
 * @param {unknown} error
 * @param {string} context
 */
function defaultErrorHandler(error, context) {
  console.warn(`[DoriosLib:${context}]`, error);
}

// @ts-check

import {
  CommandPermissionLevel,
  CustomCommandParamType,
  system,
} from "@minecraft/server";
import {
  COMMAND_PARAMETER_TYPES,
  PERMISSION_LEVELS,
} from "../constants/index.js";

export { COMMAND_PARAMETER_TYPES, PERMISSION_LEVELS };

/** Alias kept for concise command-definition terminology. */
export const PARAMETER_TYPES = COMMAND_PARAMETER_TYPES;

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

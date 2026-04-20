/**
 * Public entry point for the DoriosCore multiblock library.
 *
 * Re-exports the main facade and controller runtime class, and loads the global
 * listeners as a side effect.
 */
import * as Constants from "./constants.js";
import { ActivationManager } from "./activationManager.js";
import { DeactivationManager } from "./deactivationManager.js";
import { EntityManager } from "./entityManager.js";
import { StructureDetector } from "./structureDetection.js";

export const Multiblock = {
  Constants,
  ActivationManager,
  DeactivationManager,
  EntityManager,
  StructureDetector,
};

export { MultiblockMachine } from "./multiblockMachine.js";
export { MultiblockGenerator } from "./multiblockGenerator.js";

import "./listeners.js";

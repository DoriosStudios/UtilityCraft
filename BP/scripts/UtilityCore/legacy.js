// @ts-check

import { networkRegistrar } from "./networks/shared.js";

/**
 * Legacy custom components kept registered for existing block definitions.
 * They intentionally provide no behavior; the current systems do not use them.
 */
networkRegistrar.block("special_container", {});

import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import {
  PROVIDER_CAPABILITIES,
  projectRuntimeSurfaces,
} from "../capability-declarations.js";

/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export const OPENCODE_RUNTIME_SUPPORT = Object.freeze(
  projectRuntimeSurfaces(PROVIDER_CAPABILITIES.opencode),
) satisfies RuntimeCapabilities["supports"];

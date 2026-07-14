import { createRuntimeProviderRegistry } from "../core/runtime/providers/registry.js";
import type { RuntimeProviderRegistry } from "../core/runtime/providers/types.js";
import { HERMES_PROVIDER_MODULE } from "./hermes/provider-module.js";
import { OPENCLAW_PROVIDER_MODULE } from "./openclaw/provider-module.js";

export function createBuiltInRuntimeProviderRegistry(): RuntimeProviderRegistry {
  return createRuntimeProviderRegistry({
    modules: [HERMES_PROVIDER_MODULE, OPENCLAW_PROVIDER_MODULE],
  });
}

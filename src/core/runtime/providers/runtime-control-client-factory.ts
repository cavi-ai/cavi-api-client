import {
  createUnavailableRuntimeControlClient,
  type RuntimeControlClient,
} from "../control-plane/runtime-control-client.js";
import { normalizeRuntimeProviderToken } from "./normalize.js";
import type { RuntimeControlClientOptions, RuntimeProviderModule } from "./types.js";

function declaredCapabilities(module: RuntimeProviderModule | null): ReadonlySet<string> {
  return new Set(
    Object.entries(module?.capabilities ?? {})
      .filter(([, supported]) => supported === true)
      .map(([capability]) => capability),
  );
}

export async function createRuntimeControlClient(
  provider: string,
  options: RuntimeControlClientOptions = {},
): Promise<RuntimeControlClient> {
  const module = options.registry?.resolveProvider(provider) ?? null;
  if (module?.createRuntimeControlClient) {
    return module.createRuntimeControlClient(options);
  }

  const providerId = module?.kind ?? normalizeRuntimeProviderToken(provider) ?? provider;
  return createUnavailableRuntimeControlClient(providerId, declaredCapabilities(module));
}

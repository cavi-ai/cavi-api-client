import {
  createUnavailableCanonicalControlPlane,
  type CanonicalRuntimeControlPlane,
} from "../control-plane/canonical.js";
import { normalizeRuntimeProviderToken } from "./normalize.js";
import type { CanonicalControlPlaneFactoryOptions, RuntimeProviderModule } from "./types.js";

function declaredCapabilities(module: RuntimeProviderModule | null): ReadonlySet<string> {
  return new Set(
    Object.entries(module?.capabilities ?? {})
      .filter(([, supported]) => supported === true)
      .map(([capability]) => capability),
  );
}

export async function createRuntimeControlPlane(
  provider: string,
  options: CanonicalControlPlaneFactoryOptions = {},
): Promise<CanonicalRuntimeControlPlane> {
  const module = options.registry?.resolveProvider(provider) ?? null;
  if (module?.createCanonicalControlPlane) {
    return module.createCanonicalControlPlane(options);
  }

  const providerId = module?.kind ?? normalizeRuntimeProviderToken(provider) ?? provider;
  return createUnavailableCanonicalControlPlane(providerId, declaredCapabilities(module));
}

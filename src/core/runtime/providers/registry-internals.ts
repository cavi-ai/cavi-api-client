import { invalidConfigError } from "../../error-factories.js";
import type { CreateRuntimeProviderRegistryOptions, RuntimeProviderModule, RuntimeProviderRegistry } from "./types.js";

export function createRegistry<M extends RuntimeProviderModule>(
  options: CreateRuntimeProviderRegistryOptions<M>,
  normalize: (value: string | null | undefined) => string | null,
): RuntimeProviderRegistry<M> {
  const modules = [...(options.modules ?? [])];
  const byKey = new Map<string, M>();
  for (const module of modules) {
    const keys = new Set([module.kind, ...(module.aliases ?? [])].map(normalize).filter((key): key is string => key !== null));
    for (const key of keys) {
      if (byKey.has(key) && options.allowOverrides !== true) {
        throw invalidConfigError(`Duplicate provider key "${key}"`);
      }
      byKey.set(key, module);
    }
  }
  return {
    resolveProvider(provider) {
      const normalized = normalize(provider);
      return normalized ? byKey.get(normalized) ?? null : null;
    },
    listProviders() { return [...modules]; },
  };
}

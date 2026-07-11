import { normalizeRuntimeProviderToken } from "./normalize.js";
import type {
  CreateRuntimeProviderRegistryOptions,
  RuntimeProviderModule,
  RuntimeProviderRegistry,
} from "./types.js";

function providerModuleKeys(module: RuntimeProviderModule): readonly string[] {
  const keys = new Set<string>();
  for (const key of [module.kind, ...(module.aliases ?? [])]) {
    const normalized = normalizeRuntimeProviderToken(key);
    if (normalized) keys.add(normalized);
  }
  return [...keys];
}

export function createProviderRegistry<M extends RuntimeProviderModule>(
  options: CreateRuntimeProviderRegistryOptions<M> = {},
): RuntimeProviderRegistry<M> {
  const modules = [...(options.modules ?? [])];
  const byKey = new Map<string, M>();
  for (const module of modules) {
    for (const key of providerModuleKeys(module)) {
      if (byKey.has(key) && options.allowOverrides !== true) {
        throw new Error(`Duplicate provider key "${key}"`);
      }
      byKey.set(key, module);
    }
  }
  return {
    resolveProvider(provider) {
      const normalized = normalizeRuntimeProviderToken(provider);
      return normalized ? (byKey.get(normalized) ?? null) : null;
    },
    listProviders() {
      return [...modules];
    },
  };
}

export function createRuntimeProviderRegistry(
  options: CreateRuntimeProviderRegistryOptions = {},
): RuntimeProviderRegistry {
  return createProviderRegistry(options);
}

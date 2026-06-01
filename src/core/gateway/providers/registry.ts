import { normalizeGatewayProviderToken } from "./normalize.js";
import {
  GATEWAY_PROVIDER_ENV_KEYS,
  type CreateGatewayProviderRegistryOptions,
  type CreateProviderRegistryOptions,
  type GatewayProviderModule,
  type GatewayProviderRegistry,
  type ProviderRegistry,
  type ResolveGatewayProviderOptions,
  type RuntimeProviderModule,
} from "./types.js";

function providerModuleKeys(module: RuntimeProviderModule): readonly string[] {
  const keys = new Set<string>();
  for (const key of [module.kind, ...(module.aliases ?? [])]) {
    const normalized = normalizeGatewayProviderToken(key);
    if (normalized) {
      keys.add(normalized);
    }
  }
  return [...keys];
}

export function createProviderRegistry<M extends RuntimeProviderModule>(
  options: CreateProviderRegistryOptions<M> = {},
): ProviderRegistry<M> {
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
      const normalized = normalizeGatewayProviderToken(provider);
      return normalized ? (byKey.get(normalized) ?? null) : null;
    },
    listProviders() {
      return [...modules];
    },
  };
}

export function createGatewayProviderRegistry(
  options: CreateGatewayProviderRegistryOptions = {},
): GatewayProviderRegistry {
  return createProviderRegistry<GatewayProviderModule>(options);
}

export function createRuntimeProviderRegistry(
  options: CreateProviderRegistryOptions<RuntimeProviderModule> = {},
): ProviderRegistry<RuntimeProviderModule> {
  return createProviderRegistry<RuntimeProviderModule>(options);
}

function gatewayProviderRegistryFromOptions(
  options: ResolveGatewayProviderOptions,
): GatewayProviderRegistry {
  const providerModules = options.providerModules ?? [];
  if (options.registry && providerModules.length === 0) {
    return options.registry;
  }
  if (options.registry) {
    return createGatewayProviderRegistry({
      modules: [...options.registry.listProviders(), ...providerModules],
      allowOverrides: options.allowProviderOverrides,
    });
  }
  return createGatewayProviderRegistry({
    modules: providerModules,
    allowOverrides: options.allowProviderOverrides,
  });
}

export function requestedGatewayProvider(
  options: ResolveGatewayProviderOptions,
): string | null {
  const explicit = options.provider?.trim();
  if (explicit) return explicit;

  for (const key of GATEWAY_PROVIDER_ENV_KEYS) {
    const fromEnv = options.env?.[key]?.trim();
    if (fromEnv) return fromEnv;
  }

  return options.defaultProvider?.trim() || null;
}

export function resolveGatewayProviderModule(
  options: ResolveGatewayProviderOptions = {},
): GatewayProviderModule | null {
  const requested = requestedGatewayProvider(options);
  if (!requested || isGenericGatewayProviderToken(requested)) {
    return null;
  }
  const registry = gatewayProviderRegistryFromOptions(options);
  const provider = registry.resolveProvider(requested);
  if (!provider) {
    throw new Error(`Unknown gateway provider "${requested}"`);
  }
  return provider;
}

function isGenericGatewayProviderToken(provider: string): boolean {
  const normalized = normalizeGatewayProviderToken(provider);
  return normalized === "gateway" || normalized === "generic" || normalized === "core";
}

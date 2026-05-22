import { BUILT_IN_GATEWAY_PROVIDER_MODULES } from "./built-ins.js";
import { normalizeGatewayProviderToken } from "./normalize.js";
import {
  GATEWAY_PROVIDER_ENV_KEYS,
  type CreateGatewayProviderRegistryOptions,
  type GatewayProviderModule,
  type GatewayProviderRegistry,
  type ResolveGatewayProviderOptions,
} from "./types.js";

function providerModuleKeys(module: GatewayProviderModule): readonly string[] {
  const keys = new Set<string>();
  for (const key of [module.kind, ...(module.aliases ?? [])]) {
    const normalized = normalizeGatewayProviderToken(key);
    if (normalized) {
      keys.add(normalized);
    }
  }
  return [...keys];
}

export function createGatewayProviderRegistry(
  options: CreateGatewayProviderRegistryOptions = {},
): GatewayProviderRegistry {
  const modules = [
    ...(options.includeBuiltIns === false ? [] : BUILT_IN_GATEWAY_PROVIDER_MODULES),
    ...(options.modules ?? []),
  ];
  const byKey = new Map<string, GatewayProviderModule>();
  for (const module of modules) {
    for (const key of providerModuleKeys(module)) {
      if (byKey.has(key) && options.allowOverrides !== true) {
        throw new Error(`Duplicate gateway provider key "${key}"`);
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

function gatewayProviderRegistryFromOptions(
  options: ResolveGatewayProviderOptions,
): GatewayProviderRegistry {
  const providerModules = options.providerModules ?? [];
  if (options.registry && providerModules.length === 0) {
    return options.registry;
  }
  if (options.registry) {
    return createGatewayProviderRegistry({
      includeBuiltIns: false,
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
): string {
  const explicit = options.provider?.trim();
  if (explicit) return explicit;

  for (const key of GATEWAY_PROVIDER_ENV_KEYS) {
    const fromEnv = options.env?.[key]?.trim();
    if (fromEnv) return fromEnv;
  }

  return options.defaultProvider ?? "gateway";
}

export function resolveGatewayProviderModule(
  options: ResolveGatewayProviderOptions = {},
): GatewayProviderModule {
  const requested = requestedGatewayProvider(options);
  const registry = gatewayProviderRegistryFromOptions(options);
  const provider = registry.resolveProvider(requested);
  if (!provider) {
    throw new Error(`Unknown gateway provider "${requested}"`);
  }
  return provider;
}

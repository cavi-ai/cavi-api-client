import { invalidConfigError } from "../../error-factories.js";
import { normalizeGatewayProviderToken } from "./normalize.js";
import { createRegistry } from "../../runtime/providers/registry-internals.js";
import {
  createRuntimeProviderRegistry as createUniversalRuntimeProviderRegistry,
} from "../../runtime/providers/registry.js";
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

export function createProviderRegistry<M extends RuntimeProviderModule>(
  options: CreateProviderRegistryOptions<M> = {},
): ProviderRegistry<M> {
  return createRegistry(options, normalizeGatewayProviderToken);
}

export function createGatewayProviderRegistry(
  options: CreateGatewayProviderRegistryOptions = {},
): GatewayProviderRegistry {
  return createProviderRegistry<GatewayProviderModule>(options);
}

export function createRuntimeProviderRegistry(
  options: CreateProviderRegistryOptions<RuntimeProviderModule> = {},
): ProviderRegistry<RuntimeProviderModule> {
  return createUniversalRuntimeProviderRegistry(options);
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
    throw invalidConfigError(`Unknown gateway provider "${requested}"`);
  }
  return provider;
}

function isGenericGatewayProviderToken(provider: string): boolean {
  const normalized = normalizeGatewayProviderToken(provider);
  return normalized === "gateway" || normalized === "generic" || normalized === "core";
}

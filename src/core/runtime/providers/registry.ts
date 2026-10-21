import { normalizeRuntimeProviderToken } from "./normalize.js";
import { createRegistry } from "./registry-internals.js";
import type {
  CreateRuntimeProviderRegistryOptions,
  RuntimeProviderModule,
  RuntimeProviderRegistry,
} from "./types.js";

export function createProviderRegistry<M extends RuntimeProviderModule>(
  options: CreateRuntimeProviderRegistryOptions<M> = {},
): RuntimeProviderRegistry<M> {
  return createRegistry(options, normalizeRuntimeProviderToken);
}

export function createRuntimeProviderRegistry(
  options: CreateRuntimeProviderRegistryOptions = {},
): RuntimeProviderRegistry {
  return createProviderRegistry(options);
}

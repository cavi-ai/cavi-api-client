import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { AgyApiClient, type AgyApiClientOptions } from "./client.js";
import { AGY_RUNTIME_SUPPORT } from "./capabilities.js";

export function createAgyProviderModule(
  config: AgyApiClientOptions = {},
): RuntimeProviderModule {
  const createClient: NonNullable<RuntimeProviderModule["createClient"]> = (clientOptions) =>
    new AgyApiClient({
      ...config,
      ...(clientOptions.baseUrl ? { baseUrl: clientOptions.baseUrl } : {}),
      ...(clientOptions.fetchImpl ? { fetchImpl: clientOptions.fetchImpl } : {}),
      ...(clientOptions.onTrace ? { onTrace: clientOptions.onTrace } : {}),
      ...(clientOptions.defaultTimeoutMs !== undefined
        ? { defaultTimeoutMs: clientOptions.defaultTimeoutMs }
        : {}),
      ...(clientOptions.cache !== undefined ? { cache: clientOptions.cache } : {}),
      ...(clientOptions.credentials !== undefined
        ? { credentials: clientOptions.credentials }
        : {}),
    });
  return {
    kind: "agy",
    aliases: ["antigravity"],
    capabilities: AGY_RUNTIME_SUPPORT,
    createClient,
    createApiClient: createClient,
  };
}

export const AGY_PROVIDER_MODULE = createAgyProviderModule();

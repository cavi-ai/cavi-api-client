import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import type { RuntimeClientOptions } from "../../core/runtime/providers/types.js";
import { OpenCodeApiClient, type OpenCodeApiClientOptions } from "./client.js";
import { OPENCODE_RUNTIME_SUPPORT } from "./capabilities.js";

export type OpenCodeProviderModule = Omit<
  RuntimeProviderModule,
  "createClient" | "createApiClient"
> & {
  createClient: (clientOptions?: Partial<RuntimeClientOptions>) => OpenCodeApiClient;
  /** @deprecated Use createClient for new provider modules. */
  createApiClient: (clientOptions?: Partial<RuntimeClientOptions>) => OpenCodeApiClient;
};

export function createOpenCodeProviderModule(
  config: OpenCodeApiClientOptions,
): OpenCodeProviderModule {
  const createClient = (clientOptions: Partial<RuntimeClientOptions> = {}): OpenCodeApiClient =>
    new OpenCodeApiClient({
      ...config,
      ...(clientOptions.baseUrl !== undefined ? { baseUrl: clientOptions.baseUrl } : {}),
      ...(clientOptions.fetchImpl !== undefined ? { fetchImpl: clientOptions.fetchImpl } : {}),
      ...(clientOptions.onTrace !== undefined ? { onTrace: clientOptions.onTrace } : {}),
      ...(clientOptions.defaultTimeoutMs !== undefined
        ? { defaultTimeoutMs: clientOptions.defaultTimeoutMs }
        : {}),
      ...(clientOptions.cache !== undefined ? { cache: clientOptions.cache } : {}),
      ...(clientOptions.credentials !== undefined
        ? { credentials: clientOptions.credentials }
        : {}),
    });

  return {
    kind: "opencode",
    capabilities: OPENCODE_RUNTIME_SUPPORT,
    createClient,
    createApiClient: createClient,
  };
}

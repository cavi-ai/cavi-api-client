import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import type { RuntimeClientOptions } from "../../core/runtime/providers/types.js";
import { OPENCODE_RUNTIME_SUPPORT } from "./capabilities.js";
import { OpenCodeV2ApiClient, type OpenCodeV2ApiClientOptions } from "./v2-client.js";

/** Select v2 explicitly; the existing OpenCode factory retains its v1 contract. */
export function createOpenCodeV2ProviderModule(config: OpenCodeV2ApiClientOptions): RuntimeProviderModule {
  const createClient = (options: Partial<RuntimeClientOptions> = {}) => new OpenCodeV2ApiClient({
    ...config,
    ...Object.fromEntries(Object.entries(options).filter(([key, value]) => value !== undefined &&
      ["baseUrl", "fetchImpl", "onTrace", "defaultTimeoutMs", "cache", "credentials"].includes(key))),
  });
  return {
    kind: "opencode", capabilities: { ...OPENCODE_RUNTIME_SUPPORT, streaming: false },
    createClient, createApiClient: createClient,
  };
}

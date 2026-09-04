import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { GeminiApiClient, type GeminiApiClientOptions } from "./client.js";
import { GEMINI_RUNTIME_SUPPORT } from "./capabilities.js";

export function createGeminiProviderModule(
  config: GeminiApiClientOptions,
): RuntimeProviderModule {
  const createClient: NonNullable<RuntimeProviderModule["createClient"]> = (clientOptions) =>
    new GeminiApiClient({
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
    kind: "gemini",
    aliases: ["google", "google-gemini"],
    capabilities: GEMINI_RUNTIME_SUPPORT,
    createClient,
    createApiClient: createClient,
  };
}

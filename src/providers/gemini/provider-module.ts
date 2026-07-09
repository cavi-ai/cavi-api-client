import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { GeminiApiClient, type GeminiApiClientOptions } from "./client.js";

export function createGeminiProviderModule(
  config: GeminiApiClientOptions,
): RuntimeProviderModule {
  return {
    kind: "gemini",
    aliases: ["google", "google-gemini"],
    capabilities: { runs: true, streaming: true, batch: true },
    createApiClient: (clientOptions) =>
      new GeminiApiClient({
        ...config,
        ...(clientOptions.baseUrl ? { baseUrl: clientOptions.baseUrl } : {}),
        ...(clientOptions.fetchImpl ? { fetchImpl: clientOptions.fetchImpl } : {}),
        ...(clientOptions.onTrace ? { onTrace: clientOptions.onTrace } : {}),
      }),
  };
}

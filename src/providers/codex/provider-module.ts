import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { CodexApiClient, type CodexApiClientOptions } from "./client.js";

export function createCodexProviderModule(
  config: CodexApiClientOptions,
): RuntimeProviderModule {
  return {
    kind: "codex-responses",
    aliases: ["codex", "openai-codex"],
    capabilities: { runs: true, streaming: true },
    createApiClient: (clientOptions) =>
      new CodexApiClient({
        ...config,
        ...(clientOptions.baseUrl ? { baseUrl: clientOptions.baseUrl } : {}),
        ...(clientOptions.fetchImpl ? { fetchImpl: clientOptions.fetchImpl } : {}),
        ...(clientOptions.onTrace ? { onTrace: clientOptions.onTrace } : {}),
      }),
  };
}

import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { CodexApiClient, type CodexApiClientOptions } from "./client.js";
import { CODEX_RUNTIME_SUPPORT } from "./capabilities.js";

export function createCodexProviderModule(
  config: CodexApiClientOptions,
): RuntimeProviderModule {
  const createClient: NonNullable<RuntimeProviderModule["createClient"]> = (clientOptions) =>
    new CodexApiClient({
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
    kind: "codex-responses",
    aliases: ["codex", "openai-codex"],
    capabilities: CODEX_RUNTIME_SUPPORT,
    createClient,
    createApiClient: createClient,
  };
}

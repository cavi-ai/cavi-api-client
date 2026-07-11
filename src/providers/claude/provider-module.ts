import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { ClaudeApiClient, type ClaudeApiClientOptions } from "./client.js";

/**
 * Build the runtime-only Claude (Anthropic) provider module. The Anthropic API
 * key is captured here, so `createApiClient` needs no cast — the registry's
 * HttpApiClientOptions (baseUrl/fetchImpl/onTrace) merge over the captured
 * config. (Resolves spike finding F2b.)
 *
 * Claude is not a gateway — no teams, kanban, workspace, or WS-RPC. It
 * implements the universal RuntimeClient only and registers via
 * createRuntimeProviderRegistry (F2).
 */
export function createClaudeProviderModule(
  config: ClaudeApiClientOptions,
): RuntimeProviderModule {
  return {
    kind: "claude-sdk",
    aliases: ["claude", "anthropic"],
    capabilities: { runs: true, streaming: true, batch: true },
    createApiClient: (clientOptions) =>
      new ClaudeApiClient({
        ...config,
        ...(clientOptions.baseUrl ? { baseUrl: clientOptions.baseUrl } : {}),
        ...(clientOptions.fetchImpl ? { fetchImpl: clientOptions.fetchImpl } : {}),
        ...(clientOptions.onTrace ? { onTrace: clientOptions.onTrace } : {}),
      }),
  };
}

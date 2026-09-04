import type { RuntimeProviderModule } from "../../../core/gateway/providers/types.js";
import {
  ClaudeManagedAgentClient,
  type ClaudeManagedAgentClientOptions,
} from "./client.js";

/**
 * Build the Claude Managed Agents provider module — a runtime-only provider
 * (`kind: "claude-managed-agents"`) distinct from the stateless `claude-sdk`
 * Messages provider. The Anthropic API key + default agent/environment are
 * captured here; the registry's HttpApiClientOptions (baseUrl/fetchImpl/onTrace)
 * merge over them.
 *
 * Managed Agents sessions are stateful, so this provider advertises the same
 * `runs`/`streaming` surfaces but its client also serves getRun/cancelRun.
 */
export function createClaudeManagedAgentProviderModule(
  config: ClaudeManagedAgentClientOptions,
): RuntimeProviderModule {
  const createClient: NonNullable<RuntimeProviderModule["createClient"]> = (clientOptions) =>
    new ClaudeManagedAgentClient({
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
    kind: "claude-managed-agents",
    aliases: ["claude-agents", "claude-teams"],
    capabilities: { runs: true, streaming: true },
    createClient,
    createApiClient: createClient,
  };
}

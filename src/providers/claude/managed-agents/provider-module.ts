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
  return {
    kind: "claude-managed-agents",
    aliases: ["claude-agents", "claude-teams"],
    capabilities: { runs: true, streaming: true },
    createApiClient: (clientOptions) =>
      new ClaudeManagedAgentClient({
        ...config,
        ...(clientOptions.baseUrl ? { baseUrl: clientOptions.baseUrl } : {}),
        ...(clientOptions.fetchImpl ? { fetchImpl: clientOptions.fetchImpl } : {}),
        ...(clientOptions.onTrace ? { onTrace: clientOptions.onTrace } : {}),
      }),
  };
}

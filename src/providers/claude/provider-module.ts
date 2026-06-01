import type { RuntimeProviderModule } from "../../core/gateway/providers/types.js";
import { ClaudeApiClient, type ClaudeApiClientOptions } from "./client.js";

// Runtime-only provider: Claude (Anthropic) is not a gateway — no teams,
// kanban, workspace, or WS-RPC. It implements the universal RuntimeClient only.
// NOTE (F2): the current provider registry is GatewayProviderModule-typed, so
// this module is wired by hosts directly rather than via
// createGatewayProviderRegistry until the registry accepts RuntimeProviderModule.
export const CLAUDE_PROVIDER_MODULE: RuntimeProviderModule = {
  kind: "claude-sdk",
  aliases: ["claude", "anthropic"],
  capabilities: { runs: true, streaming: true },
  createApiClient: (clientOptions) =>
    new ClaudeApiClient(clientOptions as unknown as ClaudeApiClientOptions),
};

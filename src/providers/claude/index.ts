export { ClaudeApiClient, type ClaudeApiClientOptions } from "./client.js";
export { createClaudeProviderModule } from "./provider-module.js";
export { CLAUDE_RUNTIME_SUPPORT } from "./capabilities.js";
export { mapAnthropicStreamEvent, readAnthropicRunId } from "./stream.js";

// Managed Agents (beta) — stateful, streamable Claude runtime (sessions, agents,
// environments). Distinct from the stateless Messages-API client above.
export * from "./managed-agents/index.js";

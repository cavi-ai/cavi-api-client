// Path-owner file for the Claude (Anthropic) provider. API route literals live
// here per the package route-ownership contract (see AGENTS.md / hardening test).

export const CLAUDE_API_BASE_URL = "https://api.anthropic.com";

export const CLAUDE_API_ENDPOINTS = {
  messages: "/v1/messages",
  messageBatches: "/v1/messages/batches",
} as const;

export function claudeMessageBatchPath(batchId: string): string {
  return `${CLAUDE_API_ENDPOINTS.messageBatches}/${encodeURIComponent(batchId)}`;
}

export function claudeMessageBatchCancelPath(batchId: string): string {
  return `${claudeMessageBatchPath(batchId)}/cancel`;
}

export function claudeMessageBatchResultsPath(batchId: string): string {
  return `${claudeMessageBatchPath(batchId)}/results`;
}

export const CLAUDE_DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

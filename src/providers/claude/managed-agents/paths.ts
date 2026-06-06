// Path-owner file for the Claude (Anthropic) Managed Agents surface. API route
// literals live here per the package route-ownership contract (see AGENTS.md /
// the `keeps API route literals in path-owner files` hardening test).
//
// Managed Agents is a separate, beta Anthropic surface from `/v1/messages`:
// persisted Agent configs (`/v1/agents`), stateful Sessions (`/v1/sessions`),
// Environments (`/v1/environments`), and per-session SSE event streams. The SDK
// gates all of it behind the `managed-agents-2026-04-01` beta header.

/** Beta header value required on every Managed Agents request. */
export const CLAUDE_MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

/** Header name carrying the Managed Agents beta opt-in. */
export const CLAUDE_ANTHROPIC_BETA_HEADER = "anthropic-beta";

/** Collection endpoints (create/list). Resource-scoped paths use the helpers below. */
export const CLAUDE_MANAGED_AGENTS_ENDPOINTS = {
  agents: "/v1/agents",
  sessions: "/v1/sessions",
  environments: "/v1/environments",
  memoryStores: "/v1/memory_stores",
  vaults: "/v1/vaults",
} as const;

function segment(value: string, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`claude managed-agents: missing ${label}`);
  }
  if (trimmed === "." || trimmed === ".." || /[/?#\\]/u.test(trimmed)) {
    throw new Error(`claude managed-agents: invalid ${label}: ${trimmed}`);
  }
  return encodeURIComponent(trimmed);
}

/** `/v1/agents/{agentId}` — retrieve / update a persisted agent config. */
export function claudeAgentPath(agentId: string): string {
  return `/v1/agents/${segment(agentId, "agent id")}`;
}

/** `/v1/environments/{environmentId}` — retrieve / update an environment template. */
export function claudeEnvironmentPath(environmentId: string): string {
  return `/v1/environments/${segment(environmentId, "environment id")}`;
}

/** `/v1/sessions/{sessionId}` — retrieve / update a session. */
export function claudeSessionPath(sessionId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}`;
}

/** `/v1/sessions/{sessionId}/archive` — make a session read-only. */
export function claudeSessionArchivePath(sessionId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}/archive`;
}

/** `/v1/sessions/{sessionId}/events` — send events / list event history. */
export function claudeSessionEventsPath(sessionId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}/events`;
}

/** `/v1/sessions/{sessionId}/events/stream` — SSE event stream. */
export function claudeSessionEventStreamPath(sessionId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}/events/stream`;
}

// ── Multiagent threads ──────────────────────────────────────────────────────

/** `/v1/sessions/{sessionId}/threads` — list subagent threads. */
export function claudeSessionThreadsPath(sessionId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}/threads`;
}

/** `/v1/sessions/{sessionId}/threads/{threadId}` — retrieve one thread. */
export function claudeSessionThreadPath(sessionId: string, threadId: string): string {
  return `/v1/sessions/${segment(sessionId, "session id")}/threads/${segment(threadId, "thread id")}`;
}

/** `/v1/sessions/{sessionId}/threads/{threadId}/archive`. */
export function claudeSessionThreadArchivePath(sessionId: string, threadId: string): string {
  return `${claudeSessionThreadPath(sessionId, threadId)}/archive`;
}

/** `/v1/sessions/{sessionId}/threads/{threadId}/events` — list one thread's events. */
export function claudeSessionThreadEventsPath(sessionId: string, threadId: string): string {
  return `${claudeSessionThreadPath(sessionId, threadId)}/events`;
}

/** `/v1/sessions/{sessionId}/threads/{threadId}/stream` — one thread's SSE stream. */
export function claudeSessionThreadStreamPath(sessionId: string, threadId: string): string {
  return `${claudeSessionThreadPath(sessionId, threadId)}/stream`;
}

// ── Memory stores ───────────────────────────────────────────────────────────

/** `/v1/memory_stores/{storeId}`. */
export function claudeMemoryStorePath(storeId: string): string {
  return `/v1/memory_stores/${segment(storeId, "memory store id")}`;
}

/** `/v1/memory_stores/{storeId}/archive`. */
export function claudeMemoryStoreArchivePath(storeId: string): string {
  return `${claudeMemoryStorePath(storeId)}/archive`;
}

/** `/v1/memory_stores/{storeId}/memories`. */
export function claudeMemoriesPath(storeId: string): string {
  return `${claudeMemoryStorePath(storeId)}/memories`;
}

/** `/v1/memory_stores/{storeId}/memories/{memoryId}`. */
export function claudeMemoryPath(storeId: string, memoryId: string): string {
  return `${claudeMemoriesPath(storeId)}/${segment(memoryId, "memory id")}`;
}

/** `/v1/memory_stores/{storeId}/memory_versions`. */
export function claudeMemoryVersionsPath(storeId: string): string {
  return `${claudeMemoryStorePath(storeId)}/memory_versions`;
}

/** `/v1/memory_stores/{storeId}/memory_versions/{versionId}`. */
export function claudeMemoryVersionPath(storeId: string, versionId: string): string {
  return `${claudeMemoryVersionsPath(storeId)}/${segment(versionId, "memory version id")}`;
}

/** `/v1/memory_stores/{storeId}/memory_versions/{versionId}/redact`. */
export function claudeMemoryVersionRedactPath(storeId: string, versionId: string): string {
  return `${claudeMemoryVersionPath(storeId, versionId)}/redact`;
}

// ── Vaults & credentials (MCP credential store) ─────────────────────────────

/** `/v1/vaults/{vaultId}`. */
export function claudeVaultPath(vaultId: string): string {
  return `/v1/vaults/${segment(vaultId, "vault id")}`;
}

/** `/v1/vaults/{vaultId}/archive`. */
export function claudeVaultArchivePath(vaultId: string): string {
  return `${claudeVaultPath(vaultId)}/archive`;
}

/** `/v1/vaults/{vaultId}/credentials`. */
export function claudeVaultCredentialsPath(vaultId: string): string {
  return `${claudeVaultPath(vaultId)}/credentials`;
}

/** `/v1/vaults/{vaultId}/credentials/{credentialId}`. */
export function claudeVaultCredentialPath(vaultId: string, credentialId: string): string {
  return `${claudeVaultCredentialsPath(vaultId)}/${segment(credentialId, "credential id")}`;
}

/** `/v1/vaults/{vaultId}/credentials/{credentialId}/archive`. */
export function claudeVaultCredentialArchivePath(vaultId: string, credentialId: string): string {
  return `${claudeVaultCredentialPath(vaultId, credentialId)}/archive`;
}

/** `/v1/vaults/{vaultId}/credentials/{credentialId}/mcp_oauth_validate`. */
export function claudeVaultCredentialValidatePath(vaultId: string, credentialId: string): string {
  return `${claudeVaultCredentialPath(vaultId, credentialId)}/mcp_oauth_validate`;
}

// ── Self-hosted environment work queue ──────────────────────────────────────

/** `/v1/environments/{environmentId}/work/stats`. */
export function claudeEnvironmentWorkStatsPath(environmentId: string): string {
  return `${claudeEnvironmentPath(environmentId)}/work/stats`;
}

/** `/v1/environments/{environmentId}/work/{workId}/stop`. */
export function claudeEnvironmentWorkStopPath(environmentId: string, workId: string): string {
  return `${claudeEnvironmentPath(environmentId)}/work/${segment(workId, "work id")}/stop`;
}

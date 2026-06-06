import { BaseHttpApiClient } from "../../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../../core/http/types.js";
import { apiKeyCredentials, bearerCredentials } from "../../../core/http/credentials.js";
import { ApiClientError, ApiClientErrorCode } from "../../../core/errors.js";
import type { RuntimeClient } from "../../../core/runtime/client.js";
import type {
  RuntimeRunInput,
  RuntimeRunStartBody,
  RuntimeRunState,
  RuntimeRunStatus,
} from "../../../core/runtime/run.js";
import type { RuntimeCapabilities } from "../../../core/runtime/capabilities.js";
import type { RunEventStreamHandlers } from "../../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../../core/sse/index.js";
import { CLAUDE_API_BASE_URL, CLAUDE_DEFAULT_ANTHROPIC_VERSION } from "../paths.js";
import {
  CLAUDE_ANTHROPIC_BETA_HEADER,
  CLAUDE_MANAGED_AGENTS_BETA,
  CLAUDE_MANAGED_AGENTS_ENDPOINTS,
  claudeAgentPath,
  claudeEnvironmentPath,
  claudeMemoriesPath,
  claudeMemoryPath,
  claudeMemoryStorePath,
  claudeMemoryStoreArchivePath,
  claudeMemoryVersionPath,
  claudeMemoryVersionRedactPath,
  claudeMemoryVersionsPath,
  claudeSessionArchivePath,
  claudeSessionEventStreamPath,
  claudeSessionEventsPath,
  claudeSessionPath,
  claudeSessionThreadArchivePath,
  claudeSessionThreadEventsPath,
  claudeSessionThreadPath,
  claudeSessionThreadStreamPath,
  claudeSessionThreadsPath,
  claudeVaultArchivePath,
  claudeVaultCredentialArchivePath,
  claudeVaultCredentialPath,
  claudeVaultCredentialValidatePath,
  claudeVaultCredentialsPath,
  claudeVaultPath,
  claudeEnvironmentWorkStatsPath,
  claudeEnvironmentWorkStopPath,
} from "./paths.js";
import { appendHttpQuery } from "../../../contracts/paths.js";
import { isTerminalRunStreamEvent, mapManagedAgentStreamEvent } from "./stream.js";

/**
 * Connect timeout (time-to-first-byte) for opening an SSE stream. BaseHttpApiClient
 * clears its request timeout once response headers arrive, so this bounds only the
 * connection — body streaming runs until a terminal event or caller abort.
 */
const DEFAULT_STREAM_TIMEOUT_MS = 600_000;

export type ClaudeManagedAgentClientOptions = {
  /** Developer Platform API key — sent as `x-api-key`. Provide this or `authToken`. */
  apiKey?: string;
  /**
   * OAuth / long-term bearer token (e.g. a Claude subscription token) — sent as
   * `Authorization: Bearer`. Takes precedence over `apiKey`. Provide one of the two.
   */
  authToken?: string;
  /**
   * Default persisted agent to reference when a run does not name one. Managed
   * Agents requires an agent created out-of-band (`agents.create`, the `ant`
   * CLI, or option B's manifest provisioner) — its id is referenced here.
   */
  agentId?: string;
  /** Default environment (container template) to provision sessions in. */
  environmentId?: string;
  anthropicVersion?: string;
  /** Timeout (ms) for unary control-plane / session calls. Defaults to 60s — agent/session create can be slow. */
  defaultTimeoutMs?: number;
  /** SSE connect timeout (time-to-first-byte, ms). Defaults to 10 minutes; does not cap stream duration. */
  streamTimeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
};

export type ManagedAgentSession = {
  id: string;
  status?: string;
  model?: string;
  usage?: Record<string, number>;
  [key: string]: unknown;
};

export type ManagedAgentEvent = Record<string, unknown>;

export type ManagedAgentAgent = {
  id: string;
  version?: number;
  name?: string;
  [key: string]: unknown;
};

export type ManagedAgentEnvironment = {
  id: string;
  name?: string;
  [key: string]: unknown;
};

/** Persisted agent config (`agents.create`/`update`). `model`/`system`/`tools` live here, never on a session. */
export type CreateManagedAgentParams = {
  name: string;
  model: string;
  system?: string;
  description?: string;
  tools?: readonly Record<string, unknown>[];
  mcpServers?: readonly Record<string, unknown>[];
  skills?: readonly Record<string, unknown>[];
  multiagent?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateManagedAgentEnvironmentParams = {
  name: string;
  config?: Record<string, unknown>;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type CreateManagedAgentSessionParams = {
  agentId: string;
  environmentId: string;
  title?: string;
  resources?: readonly Record<string, unknown>[];
  vaultIds?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type ConfirmToolParams = {
  /** The `agent.tool_use` event `id` (`sevt_…`). */
  toolUseId: string;
  result: "allow" | "deny";
  /** Optional reason surfaced to the agent on a deny. */
  denyMessage?: string;
  /** Echo the originating subagent thread id when the request was cross-posted. */
  sessionThreadId?: string;
};

export type RespondCustomToolParams = {
  /** The `agent.custom_tool_use` event `id` (`sevt_…`). */
  toolUseId: string;
  content: readonly Record<string, unknown>[];
  isError?: boolean;
  /** Echo the originating subagent thread id when the request was cross-posted. */
  sessionThreadId?: string;
};

export type ManagedAgentRubric =
  | { type: "text"; content: string }
  | { type: "file"; file_id: string };

export type DefineOutcomeParams = {
  /** The task the agent works toward (no separate kickoff message needed). */
  description: string;
  rubric: ManagedAgentRubric;
  /** Default 3, max 20. */
  maxIterations?: number;
};

export type ManagedAgentThread = {
  id: string;
  status?: string;
  parent_thread_id?: string | null;
  agent?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ManagedAgentMemoryStore = {
  id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
};

export type ManagedAgentMemory = {
  id: string;
  path?: string;
  content?: string;
  content_sha256?: string;
  memory_version_id?: string;
  [key: string]: unknown;
};

export type ManagedAgentMemoryVersion = {
  id: string;
  memory_id?: string;
  operation?: string;
  [key: string]: unknown;
};

export type CreateMemoryStoreParams = {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type CreateMemoryParams = {
  path: string;
  content: string;
};

export type UpdateMemoryParams = {
  content?: string;
  path?: string;
  precondition?: { type: "content_sha256"; content_sha256: string };
};

export type ListMemoriesParams = {
  pathPrefix?: string;
  depth?: number;
  view?: "basic" | "full";
};

export type ManagedAgentVault = {
  id: string;
  display_name?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ManagedAgentCredential = {
  id: string;
  display_name?: string;
  [key: string]: unknown;
};

/** How Anthropic authenticates the OAuth refresh call. */
export type ManagedAgentTokenEndpointAuth =
  | { type: "none" }
  | { type: "client_secret_basic"; client_secret: string }
  | { type: "client_secret_post"; client_secret: string };

export type ManagedAgentCredentialAuth =
  | {
      type: "mcp_oauth";
      mcp_server_url: string;
      access_token: string;
      expires_at?: string;
      refresh?: {
        token_endpoint: string;
        client_id: string;
        scope?: string;
        refresh_token: string;
        token_endpoint_auth: ManagedAgentTokenEndpointAuth;
      };
    }
  | { type: "static_bearer"; mcp_server_url: string; token: string };

export type CreateVaultParams = {
  displayName: string;
  metadata?: Record<string, unknown>;
};

export type UpdateVaultParams = {
  displayName?: string;
  metadata?: Record<string, unknown>;
};

export type CreateCredentialParams = {
  displayName?: string;
  auth: ManagedAgentCredentialAuth;
};

/** Rotate a credential — only the secret payload + a few metadata fields are mutable. */
export type UpdateCredentialParams = {
  displayName?: string;
  auth?: Record<string, unknown>;
};

export type ManagedAgentWorkQueueStats = {
  type?: string;
  depth?: number;
  pending?: number;
  oldest_queued_at?: string | null;
  workers_polling?: number;
  [key: string]: unknown;
};

type TextBlock = { type: "text"; text: string };

/** Map a Managed Agents session status to a canonical RuntimeRunState. */
function mapSessionStatus(status: string | undefined): RuntimeRunState {
  switch (status) {
    case "running":
    case "rescheduling":
      return "running";
    case "idle":
    case "terminated":
      return "completed";
    default:
      return (status ?? "running") as RuntimeRunState;
  }
}

/** Build the user.message content blocks for a kickoff from a RuntimeRunInput. */
function kickoffContent(input: RuntimeRunInput): TextBlock[] {
  if (typeof input === "string") return [{ type: "text", text: input }];
  const parts: string[] = [];
  for (const message of input) {
    if (typeof message.content === "string") {
      parts.push(message.content);
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        const text = (block as { text?: unknown }).text;
        if (typeof text === "string") parts.push(text);
      }
    }
  }
  return [{ type: "text", text: parts.join("\n") }];
}

/** Default cloud environment config when a caller does not supply one. */
const DEFAULT_ENVIRONMENT_CONFIG = {
  type: "cloud",
  networking: { type: "unrestricted" },
} as const;

/** Build the wire body for agents.create / agents.update from typed params. */
function buildAgentBody(params: CreateManagedAgentParams): Record<string, unknown> {
  const body: Record<string, unknown> = { name: params.name, model: params.model };
  if (params.system) body.system = params.system;
  if (params.description) body.description = params.description;
  if (params.tools?.length) body.tools = params.tools;
  if (params.mcpServers?.length) body.mcp_servers = params.mcpServers;
  if (params.skills?.length) body.skills = params.skills;
  if (params.multiagent) body.multiagent = params.multiagent;
  if (params.metadata) body.metadata = params.metadata;
  return body;
}

/**
 * Claude (Anthropic) Managed Agents runtime client. A SECOND Claude runtime that
 * sits alongside `ClaudeApiClient` — not an edit to it. Where the stateless
 * Messages-API client cannot serve `getRun`/`cancelRun`, a Managed Agents
 * session is stateful, resumable, and streamable, so this client implements the
 * full RuntimeClient contract.
 *
 * Mandatory Managed Agents flow: an Agent (persisted, created once) and an
 * Environment must already exist; every run is a Session that references them by
 * id. Pass `agentId`/`environmentId` as defaults or per-run via
 * `body.metadata.agent_id` / `body.metadata.environment_id`. `body.model` and
 * `body.instructions` are NOT applied here — model and system prompt live on the
 * agent object (provision them via option B / the `ant` CLI).
 *
 * Scope (option A slice): session create + kickoff + stateful poll/cancel + the
 * happy-path event stream (messages, tool calls, completion, error). NOT yet
 * handled: lossless stream reconnect/dedupe, `tool_confirmation` round-trips, and
 * `custom_tool_result` replies (see shared Managed Agents client patterns).
 */
export class ClaudeManagedAgentClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly agentId?: string;
  private readonly environmentId?: string;
  private readonly streamTimeoutMs: number;
  private readonly betaVersion: string;

  constructor(options: ClaudeManagedAgentClientOptions) {
    const version = options.anthropicVersion?.trim() || CLAUDE_DEFAULT_ANTHROPIC_VERSION;
    const authToken = options.authToken?.trim();
    const apiKey = options.apiKey?.trim();
    if (!authToken && !apiKey) {
      throw new ApiClientError(
        "claude managed-agents: an apiKey or authToken is required",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
    super("claude-managed-agents", {
      baseUrl: options.baseUrl?.trim() || CLAUDE_API_BASE_URL,
      defaultHeaders: {
        "anthropic-version": version,
        [CLAUDE_ANTHROPIC_BETA_HEADER]: CLAUDE_MANAGED_AGENTS_BETA,
      },
      includePortalClientIdHeader: false,
      auth: {
        resolveHeaders: authToken
          ? bearerCredentials(authToken)
          : apiKeyCredentials(apiKey ?? "", { header: "x-api-key" }),
      },
      defaultTimeoutMs: options.defaultTimeoutMs ?? 60_000,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.agentId = options.agentId;
    this.environmentId = options.environmentId;
    this.streamTimeoutMs = options.streamTimeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
    this.betaVersion = CLAUDE_MANAGED_AGENTS_BETA;
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "claude-managed-agents",
      protocolVersion: this.betaVersion,
      auth: { type: "api-key", required: true },
      supports: { runs: true, streaming: true },
    };
  }

  // ── Control plane: agents & environments (create once, reuse) ─────────────

  /** Create a persisted, versioned agent config. Store the returned id + version. */
  async createAgent(params: CreateManagedAgentParams): Promise<ManagedAgentAgent> {
    return this.request<ManagedAgentAgent>(CLAUDE_MANAGED_AGENTS_ENDPOINTS.agents, {
      method: "POST",
      body: buildAgentBody(params),
    });
  }

  /** Update an agent in place — each update creates a new immutable version. */
  async updateAgent(
    agentId: string,
    params: CreateManagedAgentParams,
  ): Promise<ManagedAgentAgent> {
    return this.request<ManagedAgentAgent>(claudeAgentPath(agentId), {
      method: "POST",
      body: buildAgentBody(params),
    });
  }

  /** Retrieve an agent config (and its current latest `version`). */
  async getAgent(agentId: string): Promise<ManagedAgentAgent> {
    return this.request<ManagedAgentAgent>(claudeAgentPath(agentId), { method: "GET" });
  }

  /** Create a reusable environment (container template). Defaults to cloud/unrestricted. */
  async createEnvironment(
    params: CreateManagedAgentEnvironmentParams,
  ): Promise<ManagedAgentEnvironment> {
    const body: Record<string, unknown> = {
      name: params.name,
      config: params.config ?? DEFAULT_ENVIRONMENT_CONFIG,
    };
    if (params.description) body.description = params.description;
    if (params.metadata) body.metadata = params.metadata;
    return this.request<ManagedAgentEnvironment>(
      CLAUDE_MANAGED_AGENTS_ENDPOINTS.environments,
      { method: "POST", body },
    );
  }

  /** Retrieve an environment. */
  async getEnvironment(environmentId: string): Promise<ManagedAgentEnvironment> {
    return this.request<ManagedAgentEnvironment>(claudeEnvironmentPath(environmentId), {
      method: "GET",
    });
  }

  // ── Low-level session operations ──────────────────────────────────────────

  /** Create a stateful session referencing a pre-created agent + environment. */
  async createSession(
    params: CreateManagedAgentSessionParams,
  ): Promise<ManagedAgentSession> {
    const body: Record<string, unknown> = {
      agent: params.agentId,
      environment_id: params.environmentId,
    };
    if (params.title) body.title = params.title;
    if (params.resources?.length) body.resources = params.resources;
    if (params.vaultIds?.length) body.vault_ids = params.vaultIds;
    if (params.metadata) body.metadata = params.metadata;
    return this.request<ManagedAgentSession>(CLAUDE_MANAGED_AGENTS_ENDPOINTS.sessions, {
      method: "POST",
      body,
    });
  }

  /** Retrieve a session — the stateful read the Messages API cannot provide. */
  async getSession(sessionId: string): Promise<ManagedAgentSession> {
    return this.request<ManagedAgentSession>(claudeSessionPath(sessionId), { method: "GET" });
  }

  /** Send one or more events (user.message, user.interrupt, tool results) to a session. */
  async sendEvents(
    sessionId: string,
    events: readonly ManagedAgentEvent[],
  ): Promise<void> {
    await this.request(claudeSessionEventsPath(sessionId), {
      method: "POST",
      body: { events },
    });
  }

  /** Convenience: send a user.message with text content. */
  async sendMessage(sessionId: string, input: RuntimeRunInput): Promise<void> {
    await this.sendEvents(sessionId, [
      { type: "user.message", content: kickoffContent(input) },
    ]);
  }

  /** Interrupt a running session — the graceful "stop this run" signal. */
  async interruptSession(sessionId: string): Promise<void> {
    await this.sendEvents(sessionId, [{ type: "user.interrupt" }]);
  }

  /** Archive a session (permanent — makes it read-only). */
  async archiveSession(sessionId: string): Promise<ManagedAgentSession> {
    return this.request<ManagedAgentSession>(claudeSessionArchivePath(sessionId), {
      method: "POST",
    });
  }

  /** List a session's event history (for lossless reconnect / dedupe). */
  async listEvents(sessionId: string): Promise<ManagedAgentEvent[]> {
    const res = await this.request<{ data?: ManagedAgentEvent[] }>(
      claudeSessionEventsPath(sessionId),
      { method: "GET" },
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  /** Answer an `always_ask` tool call. Wire shape verified live: `tool_use_id` + `result`. */
  async confirmTool(sessionId: string, params: ConfirmToolParams): Promise<void> {
    await this.sendEvents(sessionId, [
      {
        type: "user.tool_confirmation",
        tool_use_id: params.toolUseId,
        result: params.result,
        ...(params.denyMessage ? { deny_message: params.denyMessage } : {}),
        ...(params.sessionThreadId ? { session_thread_id: params.sessionThreadId } : {}),
      },
    ]);
  }

  /** Answer a custom tool call. Wire shape verified live: `custom_tool_use_id` + `content`. */
  async respondCustomTool(sessionId: string, params: RespondCustomToolParams): Promise<void> {
    await this.sendEvents(sessionId, [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: params.toolUseId,
        content: params.content,
        ...(params.isError ? { is_error: true } : {}),
        ...(params.sessionThreadId ? { session_thread_id: params.sessionThreadId } : {}),
      },
    ]);
  }

  /**
   * Start a rubric-graded outcome on a session: send `user.define_outcome` and the
   * harness runs iterate → grade → revise until satisfied / max_iterations / failed.
   * Do NOT also send a `user.message` — the description IS the task.
   */
  async defineOutcome(sessionId: string, params: DefineOutcomeParams): Promise<void> {
    await this.sendEvents(sessionId, [
      {
        type: "user.define_outcome",
        description: params.description,
        rubric: params.rubric,
        ...(typeof params.maxIterations === "number"
          ? { max_iterations: params.maxIterations }
          : {}),
      },
    ]);
  }

  /** Open a session's raw SSE event stream (body). Used by the session driver. */
  async openEventStream(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await this.requestRaw(claudeSessionEventStreamPath(sessionId), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      ...(signal ? { signal } : {}),
      timeoutMs: this.streamTimeoutMs,
    });
    if (!response.body) {
      throw new ApiClientError("claude managed-agents: streaming response had no body", {
        code: ApiClientErrorCode.RequestFailed,
      });
    }
    return response.body;
  }

  // ── Multiagent threads (per-subagent streams in a coordinator session) ────

  /** List a session's subagent threads (the primary thread is included). */
  async listThreads(sessionId: string): Promise<ManagedAgentThread[]> {
    const res = await this.request<{ data?: ManagedAgentThread[] }>(
      claudeSessionThreadsPath(sessionId),
      { method: "GET" },
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  /** Retrieve one thread (carries its agent snapshot, status, parent_thread_id). */
  async getThread(sessionId: string, threadId: string): Promise<ManagedAgentThread> {
    return this.request<ManagedAgentThread>(claudeSessionThreadPath(sessionId, threadId), {
      method: "GET",
    });
  }

  /** Archive one thread. */
  async archiveThread(sessionId: string, threadId: string): Promise<ManagedAgentThread> {
    return this.request<ManagedAgentThread>(
      claudeSessionThreadArchivePath(sessionId, threadId),
      { method: "POST" },
    );
  }

  /** List one thread's event history. */
  async listThreadEvents(sessionId: string, threadId: string): Promise<ManagedAgentEvent[]> {
    const res = await this.request<{ data?: ManagedAgentEvent[] }>(
      claudeSessionThreadEventsPath(sessionId, threadId),
      { method: "GET" },
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  /** Open one thread's raw SSE stream — drill into a subagent's full trace. */
  async openThreadEventStream(
    sessionId: string,
    threadId: string,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await this.requestRaw(claudeSessionThreadStreamPath(sessionId, threadId), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      ...(signal ? { signal } : {}),
      timeoutMs: this.streamTimeoutMs,
    });
    if (!response.body) {
      throw new ApiClientError("claude managed-agents: thread stream had no body", {
        code: ApiClientErrorCode.RequestFailed,
      });
    }
    return response.body;
  }

  // ── Memory stores (workspace-scoped persistent memory) ────────────────────

  async createMemoryStore(params: CreateMemoryStoreParams): Promise<ManagedAgentMemoryStore> {
    return this.request<ManagedAgentMemoryStore>(CLAUDE_MANAGED_AGENTS_ENDPOINTS.memoryStores, {
      method: "POST",
      body: {
        name: params.name,
        ...(params.description ? { description: params.description } : {}),
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
    });
  }

  async getMemoryStore(storeId: string): Promise<ManagedAgentMemoryStore> {
    return this.request<ManagedAgentMemoryStore>(claudeMemoryStorePath(storeId), { method: "GET" });
  }

  async listMemoryStores(): Promise<ManagedAgentMemoryStore[]> {
    const res = await this.request<{ data?: ManagedAgentMemoryStore[] }>(
      CLAUDE_MANAGED_AGENTS_ENDPOINTS.memoryStores,
      { method: "GET" },
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  async deleteMemoryStore(storeId: string): Promise<void> {
    await this.requestRaw(claudeMemoryStorePath(storeId), { method: "DELETE" });
  }

  /** Archive a store (permanent — read-only, no unarchive). */
  async archiveMemoryStore(storeId: string): Promise<ManagedAgentMemoryStore> {
    return this.request<ManagedAgentMemoryStore>(claudeMemoryStoreArchivePath(storeId), {
      method: "POST",
    });
  }

  /** Create a memory at `path` (409 `memory_path_conflict_error` if occupied). */
  async createMemory(storeId: string, params: CreateMemoryParams): Promise<ManagedAgentMemory> {
    return this.request<ManagedAgentMemory>(claudeMemoriesPath(storeId), {
      method: "POST",
      body: { path: params.path, content: params.content },
    });
  }

  async getMemory(
    storeId: string,
    memoryId: string,
    view?: "basic" | "full",
  ): Promise<ManagedAgentMemory> {
    const path = view
      ? appendHttpQuery(claudeMemoryPath(storeId, memoryId), { view })
      : claudeMemoryPath(storeId, memoryId);
    return this.request<ManagedAgentMemory>(path, { method: "GET" });
  }

  async listMemories(
    storeId: string,
    params: ListMemoriesParams = {},
  ): Promise<ManagedAgentMemory[]> {
    const path = appendHttpQuery(claudeMemoriesPath(storeId), {
      path_prefix: params.pathPrefix,
      depth: params.depth,
      view: params.view,
    });
    const res = await this.request<{ data?: ManagedAgentMemory[] }>(path, { method: "GET" });
    return Array.isArray(res?.data) ? res.data : [];
  }

  /**
   * Update a memory by id (rename and/or content); optional content_sha256 precondition.
   * Verified live: the endpoint is POST (the docs' `PATCH` returns 405 — `Allow: …POST`).
   */
  async updateMemory(
    storeId: string,
    memoryId: string,
    params: UpdateMemoryParams,
  ): Promise<ManagedAgentMemory> {
    return this.request<ManagedAgentMemory>(claudeMemoryPath(storeId, memoryId), {
      method: "POST",
      body: {
        ...(params.content !== undefined ? { content: params.content } : {}),
        ...(params.path ? { path: params.path } : {}),
        ...(params.precondition ? { precondition: params.precondition } : {}),
      },
    });
  }

  async deleteMemory(storeId: string, memoryId: string): Promise<void> {
    await this.requestRaw(claudeMemoryPath(storeId, memoryId), { method: "DELETE" });
  }

  /** List immutable per-mutation versions (audit trail), optionally filtered by memory. */
  async listMemoryVersions(
    storeId: string,
    memoryId?: string,
  ): Promise<ManagedAgentMemoryVersion[]> {
    const path = memoryId
      ? appendHttpQuery(claudeMemoryVersionsPath(storeId), { memory_id: memoryId })
      : claudeMemoryVersionsPath(storeId);
    const res = await this.request<{ data?: ManagedAgentMemoryVersion[] }>(path, { method: "GET" });
    return Array.isArray(res?.data) ? res.data : [];
  }

  async getMemoryVersion(
    storeId: string,
    versionId: string,
  ): Promise<ManagedAgentMemoryVersion> {
    return this.request<ManagedAgentMemoryVersion>(
      claudeMemoryVersionPath(storeId, versionId),
      { method: "GET" },
    );
  }

  /** Redact a version's content while preserving the audit trail (leaked secrets / PII). */
  async redactMemoryVersion(
    storeId: string,
    versionId: string,
  ): Promise<ManagedAgentMemoryVersion> {
    return this.request<ManagedAgentMemoryVersion>(
      claudeMemoryVersionRedactPath(storeId, versionId),
      { method: "POST" },
    );
  }

  // ── Vaults & credentials (MCP credentials, attached via vault_ids) ────────

  /** Create a vault (per-end-user credential collection). Field is `display_name`. */
  async createVault(params: CreateVaultParams): Promise<ManagedAgentVault> {
    return this.request<ManagedAgentVault>(CLAUDE_MANAGED_AGENTS_ENDPOINTS.vaults, {
      method: "POST",
      body: {
        display_name: params.displayName,
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
    });
  }

  async getVault(vaultId: string): Promise<ManagedAgentVault> {
    return this.request<ManagedAgentVault>(claudeVaultPath(vaultId), { method: "GET" });
  }

  async listVaults(includeArchived = false): Promise<ManagedAgentVault[]> {
    const path = includeArchived
      ? appendHttpQuery(CLAUDE_MANAGED_AGENTS_ENDPOINTS.vaults, { include_archived: true })
      : CLAUDE_MANAGED_AGENTS_ENDPOINTS.vaults;
    const res = await this.request<{ data?: ManagedAgentVault[] }>(path, { method: "GET" });
    return Array.isArray(res?.data) ? res.data : [];
  }

  async updateVault(vaultId: string, params: UpdateVaultParams): Promise<ManagedAgentVault> {
    return this.request<ManagedAgentVault>(claudeVaultPath(vaultId), {
      method: "POST",
      body: {
        ...(params.displayName ? { display_name: params.displayName } : {}),
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
    });
  }

  async deleteVault(vaultId: string): Promise<void> {
    await this.requestRaw(claudeVaultPath(vaultId), { method: "DELETE" });
  }

  /** Archive a vault (cascades to credentials; secrets purged, records retained). */
  async archiveVault(vaultId: string): Promise<ManagedAgentVault> {
    return this.request<ManagedAgentVault>(claudeVaultArchivePath(vaultId), { method: "POST" });
  }

  /** Add a credential (mcp_oauth or static_bearer). One active credential per mcp_server_url. */
  async createCredential(
    vaultId: string,
    params: CreateCredentialParams,
  ): Promise<ManagedAgentCredential> {
    return this.request<ManagedAgentCredential>(claudeVaultCredentialsPath(vaultId), {
      method: "POST",
      body: {
        ...(params.displayName ? { display_name: params.displayName } : {}),
        auth: params.auth,
      },
    });
  }

  async getCredential(vaultId: string, credentialId: string): Promise<ManagedAgentCredential> {
    return this.request<ManagedAgentCredential>(
      claudeVaultCredentialPath(vaultId, credentialId),
      { method: "GET" },
    );
  }

  async listCredentials(
    vaultId: string,
    includeArchived = false,
  ): Promise<ManagedAgentCredential[]> {
    const base = claudeVaultCredentialsPath(vaultId);
    const path = includeArchived ? appendHttpQuery(base, { include_archived: true }) : base;
    const res = await this.request<{ data?: ManagedAgentCredential[] }>(path, { method: "GET" });
    return Array.isArray(res?.data) ? res.data : [];
  }

  /** Rotate a credential's secret payload (mcp_server_url / token_endpoint / client_id are locked). */
  async updateCredential(
    vaultId: string,
    credentialId: string,
    params: UpdateCredentialParams,
  ): Promise<ManagedAgentCredential> {
    return this.request<ManagedAgentCredential>(
      claudeVaultCredentialPath(vaultId, credentialId),
      {
        method: "POST",
        body: {
          ...(params.displayName ? { display_name: params.displayName } : {}),
          ...(params.auth ? { auth: params.auth } : {}),
        },
      },
    );
  }

  async deleteCredential(vaultId: string, credentialId: string): Promise<void> {
    await this.requestRaw(claudeVaultCredentialPath(vaultId, credentialId), { method: "DELETE" });
  }

  /** Archive a credential (purges the secret; frees the mcp_server_url for a replacement). */
  async archiveCredential(
    vaultId: string,
    credentialId: string,
  ): Promise<ManagedAgentCredential> {
    return this.request<ManagedAgentCredential>(
      claudeVaultCredentialArchivePath(vaultId, credentialId),
      { method: "POST" },
    );
  }

  /** Diagnose an MCP OAuth credential — returns a validation object with a `status`. */
  async validateMcpOauthCredential(
    vaultId: string,
    credentialId: string,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      claudeVaultCredentialValidatePath(vaultId, credentialId),
      { method: "POST" },
    );
  }

  // ── Self-hosted environment work queue (monitoring / control) ─────────────
  //
  // Create a self-hosted environment via createEnvironment({config:{type:"self_hosted"}}).
  // Driving the work queue (poll → execute tools → report) is a host-side worker
  // concern with its own sandbox/security boundary; this client exposes the
  // monitoring + control endpoints, not a tool-executing worker loop.

  /** Work-queue depth / pending / workers for a self-hosted environment. */
  async getWorkQueueStats(environmentId: string): Promise<ManagedAgentWorkQueueStats> {
    return this.request<ManagedAgentWorkQueueStats>(
      claudeEnvironmentWorkStatsPath(environmentId),
      { method: "GET" },
    );
  }

  /** Stop a claimed work item on a self-hosted environment. */
  async stopWork(environmentId: string, workId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      claudeEnvironmentWorkStopPath(environmentId, workId),
      { method: "POST" },
    );
  }

  // ── RuntimeClient contract ────────────────────────────────────────────────

  /**
   * Start a run: create a session against the resolved agent + environment and
   * send the kickoff message. Managed Agents is asynchronous — this returns the
   * session id with status `started`; follow progress via `streamRun`/`getRun`.
   */
  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const session = await this.createSession({
      agentId: this.resolveAgentId(body),
      environmentId: this.resolveEnvironmentId(body),
      ...this.titleFrom(body),
    });
    await this.sendMessage(session.id, body.input);
    return {
      run_id: session.id,
      status: "started",
      ...(session.model ? { model: session.model } : {}),
    };
  }

  /** Poll a run by session id — maps the live session status to a RuntimeRunState. */
  async getRun(runId: string): Promise<RuntimeRunStatus> {
    const session = await this.getSession(runId);
    return {
      run_id: session.id,
      status: mapSessionStatus(session.status),
      ...(session.model ? { model: session.model } : {}),
      ...(session.usage ? { usage: session.usage } : {}),
    };
  }

  /** Cancel a run by interrupting the session (graceful; session stays reusable). */
  async cancelRun(runId: string): Promise<{ status: string }> {
    await this.interruptSession(runId);
    return { status: "cancelled" };
  }

  /**
   * Start a run and stream it as canonical RunStreamEvents. Opens the session's
   * SSE stream BEFORE sending the kickoff (stream-first ordering) so no early
   * event is missed.
   */
  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const session = await this.createSession({
      agentId: this.resolveAgentId(body),
      environmentId: this.resolveEnvironmentId(body),
      ...this.titleFrom(body),
    });
    await this.runSessionStream(session.id, handlers, options, body.input);
  }

  /** Stream an EXISTING session's events without sending a kickoff. */
  async streamSession(
    sessionId: string,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    await this.runSessionStream(sessionId, handlers, options, null);
  }

  private async runSessionStream(
    sessionId: string,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal },
    kickoff: RuntimeRunInput | null,
  ): Promise<void> {
    const controller = new AbortController();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const body = await this.openEventStream(sessionId, controller.signal);

      // Stream is open — now send the kickoff so its events arrive on this stream.
      if (kickoff !== null) await this.sendMessage(sessionId, kickoff);

      await consumeSseStream(body, controller.signal, (sse) => {
        const event = mapManagedAgentStreamEvent(sse, sessionId);
        if (!event) return;
        handlers.onEvent(event);
        if (isTerminalRunStreamEvent(event)) controller.abort();
      });
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(error);
      else throw error;
    }
  }

  // ── Resolution helpers ────────────────────────────────────────────────────

  private resolveAgentId(body: RuntimeRunStartBody): string {
    const fromBody = body.metadata?.agent_id;
    const agentId = (typeof fromBody === "string" && fromBody) || this.agentId;
    if (!agentId) {
      throw new ApiClientError(
        "claude managed-agents: an agent id is required (pass body.metadata.agent_id or agentId)",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
    return agentId;
  }

  private resolveEnvironmentId(body: RuntimeRunStartBody): string {
    const fromBody = body.metadata?.environment_id;
    const environmentId = (typeof fromBody === "string" && fromBody) || this.environmentId;
    if (!environmentId) {
      throw new ApiClientError(
        "claude managed-agents: an environment id is required (pass body.metadata.environment_id or environmentId)",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
    return environmentId;
  }

  private titleFrom(body: RuntimeRunStartBody): { title?: string } {
    const title = body.metadata?.title;
    return typeof title === "string" && title ? { title } : {};
  }
}

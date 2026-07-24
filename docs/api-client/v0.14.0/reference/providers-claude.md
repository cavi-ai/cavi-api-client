# @cavi-ai/api-client/providers/claude

Package subpath: ./providers/claude

<a id="symbol-providers-claude-buildmanagedagentteamsplan"></a>

## buildManagedAgentTeamsPlan

Kind: function

```ts
/**
 * Pure: turn a `TeamManifest` into a provisioning plan — one coordinator spec +
 * one roster-member spec per team. The coordinator's `multiagent` roster is left
 * empty here (member agent ids don't exist until provisioned) and filled by
 * `provisionManagedAgentTeams`.
 */
export declare function buildManagedAgentTeamsPlan(manifest: TeamManifest, options?: ManagedAgentTeamMappingOptions): ManagedAgentTeamsPlan;
```

<a id="symbol-providers-claude-claude-anthropic-beta-header"></a>

## CLAUDE_ANTHROPIC_BETA_HEADER

Kind: variable

```ts
/** Header name carrying the Managed Agents beta opt-in. */
export declare const CLAUDE_ANTHROPIC_BETA_HEADER = "anthropic-beta";
```

<a id="symbol-providers-claude-claude-managed-agents-beta"></a>

## CLAUDE_MANAGED_AGENTS_BETA

Kind: variable

```ts
/** Beta header value required on every Managed Agents request. */
export declare const CLAUDE_MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";
```

<a id="symbol-providers-claude-claude-managed-agents-endpoints"></a>

## CLAUDE_MANAGED_AGENTS_ENDPOINTS

Kind: variable

```ts
/** Collection endpoints (create/list). Resource-scoped paths use the helpers below. */
export declare const CLAUDE_MANAGED_AGENTS_ENDPOINTS: {
    readonly agents: "/v1/agents";
    readonly sessions: "/v1/sessions";
    readonly environments: "/v1/environments";
    readonly memoryStores: "/v1/memory_stores";
    readonly vaults: "/v1/vaults";
    readonly deployments: "/v1/deployments";
    readonly deploymentRuns: "/v1/deployment_runs";
};
```

<a id="symbol-providers-claude-claude-runtime-support"></a>

## CLAUDE_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const CLAUDE_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-claude-claudeagentconfig"></a>

## ClaudeAgentConfig

Kind: type

```ts
/**
 * Map a CAVI `TeamManifest` onto Anthropic Managed Agents — option B, the
 * "teams" layer built on top of option A's `ClaudeManagedAgentClient`.
 *
 * THE MAPPING IS THE ORG CHART, NOT THE BEHAVIOR. A `TeamManifest` carries
 * topology + identity (teams → members → name/slug/capabilities) and gateway
 * HTTP routing — it deliberately does NOT carry the model, system prompt, or
 * tools an Anthropic Agent requires. So:
 *   - `ManifestTeam`   → a coordinator agent (`multiagent: {type:"coordinator"}`)
 *   - `ManifestMember` → a roster agent the coordinator may delegate to
 * …and each agent's behavior config (model/system/tools/…) is supplied
 * separately, via per-member/team manifest metadata (`metadata.<configKey>`) or
 * the `defaults` passed here. Model is required by Managed Agents; if none can be
 * resolved for a member or coordinator, provisioning throws rather than guessing.
 */
/** Behavior config an Anthropic Agent needs but a TeamManifest does not carry. */
export type ClaudeAgentConfig = {
    model?: string;
    system?: string;
    description?: string;
    tools?: readonly Record<string, unknown>[];
    mcpServers?: readonly Record<string, unknown>[];
    skills?: readonly Record<string, unknown>[];
};
```

<a id="symbol-providers-claude-claudeagentpath"></a>

## claudeAgentPath

Kind: function

```ts
/** `/v1/agents/{agentId}` — retrieve / update a persisted agent config. */
export declare function claudeAgentPath(agentId: string): string;
```

<a id="symbol-providers-claude-claudeapiclient"></a>

## ClaudeApiClient

Kind: class

```ts
export declare class ClaudeApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly defaultModel?;
    private readonly defaultMaxTokens;
    private readonly runStore;
    constructor(options: ClaudeApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    /**
     * Start a run and stream it as canonical RunStreamEvents. Anthropic starts
     * and streams in one POST (stream:true), so there is no prior runId — it is
     * captured from the message_start event. (Finding F4: this is why Claude uses
     * streamRun rather than RunEventStreamProvider.subscribe(runId).)
     */
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
    getBatch(batchId: string): Promise<RuntimeBatchStatus>;
    cancelBatch(batchId: string): Promise<RuntimeBatchStatus>;
    getBatchResults(batchId: string): Promise<RuntimeBatchResult[]>;
}
```

<a id="symbol-providers-claude-claudeapiclientoptions"></a>

## ClaudeApiClientOptions

Kind: type

```ts
export type ClaudeApiClientOptions = {
    apiKey: string;
    /** Default model when a run does not specify one. */
    defaultModel?: string;
    /** Default max_tokens when a run does not specify one (Anthropic requires it). */
    defaultMaxTokens?: number;
    anthropicVersion?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
};
```

<a id="symbol-providers-claude-claudeenvironmentpath"></a>

## claudeEnvironmentPath

Kind: function

```ts
/** `/v1/environments/{environmentId}` — retrieve / update / delete an environment template. */
export declare function claudeEnvironmentPath(environmentId: string): string;
```

<a id="symbol-providers-claude-claudemanagedagentclient"></a>

## ClaudeManagedAgentClient

Kind: class

```ts
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
 * `body.metadata.agent_id` / `body.metadata.environment_id` (plus optional
 * `agent_version`, `resources`, `vault_ids`). `body.model` and `body.instructions`
 * are NOT applied here — model and system prompt live on the agent object
 * (provision it via the `ant` CLI or `createAgent`).
 *
 * Coverage: the full `managed-agents-2026-04-01` control + data plane —
 * agent/environment/session lifecycle (incl. list/archive/versions and
 * session-local updates), session resources, scheduled deployments, multiagent
 * threads, outcomes, memory stores, vaults/credentials, and the self-hosted
 * work queue. Session steering (`confirmTool`, `respondCustomTool`,
 * `defineOutcome`, `listEvents` for lossless reconnect/dedupe) rounds out the
 * RuntimeClient contract with a stateful, resumable, streamable session.
 */
export declare class ClaudeManagedAgentClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly agentId?;
    private readonly environmentId?;
    private readonly streamTimeoutMs;
    private readonly betaVersion;
    constructor(options: ClaudeManagedAgentClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    /** Create a persisted, versioned agent config. Store the returned id + version. */
    createAgent(params: CreateManagedAgentParams): Promise<ManagedAgentAgent>;
    /** Update an agent in place — each update creates a new immutable version. */
    updateAgent(agentId: string, params: CreateManagedAgentParams): Promise<ManagedAgentAgent>;
    /** Retrieve an agent config (and its current latest `version`). */
    getAgent(agentId: string): Promise<ManagedAgentAgent>;
    /** List agent configs. */
    listAgents(): Promise<ManagedAgentAgent[]>;
    /** List an agent's immutable versions (newest state on each `POST /v1/agents/{id}`). */
    listAgentVersions(agentId: string): Promise<ManagedAgentAgent[]>;
    /** Archive an agent — terminal: existing sessions continue, new sessions can't reference it. */
    archiveAgent(agentId: string): Promise<ManagedAgentAgent>;
    /** Create a reusable environment (container template). Defaults to cloud/unrestricted. */
    createEnvironment(params: CreateManagedAgentEnvironmentParams): Promise<ManagedAgentEnvironment>;
    /** Retrieve an environment. */
    getEnvironment(environmentId: string): Promise<ManagedAgentEnvironment>;
    /** List environments. */
    listEnvironments(): Promise<ManagedAgentEnvironment[]>;
    /** Update an environment — changes apply to new containers; existing sessions keep their config. */
    updateEnvironment(environmentId: string, params: UpdateManagedAgentEnvironmentParams): Promise<ManagedAgentEnvironment>;
    /** Delete an environment (returns 204). */
    deleteEnvironment(environmentId: string): Promise<void>;
    /** Archive an environment — terminal: read-only, new sessions can't reference it. */
    archiveEnvironment(environmentId: string): Promise<ManagedAgentEnvironment>;
    /** Create a stateful session referencing a pre-created agent + environment. */
    createSession(params: CreateManagedAgentSessionParams): Promise<ManagedAgentSession>;
    /** Retrieve a session — the stateful read the Messages API cannot provide. */
    getSession(sessionId: string): Promise<ManagedAgentSession>;
    /** List sessions. */
    listSessions(): Promise<ManagedAgentSession[]>;
    /**
     * Update a session (session-local override; session must be `idle`). Changes
     * `title`/`metadata` or replaces `agent.tools`/`agent.mcp_servers`/`vault_ids`
     * for this session only — never touches the agent object.
     */
    updateSession(sessionId: string, params: UpdateManagedAgentSessionParams): Promise<ManagedAgentSession>;
    /** Delete a session (permanent — removes event history, container, checkpoints). */
    deleteSession(sessionId: string): Promise<void>;
    /** Attach a `file` or `github_repository` resource to a running session. */
    addResource(sessionId: string, resource: Record<string, unknown>): Promise<ManagedAgentResource>;
    /** List resources attached to a session. */
    listResources(sessionId: string): Promise<ManagedAgentResource[]>;
    /** Retrieve one attached resource. */
    getResource(sessionId: string, resourceId: string): Promise<ManagedAgentResource>;
    /** Update a resource (e.g. rotate a GitHub repo's `authorization_token`). */
    updateResource(sessionId: string, resourceId: string, params: UpdateSessionResourceParams): Promise<ManagedAgentResource>;
    /** Remove a resource from a session. */
    deleteResource(sessionId: string, resourceId: string): Promise<void>;
    /** Send one or more events (user.message, user.interrupt, tool results) to a session. */
    sendEvents(sessionId: string, events: readonly ManagedAgentEvent[]): Promise<void>;
    /** Convenience: send a user.message with text content. */
    sendMessage(sessionId: string, input: RuntimeRunInput): Promise<void>;
    /** Interrupt a running session — the graceful "stop this run" signal. */
    interruptSession(sessionId: string): Promise<void>;
    /** Archive a session (permanent — makes it read-only). */
    archiveSession(sessionId: string): Promise<ManagedAgentSession>;
    /** List a session's event history (for lossless reconnect / dedupe). */
    listEvents(sessionId: string): Promise<ManagedAgentEvent[]>;
    /** Answer an `always_ask` tool call. Wire shape verified live: `tool_use_id` + `result`. */
    confirmTool(sessionId: string, params: ConfirmToolParams): Promise<void>;
    /** Answer a custom tool call. Wire shape verified live: `custom_tool_use_id` + `content`. */
    respondCustomTool(sessionId: string, params: RespondCustomToolParams): Promise<void>;
    /**
     * Start a rubric-graded outcome on a session: send `user.define_outcome` and the
     * harness runs iterate → grade → revise until satisfied / max_iterations / failed.
     * Do NOT also send a `user.message` — the description IS the task.
     */
    defineOutcome(sessionId: string, params: DefineOutcomeParams): Promise<void>;
    /** Open a session's raw SSE event stream (body). Used by the session driver. */
    openEventStream(sessionId: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    /** List a session's subagent threads (the primary thread is included). */
    listThreads(sessionId: string): Promise<ManagedAgentThread[]>;
    /** Retrieve one thread (carries its agent snapshot, status, parent_thread_id). */
    getThread(sessionId: string, threadId: string): Promise<ManagedAgentThread>;
    /** Archive one thread. */
    archiveThread(sessionId: string, threadId: string): Promise<ManagedAgentThread>;
    /** List one thread's event history. */
    listThreadEvents(sessionId: string, threadId: string): Promise<ManagedAgentEvent[]>;
    /** Open one thread's raw SSE stream — drill into a subagent's full trace. */
    openThreadEventStream(sessionId: string, threadId: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    createMemoryStore(params: CreateMemoryStoreParams): Promise<ManagedAgentMemoryStore>;
    getMemoryStore(storeId: string): Promise<ManagedAgentMemoryStore>;
    listMemoryStores(): Promise<ManagedAgentMemoryStore[]>;
    deleteMemoryStore(storeId: string): Promise<void>;
    /** Archive a store (permanent — read-only, no unarchive). */
    archiveMemoryStore(storeId: string): Promise<ManagedAgentMemoryStore>;
    /** Create a memory at `path` (409 `memory_path_conflict_error` if occupied). */
    createMemory(storeId: string, params: CreateMemoryParams): Promise<ManagedAgentMemory>;
    getMemory(storeId: string, memoryId: string, view?: "basic" | "full"): Promise<ManagedAgentMemory>;
    listMemories(storeId: string, params?: ListMemoriesParams): Promise<ManagedAgentMemory[]>;
    /**
     * Update a memory by id (rename and/or content); optional content_sha256 precondition.
     * Verified live: the endpoint is POST (the docs' `PATCH` returns 405 — `Allow: …POST`).
     */
    updateMemory(storeId: string, memoryId: string, params: UpdateMemoryParams): Promise<ManagedAgentMemory>;
    deleteMemory(storeId: string, memoryId: string): Promise<void>;
    /** List immutable per-mutation versions (audit trail), optionally filtered by memory. */
    listMemoryVersions(storeId: string, memoryId?: string): Promise<ManagedAgentMemoryVersion[]>;
    getMemoryVersion(storeId: string, versionId: string): Promise<ManagedAgentMemoryVersion>;
    /** Redact a version's content while preserving the audit trail (leaked secrets / PII). */
    redactMemoryVersion(storeId: string, versionId: string): Promise<ManagedAgentMemoryVersion>;
    /** Create a vault (per-end-user credential collection). Field is `display_name`. */
    createVault(params: CreateVaultParams): Promise<ManagedAgentVault>;
    getVault(vaultId: string): Promise<ManagedAgentVault>;
    listVaults(includeArchived?: boolean): Promise<ManagedAgentVault[]>;
    updateVault(vaultId: string, params: UpdateVaultParams): Promise<ManagedAgentVault>;
    deleteVault(vaultId: string): Promise<void>;
    /** Archive a vault (cascades to credentials; secrets purged, records retained). */
    archiveVault(vaultId: string): Promise<ManagedAgentVault>;
    /** Add a credential (mcp_oauth or static_bearer). One active credential per mcp_server_url. */
    createCredential(vaultId: string, params: CreateCredentialParams): Promise<ManagedAgentCredential>;
    getCredential(vaultId: string, credentialId: string): Promise<ManagedAgentCredential>;
    listCredentials(vaultId: string, includeArchived?: boolean): Promise<ManagedAgentCredential[]>;
    /** Rotate a credential's secret payload (mcp_server_url / token_endpoint / client_id are locked). */
    updateCredential(vaultId: string, credentialId: string, params: UpdateCredentialParams): Promise<ManagedAgentCredential>;
    deleteCredential(vaultId: string, credentialId: string): Promise<void>;
    /** Archive a credential (purges the secret; frees the mcp_server_url for a replacement). */
    archiveCredential(vaultId: string, credentialId: string): Promise<ManagedAgentCredential>;
    /** Diagnose an MCP OAuth credential — returns a validation object with a `status`. */
    validateMcpOauthCredential(vaultId: string, credentialId: string): Promise<Record<string, unknown>>;
    /** Work-queue depth / pending / workers for a self-hosted environment. */
    getWorkQueueStats(environmentId: string): Promise<ManagedAgentWorkQueueStats>;
    /** Stop a claimed work item on a self-hosted environment. */
    stopWork(environmentId: string, workId: string): Promise<Record<string, unknown>>;
    /**
     * Create a scheduled deployment — each firing creates a session autonomously.
     * `initialEvents` must contain the kickoff `user.message`. Check the response
     * `schedule.upcoming_runs_at` to confirm the cron parsed as intended.
     */
    createDeployment(params: CreateManagedAgentDeploymentParams): Promise<ManagedAgentDeployment>;
    /** Pause a deployment — suppresses scheduled triggers (manual runs still allowed). */
    pauseDeployment(deploymentId: string): Promise<ManagedAgentDeployment>;
    /** Unpause a deployment — resumes from the next occurrence (no backfill). */
    unpauseDeployment(deploymentId: string): Promise<ManagedAgentDeployment>;
    /** Archive a deployment — terminal: the schedule stops and it becomes immutable. */
    archiveDeployment(deploymentId: string): Promise<ManagedAgentDeployment>;
    /** Trigger a manual run immediately (works while paused). */
    runDeployment(deploymentId: string): Promise<ManagedAgentDeploymentRun>;
    /** List a deployment's run records (each trigger attempt); filter failures with `hasError`. */
    listDeploymentRuns(deploymentId: string, params?: ListDeploymentRunsParams): Promise<ManagedAgentDeploymentRun[]>;
    /** Retrieve one deployment-run record by id (a `deployment_run.*` webhook carries this as `data.id`). */
    getDeploymentRun(deploymentRunId: string): Promise<ManagedAgentDeploymentRun>;
    /**
     * Start a run: create a session against the resolved agent + environment and
     * send the kickoff message. Managed Agents is asynchronous — this returns the
     * session id with status `started`; follow progress via `streamRun`/`getRun`.
     */
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    /** Poll a run by session id — maps the live session status to a RuntimeRunState. */
    getRun(runId: string): Promise<RuntimeRunStatus>;
    /** Cancel a run by interrupting the session (graceful; session stays reusable). */
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    /**
     * Start a run and stream it as canonical RunStreamEvents. Opens the session's
     * SSE stream BEFORE sending the kickoff (stream-first ordering) so no early
     * event is missed.
     */
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Stream an EXISTING session's events without sending a kickoff. */
    streamSession(sessionId: string, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    private runSessionStream;
    /** Build session-create params from a run body, threading optional metadata knobs. */
    private sessionParamsFrom;
    private resolveAgentId;
    private resolveEnvironmentId;
    private titleFrom;
}
```

<a id="symbol-providers-claude-claudemanagedagentclientoptions"></a>

## ClaudeManagedAgentClientOptions

Kind: type

```ts
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
```

<a id="symbol-providers-claude-claudesessionarchivepath"></a>

## claudeSessionArchivePath

Kind: function

```ts
/** `/v1/sessions/{sessionId}/archive` — make a session read-only. */
export declare function claudeSessionArchivePath(sessionId: string): string;
```

<a id="symbol-providers-claude-claudesessioneventspath"></a>

## claudeSessionEventsPath

Kind: function

```ts
/** `/v1/sessions/{sessionId}/events` — send events / list event history. */
export declare function claudeSessionEventsPath(sessionId: string): string;
```

<a id="symbol-providers-claude-claudesessioneventstreampath"></a>

## claudeSessionEventStreamPath

Kind: function

```ts
/** `/v1/sessions/{sessionId}/events/stream` — SSE event stream. */
export declare function claudeSessionEventStreamPath(sessionId: string): string;
```

<a id="symbol-providers-claude-claudesessionpath"></a>

## claudeSessionPath

Kind: function

```ts
/** `/v1/sessions/{sessionId}` — retrieve / update a session. */
export declare function claudeSessionPath(sessionId: string): string;
```

<a id="symbol-providers-claude-confirmtoolparams"></a>

## ConfirmToolParams

Kind: type

```ts
export type ConfirmToolParams = {
    /** The `agent.tool_use` event `id` (`sevt_…`). */
    toolUseId: string;
    result: "allow" | "deny";
    /** Optional reason surfaced to the agent on a deny. */
    denyMessage?: string;
    /** Echo the originating subagent thread id when the request was cross-posted. */
    sessionThreadId?: string;
};
```

<a id="symbol-providers-claude-createclaudemanagedagentprovidermodule"></a>

## createClaudeManagedAgentProviderModule

Kind: function

```ts
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
export declare function createClaudeManagedAgentProviderModule(config: ClaudeManagedAgentClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-claude-createclaudeprovidermodule"></a>

## createClaudeProviderModule

Kind: function

```ts
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
export declare function createClaudeProviderModule(config: ClaudeApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-claude-createcredentialparams"></a>

## CreateCredentialParams

Kind: type

```ts
export type CreateCredentialParams = {
    displayName?: string;
    auth: ManagedAgentCredentialAuth;
};
```

<a id="symbol-providers-claude-createmanagedagentdeploymentparams"></a>

## CreateManagedAgentDeploymentParams

Kind: type

```ts
export type CreateManagedAgentDeploymentParams = {
    name: string;
    agentId: string;
    /** Pin a specific agent version; omit for latest at each firing. */
    agentVersion?: number;
    environmentId: string;
    /** The kickoff events each firing sends — must include the starting `user.message`. */
    initialEvents: readonly ManagedAgentEvent[];
    schedule: ManagedAgentSchedule;
    resources?: readonly Record<string, unknown>[];
    vaultIds?: readonly string[];
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-createmanagedagentenvironmentparams"></a>

## CreateManagedAgentEnvironmentParams

Kind: type

```ts
export type CreateManagedAgentEnvironmentParams = {
    name: string;
    config?: Record<string, unknown>;
    description?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-createmanagedagentparams"></a>

## CreateManagedAgentParams

Kind: type

```ts
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
```

<a id="symbol-providers-claude-createmanagedagentsessionparams"></a>

## CreateManagedAgentSessionParams

Kind: type

```ts
export type CreateManagedAgentSessionParams = {
    agentId: string;
    /**
     * Pin a specific agent version (`{type:"agent",id,version}`); omit for the
     * latest version at session-create time.
     */
    agentVersion?: number;
    /**
     * Session-local overrides — emits `agent_with_overrides`. Pass wire-shaped
     * keys (`model`/`system`/`tools`/`mcp_servers`/`skills`); `null` clears a
     * field, omitting inherits it from the agent version. Overrides never merge.
     */
    agentOverrides?: Record<string, unknown>;
    environmentId: string;
    title?: string;
    resources?: readonly Record<string, unknown>[];
    vaultIds?: readonly string[];
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-creatememoryparams"></a>

## CreateMemoryParams

Kind: type

```ts
export type CreateMemoryParams = {
    path: string;
    content: string;
};
```

<a id="symbol-providers-claude-creatememorystoreparams"></a>

## CreateMemoryStoreParams

Kind: type

```ts
export type CreateMemoryStoreParams = {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-createvaultparams"></a>

## CreateVaultParams

Kind: type

```ts
export type CreateVaultParams = {
    displayName: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-customtoolresponse"></a>

## CustomToolResponse

Kind: type

```ts
export type CustomToolResponse = {
    content: readonly Record<string, unknown>[];
    isError?: boolean;
};
```

<a id="symbol-providers-claude-defineoutcomeparams"></a>

## DefineOutcomeParams

Kind: type

```ts
export type DefineOutcomeParams = {
    /** The task the agent works toward (no separate kickoff message needed). */
    description: string;
    rubric: ManagedAgentRubric;
    /** Default 3, max 20. */
    maxIterations?: number;
};
```

<a id="symbol-providers-claude-drivemanagedagentsession"></a>

## driveManagedAgentSession

Kind: function

```ts
/**
 * Drive an existing session: tail its events, answer tool/custom-tool requests,
 * and resolve when the session reaches a terminal state. Open the stream on a
 * session you've already created (and, for a fresh run, after sending the first
 * `user.message` — or use `client.sendMessage` once the driver is running).
 */
export declare function driveManagedAgentSession(client: ManagedAgentDriverClient, sessionId: string, handlers?: ManagedAgentDriverHandlers, options?: ManagedAgentDriverOptions): Promise<void>;
```

<a id="symbol-providers-claude-iscustomtooluseevent"></a>

## isCustomToolUseEvent

Kind: function

```ts
/** A client-side custom tool call — answer with `respondCustomTool`. */
export declare function isCustomToolUseEvent(ev: ManagedAgentSessionEvent): ev is ManagedAgentCustomToolUseEvent;
```

<a id="symbol-providers-claude-isoutcomeendevent"></a>

## isOutcomeEndEvent

Kind: function

```ts
/** A finished grader iteration (`satisfied` / `needs_revision` / `max_iterations_reached` / `failed` / `interrupted`). */
export declare function isOutcomeEndEvent(ev: ManagedAgentSessionEvent): ev is ManagedAgentOutcomeEndEvent;
```

<a id="symbol-providers-claude-isterminalrunstreamevent"></a>

## isTerminalRunStreamEvent

Kind: function

```ts
/** True for events that end a run, so the caller can stop reading the stream. */
export declare function isTerminalRunStreamEvent(event: RunStreamEvent): boolean;
```

<a id="symbol-providers-claude-isterminalsessionevent"></a>

## isTerminalSessionEvent

Kind: function

```ts
/**
 * True when this event ends the run: a terminated status, or an idle status whose
 * `stop_reason` is anything other than `requires_action` (idle also fires
 * transiently while the session waits on a tool confirmation / custom-tool result).
 */
export declare function isTerminalSessionEvent(ev: ManagedAgentSessionEvent): boolean;
```

<a id="symbol-providers-claude-isthreadevent"></a>

## isThreadEvent

Kind: function

```ts
/** Any subagent-thread event (created / status / cross-thread message). */
export declare function isThreadEvent(ev: ManagedAgentSessionEvent): ev is ManagedAgentThreadCreatedEvent | ManagedAgentThreadStatusEvent | ManagedAgentThreadMessageEvent;
```

<a id="symbol-providers-claude-listdeploymentrunsparams"></a>

## ListDeploymentRunsParams

Kind: type

```ts
export type ListDeploymentRunsParams = {
    /** Filter to failed runs only (`has_error=true`). */
    hasError?: boolean;
};
```

<a id="symbol-providers-claude-listmemoriesparams"></a>

## ListMemoriesParams

Kind: type

```ts
export type ListMemoriesParams = {
    pathPrefix?: string;
    depth?: number;
    view?: "basic" | "full";
};
```

<a id="symbol-providers-claude-managed-agent-webhook-event-types"></a>

## MANAGED_AGENT_WEBHOOK_EVENT_TYPES

Kind: variable

```ts
/** Webhook `data.type` values Anthropic emits. */
export declare const MANAGED_AGENT_WEBHOOK_EVENT_TYPES: readonly [
    "session.status_scheduled",
    "session.status_run_started",
    "session.status_idled",
    "session.status_rescheduled",
    "session.status_terminated",
    "session.thread_created",
    "session.thread_idled",
    "session.thread_terminated",
    "session.outcome_evaluation_ended",
    "agent.created",
    "agent.updated",
    "agent.archived",
    "agent.deleted",
    "deployment.created",
    "deployment.updated",
    "deployment.paused",
    "deployment.unpaused",
    "deployment.archived",
    "deployment.deleted",
    "deployment_run.started",
    "deployment_run.succeeded",
    "deployment_run.failed",
    "vault.created",
    "vault.archived",
    "vault.deleted",
    "vault_credential.created",
    "vault_credential.archived",
    "vault_credential.deleted",
    "vault_credential.refresh_failed"
];
```

<a id="symbol-providers-claude-managedagentagent"></a>

## ManagedAgentAgent

Kind: type

```ts
export type ManagedAgentAgent = {
    id: string;
    version?: number;
    name?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentcreator"></a>

## ManagedAgentCreator

Kind: interface

```ts
/** Minimal client surface the provisioner needs — eases testing with a fake. */
export interface ManagedAgentCreator {
    createAgent(params: CreateManagedAgentParams): Promise<ManagedAgentAgent>;
}
```

<a id="symbol-providers-claude-managedagentcredential"></a>

## ManagedAgentCredential

Kind: type

```ts
export type ManagedAgentCredential = {
    id: string;
    display_name?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentcredentialauth"></a>

## ManagedAgentCredentialAuth

Kind: type

```ts
export type ManagedAgentCredentialAuth = {
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
} | {
    type: "static_bearer";
    mcp_server_url: string;
    token: string;
};
```

<a id="symbol-providers-claude-managedagentcustomtooluseevent"></a>

## ManagedAgentCustomToolUseEvent

Kind: type

```ts
export type ManagedAgentCustomToolUseEvent = {
    kind: "custom_tool_use";
    /** `sevt_…` — echo as `custom_tool_use_id` on a result. */
    id: string;
    name: string;
    input: unknown;
    /** Set when cross-posted from a subagent thread — echo it on the result. */
    sessionThreadId?: string;
};
```

<a id="symbol-providers-claude-managedagentdeployment"></a>

## ManagedAgentDeployment

Kind: type

```ts
export type ManagedAgentDeployment = {
    id: string;
    status?: string;
    paused_reason?: unknown;
    schedule?: Record<string, unknown>;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentdeploymentrun"></a>

## ManagedAgentDeploymentRun

Kind: type

```ts
export type ManagedAgentDeploymentRun = {
    id: string;
    deployment_id?: string;
    session_id?: string | null;
    error?: {
        type?: string;
        message?: string;
    } | null;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentdriverclient"></a>

## ManagedAgentDriverClient

Kind: interface

```ts
/**
 * Interactive session driver — the steering loop the simple `streamRun` path
 * deliberately omits. It tails a session's SSE stream, answers `always_ask` tool
 * confirmations and custom-tool calls via caller-supplied handlers, survives
 * dropped streams with lossless reconnect, and dedupes so no event is double-
 * handled and no tool is double-answered.
 *
 * Deadlock-safe by construction: a tool-use id is marked `responded` only AFTER
 * its response send succeeds. If the stream drops mid-handler (before the
 * confirmation/result is sent), reconnect re-lists history, re-sees the request,
 * finds it un-responded, and answers it — instead of skipping it and hanging.
 */
/** The subset of `ClaudeManagedAgentClient` the driver needs (eases testing). */
export interface ManagedAgentDriverClient {
    openEventStream(sessionId: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    listEvents(sessionId: string): Promise<ManagedAgentEvent[]>;
    confirmTool(sessionId: string, params: ConfirmToolParams): Promise<void>;
    respondCustomTool(sessionId: string, params: RespondCustomToolParams): Promise<void>;
}
```

<a id="symbol-providers-claude-managedagentdriverhandlers"></a>

## ManagedAgentDriverHandlers

Kind: type

```ts
export type ManagedAgentDriverHandlers = {
    /** Every parsed event, in order (deduped — fires once per event id). */
    onEvent?: (event: ManagedAgentSessionEvent) => void | Promise<void>;
    /** Convenience for agent text output. */
    onMessage?: (text: string, event: ManagedAgentMessageEvent) => void;
    /** Decide an `always_ask` tool call. Omit → deny (the agent can adapt). */
    onToolConfirmation?: (request: ManagedAgentToolUseEvent) => ToolConfirmationDecision | Promise<ToolConfirmationDecision>;
    /** Execute a custom tool. Omit → respond with an error (an unanswered custom tool blocks the session). */
    onCustomTool?: (request: ManagedAgentCustomToolUseEvent) => CustomToolResponse | Promise<CustomToolResponse>;
    /** A finished grader iteration of a rubric-graded outcome. */
    onOutcomeEvaluation?: (event: ManagedAgentOutcomeEndEvent) => void;
    /** Subagent-thread activity in a multiagent session (created / status / cross-thread message). */
    onThreadEvent?: (event: ThreadEvent) => void;
    /** Fired once when the session reaches a terminal state (or reconnects are exhausted). */
    onComplete?: () => void;
    /** Transport error after reconnects are exhausted (lifecycle errors arrive via onEvent). */
    onError?: (error: unknown) => void;
};
```

<a id="symbol-providers-claude-managedagentdriveroptions"></a>

## ManagedAgentDriverOptions

Kind: type

```ts
export type ManagedAgentDriverOptions = {
    signal?: AbortSignal;
    /** Reconnect attempts after a dropped stream before giving up. Default 2. */
    maxReconnects?: number;
};
```

<a id="symbol-providers-claude-managedagentenvironment"></a>

## ManagedAgentEnvironment

Kind: type

```ts
export type ManagedAgentEnvironment = {
    id: string;
    name?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagenterrorevent"></a>

## ManagedAgentErrorEvent

Kind: type

```ts
export type ManagedAgentErrorEvent = {
    kind: "error";
    id?: string;
    message: string;
};
```

<a id="symbol-providers-claude-managedagentevent"></a>

## ManagedAgentEvent

Kind: type

```ts
export type ManagedAgentEvent = Record<string, unknown>;
```

<a id="symbol-providers-claude-managedagentmemberplan"></a>

## ManagedAgentMemberPlan

Kind: type

```ts
export type ManagedAgentMemberPlan = {
    memberId: string;
    agent: CreateManagedAgentParams;
};
```

<a id="symbol-providers-claude-managedagentmemory"></a>

## ManagedAgentMemory

Kind: type

```ts
export type ManagedAgentMemory = {
    id: string;
    path?: string;
    content?: string;
    content_sha256?: string;
    memory_version_id?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentmemorystore"></a>

## ManagedAgentMemoryStore

Kind: type

```ts
export type ManagedAgentMemoryStore = {
    id: string;
    name?: string;
    description?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentmemoryversion"></a>

## ManagedAgentMemoryVersion

Kind: type

```ts
export type ManagedAgentMemoryVersion = {
    id: string;
    memory_id?: string;
    operation?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentmessageevent"></a>

## ManagedAgentMessageEvent

Kind: type

```ts
export type ManagedAgentMessageEvent = {
    kind: "message";
    id?: string;
    text: string;
};
```

<a id="symbol-providers-claude-managedagentotherevent"></a>

## ManagedAgentOtherEvent

Kind: type

```ts
export type ManagedAgentOtherEvent = {
    kind: "other";
    id?: string;
    type: string;
};
```

<a id="symbol-providers-claude-managedagentoutcomeendevent"></a>

## ManagedAgentOutcomeEndEvent

Kind: type

```ts
export type ManagedAgentOutcomeEndEvent = {
    kind: "outcome_end";
    id?: string;
    outcomeId: string;
    iteration: number;
    result: ManagedAgentOutcomeResult;
    explanation?: string;
};
```

<a id="symbol-providers-claude-managedagentoutcomeprogressevent"></a>

## ManagedAgentOutcomeProgressEvent

Kind: type

```ts
export type ManagedAgentOutcomeProgressEvent = {
    kind: "outcome_progress";
    id?: string;
    outcomeId: string;
};
```

<a id="symbol-providers-claude-managedagentoutcomeresult"></a>

## ManagedAgentOutcomeResult

Kind: type

```ts
export type ManagedAgentOutcomeResult = "satisfied" | "needs_revision" | "max_iterations_reached" | "failed" | "interrupted" | (string & {});
```

<a id="symbol-providers-claude-managedagentoutcomestartevent"></a>

## ManagedAgentOutcomeStartEvent

Kind: type

```ts
export type ManagedAgentOutcomeStartEvent = {
    kind: "outcome_start";
    id?: string;
    outcomeId: string;
    iteration: number;
};
```

<a id="symbol-providers-claude-managedagentresource"></a>

## ManagedAgentResource

Kind: type

```ts
/** A file / GitHub repo attached to a live session (`resources.add`). */
export type ManagedAgentResource = {
    id: string;
    type?: string;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentrubric"></a>

## ManagedAgentRubric

Kind: type

```ts
export type ManagedAgentRubric = {
    type: "text";
    content: string;
} | {
    type: "file";
    file_id: string;
};
```

<a id="symbol-providers-claude-managedagentschedule"></a>

## ManagedAgentSchedule

Kind: type

```ts
/** Recurring cron schedule (IANA `timezone`; minute-level granularity max). */
export type ManagedAgentSchedule = {
    type: "cron";
    expression: string;
    timezone: string;
};
```

<a id="symbol-providers-claude-managedagentsession"></a>

## ManagedAgentSession

Kind: type

```ts
export type ManagedAgentSession = {
    id: string;
    status?: string;
    model?: string;
    usage?: Record<string, number>;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentsessionevent"></a>

## ManagedAgentSessionEvent

Kind: type

```ts
export type ManagedAgentSessionEvent = ManagedAgentMessageEvent | ManagedAgentToolUseEvent | ManagedAgentCustomToolUseEvent | ManagedAgentToolResultEvent | ManagedAgentStatusEvent | ManagedAgentErrorEvent | ManagedAgentOutcomeStartEvent | ManagedAgentOutcomeProgressEvent | ManagedAgentOutcomeEndEvent | ManagedAgentThreadCreatedEvent | ManagedAgentThreadStatusEvent | ManagedAgentThreadMessageEvent | ManagedAgentOtherEvent;
```

<a id="symbol-providers-claude-managedagentstatusevent"></a>

## ManagedAgentStatusEvent

Kind: type

```ts
export type ManagedAgentStatusEvent = {
    kind: "status";
    id?: string;
    status: ManagedAgentStatusKind;
    stopReason?: {
        type?: string;
        [key: string]: unknown;
    };
};
```

<a id="symbol-providers-claude-managedagentteammappingoptions"></a>

## ManagedAgentTeamMappingOptions

Kind: type

```ts
export type ManagedAgentTeamMappingOptions = {
    /** Behavior-config defaults merged under every roster member (e.g. a house model). */
    memberDefaults?: ClaudeAgentConfig;
    /** Behavior-config defaults merged under every team coordinator. */
    coordinatorDefaults?: ClaudeAgentConfig;
    /** Metadata key on a manifest member/team carrying its `ClaudeAgentConfig`. Default `"claude"`. */
    configKey?: string;
};
```

<a id="symbol-providers-claude-managedagentteamplan"></a>

## ManagedAgentTeamPlan

Kind: type

```ts
export type ManagedAgentTeamPlan = {
    teamId: string;
    members: readonly ManagedAgentMemberPlan[];
    /** Coordinator spec WITHOUT `multiagent` — the roster is filled with member agent ids at provision time. */
    coordinator: CreateManagedAgentParams;
};
```

<a id="symbol-providers-claude-managedagentteamsplan"></a>

## ManagedAgentTeamsPlan

Kind: type

```ts
export type ManagedAgentTeamsPlan = {
    teams: readonly ManagedAgentTeamPlan[];
};
```

<a id="symbol-providers-claude-managedagentthread"></a>

## ManagedAgentThread

Kind: type

```ts
export type ManagedAgentThread = {
    id: string;
    status?: string;
    parent_thread_id?: string | null;
    agent?: Record<string, unknown>;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentthreadcreatedevent"></a>

## ManagedAgentThreadCreatedEvent

Kind: type

```ts
export type ManagedAgentThreadCreatedEvent = {
    kind: "thread_created";
    id?: string;
    threadId?: string;
    agentName?: string;
};
```

<a id="symbol-providers-claude-managedagentthreadmessageevent"></a>

## ManagedAgentThreadMessageEvent

Kind: type

```ts
export type ManagedAgentThreadMessageEvent = {
    kind: "thread_message";
    id?: string;
    direction: "sent" | "received";
    /** The OTHER thread: destination for `sent`, origin for `received`. */
    threadId?: string;
    agentName?: string;
    text: string;
};
```

<a id="symbol-providers-claude-managedagentthreadstatusevent"></a>

## ManagedAgentThreadStatusEvent

Kind: type

```ts
export type ManagedAgentThreadStatusEvent = {
    kind: "thread_status";
    id?: string;
    threadId?: string;
    agentName?: string;
    status: ManagedAgentStatusKind;
    stopReason?: {
        type?: string;
        [key: string]: unknown;
    };
};
```

<a id="symbol-providers-claude-managedagenttokenendpointauth"></a>

## ManagedAgentTokenEndpointAuth

Kind: type

```ts
/** How Anthropic authenticates the OAuth refresh call. */
export type ManagedAgentTokenEndpointAuth = {
    type: "none";
} | {
    type: "client_secret_basic";
    client_secret: string;
} | {
    type: "client_secret_post";
    client_secret: string;
};
```

<a id="symbol-providers-claude-managedagenttoolresultevent"></a>

## ManagedAgentToolResultEvent

Kind: type

```ts
export type ManagedAgentToolResultEvent = {
    kind: "tool_result";
    id?: string;
    isError: boolean;
    source: "agent" | "mcp";
};
```

<a id="symbol-providers-claude-managedagenttooluseevent"></a>

## ManagedAgentToolUseEvent

Kind: type

```ts
export type ManagedAgentToolUseEvent = {
    kind: "tool_use";
    /** `sevt_…` — echo as `tool_use_id` on a confirmation. */
    id: string;
    name: string;
    input: unknown;
    /** `"ask"` ⇒ the session is paused awaiting a `user.tool_confirmation`. */
    evaluatedPermission?: string;
    source: "agent" | "mcp";
    /** Set when cross-posted from a subagent thread — echo it on the confirmation. */
    sessionThreadId?: string;
};
```

<a id="symbol-providers-claude-managedagentvault"></a>

## ManagedAgentVault

Kind: type

```ts
export type ManagedAgentVault = {
    id: string;
    display_name?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-managedagentwebhookevent"></a>

## ManagedAgentWebhookEvent

Kind: type

```ts
/** Thin webhook payload — fetch the resource by `data.id` for current state. */
export type ManagedAgentWebhookEvent = {
    type: "event";
    /** Unique per event (not per delivery) — dedupe retries on this. */
    id: string;
    created_at: string;
    data: {
        type: ManagedAgentWebhookEventType;
        id: string;
        organization_id?: string;
        workspace_id?: string;
        [key: string]: unknown;
    };
};
```

<a id="symbol-providers-claude-managedagentwebhookeventtype"></a>

## ManagedAgentWebhookEventType

Kind: type

```ts
export type ManagedAgentWebhookEventType = (typeof MANAGED_AGENT_WEBHOOK_EVENT_TYPES)[number] | (string & {});
```

<a id="symbol-providers-claude-managedagentworkqueuestats"></a>

## ManagedAgentWorkQueueStats

Kind: type

```ts
export type ManagedAgentWorkQueueStats = {
    type?: string;
    depth?: number;
    pending?: number;
    oldest_queued_at?: string | null;
    workers_polling?: number;
    [key: string]: unknown;
};
```

<a id="symbol-providers-claude-mapanthropicstreamevent"></a>

## mapAnthropicStreamEvent

Kind: function

```ts
/**
 * Map one Anthropic Messages SSE event to a canonical RunStreamEvent.
 * Returns null for events with no RunStreamEvent equivalent (message_start,
 * ping, content_block_start/stop, message_delta) — the caller skips those.
 * `runId` is supplied by the caller (captured from `message_start`).
 */
export declare function mapAnthropicStreamEvent(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-claude-mapmanagedagentstreamevent"></a>

## mapManagedAgentStreamEvent

Kind: function

```ts
/**
 * Map one Managed Agents session SSE event to a canonical RunStreamEvent.
 * Returns null for events with no RunStreamEvent equivalent (status_running,
 * thinking, span.*, thread/echo events) — the caller skips those. `runId` is the
 * session id (known before the stream opens, unlike the Messages surface which
 * captures it from `message_start`).
 *
 * Discriminator note: the SSE event kind is read from `data.type`. The
 * authoritative sources (event-type table, the SSE-vs-webhook namespace note,
 * and the SDK examples) use the DOTTED form (`session.status_idle`,
 * `agent.message`); one events-doc payload example shows a namespace-stripped
 * form (`status_idle`). Because a MISSED terminal event would hang `streamRun`
 * (no terminal → no abort → no onComplete), the lifecycle/terminal cases accept
 * BOTH forms defensively. The text/tool cases stay dotted-only: a bare `message`
 * would collide with echoed `user.message` events and surface user input as
 * agent output. Verified against a live session (2026-06-05): the wire uses the
 * DOTTED form (`session.status_idle`, `agent.message`, …, plus `user.message`
 * echoes, `span.*`, `agent.thinking`, `session.thread_status_*`); the
 * stripped-form lifecycle cases remain as defensive backup.
 */
export declare function mapManagedAgentStreamEvent(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-claude-parsesessionevent"></a>

## parseSessionEvent

Kind: function

```ts
/** Parse a raw Managed Agents event object (from the stream or `events.list`). */
export declare function parseSessionEvent(raw: Record<string, unknown> | null | undefined): ManagedAgentSessionEvent | null;
```

<a id="symbol-providers-claude-parsesessioneventdata"></a>

## parseSessionEventData

Kind: function

```ts
/** Parse one raw SSE frame (`{ data }`) into a typed session event. */
export declare function parseSessionEventData(sse: {
    data: string;
}): ManagedAgentSessionEvent | null;
```

<a id="symbol-providers-claude-parsewebhookevent"></a>

## parseWebhookEvent

Kind: function

```ts
/** Parse a webhook body without verifying — only when verification happens elsewhere. */
export declare function parseWebhookEvent(rawBody: string): ManagedAgentWebhookEvent;
```

<a id="symbol-providers-claude-provisionedmanagedagentmember"></a>

## ProvisionedManagedAgentMember

Kind: type

```ts
export type ProvisionedManagedAgentMember = {
    memberId: string;
    agentId: string;
    version?: number;
};
```

<a id="symbol-providers-claude-provisionedmanagedagentteam"></a>

## ProvisionedManagedAgentTeam

Kind: type

```ts
export type ProvisionedManagedAgentTeam = {
    teamId: string;
    coordinatorAgentId: string;
    coordinatorVersion?: number;
    members: readonly ProvisionedManagedAgentMember[];
};
```

<a id="symbol-providers-claude-provisionedmanagedagentteams"></a>

## ProvisionedManagedAgentTeams

Kind: type

```ts
export type ProvisionedManagedAgentTeams = {
    teams: readonly ProvisionedManagedAgentTeam[];
};
```

<a id="symbol-providers-claude-provisionmanagedagentteams"></a>

## provisionManagedAgentTeams

Kind: function

```ts
/**
 * Provision a `TeamManifest` as Managed Agents: create each roster member agent,
 * then create the team coordinator referencing those member ids in its
 * `multiagent` roster. Returns the created agent ids (persist them; reference by
 * id on `sessions.create` — do not re-provision per run).
 */
export declare function provisionManagedAgentTeams(client: ManagedAgentCreator, manifest: TeamManifest, options?: ManagedAgentTeamMappingOptions): Promise<ProvisionedManagedAgentTeams>;
```

<a id="symbol-providers-claude-readanthropicrunid"></a>

## readAnthropicRunId

Kind: function

```ts
/** Extract the run id from an Anthropic `message_start` SSE event, if present. */
export declare function readAnthropicRunId(sse: SseMessage): string | null;
```

<a id="symbol-providers-claude-respondcustomtoolparams"></a>

## RespondCustomToolParams

Kind: type

```ts
export type RespondCustomToolParams = {
    /** The `agent.custom_tool_use` event `id` (`sevt_…`). */
    toolUseId: string;
    content: readonly Record<string, unknown>[];
    isError?: boolean;
    /** Echo the originating subagent thread id when the request was cross-posted. */
    sessionThreadId?: string;
};
```

<a id="symbol-providers-claude-sessioneventneedsconfirmation"></a>

## sessionEventNeedsConfirmation

Kind: function

```ts
/** A tool call paused on an `always_ask` policy — answer with `confirmTool`. */
export declare function sessionEventNeedsConfirmation(ev: ManagedAgentSessionEvent): ev is ManagedAgentToolUseEvent;
```

<a id="symbol-providers-claude-toolconfirmationdecision"></a>

## ToolConfirmationDecision

Kind: type

```ts
export type ToolConfirmationDecision = {
    result: "allow" | "deny";
    denyMessage?: string;
};
```

<a id="symbol-providers-claude-updatecredentialparams"></a>

## UpdateCredentialParams

Kind: type

```ts
/** Rotate a credential — only the secret payload + a few metadata fields are mutable. */
export type UpdateCredentialParams = {
    displayName?: string;
    auth?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-updatemanagedagentenvironmentparams"></a>

## UpdateManagedAgentEnvironmentParams

Kind: type

```ts
/** Update an environment in place. All fields optional; changes apply to new containers only. */
export type UpdateManagedAgentEnvironmentParams = {
    name?: string;
    config?: Record<string, unknown>;
    description?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-updatemanagedagentsessionparams"></a>

## UpdateManagedAgentSessionParams

Kind: type

```ts
/**
 * Session-local mutation (session must be `idle`). `agent.tools`,
 * `agent.mcp_servers`, and `vault_ids` are full replacements — GET the session,
 * modify, and pass the whole array back to append. Does not touch the agent object.
 */
export type UpdateManagedAgentSessionParams = {
    title?: string;
    metadata?: Record<string, unknown>;
    agent?: {
        tools?: readonly Record<string, unknown>[];
        mcp_servers?: readonly Record<string, unknown>[];
    };
    vaultIds?: readonly string[];
};
```

<a id="symbol-providers-claude-updatememoryparams"></a>

## UpdateMemoryParams

Kind: type

```ts
export type UpdateMemoryParams = {
    content?: string;
    path?: string;
    precondition?: {
        type: "content_sha256";
        content_sha256: string;
    };
};
```

<a id="symbol-providers-claude-updatesessionresourceparams"></a>

## UpdateSessionResourceParams

Kind: type

```ts
/** Rotate a resource's `authorization_token` (GitHub repo) on a running session. */
export type UpdateSessionResourceParams = Record<string, unknown>;
```

<a id="symbol-providers-claude-updatevaultparams"></a>

## UpdateVaultParams

Kind: type

```ts
export type UpdateVaultParams = {
    displayName?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-claude-verifymanagedagentwebhook"></a>

## verifyManagedAgentWebhook

Kind: function

```ts
/**
 * Verify a Managed Agents webhook delivery and return the parsed event. Throws
 * `WebhookVerificationError` if a header is missing, the timestamp is outside the
 * tolerance window, or no signature matches. Pass the RAW request body bytes as a
 * string — re-serialized JSON changes the bytes and breaks the MAC.
 */
export declare function verifyManagedAgentWebhook(rawBody: string, headers: WebhookHeaders, signingSecret: string, options?: VerifyWebhookOptions): Promise<ManagedAgentWebhookEvent>;
```

<a id="symbol-providers-claude-verifywebhookoptions"></a>

## VerifyWebhookOptions

Kind: type

```ts
export type VerifyWebhookOptions = {
    /** Timestamp tolerance in seconds (default 300 = 5 minutes). */
    toleranceSeconds?: number;
    /** Override "now" (ms since epoch) — for testing. */
    nowMs?: number;
};
```

<a id="symbol-providers-claude-webhookheaders"></a>

## WebhookHeaders

Kind: type

```ts
export type WebhookHeaders = Record<string, string | string[] | undefined> | Headers;
```

<a id="symbol-providers-claude-webhookverificationerror"></a>

## WebhookVerificationError

Kind: class

```ts
export declare class WebhookVerificationError extends Error {
    constructor(message: string);
}
```

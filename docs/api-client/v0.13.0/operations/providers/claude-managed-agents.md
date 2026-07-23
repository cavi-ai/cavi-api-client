---
documentedVersion: 0.13.0
---

# Claude Managed Agents (beta) operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

`ClaudeManagedAgentClient` is a stateful `RuntimeClient` over the Anthropic
Managed Agents surface — a separate, beta API from `/v1/messages` covering the
full agent lifecycle: persisted Agent configs, reusable Environments, stateful
Sessions, session resources, multiagent threads, rubric-graded outcomes, memory
stores, credential vaults, and scheduled deployments.

**Every request carries the beta header `anthropic-beta: managed-agents-2026-04-01`.**
The client sets it (and `anthropic-version`) on construction, so no operation
below needs to pass it. Auth is `x-api-key` (from `apiKey`) or
`Authorization: Bearer` (from `authToken`, which takes precedence); one of the two
is required. Base URL defaults to the Anthropic API (`baseUrl` to override).

Import from the same `providers/claude` entry as the stateless Messages client:

```ts
import { ClaudeManagedAgentClient } from "@cavi-ai/api-client/providers/claude";

const client = new ClaudeManagedAgentClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentId: "agt_…",         // default agent for RuntimeClient runs
  environmentId: "env_…",   // default environment for RuntimeClient runs
});
```

Provider kind is `claude-managed-agents` (aliases `claude-agents`,
`claude-teams`); build a registry module with
`createClaudeManagedAgentProviderModule(config)`.

**Mandatory flow.** An Agent and an Environment must exist *before* any run —
model and system prompt live on the persisted agent object, never on a session.
Every run is a Session that references an agent + environment by id.

The universal run/stream semantics this client implements
(`startRun`/`getRun`/`cancelRun`/`streamRun`) are documented once under
[runtime operations](../runtime.md); the RuntimeClient section below only notes
how they map onto Managed Agents sessions.

## Runtime capabilities

**Signature** `client.getRuntimeCapabilities(): Promise<RuntimeCapabilities>`
**Capability** managed-agents (beta)

Returns `providerKind: "claude-managed-agents"`, `protocolVersion:
"managed-agents-2026-04-01"`, `auth: { type: "api-key", required: true }`, and
`supports: { runs: true, streaming: true }`. Purely local — no HTTP call.

## Agents

Persisted, versioned agent configs. Model, system prompt, tools, MCP servers,
and skills live here; each `POST` to an existing agent mints a new immutable
version.

**Signature**
`client.createAgent(params: CreateManagedAgentParams): Promise<ManagedAgentAgent>`
· `client.updateAgent(agentId, params): Promise<ManagedAgentAgent>`
· `client.getAgent(agentId): Promise<ManagedAgentAgent>`
· `client.listAgents(): Promise<ManagedAgentAgent[]>`
· `client.listAgentVersions(agentId): Promise<ManagedAgentAgent[]>`
· `client.archiveAgent(agentId): Promise<ManagedAgentAgent>`
**HTTP** `POST /v1/agents` · `POST /v1/agents/:agentId` · `GET /v1/agents/:agentId` · `GET /v1/agents` · `GET /v1/agents/:agentId/versions` · `POST /v1/agents/:agentId/archive`
**Capability** managed-agents (beta)

`archiveAgent` is terminal (no unarchive): existing sessions keep running, new
sessions can no longer reference it.

### Request body / Parameters

`CreateManagedAgentParams` (also used by `updateAgent`):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | yes | Display name. |
| `model` | `string` | yes | Model id (e.g. `claude-opus-4-8`). |
| `system` | `string` | no | System prompt. |
| `description` | `string` | no | Free-text description. |
| `tools` | `Record<string, unknown>[]` | no | Tool definitions. |
| `mcpServers` | `Record<string, unknown>[]` | no | MCP server configs (`mcp_servers`). |
| `skills` | `Record<string, unknown>[]` | no | Skill definitions. |
| `multiagent` | `Record<string, unknown>` | no | Coordinator/roster config (see [team provisioning](#team-provisioning)). |
| `metadata` | `Record<string, unknown>` | no | Arbitrary metadata. |

### Response

`ManagedAgentAgent` — `{ id, version?, name?, … }`. Persist `id` (and `version`
if you pin sessions to a specific one).

### Example

```ts
const agent = await client.createAgent({
  name: "researcher",
  model: "claude-opus-4-8",
  system: "You are a meticulous research assistant.",
  tools: [{ type: "web_search_20250305", name: "web_search" }],
});
// agent.id -> "agt_…", agent.version -> 1
```

## Environments

Reusable container templates sessions are provisioned into. Updates apply to new
containers only; existing sessions keep their config.

**Signature**
`client.createEnvironment(params: CreateManagedAgentEnvironmentParams): Promise<ManagedAgentEnvironment>`
· `client.getEnvironment(environmentId)` · `client.listEnvironments()`
· `client.updateEnvironment(environmentId, params: UpdateManagedAgentEnvironmentParams)`
· `client.deleteEnvironment(environmentId): Promise<void>`
· `client.archiveEnvironment(environmentId)`
**HTTP** `POST /v1/environments` · `GET /v1/environments/:environmentId` · `GET /v1/environments` · `POST /v1/environments/:environmentId` · `DELETE /v1/environments/:environmentId` · `POST /v1/environments/:environmentId/archive`
**Capability** managed-agents (beta)

### Request body / Parameters

`CreateManagedAgentEnvironmentParams`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | yes | Display name. |
| `config` | `Record<string, unknown>` | no | Container config; defaults to cloud/unrestricted. Pass `{ type: "self_hosted" }` for a self-hosted work queue. |
| `description` | `string` | no | Free-text description. |
| `metadata` | `Record<string, unknown>` | no | Arbitrary metadata. |

`UpdateManagedAgentEnvironmentParams` is the same shape with all fields optional.

### Self-hosted work queue

For `self_hosted` environments the client exposes monitoring/control only — the
tool-executing worker loop is a host-side concern with its own sandbox boundary.

**Signature**
`client.getWorkQueueStats(environmentId): Promise<ManagedAgentWorkQueueStats>`
· `client.stopWork(environmentId, workId): Promise<Record<string, unknown>>`
**HTTP** `GET /v1/environments/:environmentId/work/stats` · `POST /v1/environments/:environmentId/work/:workId/stop`
**Capability** managed-agents (beta)

## Sessions

Stateful runs referencing a pre-created agent + environment. The stateful reads,
resumability, and streaming the Messages API cannot provide.

**Signature**
`client.createSession(params: CreateManagedAgentSessionParams): Promise<ManagedAgentSession>`
· `client.getSession(sessionId)` · `client.listSessions()`
· `client.updateSession(sessionId, params: UpdateManagedAgentSessionParams)`
· `client.deleteSession(sessionId): Promise<void>`
· `client.archiveSession(sessionId)`
**HTTP** `POST /v1/sessions` · `GET /v1/sessions/:sessionId` · `GET /v1/sessions` · `POST /v1/sessions/:sessionId` · `DELETE /v1/sessions/:sessionId` · `POST /v1/sessions/:sessionId/archive`
**Capability** managed-agents (beta)

`updateSession` is a session-local override (session must be `idle`);
`agent.tools`, `agent.mcp_servers`, and `vault_ids` are full replacements, not
merges. `deleteSession` is permanent (removes event history, container,
checkpoints); `archiveSession` makes it read-only.

### Request body / Parameters

`CreateManagedAgentSessionParams`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `agentId` | `string` | yes | Persisted agent to reference. |
| `environmentId` | `string` | yes | Environment to provision into. |
| `agentVersion` | `number` | no | Pin an agent version; omit for latest at create time. |
| `agentOverrides` | `Record<string, unknown>` | no | Session-local wire-shaped overrides (`model`/`system`/`tools`/…); `null` clears a field. Never merges. |
| `title` | `string` | no | Session title. |
| `resources` | `Record<string, unknown>[]` | no | Initial attached resources. |
| `vaultIds` | `readonly string[]` | no | Credential vaults to attach (`vault_ids`). |
| `metadata` | `Record<string, unknown>` | no | Arbitrary metadata. |

### Example

```ts
const session = await client.createSession({
  agentId: "agt_…",
  environmentId: "env_…",
  title: "Q3 report",
});
await client.sendMessage(session.id, "Summarize the attached filings.");
```

## Session events & steering

Sessions are driven by appending events. All of these `POST` to the session's
events endpoint (`sendMessage`, `interruptSession`, `confirmTool`,
`respondCustomTool`, and `defineOutcome` are convenience wrappers over
`sendEvents`).

**Signature**
`client.sendEvents(sessionId, events: readonly ManagedAgentEvent[]): Promise<void>`
· `client.sendMessage(sessionId, input: RuntimeRunInput): Promise<void>`
· `client.interruptSession(sessionId): Promise<void>`
· `client.confirmTool(sessionId, params: ConfirmToolParams): Promise<void>`
· `client.respondCustomTool(sessionId, params: RespondCustomToolParams): Promise<void>`
· `client.defineOutcome(sessionId, params: DefineOutcomeParams): Promise<void>`
· `client.listEvents(sessionId): Promise<ManagedAgentEvent[]>`
· `client.openEventStream(sessionId, signal?): Promise<ReadableStream<Uint8Array>>`
**HTTP** `POST /v1/sessions/:sessionId/events` · `GET /v1/sessions/:sessionId/events` · `GET /v1/sessions/:sessionId/events/stream`
**Capability** managed-agents (beta)

- `confirmTool` answers an `always_ask` tool call — `{ toolUseId, result: "allow" | "deny", denyMessage?, sessionThreadId? }`.
- `respondCustomTool` answers a custom tool call — `{ toolUseId, content, isError?, sessionThreadId? }`.
- `defineOutcome` starts a rubric-graded run (iterate → grade → revise). The `description` *is* the task — do not also send a `user.message`.
- `listEvents` returns the full event history for lossless reconnect/dedupe.
- `openEventStream` returns the raw SSE body (used by the session driver); prefer `streamRun`/`streamSession` for canonical run-stream events.

### Request body / Parameters

`DefineOutcomeParams`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `description` | `string` | yes | The task the agent works toward. |
| `rubric` | `{ type: "text"; content } \| { type: "file"; file_id }` | yes | Grading rubric. |
| `maxIterations` | `number` | no | Default 3, max 20. |

### Example

```ts
await client.defineOutcome(session.id, {
  description: "Produce a one-page competitive brief.",
  rubric: { type: "text", content: "Covers pricing, positioning, and 3 risks." },
  maxIterations: 5,
});
```

## Session resources

Files and GitHub repos attached to a live session.

**Signature**
`client.addResource(sessionId, resource: Record<string, unknown>): Promise<ManagedAgentResource>`
· `client.listResources(sessionId)` · `client.getResource(sessionId, resourceId)`
· `client.updateResource(sessionId, resourceId, params: UpdateSessionResourceParams)`
· `client.deleteResource(sessionId, resourceId): Promise<void>`
**HTTP** `POST /v1/sessions/:sessionId/resources` · `GET /v1/sessions/:sessionId/resources` · `GET /v1/sessions/:sessionId/resources/:resourceId` · `POST /v1/sessions/:sessionId/resources/:resourceId` · `DELETE /v1/sessions/:sessionId/resources/:resourceId`
**Capability** managed-agents (beta)

`updateResource` is used e.g. to rotate a GitHub repo's `authorization_token` on
a running session.

## Multiagent threads

Per-subagent event streams inside a coordinator session (the primary thread is
included).

**Signature**
`client.listThreads(sessionId): Promise<ManagedAgentThread[]>`
· `client.getThread(sessionId, threadId)` · `client.archiveThread(sessionId, threadId)`
· `client.listThreadEvents(sessionId, threadId): Promise<ManagedAgentEvent[]>`
· `client.openThreadEventStream(sessionId, threadId, signal?): Promise<ReadableStream<Uint8Array>>`
**HTTP** `GET /v1/sessions/:sessionId/threads` · `GET /v1/sessions/:sessionId/threads/:threadId` · `POST /v1/sessions/:sessionId/threads/:threadId/archive` · `GET /v1/sessions/:sessionId/threads/:threadId/events` · `GET /v1/sessions/:sessionId/threads/:threadId/stream`
**Capability** managed-agents (beta)

## Memory stores

Workspace-scoped persistent memory, with an immutable per-mutation version audit
trail.

**Signature**
`client.createMemoryStore(params: CreateMemoryStoreParams): Promise<ManagedAgentMemoryStore>`
· `client.getMemoryStore(storeId)` · `client.listMemoryStores()`
· `client.deleteMemoryStore(storeId): Promise<void>` · `client.archiveMemoryStore(storeId)`
· `client.createMemory(storeId, params: CreateMemoryParams): Promise<ManagedAgentMemory>`
· `client.getMemory(storeId, memoryId, view?)` · `client.listMemories(storeId, params?: ListMemoriesParams)`
· `client.updateMemory(storeId, memoryId, params: UpdateMemoryParams)`
· `client.deleteMemory(storeId, memoryId): Promise<void>`
· `client.listMemoryVersions(storeId, memoryId?)` · `client.getMemoryVersion(storeId, versionId)`
· `client.redactMemoryVersion(storeId, versionId)`
**HTTP** `POST /v1/memory_stores` · `GET /v1/memory_stores/:storeId` · `GET /v1/memory_stores` · `DELETE /v1/memory_stores/:storeId` · `POST /v1/memory_stores/:storeId/archive` · `POST /v1/memory_stores/:storeId/memories` · `GET /v1/memory_stores/:storeId/memories/:memoryId` · `GET /v1/memory_stores/:storeId/memories` · `POST /v1/memory_stores/:storeId/memories/:memoryId` · `DELETE /v1/memory_stores/:storeId/memories/:memoryId` · `GET /v1/memory_stores/:storeId/memory_versions` · `GET /v1/memory_stores/:storeId/memory_versions/:versionId` · `POST /v1/memory_stores/:storeId/memory_versions/:versionId/redact`
**Capability** managed-agents (beta)

`createMemory` returns `409 memory_path_conflict_error` if the `path` is
occupied. `updateMemory` accepts an optional `precondition:
{ type: "content_sha256", content_sha256 }` for optimistic concurrency (the
endpoint is `POST`, not `PATCH`). `redactMemoryVersion` scrubs a version's
content while preserving the audit trail (leaked secrets / PII).

### Request body / Parameters

`createMemory` (`CreateMemoryParams`): `{ path: string; content: string }`.
`updateMemory` (`UpdateMemoryParams`): `{ content?; path?; precondition? }`.
`listMemories` (`ListMemoriesParams`, query): `{ pathPrefix?; depth?; view?: "basic" | "full" }`.

## Vaults & credentials

Per-end-user MCP credential collections, attached to sessions via `vault_ids`.

**Signature**
`client.createVault(params: CreateVaultParams): Promise<ManagedAgentVault>`
· `client.getVault(vaultId)` · `client.listVaults(includeArchived?)`
· `client.updateVault(vaultId, params: UpdateVaultParams)`
· `client.deleteVault(vaultId): Promise<void>` · `client.archiveVault(vaultId)`
· `client.createCredential(vaultId, params: CreateCredentialParams): Promise<ManagedAgentCredential>`
· `client.getCredential(vaultId, credentialId)` · `client.listCredentials(vaultId, includeArchived?)`
· `client.updateCredential(vaultId, credentialId, params: UpdateCredentialParams)`
· `client.deleteCredential(vaultId, credentialId): Promise<void>`
· `client.archiveCredential(vaultId, credentialId)`
· `client.validateMcpOauthCredential(vaultId, credentialId): Promise<Record<string, unknown>>`
**HTTP** `POST /v1/vaults` · `GET /v1/vaults/:vaultId` · `GET /v1/vaults` · `POST /v1/vaults/:vaultId` · `DELETE /v1/vaults/:vaultId` · `POST /v1/vaults/:vaultId/archive` · `POST /v1/vaults/:vaultId/credentials` · `GET /v1/vaults/:vaultId/credentials/:credentialId` · `GET /v1/vaults/:vaultId/credentials` · `POST /v1/vaults/:vaultId/credentials/:credentialId` · `DELETE /v1/vaults/:vaultId/credentials/:credentialId` · `POST /v1/vaults/:vaultId/credentials/:credentialId/archive` · `POST /v1/vaults/:vaultId/credentials/:credentialId/mcp_oauth_validate`
**Capability** managed-agents (beta)

`createCredential` takes `auth` as `mcp_oauth` (with optional refresh config) or
`static_bearer`; one active credential per `mcp_server_url`.
`validateMcpOauthCredential` returns a validation object with a `status`.
Archiving a vault cascades to its credentials (secrets purged, records retained).

## Deployments

Scheduled deployments fire a session on a recurring cron schedule; each firing
writes a deployment-run record. Deployments have no retrieve-by-id or list
endpoint — only the lifecycle actions below plus the run records.

**Signature**
`client.createDeployment(params: CreateManagedAgentDeploymentParams): Promise<ManagedAgentDeployment>`
· `client.pauseDeployment(deploymentId)` · `client.unpauseDeployment(deploymentId)`
· `client.archiveDeployment(deploymentId)` · `client.runDeployment(deploymentId): Promise<ManagedAgentDeploymentRun>`
· `client.listDeploymentRuns(deploymentId, params?: ListDeploymentRunsParams)`
· `client.getDeploymentRun(deploymentRunId): Promise<ManagedAgentDeploymentRun>`
**HTTP** `POST /v1/deployments` · `POST /v1/deployments/:deploymentId/pause` · `POST /v1/deployments/:deploymentId/unpause` · `POST /v1/deployments/:deploymentId/archive` · `POST /v1/deployments/:deploymentId/run` · `GET /v1/deployment_runs` · `GET /v1/deployment_runs/:deploymentRunId`
**Capability** managed-agents (beta)

`runDeployment` triggers a manual run immediately (works even while paused).
`listDeploymentRuns` filters by `deployment_id` (query) and, with `hasError`, to
failed runs only. `pause`/`unpause` toggle scheduled triggers with no backfill;
`archive` is terminal.

### Request body / Parameters

`CreateManagedAgentDeploymentParams`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | yes | Deployment name. |
| `agentId` | `string` | yes | Agent each firing runs. |
| `environmentId` | `string` | yes | Environment to provision. |
| `initialEvents` | `readonly ManagedAgentEvent[]` | yes | Kickoff events; must include the starting `user.message`. |
| `schedule` | `{ type: "cron"; expression; timezone }` | yes | IANA `timezone`; minute-level granularity. |
| `agentVersion` | `number` | no | Pin an agent version; omit for latest at each firing. |
| `resources` | `Record<string, unknown>[]` | no | Attached resources. |
| `vaultIds` | `readonly string[]` | no | Credential vaults. |
| `metadata` | `Record<string, unknown>` | no | Arbitrary metadata. |

### Example

```ts
const deployment = await client.createDeployment({
  name: "daily-standup",
  agentId: "agt_…",
  environmentId: "env_…",
  initialEvents: [{ type: "user.message", content: "Summarize yesterday's PRs." }],
  schedule: { type: "cron", expression: "0 9 * * *", timezone: "America/New_York" },
});
// inspect deployment.schedule.upcoming_runs_at to confirm the cron parsed
```

## RuntimeClient contract

Managed Agents implements the universal `RuntimeClient` surface by mapping runs
onto sessions. Field-level run/stream semantics are documented under
[runtime operations](../runtime.md) — the notes here are Managed-Agents specifics.

**Signature**
`client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
· `client.getRun(runId): Promise<RuntimeRunStatus>`
· `client.cancelRun(runId): Promise<{ status: string }>`
· `client.streamRun(body, handlers, options?): Promise<void>`
· `client.streamSession(sessionId, handlers, options?): Promise<void>`
**HTTP** `POST /v1/sessions` · `GET /v1/sessions/:sessionId` · `POST /v1/sessions/:sessionId/events` · `GET /v1/sessions/:sessionId/events/stream`
**Capability** `supports.runs`, `supports.streaming`

- `startRun` creates a session (against the resolved default or per-run
  `metadata.agent_id`/`metadata.environment_id`) and sends the kickoff message;
  it returns the session id as `run_id` with status `started` (Managed Agents is
  asynchronous). `body.model`/`body.instructions` are **not** applied — model and
  system prompt live on the agent.
- `getRun` polls the session and maps its status to a `RuntimeRunState`.
- `cancelRun` interrupts the session gracefully (the session stays reusable).
- `streamRun` opens the SSE stream *before* sending the kickoff (stream-first
  ordering, so no early event is missed) and emits canonical run-stream events.
- `streamSession` streams an existing session without sending a kickoff.

### Example

```ts
await client.streamRun(
  { input: "Draft the release notes.", metadata: { agent_id: "agt_…", environment_id: "env_…" } },
  { onEvent: (e) => console.log(e.type), onError: (err) => console.error(err) },
);
```

## Webhooks

Verify Managed Agents webhook deliveries (Standard Webhooks scheme) and parse the
typed payload. Payloads are thin — fetch the resource by `data.id` for current
state.

**Signature**
`verifyManagedAgentWebhook(rawBody: string, headers: WebhookHeaders, signingSecret: string, options?: VerifyWebhookOptions): Promise<ManagedAgentWebhookEvent>`
· `parseWebhookEvent(rawBody: string): ManagedAgentWebhookEvent`
**Capability** managed-agents (beta) — local verification, no HTTP call

Pass the **raw** request body bytes as a string — re-serialized JSON changes the
bytes and breaks the MAC. `verifyManagedAgentWebhook` reads standard
`webhook-id` / `webhook-timestamp` / `webhook-signature` headers (with `svix-*` /
`x-webhook-*` aliases) and throws `WebhookVerificationError` on a missing header,
an out-of-tolerance timestamp (default 5 minutes, `options.toleranceSeconds`), or
no matching signature. `MANAGED_AGENT_WEBHOOK_EVENT_TYPES` enumerates the
`data.type` values Anthropic emits (`session.*`, `agent.*`, `deployment.*`,
`deployment_run.*`, `vault.*`, `vault_credential.*`).

### Example

```ts
import { verifyManagedAgentWebhook } from "@cavi-ai/api-client/providers/claude";

const event = await verifyManagedAgentWebhook(rawBody, req.headers, process.env.WEBHOOK_SECRET);
if (event.data.type === "deployment_run.failed") {
  const run = await client.getDeploymentRun(event.data.id);
}
```

## Team provisioning

Map a `TeamManifest` onto Managed Agents: one coordinator agent plus one agent
per roster member per team.

**Signature**
`buildManagedAgentTeamsPlan(manifest: TeamManifest, options?: ManagedAgentTeamMappingOptions): ManagedAgentTeamsPlan`
· `provisionManagedAgentTeams(client: ManagedAgentCreator, manifest, options?): Promise<ProvisionedManagedAgentTeams>`
**Capability** managed-agents (beta)

`buildManagedAgentTeamsPlan` is pure — it turns the manifest into a provisioning
plan (coordinator spec + member specs; the coordinator's `multiagent` roster is
left empty because member agent ids don't exist yet).
`provisionManagedAgentTeams` executes it: it creates each member agent, then
creates the coordinator referencing those member ids in its `multiagent` roster,
and returns the created agent ids. Persist them and reference by id on
`createSession` — do not re-provision per run.

### Example

```ts
import { provisionManagedAgentTeams } from "@cavi-ai/api-client/providers/claude";

const { teams } = await provisionManagedAgentTeams(client, manifest);
// teams[0].coordinatorAgentId, teams[0].members[i].agentId
```

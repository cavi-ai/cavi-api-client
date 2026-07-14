# API Reference

Master endpoint catalog for `@cavi-ai/api-client`.

This package mirrors gateway, provider, and CAVI extension contracts. It is not
the canonical runtime contract for upstream OpenClaw, Caviclaw, or gateway
servers. Keep source-of-truth endpoint literals in `paths.ts` files or surface
contract maps, then update this document and the Postman collection together.

Primary sources:

- `src/contracts/paths.ts`
- `src/contracts/surfaces.ts`
- `src/contracts/team-manifest.ts`
- `src/extensions/cavi/contracts/paths.ts`
- `src/extensions/cavi/contracts/surfaces.ts`
- `src/providers/claude/paths.ts` (Claude / Anthropic Messages + Message Batches, runtime-only)
- `src/providers/claude/managed-agents/paths.ts` (Claude Managed Agents, beta)
- `src/providers/codex/paths.ts` (Codex / OpenAI Responses, runtime-only)
- `src/providers/gemini/paths.ts` (Gemini / Google Developer API, runtime-only)

The companion Postman collection is
`docs/postman/cavi-api-client.postman_collection.json`.

## Versioned Documentation Artifact

The immutable API documentation for package `0.11.0` is generated and shipped at
[`docs/api-client/v0.11.0`](docs/api-client/v0.11.0). Consumers begin with
[`manifest.json`](docs/api-client/v0.11.0/manifest.json) for release integrity
and [`navigation.json`](docs/api-client/v0.11.0/navigation.json) for navigation.
The copy/install and public-path contract is defined in
[`docs/api-client/CONSUMER.md`](docs/api-client/CONSUMER.md).

Verify the stable artifact before consumption:

```sh
pnpm docs:check
```

## Conventions

- `{{gatewayUrl}}` is the HTTP gateway base URL, for example
  `http://localhost:8787`.
- `{{gatewayWsUrl}}` is the WebSocket gateway base URL, for example
  `ws://localhost:8787`.
- `:param` means a path segment that must be URL-encoded by the caller.
- Query strings shown with `?name=:value` are optional unless the description
  says otherwise. A `?path=:path` value is appended via `appendHttpQuery`, which
  URL-encodes but does **not** sanitize it — prefer the manifest workspace
  whitelist (`resolveTeamWorkspacePath`), or run a free-form path through
  `assertSafeRelativePath` first. See
  [docs/team-manifest.md](docs/team-manifest.md#workspace-files-and-path-safety).
- `GET/POST` or similar means the same path has multiple known method variants.
- `hard` degradation means the surface is expected for core compatibility.
  `gap` degradation means callers should report a compatibility gap or use a
  fallback when the route is missing.

## Runtime Usage

Exported from the root and `@cavi-ai/api-client/core/runtime`.

- `RuntimeUsage` — normalized per-run token usage: `inputTokens?`, `outputTokens?`,
  `totalTokens?`, `cacheReadTokens?`, `cacheWriteTokens?`, `raw?` (lossless native counts).
- `RuntimeRunStatus.tokens?: RuntimeUsage` — the normalized field every provider populates.
- `RuntimeRunStatus.usage?: Record<string, number>` — **deprecated** raw provider counts; still populated.
- `RunStreamRunCompletedEvent.usage?: RuntimeUsage` — normalized usage on the terminal stream event.
- `normalizeRuntimeUsage(raw, providerKind)` — best-effort normalizer for a flat native record.
- `TokenPrices` + `estimateUsageCost(usage, prices)` — pluggable cost; no price table ships.

## Runtime Errors

Exported from the root.

- `RuntimeErrorMetadata` records the provider, transport, operation, retryability,
  and optional retry delay, HTTP status, and provider code for a runtime failure.
- `ApiClientError` accepts optional `runtime` metadata, retrievable with
  `getRuntimeErrorMetadata(error)`. The getter returns `undefined` for malformed
  metadata instead of treating arbitrary object or array values as trusted data.
- `ApiClientErrorCode` includes provider-neutral capability, permission, request,
  conflict, rate-limit, transport, protocol, and overload failure codes.
- `serializeError(error)` retains its stable `name`, `message`, `type`, and `code`
  shape; runtime metadata is intentionally excluded.

## Shared Transport Runtime

Universal factories are exported from
`@cavi-ai/api-client/core/transport`: `createHttpTransport`,
`createSseTransport`, `createWebSocketTransport`, and
`createJsonRpcTransport`. The curated root exports only `TransportKind`,
`TransportLifecycleEvent`, `TransportErrorMetadata`, `TransportError`, and
`getTransportErrorMetadata`; factories stay subpath-only.

- HTTP retries are finite and opt-in. Reads and explicitly idempotent requests
  may retry; mutations require an explicit idempotency key and otherwise have
  no replay.
- SSE and WebSocket reconnect policies are bounded. SSE carries the latest
  cursor as `Last-Event-ID` and suppresses duplicate event IDs within the
  configured bounded dedupe capacity.
- JSON-RPC composes over a WebSocket message channel or over framed stdio and
  Unix byte channels using `createFramedMessageChannel` with `jsonLinesCodec`
  or `contentLengthCodec`.
- `TransportError` messages are credential-redacted, while
  `getTransportErrorMetadata` exposes safe kind, phase, operation, retry, and
  status metadata. `TransportLifecycleEvent` reports connection and retry state
  without credentials.

These factories are transport infrastructure, not a provider adapter. They do
not declare provider capabilities or map an upstream runtime API.

### Node Transport Drivers

Exported only from `@cavi-ai/api-client/core/transport/node` so universal and
root imports remain free of Node built-ins.

- `createStdioTransport(options)` owns a spawned process, exposes its stdout and
  stdin as a `TransportByteChannel`, honors stdin backpressure, and applies an
  explicit ignore, inherit, or callback stderr policy.
- `createUnixSocketTransport(options)` owns a Unix-domain socket and optionally
  performs bounded reconnect attempts. Writes fail while disconnected and are
  never queued or replayed onto a replacement socket.
- Both drivers expose `closed`; the Unix-socket driver also exposes `ready`.
  Abort and `close()` are idempotent and release each owned resource once.
- `spawnImpl` and `connectImpl` accept structural interfaces for deterministic
  testing without exporting Node-specific declaration types.
- Unix-socket `dependencies` can inject the transport clock, random source, and
  abort-aware sleep for deterministic reconnect and deadline control.
- Unix reconnects are bounded; disconnected writes fail and have no write
  replay onto a replacement socket.

## Runtime Control-Plane Contracts

Exported from the root and `@cavi-ai/api-client/core/runtime`.

Runtime execution (`RuntimeClient`) remains the universal run and stream contract.
The control plane is a separate, optional discovery and administration surface:
providers expose only the focused modules they actually implement. Consumers
should prefer stable transport declarations and treat absent or experimental
modules as unsupported instead of assuming a fallback exists.

- `RuntimeProviderStability` — provider contract stability: `stable` or
  `experimental`.
- `RuntimeControlPlaneSource` — identifies a provider operation by its
  transport (`http`, `sse`, `websocket`, `json-rpc`, `stdio`, or
  `unix-socket`) and method name.
- `RuntimeControlPlaneMetadata` — provider, stability, source, and optional
  lossless `providerData` metadata for a control-plane result.
- `RuntimePage<T>` — a readonly data page with an optional continuation cursor.
- `RUNTIME_TRANSPORT_KINDS` and `RuntimeTransportKind` — the supported transport
  vocabulary.
- `RuntimeTransportCapability` and `RuntimeTransportCapabilities` — describe
  declared transport stability, authentication, reconnect, replay, and
  cancellation capabilities.
- `runtimeTransportSupports(capabilities, kind)` — returns `true` only when the
  requested transport is declared with `stable` stability; undeclared and
  experimental transports return `false`.
- `SessionClient` and `RuntimeSessionSummary` — list, inspect, and optionally
  cancel provider sessions while retaining canonical lifecycle and source metadata.
- `ModelCatalogClient`, `RuntimeModelDescriptor`, `AuthStatusClient`, and
  `RuntimeAuthStatus` — read-only model availability and secret-safe authentication
  status contracts. Authentication status must never expose tokens, API keys,
  passwords, cookies, authorization headers, or other credential material.
- `UsageClient`, `RuntimeUsageQuery`, and `RuntimeUsageSummary` — normalized token
  usage with cost availability that distinguishes available, estimated, and
  unavailable monetary values.
- `TaskClient` and `RuntimeTaskSummary` — list, inspect, and optionally cancel
  provider tasks with associated run, session, and thread references.
- `WorkspaceClient` and `RuntimeWorkspaceDescriptor` — read-only workspace
  discovery without introducing arbitrary filesystem access.
- `RUNTIME_CONTROL_PLANE_EVENT_NAMES`, `RuntimeControlPlaneEvent`, and
  `RuntimeEventClient` — a normalized event vocabulary and subscription surface
  covering operation lifecycle, deltas, tools, approvals, usage, and stream
  continuity without changing the existing run-stream contract.
- `inspectRuntimeEventSequence(events)` — reports terminal-event counts and
  explicit stream gaps; a sequence is valid only when it has exactly one terminal
  event.
- `RuntimeControlPlane` — aggregates declared transports and optional focused
  clients for sessions, models, usage, tasks, workspaces, authentication status,
  and events.
- `RuntimeControlClient` — a required facade containing all seven
  focused modules (`authStatus`, `sessions`, `models`, `usage`, `tasks`,
  `workspace`, and `events`) and `dispose()`. Disposal is idempotent.
- `CapabilityUnavailable` — typed error carrying the `providerId` and
  method-specific `capability` that is unavailable.
- `createUnavailableRuntimeControlClient(providerId, capabilities)` — creates
  the complete canonical shape for an unavailable adapter. Each module method
  rejects with a fresh `CapabilityUnavailable`; `dispose()` is side-effect free
  and may be called repeatedly.

The `RuntimeControlClient` names directly replace an unreleased facade, factory,
provider hook, and conformance surface. This pre-release rename does not remove
or alter the older released `RuntimeControlPlane` declaration API, and it does
not retain aliases for the unreleased names.

- `createRuntimeControlClient(provider, options)` — at the package root, resolves
  a provider kind or alias through a fresh registry of shipped provider modules;
  `options.registry` replaces that default. The core/providers export remains
  registry-driven. The factory invokes a resolved module's optional canonical
  hook or returns the complete unavailable facade. `RuntimeControlClientOptions`
  contains only provider-neutral URL, token/auth resolver, abort signal, trace,
  transport, and registry inputs. Registry membership alone does not imply a
  built-in canonical adapter. OpenClaw recognizes a structurally compatible RPC
  fixture supplied through `transport`, which keeps deterministic construction
  tests on the same provider-neutral factory path without exposing an
  OpenClaw-specific option at the package root.
- `RuntimeControlClientFactory` — asynchronous provider-module hook that
  produces the required `RuntimeControlClient` shape.
- `RuntimeControlPlaneDeclaration` — an optional provider-module declaration of
  implemented control-plane transports and focused modules; declarations do not
  add those methods to `RuntimeClient`.
- `RUNTIME_PROVIDER_CAPABILITY_MATRIX` and
  `getRuntimeProviderCapabilityRow(provider)` — supported root exports providing
  frozen, provider-by-provider
  records of existing runtime surfaces, implemented transports, and separately
  declared control-plane modules. OpenClaw declares the seven canonical modules;
  the other provider rows retain empty control-plane declarations. Prefer the
  narrower control-plane contracts above when a consumer does not need
  cross-provider matrix discovery.
- `runRuntimeControlClientConformance({ providerId, create })` — exported from
  `@cavi-ai/api-client/testing`; constructs and disposes a canonical facade,
  verifies every required method on all seven modules, invokes representative
  operations, validates canonical result shapes or typed
  `CapabilityUnavailable` rejections, and reports supported, unavailable, and
  failed operations. The declared `providerId` must exactly match unavailable
  error metadata, as must the canonical capability assigned to each operation.
  Empty module objects are invalid.
- `inspectRuntimeControlPlaneConformance(fixture)` — exported from
  `@cavi-ai/api-client/testing`; validates that a provider's control-plane
  factory, declared transports, and declared focused modules match its exposed
  runner-neutral control-plane object, and rejects undeclared exposed modules.

OpenClaw declares all seven canonical modules and its stable WebSocket transport;
unregistered providers retain the required shape and typed unavailable errors.
The six focused clients are sessions, models, usage, tasks, workspace, and
authentication status; `RuntimeEventClient` is the event subscription contract,
and `RuntimeTransportCapabilities` declares the available transports separately.
The OpenClaw adapter is built in; providers without a registered adapter use the
typed unavailable facade. Hosted Codex over OpenAI Responses and a future
`codex-app-server` JSON-RPC provider are distinct identities and must not be
presented as one adapter.

Existing consumers require no migration: `RuntimeClient`, `GatewayClient`, and
all established imports retain their behavior, and `RuntimeControlPlane` remains
the optional declaration-driven contract. Use `RuntimeControlClient`
when the consumer requires a uniform seven-module facade. Adopt a provider's
implemented control plane only when its module truthfully declares and returns
the required optional modules.

```ts
import { createRuntimeControlClient } from "@cavi-ai/api-client";

const controlPlane = await createRuntimeControlClient(config.provider, {
  baseUrl: config.baseUrl,
  webSocketUrl: config.webSocketUrl,
  resolveAuth: () => authStore.resolve(config.provider),
});

const sessions = await controlPlane.sessions.listSessions({ limit: 50 });
```

The package contract is canonical for its consumers; upstream wire APIs remain
provider-owned and mirrored. OpenClaw's verified canonical adapter operations
are deliberately narrower than the complete gateway RPC catalog:

| Canonical module | Verified OpenClaw methods |
| --- | --- |
| `workspace` | `agents.list` |
| `models`, `authStatus` | `models.list`, `models.authStatus` |
| `usage` | `usage.status`, `usage.cost` |
| `sessions` | `sessions.list`, `sessions.describe`, `sessions.abort` |
| `tasks` | `tasks.list`, `tasks.get`, `tasks.cancel` |
| `events` | Native gateway subscription; no additional request method claimed |

OpenClaw native event cursor resume is unsupported. Supplying any cursor rejects
with `CapabilityUnavailable("openclaw", "controlPlane.events.cursor")`. On
reconnect, the adapter emits `stream.reconnected` followed by `stream.gap` when
continuity cannot be proven; it does not claim replay. Factory-created WebSocket
clients are client-owned and closed by `dispose()`. Injected transports are
caller-owned and remain open unless the caller closes them. Before an owned
socket connects, `resolveAuth` is called and a returned bearer authorization
overrides `token` regardless of header-name casing; duplicate semantic headers
are collapsed deterministically. Workspace descriptors are emitted only for explicit
`agents.list` workspace values; agent IDs remain provider metadata. Because the
current `usage.cost` wire has no validated currency field, its amount remains
provider data and canonical cost availability is `unavailable`. Parser and
native-event validation failures surface as sanitized, non-retryable
`TransportProtocolError` values with exact operation metadata. Native event
names must use a bounded, secret-safe vocabulary before they can reach mapping,
metadata, or public errors; safe unknown names map to `operation.updated`.

## Runtime Providers

These are runtime-only providers reached via their subpaths (`./providers/claude`,
`./providers/codex`, `./providers/gemini`). They implement `RuntimeClient` and do
not expose gateway surfaces (teams, kanban, media, wiki, websocket).

Provider-neutral construction is exported from the root and
`./core/runtime/providers`: `createRuntimeProviderRegistry` resolves provider
kinds and aliases, while `createRuntimeClient(provider, { registry,
clientOptions })` returns a universal `RuntimeClient`. New consumers should use
the narrow `./providers/*/runtime` or `./providers/claude/messages` entries.
Third-party modules can validate metadata and method parity through
`./testing` without depending on Vitest.

- **Claude** (`providers/claude`): `POST /v1/messages` — Anthropic Messages API;
  `x-api-key` auth. Also ships `ClaudeManagedAgentClient` (`managed-agents/`
  beta) for stateful sessions over the Anthropic Managed Agents beta.
- Claude batch (`providers/claude`, `supports.batch`): `POST /v1/messages/batches`,
  `GET /v1/messages/batches/:id`, `POST /v1/messages/batches/:id/cancel`,
  `GET /v1/messages/batches/:id/results` (JSONL).
- **Codex** (`providers/codex`): `POST /v1/responses` — OpenAI Responses API;
  bearer auth; default model `gpt-5-codex`; `getRun`/`cancelRun` supported
  (background responses via `GET /v1/responses/:id` and
  `POST /v1/responses/:id/cancel`).
- Codex batch (`providers/codex`, `supports.batch`): `POST /v1/batches`,
  `GET /v1/batches/:id`, `POST /v1/batches/:id/cancel`; files via
  `POST /v1/files` (multipart), `GET /v1/files/:id/content`, `GET`/`DELETE /v1/files/:id`.
  Downloaded result JSONL is parsed strictly by `CodexApiClient.getBatchResults`
  and raises `invalid_json` when malformed; `parseOpenAIBatchOutput` has an
  opt-in `{ malformedLine: "throw" }` mode for standalone strict parsing.
- **Gemini** (`providers/gemini`):
  `POST /v1beta/models/:model:generateContent` and
  `POST /v1beta/models/:model:streamGenerateContent?alt=sse` — Gemini Developer
  API at `generativelanguage.googleapis.com`; `x-goog-api-key` auth; model is
  in the URL path (explicit model required per run unless `defaultModel` is set
  on `GeminiApiClient`); registry aliases `google` and `google-gemini`;
  `getRun`/`cancelRun` throw `EndpointNotFound` (synchronous API).
- Gemini batch (`providers/gemini`, `supports.batch`):
  `POST /v1beta/models/:model:batchGenerateContent` (inline requests under ~18MB,
  otherwise JSONL via `POST /upload/v1beta/files` resumable upload),
  `GET /v1beta/batches/:batchId`, `POST /v1beta/batches/:batchId:cancel`;
  results inline on the batch object or via
  `GET /download/v1beta/:responsesFile:download?alt=media`. All requests in a
  batch must use the same model (`ValidationFailed` otherwise). Public
  `GeminiFilesClient` mirrors `CodexFilesClient` for direct file operations.

## Core Gateway

Gateway aliases:

- `HERMES_API_ENDPOINTS` and `GATEWAY_API_ENDPOINTS` are the same map.
- `HERMES_MEDIA_API_ENDPOINTS`, `OPENCLAW_MEDIA_API_ENDPOINTS`, and
  `GATEWAY_MEDIA_API_ENDPOINTS` are the same map.
- `HERMES_WIKI_API_ENDPOINTS`, `OPENCLAW_WIKI_API_ENDPOINTS`, and
  `GATEWAY_WIKI_API_ENDPOINTS` are the same map.
- `HERMES_AGENT_CONFIG_API_ENDPOINTS`, `OPENCLAW_AGENT_CONFIG_API_ENDPOINTS`,
  and `GATEWAY_AGENT_CONFIG_API_ENDPOINTS` are the same map.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `gateway.health` | GET | `/health` | Primary gateway reachability check. |
| `gateway.healthDetailed` | GET | `/health/detailed` | Detailed health check; absence is a compatibility gap if basic health works. |
| `probe.healthz` | GET | `/healthz` | Lightweight liveness probe. |
| `probe.readyz` | GET | `/readyz` | Readiness probe. |
| `models` | GET | `/v1/models` | Gateway model inventory. |
| `gateway.capabilities` | GET | `/v1/capabilities` | Authenticated capability proof for saved bearer tokens. |
| `chatCompletions` | POST | `/v1/chat/completions` | OpenAI-compatible chat completions compatibility route. |
| `responses` | POST | `/v1/responses` | OpenAI-compatible response creation route. |
| `response` | GET | `/v1/responses/:responseId` | Retrieve a response by id. |
| `runs` | POST | `/v1/runs` | Create a gateway run. |
| `run` | GET | `/v1/runs/:runId` | Fetch run status or detail. |
| `runEvents` | GET | `/v1/runs/:runId/events` | Stream run events, typically SSE. |
| `runApproval` | POST | `/v1/runs/:runId/approval` | Resolve a run approval decision. |
| `runStop` | POST | `/v1/runs/:runId/stop` | Request that a run stop. |
| `jobs` | GET | `/api/jobs` | Gateway job inventory. |
| `job` | GET | `/api/jobs/:jobId` | Gateway job detail or status. |
| `gateway.websocket` | WS | `/api/ws` | Dashboard/TUI JSON-RPC websocket path for chat, sessions, logs, and health. |
| `ecgSharedFiles` | GET | `/api/v1/files?agent={agent}&folder={folder}` | Template for ECG/shared files by agent and folder. |

## Gateway Media

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `media.root` | GET | `/v1/media` | Gateway media API root. |
| `gateway.mediaProviders` | GET | `/v1/media/providers` | Provider inventory across audio, image, video, and music generation. |
| `media.providersByKind` | GET | `/v1/media/:kind/providers` | Provider inventory scoped to one media kind. |
| `gateway.mediaAudioGenerate` | POST | `/v1/media/audio/generate` | Audio generation route. |
| `gateway.mediaImageGenerate` | POST | `/v1/media/image/generate` | Image generation route. |
| `gateway.mediaVideoGenerate` | POST | `/v1/media/video/generate` | Video generation route. |
| `gateway.mediaMusicGenerate` | POST | `/v1/media/music/generate` | Music generation route. |
| `gateway.mediaJob` | GET | `/v1/media/:kind/jobs/:jobId` | Media job status route. |
| `gateway.mediaAssets` | GET | `/v1/media/assets?kind=:kind&cursor=:cursor&limit=:limit` | Media asset inventory route. |
| `gateway.mediaAssetCreate` | POST | `/v1/media/assets?kind=:kind` | Create or upload a media asset. |
| `gateway.mediaAsset` | GET | `/v1/media/assets/:assetId` | Fetch media asset bytes or metadata, depending on `Accept`. |
| `gateway.mediaAssetDelete` | DELETE | `/v1/media/assets/:assetId` | Delete a media asset. |

## Gateway Wiki

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `wiki.root` | GET | `/v1/wiki` | Gateway wiki API root. |
| `gateway.wikiVaults` | GET | `/v1/wiki/vaults` | Vault inventory for external Obsidian/QMD plugin vaults. |
| `wiki.vault` | GET | `/v1/wiki/vaults/:vaultId` | Vault metadata. |
| `gateway.wikiTree` | GET | `/v1/wiki/vaults/:vaultId/tree` | Vault tree route. |
| `gateway.wikiRead` | GET | `/v1/wiki/vaults/:vaultId/read?path=:path` | Read a wiki page or file. |
| `gateway.wikiIngest` | POST | `/v1/wiki/vaults/:vaultId/ingest` | Ingest content into a wiki vault. |
| `gateway.wikiCompile` | POST | `/v1/wiki/vaults/:vaultId/compile` | Compile QMD/wiki content. |
| `gateway.wikiPromote` | POST | `/v1/wiki/vaults/:vaultId/promote` | Promote wiki output for durable publishing. |
| `wiki.job` | GET | `/v1/wiki/vaults/:vaultId/jobs/:jobId` | Wiki job status. |
| `wiki.artifact` | GET | `/v1/wiki/vaults/:vaultId/artifacts/:artifactId` | Wiki artifact retrieval. |

## Sessions And Snapshots

The session REST paths are HTTP fallbacks for the websocket RPC session methods.
Core snapshot loaders accept a provider-neutral `GatewaySessionOperations` port
covering list, usage, preview, detail, and patch. The default
`createOpenClawSessionOperations` adapter retains the plural `sessions.*` RPC
names and the REST mappings below; injecting the port does not change loader
payloads, cache behavior, or released loader method names.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `sessions.list` | GET | `/api/sessions/list?...` | List sessions with filters such as `limit`, `search`, `agentId`, and `activeMinutes`. |
| `sessions.usage` | GET | `/api/sessions/usage?...` | Fetch session usage and aggregate cost/token data. |
| `sessions.preview` | POST | `/api/sessions/preview` | Fetch compact previews for selected session keys. |
| `sessions.detail` | POST | `/api/sessions/detail` | Fetch detail for one session key. |
| `sessions.patch` | PATCH | `/api/sessions/patch` | Mutate per-session operator settings such as label or thinking level. |
| `gateway.overview` | WS | `sessions.list + sessions.usage + health/log RPC` | Composite overview snapshot assembled by the client loaders. |
| `gateway.costHistory` | GET | `/api/plugins/cavi-control/cost/history?range=:range` | Optional CAVI cost-history fallback used by snapshot loaders. |

## Agent Config And Profiles

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `profiles` | GET | `/api/profiles` | Legacy profile list fallback. |
| `config` | GET | `/api/config` | Legacy gateway config payload. |
| `configDefaults` | GET | `/api/config/defaults` | Default config values. |
| `configSchema` | GET | `/api/config/schema` | Config schema. |
| `agentConfigs` | GET | `/api/agent-configs` | Native agent config/profile inventory. |
| `agentConfig` | GET | `/api/agent-configs/:agentId/config` | Fetch one agent profile config. |
| `agentConfig` | PATCH | `/api/agent-configs/:agentId/config` | Patch one agent profile config. |
| `portal.config` | POST | `/api/plugins/portal/:portalSlug/config` | Shared portal config patch route. |

## Vault, Kanban, And Teams

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `vault.tree` | GET | `/api/obsidian/tree` | Obsidian vault tree; no native gateway route identified yet. |
| `vault.read` | GET | `/api/obsidian/read?path=:path` | Obsidian file read; query string is appended by caller. |
| `kanban.tasks` | POST | `/api/plugins/kanban/tasks` | Legacy/unknown kanban compatibility route; no native OpenClaw Workboard REST owner is mirrored here. |
| `kanban.board` | GET | `/api/plugins/kanban/board` | Legacy/unknown board compatibility route; prefer native Workboard RPC when available. |
| `team.kanban` | GET | `/api/teams/:teamId/kanban` | Team-shaped compatibility route; CAVI adapters map `teamId` to Workboard `boardId` only in compatibility code. |
| `team.runs` | GET | `/api/teams/:teamId/runs` | Team runs route derived from the team manifest identity. |
| `team.config` | GET | `/api/teams/:teamId/config` | Team config route derived from the team manifest identity. |
| `team.workspace` | GET | `/api/teams/:teamId/workspace/:workspacePath` | Whitelisted team workspace route. |
| `team.action` | POST | `/api/teams/:teamId/actions/:actionId` | Team action route derived from a manifest action contract. |
| `team.agent.config` | GET | `/api/teams/:teamId/agents/:agentId/config` | Team member config route. |
| `team.agent.action` | POST | `/api/teams/:teamId/agents/:agentId/actions/:actionId` | Team member action route. |
| `team.agent.workspace` | GET | `/api/teams/:teamId/agents/:agentId/workspace/:workspacePath` | Whitelisted team-member workspace route. |

## CAVI Control Operator

The plugin alias paths mirror the operator paths under
`/api/plugins/cavi-control/operator`.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `operator.root` | GET | `/cavi-control/api/operator` | Operator API root. |
| `cavi.operator.snapshot` | GET | `/cavi-control/api/operator/snapshot` | Aggregate operator snapshot. |
| `cavi.operator.status` | GET | `/cavi-control/api/operator/status` | Operator status endpoint. |
| `cavi.operator.registry` | GET | `/cavi-control/api/operator/registry` | Operator registry endpoint. |
| `cavi.operator.tasks` | POST | `/cavi-control/api/operator/tasks` | Create an operator task. |
| `cavi.operator.task` | GET | `/cavi-control/api/operator/tasks/:taskId` | Fetch operator task detail. |
| `cavi.operator.taskDiscourse` | GET | `/cavi-control/api/operator/tasks/:taskId/discourse` | Fetch task discourse tree. |
| `cavi.operator.memory` | GET | `/cavi-control/api/operator/memory` | Operator memory endpoint. |
| `cavi.operator.workerReady` | GET | `/cavi-control/api/operator/worker/ready` | Operator worker readiness. |
| `cavi.operator.workerTasks` | GET | `/cavi-control/api/operator/worker/tasks` | Operator worker task queue. |
| `operatorAlias.root` | GET | `/api/plugins/cavi-control/operator` | Plugin alias for the operator API root. |
| `operatorAlias.snapshot` | GET | `/api/plugins/cavi-control/operator/snapshot` | Plugin alias for the aggregate operator snapshot. |
| `operatorAlias.status` | GET | `/api/plugins/cavi-control/operator/status` | Plugin alias for operator status. |
| `operatorAlias.registry` | GET | `/api/plugins/cavi-control/operator/registry` | Plugin alias for operator registry. |
| `operatorAlias.tasks` | POST | `/api/plugins/cavi-control/operator/tasks` | Plugin alias for operator task creation. |
| `operatorAlias.task` | GET | `/api/plugins/cavi-control/operator/tasks/:taskId` | Plugin alias for operator task detail. |
| `operatorAlias.taskDiscourse` | GET | `/api/plugins/cavi-control/operator/tasks/:taskId/discourse` | Plugin alias for task discourse. |
| `operatorAlias.memory` | GET | `/api/plugins/cavi-control/operator/memory` | Plugin alias for operator memory. |
| `operatorAlias.workerReady` | GET | `/api/plugins/cavi-control/operator/worker/ready` | Plugin alias for worker readiness. |
| `operatorAlias.workerTasks` | GET | `/api/plugins/cavi-control/operator/worker/tasks` | Plugin alias for worker task queue. |

## CAVI Control Project Board

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `cavi.costHistory` | GET | `/api/plugins/cavi-control/cost/history?range=:range` | CAVI cost history endpoint. |
| `cavi.scoringModel` | GET | `/api/plugins/cavi-control/scoring/model` | CAVI scoring model endpoint. |
| `cavi.projectBoard.root` | GET | `/api/plugins/cavi-control/kanban` | Project Board compatibility aggregate; native Workboard data may be projected from RPC. |
| `cavi.projectBoard.profile` | GET | `/api/plugins/cavi-control/kanban/profile` | Project Board compatibility profile slice. |
| `cavi.projectBoard.profile` | PUT | `/api/plugins/cavi-control/kanban/profile` | Persist Project Board profile email mutations. |
| `cavi.projectBoard.sprint` | GET | `/api/plugins/cavi-control/kanban/sprint` | Project Board compatibility sprint slice synthesized from board metadata, stats, or fallback data. |
| `cavi.projectBoard.backlog` | GET | `/api/plugins/cavi-control/kanban/backlog` | Project Board compatibility backlog slice; native cards map through Workboard RPC when present. |
| `cavi.projectBoard.backlog` | POST | `/api/plugins/cavi-control/kanban/backlog` | Compatibility create route; native Workboard-backed clients use `workboard.cards.create`. |
| `cavi.projectBoard.backlogItem` | PATCH | `/api/plugins/cavi-control/kanban/backlog/:itemId` | Compatibility update route; native Workboard-backed clients use `workboard.cards.update` and `workboard.cards.move`. |
| `cavi.projectBoard.call` | POST | `/api/plugins/cavi-control/kanban/call` | Compatibility command route; known actions map to typed Workboard card RPC methods. |

## CAVI Portal Surfaces

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `portal.dashboard` | GET | `/api/plugins/portal/:portal/dashboard` | Generic portal dashboard aggregate. The `:portal` identity is supplied by the host team manifest and resolved via `resolvePortalApiPath`; the package hardcodes no portal or persona names. |
| `portal.config` | POST | `/api/plugins/portal/:portal/config` | Generic portal config patch endpoint. |
| `portalMemory.snapshot` | GET | `/api/plugins/portal-memory/teams/:teamSlug/members/:memberId/:memoryKey` | Portal memory snapshot endpoint. |

## Library APIs

`LIBRARY_API_ENDPOINTS` uses `/library/api`. CAVI surface contracts also mirror
several library routes under `/api/plugins/library`.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `library.root` | GET | `/library/api` | Library API root. |
| `library.search` | GET | `/library/api/search?...` | Library search endpoint. |
| `library.ingest` | POST | `/library/api/ingest` | Ingest URL, text, file, or note content into the library. |
| `library.documents` | GET | `/library/api/documents` | Library document inventory. |
| `library.document` | GET | `/library/api/documents/:id` | Library document detail. |
| `library.fleetStatus` | GET | `/library/api/fleet-status` | Fleet library status. |
| `library.status` | GET | `/library/api/status` | Library ingest pipeline counters. |
| `library.inbox` | GET | `/library/api/inbox` | Library inbox endpoint. |
| `library.promotable` | GET | `/library/api/promotable` | Promotable library rows. |
| `library.reviewRequests` | GET | `/library/api/review-requests` | Library review-request rows. |
| `library.clip` | POST | `/library/api/clip` | CaviClip ingest endpoint. |
| `library.clipHealth` | GET | `/library/api/clip/health` | CaviClip health endpoint. |
| `library.clipSchema` | GET | `/library/api/clip/schema` | CaviClip schema endpoint. |
| `library.clipLogs` | GET | `/library/api/clip/logs` | CaviClip logs endpoint. |
| `libraryPlugin.fleetStatus` | GET | `/api/plugins/library/fleet-status` | Plugin route for fleet library status. |
| `libraryPlugin.status` | GET | `/api/plugins/library/status` | Plugin route for library pipeline counters. |
| `libraryPlugin.inbox` | GET | `/api/plugins/library/inbox` | Plugin route for library inbox. |
| `libraryPlugin.promotable` | GET | `/api/plugins/library/promotable` | Plugin route for promotable rows. |
| `libraryPlugin.reviewRequests` | GET | `/api/plugins/library/review-requests` | Plugin route for review-request rows. |
| `libraryPlugin.search` | GET | `/api/plugins/library/search?...` | Plugin route for library search. |
| `libraryPlugin.clip` | POST | `/api/plugins/library/clip` | Plugin route for CaviClip ingest. |

## Operator Dispatch

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `operatorDispatch.message` | POST | `/api/message` | Operator dispatch message endpoint. |
| `operatorDispatch.operatorEvents` | GET | `/operator/events` | Operator event stream endpoint. |
| `operatorDispatch.taskReceiptsTemplate` | GET | `/cavi-control/api/tasks/:taskId/receipts` | Operator task receipt template. |

## WebSocket RPC Methods

Postman can open the transport URL, but websocket JSON-RPC calls are runtime
protocol messages rather than ordinary HTTP requests. Use `{{gatewayWsUrl}}/api/ws`
for the transport.

`OpenClawWebSocketClient` retains the existing authenticated OpenClaw gateway
handshake and also exposes provider-specific lifecycle helpers used by the
control-plane adapter: `subscribe(listener)` delegates to native gateway event
delivery, `request(method, params, { signal })` lets one caller stop waiting
without closing the shared connection, and `dispose()` closes the client-owned
connection. Cancelling one request does not unsubscribe other listeners.

### Gateway RPC: OpenClaw Workboard

Native Workboard methods are WebSocket RPC messages, not HTTP routes. This
package mirrors the upstream OpenClaw method names and card field enums so
clients can call them without hand-built strings; OpenClaw remains the runtime
contract owner.

The provider-agnostic `KanbanClient` (`@cavi-ai/api-client/core/kanban`) is the
capability interface over these methods: the OpenClaw Workboard adapter maps its
canonical card/status types onto the RPC calls below, and any `supports.kanban`
provider is held to the `@cavi-ai/api-client/testing` kanban conformance kit.

| Group | Method | Description |
| --- | --- | --- |
| Cards | `workboard.cards.list` | List native Workboard cards, optionally scoped by board. |
| Cards | `workboard.cards.export` | Export card data. |
| Cards | `workboard.cards.diagnostics` | Read Workboard diagnostics. |
| Cards | `workboard.cards.stats` | Read Workboard card status/priority stats. |
| Cards | `workboard.cards.runs` | Read Workboard-linked run data. |
| Cards | `workboard.cards.create` | Create a Workboard card. |
| Cards | `workboard.cards.update` | Patch card fields. |
| Cards | `workboard.cards.move` | Move a card to another Workboard status. |
| Cards | `workboard.cards.delete` | Delete a card. |
| Cards | `workboard.cards.comment` | Add a card comment. |
| Cards | `workboard.cards.link` | Link a card to an external object. |
| Cards | `workboard.cards.linkDependency` | Link card dependency relationships. |
| Cards | `workboard.cards.proof` | Attach proof metadata to a card. |
| Cards | `workboard.cards.artifact` | Attach artifact metadata to a card. |
| Cards | `workboard.cards.claim` | Claim a card for an agent/operator. |
| Cards | `workboard.cards.heartbeat` | Send card worker heartbeat. |
| Cards | `workboard.cards.release` | Release a claimed card. |
| Cards | `workboard.cards.promote` | Promote a card through Workboard flow. |
| Cards | `workboard.cards.reassign` | Reassign a card. |
| Cards | `workboard.cards.reclaim` | Reclaim a stale card. |
| Cards | `workboard.cards.complete` | Complete a card. |
| Cards | `workboard.cards.block` | Block a card. |
| Cards | `workboard.cards.unblock` | Unblock a card. |
| Cards | `workboard.cards.bulk` | Apply bulk card operations. |
| Cards | `workboard.cards.diagnostics.refresh` | Refresh Workboard diagnostics. |
| Cards | `workboard.cards.dispatch` | Dispatch queued Workboard card work. |
| Cards | `workboard.cards.specify` | Specify card work. |
| Cards | `workboard.cards.decompose` | Decompose card work. |
| Cards | `workboard.cards.archive` | Archive a card. |
| Boards | `workboard.boards.list` | List Workboard boards. |
| Boards | `workboard.boards.upsert` | Create or update a board. |
| Boards | `workboard.boards.archive` | Archive a board. |
| Boards | `workboard.boards.delete` | Delete a board. |
| Notifications | `workboard.notifications.subscribe` | Subscribe to Workboard notifications. |
| Notifications | `workboard.notifications.list` | List Workboard notifications. |
| Notifications | `workboard.notifications.delete` | Delete a Workboard notification. |
| Notifications | `workboard.notifications.events` | Read Workboard notification events. |
| Notifications | `workboard.notifications.advance` | Advance notification cursor/state. |
| Attachments | `workboard.cards.attachments.list` | List card attachments. |
| Attachments | `workboard.cards.attachments.get` | Fetch a card attachment. |
| Attachments | `workboard.cards.attachments.add` | Add a card attachment. |
| Attachments | `workboard.cards.attachments.delete` | Delete a card attachment. |
| Workers | `workboard.cards.workerLog` | Append Workboard worker log data. |
| Workers | `workboard.cards.protocolViolation` | Record a worker protocol violation. |

| Group | Method | Description |
| --- | --- | --- |
| System | `health` | Core health RPC. |
| System | `health.snapshot` | Legacy health snapshot fallback. |
| System | `status` | OpenClaw status RPC. |
| System | `logs.tail` | Tail gateway logs. |
| Agent | `agent.wait` | Wait for agent readiness. |
| Config | `config.get` | Fetch runtime config. |
| Config | `config.schema` | Fetch runtime config schema. |
| Catalog | `models.list` | List models. |
| Catalog | `commands.list` | List commands. |
| Catalog | `tools.catalog` | List available tools. |
| Catalog | `agents.list` | List agents. |
| Sessions | `sessions.list` | List sessions. |
| Sessions | `sessions.preview` | Fetch compact session previews. |
| Sessions | `sessions.describe` | Describe a session. |
| Sessions | `sessions.usage` | Fetch session usage data. |
| Sessions | `sessions.create` | Create a session. |
| Sessions | `sessions.resolve` | Resolve a session key. |
| Sessions | `sessions.send` | Send to a session. |
| Sessions | `sessions.steer` | Steer session behavior. |
| Sessions | `sessions.abort` | Abort session work. |
| Sessions | `sessions.patch` | Patch session settings. |
| Chat | `chat.send` | Send a chat message. |
| Chat | `chat.abort` | Abort chat work. |
| CAVI Operator | `operator.status` | Fetch CAVI operator status. |
| CAVI Operator | `operator.registry.get` | Fetch CAVI operator registry. |
| CAVI Operator | `operator.snapshot` | Fetch CAVI operator snapshot. |
| CAVI Operator | `operator.memory.list` | List operator memory entries. |
| CAVI Operator | `operator.tasks.list` | List operator tasks. |
| CAVI Operator | `operator.tasks.get` | Fetch operator task detail. |
| CAVI Operator | `discourse.tree` | Fetch discourse tree. |
| CAVI Operator | `operator.worker.ready` | Fetch worker readiness. |
| CAVI Operator | `operator.worker.tasks.list` | List worker tasks. |
| CAVI Operator | `operator.worker.tasks.get` | Fetch worker task detail. |

## Claude Managed Agents (Beta)

These routes are **Anthropic's** Managed Agents beta, not a gateway/CAVI surface.
They are served from the Anthropic API base (`https://api.anthropic.com`), and
every request carries the beta opt-in header
`anthropic-beta: managed-agents-2026-04-01`. The path literals are owned by
`src/providers/claude/managed-agents/paths.ts`; the typed client is
`ClaudeManagedAgentClient` (`@cavi-ai/api-client/providers/claude`). The core
session/agent/environment/memory/vault paths and shapes were verified against
the live beta API on 2026-06-05/06; the deployment, session-resource, and
list/archive/update lifecycle rows follow the documented
`managed-agents-2026-04-01` surface.

`:param` segments are URL-encoded by the client. `GET/POST` on a row means the
same path has multiple method variants (e.g. retrieve vs. update). An update is
a `POST` (Managed Agents has no `PATCH`; each agent update mints a new version).

### Agents And Environments

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/v1/agents` | List / create a persisted, versioned agent config. |
| GET/POST | `/v1/agents/:agentId` | Retrieve an agent / push an update (new version). |
| GET | `/v1/agents/:agentId/versions` | List an agent's immutable versions. |
| POST | `/v1/agents/:agentId/archive` | Archive an agent (terminal; new sessions can't reference it). |
| GET/POST | `/v1/environments` | List / create an environment template (container config). |
| GET/POST/DELETE | `/v1/environments/:environmentId` | Retrieve / update / delete an environment. |
| POST | `/v1/environments/:environmentId/archive` | Archive an environment (terminal). |

### Sessions And Events

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/v1/sessions` | List / create a stateful session for an agent + environment. |
| GET/POST/DELETE | `/v1/sessions/:sessionId` | Retrieve / update (session-local override) / delete a session. |
| POST | `/v1/sessions/:sessionId/archive` | Archive a session (makes it read-only). |
| GET/POST | `/v1/sessions/:sessionId/events` | List event history / send events (messages, interrupts, tool answers). |
| GET | `/v1/sessions/:sessionId/events/stream` | SSE event stream for the session. |
| GET/POST | `/v1/sessions/:sessionId/resources` | List / attach `file` or `github_repository` resources. |
| GET/POST/DELETE | `/v1/sessions/:sessionId/resources/:resourceId` | Retrieve / update (e.g. rotate token) / remove a resource. |

### Multiagent Threads

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/sessions/:sessionId/threads` | List subagent threads. |
| GET | `/v1/sessions/:sessionId/threads/:threadId` | Retrieve one thread. |
| POST | `/v1/sessions/:sessionId/threads/:threadId/archive` | Archive a thread. |
| GET | `/v1/sessions/:sessionId/threads/:threadId/events` | List one thread's events. |
| GET | `/v1/sessions/:sessionId/threads/:threadId/stream` | SSE stream for one thread. |

### Memory Stores

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/v1/memory_stores` | List / create memory stores. |
| GET/DELETE | `/v1/memory_stores/:storeId` | Retrieve / delete a store. |
| POST | `/v1/memory_stores/:storeId/archive` | Archive a store. |
| GET/POST | `/v1/memory_stores/:storeId/memories` | List / create memories. |
| GET/POST/DELETE | `/v1/memory_stores/:storeId/memories/:memoryId` | Retrieve / update / delete a memory (update is `POST`). |
| GET | `/v1/memory_stores/:storeId/memory_versions` | List memory versions (optionally `?memory_id=`). |
| GET | `/v1/memory_stores/:storeId/memory_versions/:versionId` | Retrieve a memory version. |
| POST | `/v1/memory_stores/:storeId/memory_versions/:versionId/redact` | Redact a memory version. |

### Vaults And MCP Credentials

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/v1/vaults` | List (`?include_archived=`) / create vaults. |
| GET/POST/DELETE | `/v1/vaults/:vaultId` | Retrieve / update / delete a vault (update is `POST`). |
| POST | `/v1/vaults/:vaultId/archive` | Archive a vault. |
| GET/POST | `/v1/vaults/:vaultId/credentials` | List / create credentials. |
| GET/POST/DELETE | `/v1/vaults/:vaultId/credentials/:credentialId` | Retrieve / update / delete a credential (update is `POST`). |
| POST | `/v1/vaults/:vaultId/credentials/:credentialId/archive` | Archive a credential. |
| POST | `/v1/vaults/:vaultId/credentials/:credentialId/mcp_oauth_validate` | Validate an `mcp_oauth` credential. |

### Self-Hosted Environment Work Queue

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/environments/:environmentId/work/stats` | Read work-queue depth / worker stats. |
| POST | `/v1/environments/:environmentId/work/:workId/stop` | Stop a queued/in-flight unit of work. |

### Scheduled Deployments

A deployment fires a session on a recurring cron schedule; each firing writes a
run record. Deployments have no retrieve-by-id or list endpoint — only the
lifecycle actions and the run records below.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/deployments` | Create a scheduled deployment (agent + environment + cron schedule + initial events). |
| POST | `/v1/deployments/:deploymentId/pause` | Suppress scheduled triggers (manual runs still allowed). |
| POST | `/v1/deployments/:deploymentId/unpause` | Resume from the next occurrence (no backfill). |
| POST | `/v1/deployments/:deploymentId/archive` | Terminal — the schedule stops and it becomes immutable. |
| POST | `/v1/deployments/:deploymentId/run` | Trigger a manual run immediately (works while paused). |
| GET | `/v1/deployment_runs` | List a deployment's runs (`?deployment_id=`, `?has_error=`). |
| GET | `/v1/deployment_runs/:deploymentRunId` | Retrieve one run record. |

# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.x` were unpublished pre-release iterations. `0.2.0` is the first tracked
> public release; the history below starts here.

## [Unreleased]

### Added

- Extended `./testing` `inspectRuntimeProviderConformance` with streaming-path
  duality (`streamRun` or gateway `createSseRunEventProvider`), required
  `runLifecycleSemantics` (`omit` | `server` | `sync-store` | `unsupported-throw`)
  when getRun/cancelRun are present, and a sync-store foreign-`getRun` probe.

- Added a canonical, provider-agnostic `./core/teams` capability: `Team` /
  `TeamMember` value types and a pure `TeamDirectory` resolver (resolve teams and
  members by id/slug/code/alias), plus `createTeamDirectoryFromManifest` in
  `./contracts` and a `./testing` conformance kit (`validateTeam`,
  `inspectTeamDirectoryConformance`). The CAVI team registry now sources its
  identifier normalizer from this canonical core. Additive; no runtime behavior
  change to existing consumers.

### Changed

- Documented `RuntimeClient` getRun/cancelRun as three real semantics (omit,
  server, sync-store) and named `GatewayApiClient` as the gateway implementer
  (React `GatewayClient*` remains WS-RPC context only). Aligned `CLAUDE.md` /
  `AGENTS.md` with SynchronousRunStore behavior for Claude Messages and Gemini.

- Hermes and OpenClaw provider modules now expose `createClient` alongside the
  legacy `createApiClient` alias. Provider `team-registry-config` re-exports are
  marked `@deprecated` toward `@cavi-ai/api-client/extensions/cavi`.

- Replaced the provider-heavy README with a concise, wiki-first,
  provider-neutral entry point and moved exports, provider selection, Claude
  integrations, development checks, and consumer verification into focused
  linked documents.

### Fixed

- OpenClaw `getTask`/`cancelTask` now send the `taskId` RPC parameter (not
  `id`) that `tasks.get` / `tasks.cancel` require — consistent with the
  method-specific param naming already used elsewhere (`sessions.*` → `key`).
- OpenClaw model wire validation now allowlists the optional `api`,
  `available`, and `input` catalog fields the gateway forwards, keeping live
  model payloads forward-compatible instead of rejecting the whole list.

## [0.12.0] - 2026-07-15

### Added

- Added deterministic consumer snapshot tooling for release-candidate evidence.
  It captures dirty tracked and intended untracked sources without private or
  generated artifacts, emits a verified Git bundle plus path/mode/content
  metadata, encodes untracked provenance in the immutable commit, preserves
  original worktree status bytes, rejects capture races, and lets the consumer
  verifier consume and independently re-derive that durable evidence directly.
  Final evidence can pin the expected consumer origin/base, rejects private
  workstation paths and agent/debug artifacts, and verifies the captured RC
  dependency and lock without rewriting either file.

- Aligned Hermes runtime control with the live aiohttp API Server: `baseUrl`
  capability-probes `/v1/capabilities` and maps `/v1/models`,
  `/api/sessions/list`, and `/api/sessions/usage`. The separate TUI dashboard
  remains explicit, API-server-only clients do not claim `gateway.raw`, and an
  existing run may opt into `/v1/runs/{run_id}/events` SSE without creating a
  run. Unsupported auth, session mutations, cron-as-task, and workspace remain
  typed unavailable. OpenClaw's owned default identity now matches the accepted
  `openclaw-control-ui`; explicit consumer identity still wins.
  API Server authentication resolves independently from explicit dashboard
  credentials, and runtime disposal aborts all active API Server SSE streams
  while suppressing post-dispose delivery. Naturally completed and failed
  streams release their captured handlers immediately; later caller or runtime
  disposal is harmless.

- Added opt-in, provider-neutral `RuntimeControlClientOptions.gatewayReconnect`
  with retryable-only bounded backoff for owned OpenClaw gateway lifecycles.
  Concurrent connects share only their in-flight promise, later manual connects
  invoke the transport again, and disposal cancels pending retries. Hermes
  rejects the policy and post-close manual reconnect explicitly because its
  fixed dashboard channel cannot be reconstructed safely.
- Added provider-neutral `RuntimeControlClientOptions.gatewayConnection`,
  composed from the existing `GatewayRpcClientOptions`, so owned OpenClaw
  connections can receive mobile-safe identity, device signing, scopes,
  protocol, timeout, request-limit, and redacted RPC-trace settings. Injected
  transports retain precedence; Hermes rejects unsupported fields explicitly
  instead of silently downgrading security configuration.
- Added the optional provider-neutral `GATEWAY_RAW_EXTENSION` (`gateway.raw`)
  contract for arbitrary operation requests, unchanged raw event snapshots,
  normalized connection state, cancellation, and exact-once asynchronous
  disposal. The descriptor does not claim provider support and remains distinct
  from normalized runtime-control events and the CAVI-only `cavi.control`
  extension.
- Added shared `gateway.raw` conformance for OpenClaw and Hermes covering
  request and raw-event identity, listener isolation, ordered reconnect state,
  abort propagation, typed unsupported operations, and exact-once disposal.
  Published testing imports, compatibility evidence, and dependency guardrails
  keep the suite provider-neutral; REST-only Hermes remains unsupported.
- Added the CAVI extension's provider-neutral `resolvePluginApiPath` dispatcher
  for generic `/api/plugins/{plugin}/...` routes and the
  `LIBRARY_LEGACY_API_BASE_PATH` compatibility constant for consumers that
  normalize released `/library/api` inputs. Portal dispatch and existing
  library route behavior are unchanged.
- Added a provider-neutral runtime-control scenario catalog through the testing
  subpath. It records typed capability unavailability, keeps live mutation
  probes behind an explicit disposable mode and typed extension, cleans created
  resources in reverse order, redacts failure details, and always reports client
  disposal independently.
- Added a provider-neutral typed extension registry to `RuntimeControlClient`.
  Descriptors normalize IDs, registries reject blank or duplicate IDs and expose
  immutable sorted discovery with descriptor-identity lookup, and repeated
  `withRuntimeControlExtensions` calls compose without shadowing existing or core
  client properties while preserving module identity and delegating disposal
  exactly once.
- Added the typed `CAVI_CONTROL_EXTENSION` (`cavi.control`) descriptor. The CAVI
  registry enhancer now installs independently constructed complete CAVI control
  adapters for configured OpenClaw and Hermes providers while preserving their
  released core modules, immutable base registries, and canonical alias checks.
- Added the CAVI-only `withCaviRuntimeControlProviders` registry enhancer. It
  immutably installs the resolved Hermes runtime-control factory while
  preserving base modules, aliases, capabilities, resolution order, the root
  capability matrix, and provider-neutral package-factory options. Canonical
  Hermes identity now fails closed for missing, ambiguous, or alias-shadowed
  registries; generic module types and defensive-copy registries are preserved,
  and mutable extension setup is snapshotted without cloning opaque runtime
  resources.
- Documented branch-free `RuntimeControlClient` consumption and the exact
  Hermes/OpenClaw transport, REST fallback, event, authentication, lifecycle,
  task, workspace, cost, and upstream protocol-ownership boundaries. The
  Hermes session module requires both dashboard REST and a channel. An explicit
  dashboard token suppresses authentication resolution and wins over the generic
  token; otherwise a resolved authorization header wins, with the generic token
  supplying bearer authorization when resolved headers contain no authentication.
  Hermes session pagination preserves validated upstream totals, CAVI task
  snapshots fail closed on malformed nested schemas, and task/workspace metadata
  reports the adapter's actual WebSocket or HTTP transport without labeling
  local fallback data as wire traffic. Blank resolved authorization values use
  the generic bearer token, session cursors stop at the 200-row bound and do not
  repeat when REST fallback cannot advance, and partial operator-section
  fallbacks retain non-wire provenance. The
  immutable generated `v0.11.0` documentation remains historically accurate
  and intentionally excludes these unreleased APIs.
- Added an OpenAI-style operation reference to the documentation pipeline
  (rendered on cavi-ai.xyz): per-operation method signatures, request bodies,
  responses, runnable examples, and the HTTP endpoint each operation maps to,
  covering the universal runtime contract, every provider (Claude, Codex,
  Gemini, Hermes, OpenClaw), Claude Managed Agents, the gateway control-plane and
  WebSocket RPC surfaces, and the CAVI extension, plus a companion redundancy
  audit that records removal candidates. A new `docs:check` step
  (`scripts/docs/check-operation-endpoints.mjs`) fails the build when a
  documented HTTP path is not owned by a `paths.ts` file.

### Changed

- Extracted the core gateway session loaders behind an injectable,
  provider-neutral `GatewaySessionOperations` port. The default OpenClaw adapter
  preserves the released plural `sessions.*` RPC and REST fallback mappings,
  payloads, caches, and one-argument loader calls without adding a CAVI copy.
  Optional request options now propagate through every session operation;
  already-aborted signals prevent legacy transport dispatch, while in-flight
  cancellation remains unsupported by those released transports.
- Extended the additive gateway session operation seam with optional typed
  cancellation and provider-neutral raw creation/update/state fields. Canonical
  session methods now share abortable request option types; providers without
  proven cancellation semantics keep the optional operation absent.
- Directly renamed the unreleased canonical facade, factories, provider hook,
  and conformance kit to the `RuntimeControlClient` vocabulary. This is a
  pre-release rename, not a compatibility removal; the older released
  `RuntimeControlPlane` declaration API remains intact.
- Reduced `API.md` to an index that points at the pipeline operation reference;
  its former control-plane facade and OpenClaw adapter prose moved into the
  operation pages, and the `docs-integrity` contract now verifies them there.
  Renamed the Claude provider reference page to `claude-anthropic.md` to avoid a
  `CLAUDE.md` case collision on case-insensitive filesystems.

### Fixed

- OpenClaw canonical session summaries now preserve the upstream preferred
  title, using an explicit session label before the derived display name for
  both list and get operations.
- Aligned OpenClaw control-plane validation with current upstream
  `sessions.list` pagination/default metadata, `usage.cost` cost-detail and
  cache-status fields, and `agents.list` runtime/thinking metadata while
  retaining fail-closed nested validation, including current session label and
  display-name fields. Current OpenClaw session pagination now follows validated
  continuation metadata without truncating later pages.
  Already-aborted OpenClaw requests no longer dispatch a hidden RPC that rejects
  during disposal, Hermes API Server requests preserve caller abort identity
  without dispatching fetch, and late caller cancellation no longer masks an
  unrelated HTTP transport failure or a timeout that already won the combined
  abort race.
- Made Hermes runtime-control composition independent per configured surface:
  CAVI task/workspace adapters now install without dashboard REST, while absent
  dashboard modules remain exact unavailable facades. Construction now unwinds
  owned channels and RPC resources in reverse order, including readiness,
  synchronous subscription, and post-construction abort failures, without
  closing borrowed channels or replacing the primary error.
- Added the current `/cavi-control/api/cost/history` route as a fail-closed
  fallback for 404/405 responses from the released plugin cost-history route.
  The existing adapter, response handling, fallback behavior, and in-flight
  cache remain shared; authentication, server, schema, and abort failures do
  not try the alias.
- Strengthened the CAVI ownership guard to validate complete classification
  metadata and resolve static, dynamic, TypeScript import-equals, CommonJS, and
  relative barrel dependencies across core, contracts, providers, and extension
  implementations. Inventory owners and classification families now also match
  each compiler-resolved export declaration rather than trusting table text.
- Hardened the OpenClaw canonical adapter so factory-owned WebSockets resolve
  fresh bearer authentication case-insensitively before connecting, without
  duplicate semantic headers. Native event names and payloads are bounded and
  secret-safe before delivery; malformed wire responses become sanitized
  `TransportProtocolError` failures, workspace identity comes only from explicit
  workspace descriptors, and currency-less upstream cost totals stay canonically
  unavailable while their validated amount remains provider data.

- Expanded canonical control-plane conformance from object-presence checks to
  exact method and behavioral validation, guaranteed facade disposal, and real
  package-factory coverage through the provider-neutral injected transport
  seam. Empty module objects and unavailable errors with a mismatched provider
  or operation capability no longer pass conformance.
- Corrected API documentation that simultaneously advertised OpenClaw's adapter
  and described the package as shipping no built-in adapter.
- OpenClaw's internal control-plane factory now supplies a stable provider
  client identity when it creates the authenticated WebSocket connection.
- Made the package-root canonical control-plane factory resolve shipped
  provider modules through a provider-layer registry while preserving explicit
  registry overrides and the provider-neutral core dependency boundary.

### Added

- Added the CAVI-extension Hermes `RuntimeControlClient` composer. It exposes
  the complete seven-module facade, installs only configured dashboard/CAVI
  modules, preserves typed unavailable fallbacks, applies explicit dashboard
  auth precedence, and disposes owned transports idempotently without closing
  borrowed injected channels.
- Added the CAVI-owned Hermes dashboard standard JSON-RPC driver with bounded,
  abortable requests, validated event notifications, secret-safe remote errors,
  explicit injected-channel ownership, remote-close synchronization, and a safe
  protocol-error observer. Matching malformed responses now reject their shared
  JSON-RPC request instead of occupying capacity indefinitely. The driver
  intentionally does not implement OpenClaw gateway framing, handshake, or
  unobservable reconnect replay claims.
- Documented every public CAVI extension export in a compiler-checked ownership
  inventory and enforced the core-to-extension dependency direction, the exact
  four released provider forwarding exceptions, and generic transport/snapshot
  implementation ownership without changing any public export.
- Published the provider-neutral `createRuntimeControlClient` facade and root
  `CapabilityUnavailable` error for the exact `authStatus`, `sessions`,
  `models`, `usage`, `tasks`, `workspace`, and `events` contract. Documented the
  verified OpenClaw method subset, typed unavailable native cursor resume,
  `stream.reconnected` plus `stream.gap` behavior without replay, and
  client-owned versus caller-owned disposal without changing existing root
  exports, provider subpaths, or execution-plane behavior.

- Registered OpenClaw's canonical seven-module control-plane factory and marked
  only fixture-verified agent, model/auth, usage, session, and task RPC shapes.
  Other providers keep the same facade shape with typed unavailable errors.
- Added OpenClaw capability-matrix detail and documented native reconnect,
  typed unavailable cursor resume, and explicit stream-gap semantics without
  changing existing rows, aliases, routes, or subpath exports.

- Added provider-specific lifecycle helpers to `OpenClawWebSocketClient` for a
  narrow control-plane RPC seam: event subscription, abortable caller waits,
  and idempotent disposal without changing the authenticated gateway wire
  handshake. The internal OpenClaw control-plane factory owns clients it
  creates and leaves injected RPC seams caller-owned by default.
- Provider-neutral `createRuntimeControlClient(provider, options)` construction,
  with alias-aware registry lookup, optional provider canonical factories, and
  a complete typed unavailable facade when a registered adapter is absent.
  Factory options cover URLs, token/auth resolution, cancellation, tracing, and
  injected transport without adding a built-in provider adapter.
- Required `RuntimeControlClient` facade with authentication status,
  sessions, models, usage, tasks, workspace, and events modules, plus idempotent
  disposal and `CapabilityUnavailable`-based unavailable-provider scaffolding.
  The existing optional `RuntimeControlPlane` contract remains supported.
- A versioned documentation consumer contract for the immutable `0.11.0`
  artifact, including its copy path, public base path, stable alias, navigation
  entry point, source-package and generated-content integrity checks, complete
  contract and release navigation, and the explicit repository/CI handoff for
  documentation generated after the already-published npm release.
- Universal shared transport infrastructure at
  `@cavi-ai/api-client/core/transport`, with `createHttpTransport`,
  `createSseTransport`, `createWebSocketTransport`, and
  `createJsonRpcTransport`; curated root transport contracts and guards; and
  compile-checked browser and Node examples. Retries and reconnects are bounded
  and opt-in, mutations require explicit idempotency for replay, SSE resumes by
  cursor with bounded dedupe, and errors/lifecycle events remain secret-safe.
- Node-only stdio and Unix-domain socket byte-channel drivers under
  `@cavi-ai/api-client/core/transport/node`, with bounded opt-in reconnects,
  backpressure handling, no write replay, and exact-once owned-resource cleanup.
- Provider-neutral runtime error codes and optional typed runtime metadata on
  `ApiClientError`, with a root-exported metadata getter and unchanged error
  serialization.
- Provider-neutral runtime control-plane metadata and pagination contracts,
  plus typed HTTP, SSE, WebSocket, JSON-RPC, stdio, and Unix-socket transport
  capabilities with stable-transport detection.
- Focused provider-neutral control-plane contracts for sessions, model catalogs,
  authentication status, usage and cost, tasks, and workspaces.
- Normalized runtime control-plane event contracts, continuity inspection, event
  subscriptions, and the aggregate `RuntimeControlPlane` provider surface.
- Optional provider control-plane declarations and factories, plus a frozen
  capability matrix for all six shipped provider entries. The matrix records
  existing runtime and transport facts without advertising control-plane
  modules before adapters exist.
- Runner-neutral control-plane conformance inspection through the testing
  subpath, with curated root and core runtime contract exports that preserve the
  supported root capability-matrix surface without leaking provider adapters.
- Compile-checked control-plane provider guidance documenting the additive
  execution/control-plane split, stable-first declarations, secret-safe auth
  status, and the truthful adapter-free initial capability matrix.
- `@cavi-ai/api-client/core/kanban` — the first unified capability interface: a
  provider-agnostic `KanbanClient` with canonical card types that preserve the
  backend's native status alongside a canonical status category. Ships an
  OpenClaw Workboard adapter and a `@cavi-ai/api-client/testing` kanban
  conformance kit (`inspectKanbanConformance`) that any `supports.kanban`
  provider must pass.

### Fixed

- Transport authentication failures no longer retain resolver errors that may
  contain credentials; WebSocket disconnect handling is exact-once per socket
  generation; and Unix-socket reconnect timing uses injectable dependencies.
- Runtime error metadata now validates its required and optional fields before
  narrowing unknown values, while preserving the stable serialized error shape.
- Control-plane conformance now rejects both missing declared transports and
  undeclared exposed transports, and the provider matrix no longer represents
  OpenClaw's WebSocket RPC encoding as a separate transport or marks Hermes
  WebSocket support stable without sufficient implementation evidence.

## [0.11.0] - 2026-07-11

### Added

- Added the runtime-owned provider kernel with `createRuntimeClient`,
  `createRuntimeProviderRegistry`, provider-neutral transport options, and the
  `@cavi-ai/api-client/core/runtime/providers` entry.
- Added narrow provider entries for Claude Messages/Managed Agents, Codex
  runtime/files, Gemini runtime/files, Hermes runtime, and OpenClaw runtime.
- Added `@cavi-ai/api-client/testing` with runner-neutral provider conformance
  reports, plus compile-checked Node, browser, React, registry, custom-provider,
  capability, and narrow-import examples.
- Added `dryRun: true` to `startRun`/`streamRun`: the call short-circuits with
  zero network/RPC calls and returns a `dry_run` status/stream event across
  every provider, backed by `buildDryRunStatus`/`buildDryRunStreamEvent` and the
  new `dry_run` run state.
- Added the `isEndpointNotFoundError` type guard (exported and documented).

### Changed

- Moved CAVI team-registry compatibility ownership under
  `extensions/cavi/providers`; legacy Hermes/OpenClaw exports remain deprecated
  forwarding aliases.
- Verification now starts from a clean `dist` before testing and packing.

### Fixed

- Claude and Codex provider modules now advertise the batch capability already
  implemented by their clients. Built-in runtime modules and clients share one
  frozen capability map to prevent metadata drift.
- Usage is normalized into `tokens` on `RUN_COMPLETED` for both the live stream
  and the poll fallback.
- OpenClaw now throws typed errors — `EndpointNotFound` from the SSE subscribe
  stub, and `ApiClientError` for a missing runId or unsupported
  `resolveRunApproval` — and reports `wiki: false`/`media: false` (core RPC gates
  both pre-plugin).
- The 401/403-never-degrades invariant now routes through `isAuthError()` in the
  degradation envelope and operator-control.
- Corrected migration and root-entry documentation that described the current
  `0.10.x` package as `2.x`.

## [0.10.1] - 2026-07-09

### Added

- **Gemini batch backend** — `GeminiApiClient` now implements the batch surface
  over Google's `batchGenerateContent` API (inline requests under ~18MB,
  otherwise JSONL upload via the Gemini Files API). Results map to
  `RuntimeRunStatus` (incl. normalized `tokens`) by `customId`; all requests in
  a batch must share the same model.
- **`GeminiFilesClient`** (`@cavi-ai/api-client/providers/gemini`) — resumable
  file upload, download, retrieve, and delete for the Gemini Files API.

### Changed

- Documentation: README, CONTRIBUTING, and the architecture hero diagram now
  list Gemini alongside the other built-in runtime providers (Codex, Claude) in
  taglines, provider overviews, and contributor layer maps. README Gemini
  section now documents `streamRun`, optional `defaultModel`, synchronous
  `getRun`/`cancelRun` behavior, and batch support.

## [0.10.0] - 2026-07-09

### Added

- **Managed Agents — full `managed-agents-2026-04-01` coverage.**
  `ClaudeManagedAgentClient` gains:
  - **Scheduled deployments** — `createDeployment`, `pauseDeployment`,
    `unpauseDeployment`, `archiveDeployment`, `runDeployment`,
    `listDeploymentRuns`, `getDeploymentRun` over `/v1/deployments` and
    `/v1/deployment_runs`.
  - **Session resources** — `addResource`, `getResource`, `listResources`,
    `updateResource` (rotate a GitHub token on a live session), `deleteResource`.
  - **Lifecycle completeness** — `listAgents`, `listAgentVersions`,
    `archiveAgent`; `listEnvironments`, `updateEnvironment`, `deleteEnvironment`,
    `archiveEnvironment`; `listSessions`, `updateSession` (session-local
    tools/mcp/vault override), `deleteSession`.
  - **Agent version-pinning + overrides** on `createSession` (and
    `startRun`/`streamRun` via `metadata.agent_version` / `resources` /
    `vault_ids`): `agentVersion` emits `{type:"agent",id,version}`,
    `agentOverrides` emits `agent_with_overrides`.
  - Webhook `MANAGED_AGENT_WEBHOOK_EVENT_TYPES` now includes the `agent.*`,
    `deployment.*`, and `deployment_run.*` event types.
- **OpenAI/Codex batch backend** — `CodexApiClient` now implements the batch
  surface over the OpenAI Batch API (upload JSONL → create batch targeting
  `/v1/responses`, `completion_window "24h"` → download output/error files);
  results map to `RuntimeRunStatus` (incl. normalized `tokens`) by `customId`.
- **`CodexFilesClient`** (`@cavi-ai/api-client/providers/codex`) — a minimal OpenAI
  Files client (multipart upload, content download, retrieve, delete).

### Fixed

- Codex batch result downloads now fail with a typed `invalid_json` error when
  OpenAI output/error JSONL is malformed instead of silently skipping bad lines.
  The low-level `parseOpenAIBatchOutput` helper preserves its default skip
  behavior and exposes opt-in strict parsing.

### Security

- HTTP error previews, trace `path`/`url` output, invalid-JSON errors, and
  gateway error messages now redact secret-looking query params and body fields
  (`token=`, `api_key=`, `Bearer …`, etc.) via `REDACTION_PLACEHOLDER`, so
  credentials no longer leak into error strings, logs, or `onTrace` hooks.

## [0.9.0] - 2026-07-02

### Added

- **Batch surface** — an optional `RuntimeClient` batch API gated by a new
  `"batch"` capability: `submitBatch`, `getBatch`, `cancelBatch`, `getBatchResults`
  with `RuntimeBatchRequest`/`RuntimeBatchStatus`/`RuntimeBatchResult` types.
  Implemented for Claude over Anthropic Message Batches (`/v1/messages/batches`);
  results map to `RuntimeRunStatus` (incl. normalized `tokens`) by `customId`.
  OpenAI and Gemini batch backends are planned follow-ups.

## [0.8.0] - 2026-06-30

### Added

- Google **Gemini** provider (runtime-only) at the `./providers/gemini` subpath:
  `GeminiApiClient` + `createGeminiProviderModule` over the Gemini Developer API
  (`:generateContent` / `:streamGenerateContent`), with normalized `tokens`
  usage and canonical run-stream events. Requires an explicit model (no default
  ships) and authenticates with `x-goog-api-key`.

## [0.7.0] - 2026-06-26

### Added

- Normalized token usage. `RuntimeUsage` plus `RuntimeRunStatus.tokens` give a
  provider-agnostic view of token counts (`inputTokens`, `outputTokens`,
  `totalTokens`, `cacheReadTokens`, `cacheWriteTokens`, lossless `raw`), populated
  by Claude, Codex, and gateway run statuses. The streamed `run.completed` event
  carries the same usage via a new optional `usage: RuntimeUsage`.
- `estimateUsageCost(usage, prices)` + `TokenPrices` — a pluggable cost estimate.
  The package ships no price table; callers supply per-million-token prices.
- `normalizeRuntimeUsage(raw, providerKind)` — normalizes a flat provider-native
  usage record into `RuntimeUsage`.
- Conformance kit now requires a provider to expose normalized `tokens` whenever
  it reports raw `usage`.

### Deprecated

- `RuntimeRunStatus.usage` (raw provider-native counts). Use `tokens`. The field is
  still populated; no removal is scheduled.

## [0.6.0] - 2026-06-15

### Added

- `assertSafeRelativePath(value)` (root + `./contracts`) — an opt-in validator
  for free-form relative paths (e.g. a raw `?path=` value bound for a
  workspace/wiki file endpoint). Rejects absolute paths, URL schemes,
  backslashes, and `.`/`..` segments including percent-encoded forms; returns the
  cleaned `a/b/c` form. `appendHttpQuery` only URL-encodes and does not sanitize,
  so untrusted path values should pass through this first. The manifest workspace
  whitelist (`resolveTeamWorkspacePath`) remains the primary guard.
- `typecheck:docs` gate (`tsconfig.docs.json`) — typechecks the shipped
  documentation examples (`docs/*.ts`) against the package source, in `verify`
  and CI. Doc examples are outside the build, so this prevents them drifting from
  the real exports.

### Fixed

- Documentation examples no longer reference names the package does not export.
  `docs/team-manifest.consumer.template.ts` used `TeamManifestMember` /
  `TeamManifestTeam` (the real exports are `ManifestMember` / `ManifestTeam`) and
  imported `TeamRegistryConfig` from the root (it ships on `./extensions/cavi`).
  `docs/cavi-team-manifest.example.ts` placed `portalId` as a top-level identity
  field (host hints belong in `identity.metadata`) and imported
  `TeamRegistryConfig` from the root. No runtime/API change — examples only.

### Documentation

- `docs/team-manifest.md` adds a "Workspace Files And Path Safety" section
  covering the whitelist boundary, the unsanitized raw `?path=` query, and the
  `assertSafeRelativePath` helper, and corrects the `configureTeamRegistryConfig`
  import to the `./extensions/cavi` subpath.

## [0.5.0] - 2026-06-06

### Added

- `@cavi-ai/api-client/providers/codex` — a runtime-only Codex provider backed
  by the OpenAI Responses API. `CodexApiClient` defaults to `gpt-5-codex`,
  starts background responses, supports polling via `getRun`, cancellation via
  `cancelRun`, and maps Responses SSE into canonical `RunStreamEvent`s.
- `createCodexProviderModule` for registering Codex with
  `createRuntimeProviderRegistry` under `codex-responses` with `codex` and
  `openai-codex` aliases.

### Changed

- Package metadata and README now describe Codex as an additive runtime-only
  provider. The root export remains curated; Codex is available only through
  its provider subpath.

## [0.4.1] - 2026-06-06

### Changed

- npm package metadata only — no code change. The `package.json` `description`
  and `keywords` now surface Claude Managed Agents (beta) (`managed-agents`,
  `claude-managed-agents`, `stateful-agents`, `mcp`, `agents`), since a
  published version's registry metadata can only be updated by publishing a new
  version.

## [0.4.0] - 2026-06-06

### Added

- **Claude Managed Agents (beta) support** under
  `@cavi-ai/api-client/providers/claude`. The Anthropic Managed Agents beta
  (`managed-agents-2026-04-01`) is a stateful, server-run agent surface
  (persisted/versioned agents → per-run sessions → containerized
  environments) with an SSE event stream. This release wires it to the
  package's universal `RuntimeClient` contract so the same code can target a
  managed Claude agent or any gateway provider. Wire shapes were verified
  against the live beta API on 2026-06-05/06.
- `ClaudeManagedAgentClient` — implements `RuntimeClient` and adds the full
  managed-agents control plane: sessions (`createSession`, `getSession`,
  `sendMessage`, `sendEvents`, `interruptSession`, `archiveSession`,
  `listEvents`, `openEventStream`), agents and environments
  (`createAgent`, `updateAgent`, `getAgent`, `createEnvironment`). Supports
  either an `apiKey` (`x-api-key`) or an OAuth `authToken` (Bearer), with
  configurable request and stream timeouts.
- Steering round-trips: `confirmTool` (`user.tool_confirmation`) and
  `respondCustomTool` (`user.custom_tool_result`), including the optional
  `session_thread_id` for multiagent fan-out.
- `driveManagedAgentSession` — a stream-first session driver with history
  dedupe and reconnect that is deadlock-safe across reconnects (tool answers
  are marked responded only after a successful send, so a dropped stream
  re-drives instead of stalling). Handlers cover messages, tool confirmations,
  custom tools, outcome evaluation, and thread events.
- Typed session events: `parseSessionEvent` / `parseSessionEventData` and a
  discriminated `ManagedAgentSessionEvent` union (message, tool_use,
  custom_tool_use, tool_result, status, error, outcome_start/progress/end,
  thread_created/status/message, other) with predicates
  (`sessionEventNeedsConfirmation`, `isCustomToolUseEvent`,
  `isTerminalSessionEvent`, `isOutcomeEndEvent`, `isThreadEvent`).
- Outcomes — `defineOutcome` for rubric-graded session loops, surfaced as
  `outcome_*` events.
- Multiagent threads — `listThreads`, `getThread`, `archiveThread`,
  `listThreadEvents`, `openThreadEventStream`.
- Memory stores — full CRUD over stores, memories, and memory versions
  (`createMemoryStore`/`getMemoryStore`/`listMemoryStores`/`deleteMemoryStore`/
  `archiveMemoryStore`, `createMemory`/`getMemory`/`listMemories`/
  `updateMemory`/`deleteMemory`, `listMemoryVersions`/`getMemoryVersion`/
  `redactMemoryVersion`). `updateMemory` is `POST` (verified against the live
  API — the beta does not accept `PATCH` here).
- Vaults & MCP credentials — `createVault`/`getVault`/`listVaults`/
  `updateVault`/`deleteVault`/`archiveVault` and credential CRUD
  (`createCredential`/`getCredential`/`listCredentials`/`updateCredential`/
  `deleteCredential`/`archiveCredential`) plus
  `validateMcpOauthCredential` for `static_bearer` and `mcp_oauth` MCP auth.
- Self-hosted environment monitoring — `getWorkQueueStats` and `stopWork`
  for `self_hosted` environments. This is queue observation and control only;
  the package does not ship a tool-executing worker (that boundary stays with
  the host).
- Webhook verification — `verifyManagedAgentWebhook` / `parseWebhookEvent`
  implementing the Standard Webhooks signing scheme the Anthropic SDK uses
  (`webhook-id`/`webhook-timestamp`/`webhook-signature` with `x-webhook-*`
  aliases, HMAC-SHA256 over `id.timestamp.body`, base64 `whsec_` key,
  5-minute tolerance) via Web Crypto — no new runtime dependency. Verified
  against the scheme with an independent `node:crypto` signer; live delivery
  is not part of this release.
- `buildManagedAgentTeamsPlan` / `provisionManagedAgentTeams` — map a
  `TeamManifest` to a Managed Agents coordinator + roster, reading
  per-member model/system/tools from `metadata.claude`.
- `createClaudeManagedAgentProviderModule` — a `claude-managed-agents`
  provider module.
- Docs-integrity test gate (`src/__tests__/docs-integrity.test.ts`): fails
  the build (and therefore `prepublishOnly`) if the published version has no
  matching `CHANGELOG.md` entry, if a released heading is undated, or if the
  README documents a subpath the package does not export.

### Notes

- No breaking changes. The stateless Claude Messages-API client
  (`ClaudeApiClient`) is unchanged; Managed Agents is an additive subtree
  re-exported from the same `@cavi-ai/api-client/providers/claude` entry.

## [0.3.0] - 2026-06-04

### Added

- OpenClaw Workboard mirror under `@cavi-ai/api-client/providers/openclaw`,
  including native Workboard statuses, priorities, Gateway RPC method names, and
  a small RPC helper over caller-supplied transport.
- Manifest coverage for native `workboard.*` Gateway RPC methods, with the
  vendored RPC fixture updated so manifest drift remains test-covered.
- CAVI Project Board compatibility adapter that projects native Workboard cards
  into legacy backlog/workspace snapshots and routes known backlog/call
  mutations through typed Workboard RPC when an RPC client is available.

### Changed

- Documented OpenClaw Workboard as a Gateway RPC surface rather than an HTTP
  route table.
- Clarified legacy kanban and CAVI Project Board REST entries as compatibility
  surfaces that follow upstream runtime/plugin behavior.

## [0.2.1] - 2026-06-01

This release reorganizes the package around a provider-agnostic `RuntimeClient`
contract, adds the first runtime-only provider (Claude / Anthropic), and curates
the public surface. No consumers depend on the `0.2.x` line yet, so the surface
changes are a pre-publish clean-up rather than a consumer-facing break.

### Added

- Provider-agnostic `RuntimeClient` contract — the universal tier (capabilities ·
  runs · streaming) that every provider implements, with `GatewayClient`
  re-expressed as an extension. New `RuntimeRunStartBody` / `RuntimeRunStatus`
  (no gateway fields), `RuntimeCapabilities`, and `RuntimeProviderModule`.
- Claude (Anthropic) runtime-only provider at
  `@cavi-ai/api-client/providers/claude` — synchronous runs and SSE streaming
  normalized into the canonical `RunStreamEvent`, built via
  `createClaudeProviderModule({ apiKey })`.
- Credential / auth seam — `bearerCredentials`, `apiKeyCredentials`, and
  `auth.resolveHeaders` on `BaseHttpApiClient`, so a provider declares its own
  scheme (bearer · cookie · `x-api-key`).
- Protocol-version guard — `checkProtocolVersion` / `assertProtocolVersion` and a
  typed `ProtocolMismatch` error.
- Manifest as an interface — `TeamManifestSource` (static + cached/refreshable)
  and `TeamRouteResolver`, so a host brings its own manifest and the package owns
  no manifest data.
- Generic provider registry — `createProviderRegistry` and
  `createRuntimeProviderRegistry`, so runtime-only providers register and resolve
  alongside gateway providers.
- Canonical run-stream contract in `core/runtime` (`RUN_STREAM_EVENT_NAMES`, the
  `RunStreamEvent` union, and the `RunEventStream*` interfaces); `RuntimeClient`
  gains an optional `streamRun`.
- A provider runtime conformance kit and a CI acceptance gate
  (`typecheck:gate`) that proves the Runtime contract holds the Claude shape.
- `withFallback` optional `onResolve` hook for live-vs-mock observability.
- `MIGRATION.md` mapping the public-surface relocations.
- Provider-agnostic manifest schema at
  `src/core/gateway/providers/manifest.types.ts`, plus the OpenClaw manifest at
  `src/providers/openclaw/manifest.ts` (mirroring the vendored gateway doc), its
  derived constants in `src/providers/openclaw/manifest.derive.ts`, and a
  conformance test that fails the build on drift.

### Changed

- `RuntimeClient.getRun` / `cancelRun` are now optional — synchronous/stateless
  providers omit them instead of throwing.
- Manifest child types renamed `TeamManifest{Team,Member,Identity,RouteConfig}` →
  `Manifest*`; `ManifestIdentity` drops `portalId` / `sector*` into a generic
  `metadata` bag (the consuming registry reads them from there).
- The root entry is slimmed to a curated stable API. Provider modules, the CAVI
  extension, and low-level core primitives are reachable only via their subpaths
  (`./providers/*`, `./extensions/cavi`, `./core/*`) — see `MIGRATION.md`.
- `X-Portal-Client-Id` is now opt-out (`includePortalClientIdHeader`); the Claude
  provider opts out so it doesn't send a gateway header to non-gateway backends.
- Unified capability dispatch: provider modules route the UI's single capability
  calls to each gateway's native surface. `OpenClawMediaApiClient` /
  `OpenClawWikiApiClient` / `OpenClawAgentConfigApiClient` throw a typed
  `EndpointNotFound` until a plugin manifest registers routes.

### Removed

- ~64 re-exports were dropped from the root entry and relocated to their
  subpaths. No symbols were lost — a reachability test guards that every one
  still resolves via `./providers/*`, `./extensions/cavi`, or `./core/*`.
- `OPENCLAW_MEDIA_API_ENDPOINTS`, `OPENCLAW_WIKI_API_ENDPOINTS`, and
  `OPENCLAW_AGENT_CONFIG_API_ENDPOINTS` aliases in `contracts/paths.ts` — those
  `/v1/media/*` and `/v1/wiki/*` REST paths do not exist on OpenClaw.

## [0.2.0] - 2026-05-28

First public release of `@cavi-ai/api-client` as a standalone, gateway-agnostic
client for agent runtimes.

### Added

- Gateway-agnostic HTTP (`BaseHttpApiClient`, `CaviControlApiClient`), WebSocket
  RPC (`GatewayRpcClient`), SSE run-event streams, and run/media/wiki clients.
- `GatewayApiClient` with a provider-module registry for built-in and
  host-supplied gateways (Hermes, OpenClaw, or your own).
- Typed error surface — `HttpApiError`, `GatewayHttpError`, `GatewayRpcError`,
  `ApiClientError` — with guards `isHttpApiError`, `isGatewayHttpError`,
  `isAuthError`, `isAbortError`, and `getErrorStatus`.
- Structured graceful degradation via `DataEnvelope`, `withFallback`, and
  `withMutationResult`.
- Owned path and surface contracts (`resolvePath`, `resolveCaviPath`) plus a
  runtime-supplied team manifest with normalization, lookup validation,
  workspace-path whitelisting, and route bindings.
- Optional React bindings at `@cavi-ai/api-client/frameworks/react`; UI-framework
  bindings live as siblings under `frameworks/**`.
- CAVI extension adapters for product-shaped dashboards and fallback providers.
- Strict package-boundary hardening tests, ESM-only build, and subpath exports.
- Public release docs, including contributing, security, architecture, code of
  conduct, issue templates, CI, and trusted npm publishing workflow.

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.11.0...v0.12.0
[0.5.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/cavi-ai/cavi-api-client/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.2.0

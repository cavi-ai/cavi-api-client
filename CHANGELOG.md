# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.x` were unpublished pre-release iterations. `0.2.0` is the first tracked
> public release; the history below starts here.

## [Unreleased]

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

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/cavi-ai/cavi-api-client/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.2.0

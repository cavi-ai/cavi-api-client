# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.x` were unpublished pre-release iterations. `0.2.0` is the first tracked
> public release; the history below starts here.

## [Unreleased]

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

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/cavi-ai/cavi-api-client/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.2.0

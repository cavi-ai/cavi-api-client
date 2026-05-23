# Changelog

All notable changes to `@cavi/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Canonicalized gateway core ownership docs around `client`, `agent`, `run`,
  `rpc`, `snapshots`, `resources`, `envelope`, and `portal` modules.
- Replaced the flat `src/core/gateway/*.ts` shim set with a single canonical
  `src/core/gateway/index.ts` aggregate that points at owner-folder indexes.
- Moved snapshot TTL cache helpers to `src/core/gateway/snapshots/cache.ts`.
- Published `./core/gateway` from the canonical gateway aggregate.

### Fixed

- Prevented core gateway provider resolution from becoming a second provider
  boundary; provider selection stays in `src/providers/gateway/**`.
- Moved old flat gateway shim files, the old provider-resolution file, and stale
  generated output to quarantine.
- Aligned portal config patch paths with the `portal.config` surface contract.

## [1.0.0] - 2026-05-22

First public release.

`@cavi/api-client` is the single gateway-agnostic TypeScript client for agent
runtimes: HTTP + WebSocket access to runs, capabilities, media, wikis, team
registries, and fleet snapshots, with structured graceful degradation built in.

### Added

- **Gateway-agnostic core.** `BaseHttpApiClient` (fetch wrapper: timeout, bearer
  auth, trace hooks, typed `HttpApiError`) and `GatewayRpcClient` (WebSocket RPC:
  device-auth handshake, backpressure, reconnect, redacted trace) as the only two
  network-touching primitives.
- **Provider model.** `createGatewayApiClient(opts, { provider | env })` selecting
  `gateway` / `hermes` / `openclaw` implementations behind one interface, with
  `Hermes*` / `OpenClaw*` names as provider-specific compatibility exports.
- **Provider plugin boundary.** `createGatewayProviderRegistry` and
  `GatewayProviderModule` (exported from `@cavi/api-client/providers/gateway`) so
  third-party gateways register at the factory boundary without forking the package.
- **Gateway resources.** Media (`GatewayMediaApiClient`), wiki
  (`GatewayWikiApiClient`), and agent-config (`GatewayAgentConfigApiClient`)
  clients with provider adapters.
- **Run streaming.** `GatewaySseRunEventProvider`, run-event stream composition,
  and `streamGatewayChatRun` over canonical run/run-stream contracts in `core`.
- **Capabilities UI helpers.** `extractGatewayCommandCatalog`,
  `buildAgentSlashShortcuts`, `buildAgentMentionChips`, `buildAgentCommandSurface`
  sourced from `/v1/capabilities`.
- **Graceful degradation contract.** `withFallback` / `withMutationResult` return
  a typed `DataEnvelope` with `source: "mock"` and a structured `contractGap` on
  transport/backend failure; 401/403 and `unknown`-classified errors still throw.
- **Path contracts.** Route literals owned by `*paths.ts` files
  (`src/contracts/paths.ts`, `src/cavi/paths.ts`) and `src/contracts/surfaces.ts`,
  with `resolvePath(key, mode)` for `GatewayMode` resolution.
- **Team manifest.** Runtime-supplied team / member / workspace / action routing
  via `normalizeTeamManifest`, generated route grammar, workspace-path
  whitelisting, and `resolveGatewayRouteBinding`. `TEAM_REGISTRY_CONFIG` ships empty.
- **React bindings.** `GatewayClientProvider` and `useGatewayClient` /
  `useGatewayRpc` / `useGatewayEvents` / `useGatewayConnectionState` /
  `useGatewayEventStream` hooks (React is an optional peer dependency).
- **UI data adapters.** `createCaviControlAdapters` combining gateway WebSocket
  RPC with HTTP and mock fallbacks.
- **Environment + repo-root resolution.** `resolveHttpApiConfigFromEnv`,
  `requireRepoRoot` / `resolveRepoRoot`.
- **Subpath exports** for `core/*`, `contracts`, `cavi`, `providers/*`, and `react`.
- **Tooling.** MIT license, `vitest run --coverage` via `@vitest/coverage-v8`,
  and package-boundary hardening tests in `src/package-hardening.test.ts`.

### Project history

This package was extracted and consolidated from per-app API clients that had
forked across multiple harnesses (mobile, portal, and several gateways). The
pre-1.0 development era (internal `0.x`) restructured that scattered code into a
strict `core → contracts → cavi → providers/react` layering, moved shared
transport/HTTP/SSE/WebSocket behavior into `core`, replaced baked-in product
registries with a runtime team manifest, and established the package-boundary
hardening tests. `1.0.0` is the first release published for external use.

[Unreleased]: https://github.com/sasan1200/cavi-api-client/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sasan1200/cavi-api-client/releases/tag/v1.0.0

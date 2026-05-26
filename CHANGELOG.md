# Changelog

All notable changes to `@cavi-ai/api-client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions CI for PRs and pushes to `main`, running install, tests, build,
  and package dry-run across Node 20 and 22.
- GitHub Actions publish workflow for GitHub releases and manual dry-runs,
  publishing to npm with provenance via OIDC trusted publishing (no token).
- Husky `pre-commit` and `pre-push` hooks for local test/build/package gates.

## [0.1.0] - 2026-05-25

Initial public pre-1.0 release.

`@cavi-ai/api-client` is the gateway-agnostic TypeScript client for agent
runtimes: HTTP + WebSocket access to runs, capabilities, media, wikis, team
registries, and fleet snapshots, with structured graceful degradation built in.

### Added

- **Gateway-agnostic core.** `BaseHttpApiClient` (fetch wrapper: timeout, bearer
  auth, trace hooks, typed `HttpApiError`) and `GatewayRpcClient` (WebSocket RPC:
  device-auth handshake, backpressure, reconnect, redacted trace) as the only two
  network-touching primitives.
- **Provider model.** `createGatewayApiClient(opts, { provider | env })` selecting
  `gateway` / `hermes` / `openclaw` implementations behind one interface, with
  `Hermes*` / `OpenClaw*` names available from provider-specific exports.
- **Provider plugin boundary.** `createGatewayProviderRegistry` and
  `GatewayProviderModule` (exported from `@cavi-ai/api-client/core/gateway`) so
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
- **Overrideable fallback providers.** Core snapshots and operator-control
  adapters default to neutral empty fallbacks; CAVI-specific snapshot/control data
  is opt-in through `createCaviSnapshotFallbackProvider` and
  `createCaviControlAdapterFallbackProvider`.
- **Runtime override hooks.** RPC preauth env keys, request timeout, max
  concurrency, default scopes, provider fallbacks, and core default values can be
  overridden by the host app or provider module.
- **Path contracts.** Route literals owned by `*paths.ts` files
  (`src/contracts/paths.ts`, `src/extensions/cavi/contracts/paths.ts`) and
  surface owner files, with `resolvePath(key, mode)` for `GatewayMode` resolution.
- **Team manifest.** Runtime-supplied team / member / workspace / action routing
  via `normalizeTeamManifest`, generated route grammar, workspace-path
  whitelisting, action override resolution, duplicate detection, and hardened
  dynamic path validation. `TEAM_REGISTRY_CONFIG` ships empty.
- **CAVI manifest example.** A plugin-owned CAVI team manifest example and fixture
  demonstrate how consumers supply teams, portal bindings, workspaces, and action
  routes without baking registry data into the package.
- **React bindings.** `GatewayClientProvider` and `useGatewayClient` /
  `useGatewayRpc` / `useGatewayEvents` / `useGatewayConnectionState` /
  `useGatewayEventStream` hooks (React is an optional peer dependency).
- **UI data adapters.** `createCaviControlAdapters` combining gateway WebSocket
  RPC with HTTP and fallback providers.
- **Environment + repo-root resolution.** `resolveHttpApiConfigFromEnv`,
  `requireRepoRoot` / `resolveRepoRoot`.
- **Subpath exports** for `core/*`, `contracts`, `extensions/cavi`,
  `providers/hermes`, `providers/openclaw`, and `react`.
- **Tooling.** MIT license, `vitest run --coverage` via `@vitest/coverage-v8`,
  `prepack` / `prepublishOnly` gates, package docs in the npm tarball, and
  package-boundary hardening tests in `src/__tests__/package-hardening.test.ts`.

[Unreleased]: https://github.com/cavi-ai/cavi-api-client/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cavi-ai/cavi-api-client/releases/tag/v0.1.0

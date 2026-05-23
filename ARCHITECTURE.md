# /api-client Architecture

This package is organized around first-class boundaries, not legacy buckets. CAVI is a product/data module, not a compatibility module. It can own CAVI data, domain shaping, adapters, and current CAVI routes, but it must use shared core clients and shared contracts instead of inventing parallel transport or route machinery.

## Source Layout

```text
src/
  core/
    data/
    env/
    gateway/
      agent/
      client/
      envelope/
      portal/
      providers/
      resources/
      rpc/
      run/
      snapshots/
    http/
    runtime/
    sse/
    ws/
  contracts/
  extensions/
    cavi/
      adapters/
      contracts/
      discourse/
      domain/
      fallbacks/
      library/
      operator-control/
      portal/
      project-board/
      registry/
      runtime/
  providers/
    hermes/
    openclaw/
  react/
  __tests__/
    extensions/
      cavi/
    fixtures/
  index.ts
```

Active source is organized under canonical folders. `src/core/gateway/index.ts`
is the single canonical aggregate for gateway owner folders and backs the
published `./core/gateway` subpath. Old flat `src/core/gateway/*.ts` shim paths
are not active source, are not package-owned import targets, and must not be
reintroduced.
Provider resolution has one boundary in `src/core/gateway/providers/**`; the old core
gateway provider-resolution file is not active source.

## Dependency Direction

- `core/**` contains shared data, env, gateway, HTTP, runtime, and WebSocket behavior. It must not import from `extensions/cavi/**`, concrete `providers/**`, `react/**`, or compatibility shims.
- `core/sse/**` owns generic Server-Sent Events parsing, stream consumption, and abort-signal helpers. Gateway-specific run-event translation and polling fallback remain in `core/gateway/**`.
- `core/ws/**` owns generic WebSocket target resolution, close-event normalization, and WebSocket-facing aliases. Gateway-specific connect/auth protocol remains in `core/gateway/**`.
- `core/runtime/**` contains generic base-path helpers only. It must not know product globals such as OpenClaw/CAVI base-path keys; CAVI runtime wrappers read those globals and call core helpers.
- `contracts/**` contains global route, surface, and agnostic team-manifest contracts. It must not import from `extensions/**` or providers.
- `extensions/cavi/**` may import from `core/**` and `contracts/**`. It owns CAVI clients, extension contracts, adapters, domain DTOs, and registry wrappers.
- `providers/hermes/**` and `providers/openclaw/**` may import from `core/**` and `contracts/**`.
- `core/gateway/providers/**` owns the gateway provider plugin boundary. Its
  `types.ts`, `normalize.ts`, `registry.ts`, and `factory.ts` modules must stay
  provider-implementation agnostic. Built-in provider modules belong in
  `src/providers/hermes/provider-module.ts` and
  `src/providers/openclaw/provider-module.ts`.
- `react/**` may import from `core/gateway/**` and React only.
- `extensions/cavi/fallbacks/snapshots/**` contains runtime fallback snapshots used by degraded gateway flows. These are production fallback data, not test mocks.
- `extensions/cavi/data/**` is removed legacy shim space. Active source should import named folders such as `extensions/cavi/project-board/**`, `extensions/cavi/operator-control/**`, `extensions/cavi/portal/**`, `extensions/cavi/registry/**`, `extensions/cavi/runtime/**`, or `extensions/cavi/library/**` directly.
- `__tests__/extensions/cavi/**` contains CAVI tests. Test files should not live under production `extensions/cavi/**` folders.
- `__tests__/fixtures/**` contains test-only fixtures and helpers. Production modules must not depend on it and it is not part of the build include.

## CAVI Boundary

Current CAVI paths such as `/cavi-control/api/*`, `/library/api/*`, dynamic portal plugin routes, and portal-memory routes are active CAVI extension contracts. Route literals and dynamic route helpers are owned by `src/extensions/cavi/contracts/paths.ts`; CAVI surface keys are owned by `src/extensions/cavi/contracts/surfaces.ts`. Global gateway/team/kanban contracts stay in `src/contracts/**`.

CAVI must not duplicate:

- HTTP client implementation
- JSON HTTP request helpers, query builders, gateway HTTP errors, or gateway error-detail parsing
- generic data guards and coercion helpers
- gateway envelope/fallback contracts
- runtime base-path helpers
- gateway RPC implementation
- generic SSE block parsing, stream consumption, or abort-signal composition
- generic WebSocket target or close-event helpers
- gateway SSE run-event parsing or polling fallback
- gateway media interfaces for audio, video, or music
- gateway wiki interfaces for Obsidian/QMD vault ingest, compile, or promote
- route resolver logic
- static team registry defaults

CAVI should call shared core methods and shared contract helpers.

CAVI data behavior should live in named feature folders. Generic helpers belong
in `core/**`; global route literals belong in `src/contracts/paths.ts`; CAVI feature
route aliases and route helper functions belong in `src/extensions/cavi/contracts/paths.ts`;
operator defaults and section helpers live in `src/extensions/cavi/operator-control/**`.

## Cleanup Progress

Completed cleanup passes:

- Project Board active implementation is consolidated under `src/extensions/cavi/project-board/**`.
- Discourse active implementation is consolidated under `src/extensions/cavi/discourse/**`.
- Generic data guards moved to `src/core/data/**`.
- Shared JSON HTTP request helpers and gateway HTTP errors moved to `src/core/http/**`.
- Gateway envelope/fallback contracts moved to `src/core/gateway/**`.
- Gateway health/log tail system loaders moved to `src/core/gateway/snapshots/system-loaders.ts`.
- Gateway-derived overview, run, routing, and incident snapshot orchestration moved to `src/core/gateway/snapshots/loaders.ts`, with fallbacks and source bindings injected by callers.
- Generic runtime base-path helpers moved to `src/core/runtime/**`, with CAVI runtime wrappers under `src/extensions/cavi/runtime/**`.
- Generic SSE stream parsing and consumption moved to `src/core/sse/**`; gateway run-event providers now compose those helpers.
- Project Board and operator route aliases moved to `src/extensions/cavi/contracts/paths.ts`; operator defaults and section helpers remain in `src/extensions/cavi/operator-control/**`.
- Gateway raw fetch helpers moved to `src/core/gateway/client/fetch.ts`; CAVI library code now only adapts session-auth runtime details before using core HTTP transports.
- Gateway snapshot TTL cache helpers moved to `src/core/gateway/snapshots/cache.ts`; the old `src/core/gateway/cache.ts` path is not active source.
- Generic WebSocket target resolution and close-event normalization moved to `src/core/ws/**`; the stale `src/core/gateway/websocket.ts` alias is not active source.
- Legacy `src/extensions/cavi/data/**` re-export/path shims are not active source; canonical folders and path-owner modules are imported directly.
- Dynamic CAVI portal route construction lives in `src/extensions/cavi/contracts/paths.ts`; CAVI portal clients call that helper instead of assembling API templates inline.
- Portal envelope/library/memory contracts moved to `src/extensions/cavi/contracts/portals.ts`; CAVI registry and adapter code imports those extension contracts directly.
- CAVI-labeled core re-export shims for runtime HTTP transport and portal client-id validation are not active source; active modules import `core/http/**` and `contracts/**` directly.
- Duplicate Project Board/Discourse mock fixtures and stale generated `dist` outputs are not active source.

Remaining cleanup should focus on reducing the active `src/extensions/cavi/**` surface to
actual CAVI-specific behavior, especially any lingering compatibility shims,
operator fallback modules, or generic helpers that still live under CAVI names.
`src/extensions/cavi/data/**` should not return to active source.

## Gateway Transports

HTTP, run-event SSE, and gateway RPC are core gateway contracts. Generic
WebSocket helpers live in `src/core/ws/**`; gateway protocol implementations
live in `src/core/gateway/**`; provider adapters live under
`src/providers/hermes/**` and `src/providers/openclaw/**`.

- HTTP: `GatewayApiClient` is the base client; Hermes and OpenClaw expose thin
  provider clients selected by `createGatewayApiClient`.
- Raw gateway fetch helpers, raw HTTP access, request-init conversion, portal client-id validation, gateway
  error-detail parsing, runtime base-path helpers, and runtime HTTP/WS target
  resolution live under `src/core/http/**`, `src/core/runtime/**`, or
  `src/core/gateway/**`. CAVI may wrap these for product fallbacks, but must
  not duplicate the transport rules.
- SSE: `core/sse/**` owns SSE parsing and stream consumption.
  `core/gateway/run/**` owns canonical run-event contracts, translation, and polling
  fallback. Provider adapters only add endpoint maps and required
  routing/session headers.
- WebSocket/RPC: `core/gateway/rpc/**` owns the gateway JSON-RPC protocol,
  device identity auth, and preauth handshakes while `core/ws/**` owns generic
  target and close-event helpers. Provider clients are selected through
  `createGatewayWebSocketClient` or the `createGatewayRpcClient` alias.
- Agent config: `core/gateway/agent/**` owns the provider-neutral native
  `/api/agent-configs/:id/config` contract, command parsing, voice parsing, and
  generic config normalization.
  Provider compatibility fallbacks, provider cookies, provider source paths,
  and WebUI-shaped payload adapters belong in the provider implementation,
  currently `providers/hermes/agent-config.ts`.

New transport behavior should enter through these core contracts first. A
provider module may customize headers, endpoint maps, factories, or defaults,
but it should not fork the parser, RPC protocol, retry semantics, or trace
behavior.

Provider selection is a plugin boundary, not a core gateway concern:

- `core/gateway/providers/types.ts` defines `GatewayProviderModule` and the factory
  interface each plugin implements.
- `core/gateway/providers/registry.ts` resolves explicit provider choices,
  `CAVI_GATEWAY_PROVIDER`, `GATEWAY_PROVIDER`, aliases, and default providers.
  It rejects duplicate provider keys unless an override is explicit.
- `core/gateway/providers/factory.ts` adapts resolved provider modules into the
  public `createGateway*` factory functions.
- `providers/hermes/provider-module.ts` and
  `providers/openclaw/provider-module.ts` expose the built-in provider modules.
  New third-party providers should be passed as modules or registries by the
  host app instead of being added to this package.
- Core gateway does not own provider resolution; provider selection has one
  boundary in `src/core/gateway/providers/**`.

CAVI adapter modules should stay as composition layers over those contracts.
For gateway WebSocket-backed control surfaces, `core/gateway/snapshots/session-loaders.ts`
owns `sessions.*` request coalescing and cache behavior, while
`core/gateway/snapshots/loaders.ts` owns reusable snapshot assembly. CAVI
adapters inject compatibility fallbacks and keep CAVI-only surfaces such as
operator control, Project Board, Discourse, cost history, and library loading.

## Gateway Media

Audio, video, and music are core gateway features. The shared interface lives in
`src/core/gateway/resources/media.ts`; provider-specific clients live under
`src/providers/hermes/**` and `src/providers/openclaw/**`. Product surfaces such
as Machine TTS may remain as compatibility helpers, but new media generation
should use `GatewayMediaApiClient` or `createGatewayMediaClient` so Hermes and
OpenClaw stay behind the same contract.

## Gateway Wiki

Wiki support is also a core gateway feature. The shared interface lives in
`src/core/gateway/resources/wiki.ts`; provider-specific clients live under
`src/providers/hermes/**` and `src/providers/openclaw/**`. The gateway wiki
contract treats external wiki plugins as specialized Obsidian-style vaults
backed by QMD and owns common methods such as vault listing, tree/read, ingest,
compile, promote, job lookup, and artifact download. Legacy `/api/obsidian/*`
routes are compatibility shims only; new frontend code should use
`GatewayWikiApiClient` or `createGatewayWikiClient`.

## Registry Model

Team and portal registry data is runtime configuration. `TEAM_REGISTRY_CONFIG` starts empty, apps populate it after loading gateway/plugin config, and registry-dependent APIs fail loudly when config is missing.

Team manifests are the preferred agnostic input shape for dynamic frontend
compatibility. A manifest has a `teams` array, a default team-of-one helper for
minimal setups, shared generated routes such as team Kanban/runs/config and
team/member workspace APIs, and per-team or per-member workspace roots with
explicit whitelisted relative paths. Product names such as Project Board or Martina
should not define core route grammar; they may supply manifest entries,
workspace folders, capabilities, or compatibility adapters.

Gateway route bindings are also manifest data. Runtime sources such as chat
rooms, workplace tools, or deployment-specific channels should be expressed as
`GatewayRouteBinding` entries and resolved through `resolveGatewayRouteBinding`
instead of adding package-owned route literals or hardcoded channel names.

New team-shaped CAVI paths should use the `team.*` contracts first. Existing
Project Board, Martina, Machine, Front Door, and portal-memory paths are compatibility
contracts and should not be expanded unless a gateway compatibility boundary
requires it.

## Removed Legacy Paths

Legacy shim paths are not retained as active source, generated output, package
exports, `tsconfig.json` inputs, or test fixtures. Reintroducing a removed path
requires updating the hardening tests with a concrete compatibility reason.

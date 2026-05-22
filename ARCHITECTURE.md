# /api-client Architecture

This package is organized around first-class boundaries, not legacy buckets. CAVI is a product/data module, not a compatibility module. It can own CAVI data, domain shaping, adapters, and current CAVI routes, but it must use shared core clients and shared contracts instead of inventing parallel transport or route machinery.

## Source Layout

```text
src/
  core/
    http/
    gateway/
    env/
  contracts/
  cavi/
    adapters/
    data/
    domain/
    fallbacks/
    library/
    portal/
    registry/
    runtime/
  providers/
    hermes/
    openclaw/
  react/
  compat/
    martina/
  __tests__/
    cavi/
    fixtures/
  index.ts
```

The build includes canonical folders plus explicit compatibility modules such
as `src/compat/martina/**`. Old root/source paths are not supported, are not
package exports, and are not built. They are preserved only under
`quarantine/src/**` because this repo forbids deletion.

## Dependency Direction

- `core/**` contains shared HTTP, gateway, and env behavior. It must not import from `cavi/**`, `providers/**`, `react/**`, or compatibility shims.
- `contracts/**` contains route, surface, and agnostic team-manifest contracts. It must not import from `cavi/**` or providers.
- `cavi/**` may import from `core/**` and `contracts/**`. It owns CAVI clients, data, adapters, domain DTOs, and registry wrappers.
- `providers/**` may import from `core/**`, `contracts/**`, and shared CAVI registry/domain types when needed.
- `react/**` may import from `core/gateway/**` and React only.
- `compat/**` owns explicit compatibility domains such as Martina. It is not a
  dumping ground for stale root import paths.
- `cavi/fallbacks/snapshots/**` contains runtime fallback snapshots used by degraded gateway flows. These are production fallback data, not test mocks.
- `cavi/data/lib/**` is compatibility shims only. New implementation belongs in named folders such as `cavi/portal/**`, `cavi/registry/**`, `cavi/runtime/**`, or `cavi/library/**`.
- `__tests__/cavi/**` contains CAVI tests. Test files should not live under production `cavi/**` folders.
- `__tests__/fixtures/**` contains test-only fixtures and helpers. Production modules must not depend on it and it is not part of the build include.

## CAVI Boundary

Current CAVI paths such as `/cavi-control/api/*`, `/library/api/*`, and portal-memory routes are active CAVI contracts. Route literals are owned by `src/contracts/paths.ts`; `src/cavi/paths.ts` is a compatibility re-export for CAVI consumers. They are not treated as quarantine.

CAVI must not duplicate:

- HTTP client implementation
- gateway RPC implementation
- gateway SSE run-event parsing or polling fallback
- gateway media interfaces for audio, video, or music
- gateway wiki interfaces for Obsidian/QMD vault ingest, compile, or promote
- route resolver logic
- static team registry defaults

CAVI should call shared core methods and shared contract helpers.

## Gateway Transports

HTTP, run-event SSE, and WebSocket/RPC are core gateway contracts. The base
implementations live in `src/core/gateway/**`; provider adapters live under
`src/providers/hermes/**` and `src/providers/openclaw/**`.

- HTTP: `GatewayApiClient` is the base client; Hermes and OpenClaw expose thin
  provider clients selected by `createGatewayApiClient`.
- SSE: `GatewaySseRunEventProvider` owns SSE parsing, canonical run-event
  translation, and polling fallback. Provider adapters only add endpoint maps
  and required routing/session headers.
- WebSocket/RPC: `GatewayRpcClient` / `GatewayWebSocketClient` own the shared
  protocol implementation. Provider clients are selected through
  `createGatewayWebSocketClient` or the `createGatewayRpcClient` alias.

New transport behavior should enter through these core contracts first. A
provider module may customize headers, endpoint maps, or defaults, but it
should not fork the parser, RPC protocol, retry semantics, or trace behavior.

CAVI adapter modules should stay as composition layers over those contracts.
For gateway WebSocket-backed control surfaces, `core/gateway/session-loaders.ts`
owns `sessions.*` request coalescing and cache behavior, while CAVI owns only
the dashboard snapshot assembly and CAVI-specific fallback envelopes.

## Gateway Media

Audio, video, and music are core gateway features. The shared interface lives in
`src/core/gateway/media.ts`; provider-specific clients live under
`src/providers/hermes/**` and `src/providers/openclaw/**`. Product surfaces such
as Machine TTS may remain as compatibility helpers, but new media generation
should use `GatewayMediaApiClient` or `createGatewayMediaClient` so Hermes and
OpenClaw stay behind the same contract.

## Gateway Wiki

Wiki support is also a core gateway feature. The shared interface lives in
`src/core/gateway/wiki.ts`; provider-specific clients live under
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
explicit whitelisted relative paths. Product names such as Deb or Martina
should not define core route grammar; they may supply manifest entries,
workspace folders, capabilities, or compatibility adapters.

New team-shaped CAVI paths should use the `team.*` contracts first. Existing
Deb, Martina, Machine, Front Door, and portal-memory paths are compatibility
contracts and should not be expanded unless a gateway compatibility boundary
requires it.

## Quarantine

`quarantine/src/**` contains stale source paths retained only because deletion
is disallowed. Nothing in `src/**`, `package.json` exports, or `tsconfig.json`
may point at quarantine.

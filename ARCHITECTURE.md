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
  providers/
    hermes/
    openclaw/
  react/
  compat/
    martina/
  test-support/
  index.ts
```

The build includes canonical folders plus explicit compatibility modules such
as `src/compat/martina/**`. Old root/source paths are not supported, are not
package exports, and are not built. They are preserved only under
`quarantine/src/**` because this repo forbids deletion.

## Dependency Direction

- `core/**` contains shared HTTP, gateway, and env behavior. It must not import from `cavi/**`, `providers/**`, `react/**`, or compatibility shims.
- `contracts/**` contains route and surface contracts. It must not import from `cavi/**` or providers.
- `cavi/**` may import from `core/**` and `contracts/**`. It owns CAVI clients, data, adapters, domain DTOs, and registry wrappers.
- `providers/**` may import from `core/**`, `contracts/**`, and shared CAVI registry/domain types when needed.
- `react/**` may import from `core/gateway/**` and React only.
- `compat/**` owns explicit compatibility domains such as Martina. It is not a
  dumping ground for stale root import paths.
- `cavi/fallbacks/**` contains runtime fallback snapshots used by degraded gateway flows.
- `test-support/**` contains test-only fixtures and helpers. Production modules must not depend on it and it is not part of the build include.

## CAVI Boundary

Current CAVI paths such as `/cavi-control/api/*`, `/library/api/*`, and portal-memory routes are active CAVI contracts. Route literals are owned by `src/contracts/paths.ts`; `src/cavi/paths.ts` is a compatibility re-export for CAVI consumers. They are not treated as quarantine.

CAVI must not duplicate:

- HTTP client implementation
- gateway RPC implementation
- route resolver logic
- static team registry defaults

CAVI should call shared core methods and shared contract helpers.

## Registry Model

Team and portal registry data is runtime configuration. `TEAM_REGISTRY_CONFIG` starts empty, apps populate it after loading gateway/plugin config, and registry-dependent APIs fail loudly when config is missing.

## Quarantine

`quarantine/src/**` contains stale source paths retained only because deletion
is disallowed. Nothing in `src/**`, `package.json` exports, or `tsconfig.json`
may point at quarantine.

# Contributing to @cavi/api-client

Thanks for contributing. This package is the shared bridge between many agent
runtimes and the apps that consume them, so the bar is: **adding a provider or a
feature should be additive — a small module, not a fork.** This guide explains the
workflow, the boundary rules, and the checklists for the two most common
contributions (a new gateway provider, a new feature).

## Quick start

```sh
git clone https://github.com/sasan1200/cavi-api-client.git
cd cavi-api-client
npm install

npm test           # vitest run — guardrails + behavior (the only test command)
npm run coverage   # coverage report (text + html + lcov)
npm run build      # tsc → dist/
npx tsc --noEmit   # typecheck only
```

- **Node `>=20`.** Target ES2022, `strict` on.
- **There is no separate linter.** `tsc` under `strict` is the type gate.
- **ESM throughout.** Relative imports use the `.js` extension on `.ts` sources
  (`moduleResolution: "Bundler"`). Import `from "./foo.js"`, not `"./foo"`.

## The package boundary (read this first)

The boundary is enforced by tests, not honor system. Before you start, skim
[`src/package-hardening.test.ts`](src/package-hardening.test.ts) — it is the
authoritative contract. It fails the build on:

- Imports of forbidden host packages (`@cavi/data`, `@cavi/domain`,
  `@cavi/gateway-client`, `@cavi/gateway-transforms`, `@mobile-cavi/*`).
- API route literals (bare or URL-embedded) outside `*paths.ts` and
  `contracts/surfaces.ts`.
- Layout drift (reappearance of the pre-restructure flat layout, non-allowlisted
  files at `src/` root, `tsconfig.json` `include` drifting from its allowlist).
- Product team-registry slugs baked into the package (registry data is
  runtime-supplied; `TEAM_REGISTRY_CONFIG.teams` ships empty).

**Update a hardening test only when the boundary intentionally changes**, and say
so explicitly in your PR.

### Dependency direction

```
core → contracts → cavi → providers / react
```

Lower layers never import upward. Concretely:

- **`core/`** is gateway-agnostic. No product knowledge, no `cavi/`/`providers/`/
  `react/` imports. Universal concepts (runs, run-stream events, transports) live
  here.
- **`contracts/`** owns paths, surfaces, and the agnostic team manifest. No imports
  from `cavi/` or providers.
- **`cavi/`** owns CAVI-specific clients, adapters, domain DTOs, registry wrappers.
- **`providers/gateway/`** is the plugin boundary; `providers/hermes` and
  `providers/openclaw` are the built-in adapters.
- **`react/`** imports `core/gateway` and React only.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full module map.

Gateway internals are grouped by owner folder under `src/core/gateway/`
(`client`, `agent`, `run`, `rpc`, `snapshots`, `resources`, `envelope`,
`portal`). `src/core/gateway/index.ts` is the only aggregate in that folder and
must re-export owner-folder indexes directly. Old flat shim files and the old
provider-resolution file are not active source. New source should import from
the owner folder or from the canonical aggregate, never from a flat shim path.

## Adding a gateway provider

The whole point of the provider model is that you do **not** edit core to add a
gateway. A provider is a `GatewayProviderModule`. Built-in wiring (Hermes,
OpenClaw) lives only in `src/providers/gateway/built-ins.ts`; third-party
providers are passed as modules/registries by the host app.

Checklist:

1. **Implement the module.** At minimum `kind`, optional `aliases`, and the
   relevant `create*` factory. Reuse `GatewayApiClient` with a surface name; only
   override what genuinely differs (headers, endpoint map, default surface).

   ```ts
   import { GatewayApiClient } from "@cavi/api-client";
   import { type GatewayProviderModule } from "@cavi/api-client/providers/gateway";

   export const acmeProvider: GatewayProviderModule = {
     kind: "acme",
     aliases: ["acme-gateway"],
     createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
   };
   ```

2. **Do not fork the engine.** The SSE parser, RPC protocol, retry semantics, and
   trace behavior are written once in `core`. A provider customizes headers,
   endpoint maps, factories, or defaults — nothing else.
3. **Routes go in path-owner files.** If your provider needs new routes, add them
   to `src/contracts/paths.ts` (or a surface contract), never inline.
4. **Keep keys clean.** Keys are normalized (trimmed, lowercased); `generic`
   aliases `gateway`. Don't shadow built-in keys — duplicates throw by design.
5. **Test it.** Construct the client with a mocked `fetch`/`WebSocket` and assert
   the first request hits the right path with the right headers. Add a registry
   test if you add resolution behavior.

## Adding a feature

1. **Decide the layer.** Generic transport/data/runtime → `core/`. A route or
   surface contract → `contracts/`. CAVI-specific shaping → `cavi/`. Provider-only
   behavior → `providers/<name>/`.
2. **Don't duplicate a core type.** If `core` already models the concept (a run, a
   run-stream event), re-export and extend — never copy it downstream.
3. **Route every loader through degradation.** New data loaders use `withFallback`
   / `withMutationResult` with a mock and an expected-contract summary. Remember:
   401/403 and `unknown`-classified errors must still throw.
4. **Export from the right entry.** Add public API to `src/index.ts` and, if it
   belongs to a slice, the relevant subpath entry. Keep provider-specific names out
   of the gateway-agnostic surface unless they are explicit compatibility exports.

## Tests

- `npm test` runs the full suite (guardrails + behavior). It must pass before a PR
  merges.
- Test files are `*.test.ts(x)` under `src/__tests__/**`; they are excluded from
  the build. Production modules must not import test fixtures.
- For new public exports, add a smoke test that constructs the client/helper and
  verifies its contract (path + headers, or transform output).
- Run `npm run coverage` and try not to regress coverage on the surface you touch.

## Commits and pull requests

- Keep PRs focused. One provider, one feature, or one fix per PR.
- Describe **what** changed and **why**; if you touched a hardening test, explain
  the boundary change.
- Update [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` for any user-facing
  change.
- Make sure `npm test` and `npm run build` pass locally.

## Reporting issues

- Bugs and feature requests: <https://github.com/sasan1200/cavi-api-client/issues>.
- Security vulnerabilities: **do not** open a public issue — see
  [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).

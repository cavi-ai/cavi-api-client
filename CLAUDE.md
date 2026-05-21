# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@cavi/api-client` is the **single private API client package** for CAVI Control mobile and portal clients — gateway-agnostic HTTP + WebSocket access to fleet data. Pure TypeScript ESM library; React is an optional peer dep (only the `react/` entry needs it). Ships compiled `dist/`.

**Read `AGENTS.md` for the package-boundary intent** (forbidden imports, gateway-agnostic rule). Note: AGENTS.md still cites pre-restructure paths (`src/paths.ts`, `src/endpoints.ts`, `src/repo-root.ts`); the live layout is below and the **hardening tests in [package-hardening.test.ts](src/package-hardening.test.ts) are the enforced contract** — trust them over prose.

## Commands

```bash
npm test                 # vitest run — guardrails + behavior (only test command; ~80 tests, fast)
npm run build            # tsc → dist/ (run before publishing or linking)
npm run clean            # rm -rf dist
npx tsc --noEmit         # typecheck only (strict mode is the lint gate; no separate linter)
npx vitest run src/cavi/data/cavi-control/envelope.test.ts   # single file
npx vitest run -t "withFallback"                             # single test by name
```

## Layered architecture

Strict dependency direction: **`core` → `contracts` → `cavi` → `providers`/`react`/`compat`**. Lower layers never import upward.

- **`src/core/`** — gateway-agnostic foundation, no CAVI domain knowledge.
  - `core/http/` — `BaseHttpApiClient` (fetch wrapper: timeout, bearer auth, trace hooks, `HttpApiError`), types.
  - `core/gateway/` — `GatewayRpcClient` (WebSocket RPC: device-auth handshake, backpressure, reconnect, redacted trace), `GatewayApiClient`, `provider.ts` (provider selection), `run-event-stream.ts` + `run-stream-contracts.ts` (**canonical** universal run/run-stream types), `session-loaders.ts`, `transforms.ts`, device crypto/store, preauth handshake.
  - `core/env/` — env→config resolution (`resolveHttpApiConfigFromEnv`), `repo-root.ts` (`resolveRepoRoot`/`requireRepoRoot`).
- **`src/contracts/`** — path & surface contracts. `paths.ts` (endpoint tables), `surfaces.ts` (`SURFACE_CONTRACTS` + `GatewayMode` + the legacy/canonical map), `resolve.ts` (`resolvePath(key, mode)`), `mobile.ts`, `portals.ts`.
- **`src/cavi/`** — CAVI domain-specific code. `domain/` (snapshot types), `data/cavi-control/` (the `withFallback` degradation engine, http-client, gateway-rpc, guards, normalizers), `adapters/` (`create-cavi-control-adapters.ts` + live adapters), `client.ts` (`CaviControlApiClient`), `library/`, `portal/`, `registry/` (the 352-line `team-registry` impl).
- **`src/providers/{hermes,openclaw}/`** — provider-specific surfaces: `HermesApiClient`, `chat-run`, `sse-run-event-provider`, and thin `createHermesTeamRegistry`/`createOpenClawTeamRegistry` wrappers over `cavi/registry`.
- **`src/react/`** — `gateway-provider.tsx` (React context/hooks). **`src/compat/martina/`** — isolated Martina compatibility. **`src/test-support/mock-data/`** — mock fixtures used by `withFallback`.

`src/index.ts` is the root entry. The package also exposes **subpath exports** (`./core/http`, `./core/gateway`, `./core/env`, `./contracts`, `./cavi`, `./providers/hermes`, `./providers/openclaw`, `./react`, `./compat/martina`) — consumers import the slice they need.

### Gateway model: one interface, provider overrides
HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) coexist. Core stays gateway-agnostic; `createGatewayApiClient(opts, { provider | env })` ([core/gateway/provider.ts](src/core/gateway/provider.ts)) returns the right impl. Provider kinds `gateway` | `hermes` | `openclaw` map to surfaces `gateway-api` / `hermes-api-server` / `openclaw-api`; resolved from explicit `provider` then `CAVI_GATEWAY_PROVIDER` / `GATEWAY_PROVIDER` env. **Universal concepts (agent runs, run-stream events) live in `core`; `cavi` re-exports them and adds only its own aggregates** — never duplicate a core type into `cavi`.

### Graceful degradation is a contract
[cavi/data/cavi-control/envelope.ts](src/cavi/data/cavi-control/envelope.ts) `withFallback()` wraps adapter loads: on transport/backend failure it returns a `DataEnvelope` with `source: "mock"` (from `test-support/mock-data`) + a structured `contractGap`, instead of throwing. **401/403 and `unknown`-classified errors still throw.** New loaders must route through `withFallback`/`withMutationResult` with a mock + expected-contract summary.

## Enforced guardrails (in `package-hardening.test.ts`)

Changing the boundary means updating these tests deliberately. They fail the build on:
- Imports of `@cavi/data`, `@cavi/domain`, `@cavi/gateway-client`, `@cavi/gateway-transforms`, `@mobile-cavi/*`; or quarantined monorepo / host-registry paths.
- API route literals (bare or URL-embedded) outside `*paths.ts` and `contracts/surfaces.ts`.
- Surface contracts whose canonical path isn't api-first.
- Reappearance of the pre-restructure flat layout (`src/data/`, `src/gateway/`, top-level `src/paths.ts`, etc.); non-allowlisted files at `src/` root; any `src/compat/legacy/` tree.
- `tsconfig.json` `include` drifting from the canonical folder allowlist (it is an explicit allowlist, **not** `src/**`).
- Martina identifiers outside `src/compat/martina/`.
- Team-registry slugs baked into the package (registry data must be runtime-supplied; `TEAM_REGISTRY_CONFIG.teams` ships empty).
- `index.ts` exporting from legacy shim paths, or removed legacy package subpath exports reappearing.

## Conventions

- ESM throughout: relative imports use the `.js` extension on `.ts` sources (`moduleResolution: "Bundler"`).
- `node >= 20`, target ES2022, `strict` on. `.test.ts(x)` and `quarantine/**` excluded from the build.
- Filesystem integrations take an explicit `repoRoot` or resolve `REPO_ROOT` via `core/env/repo-root.ts` — never assume a checkout layout.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

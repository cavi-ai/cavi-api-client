# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@cavi/api-client` is the **single private API client package** for CAVI Control mobile and portal clients — gateway-agnostic HTTP + WebSocket access to fleet data. Pure TypeScript ESM library; React is an optional peer dep (only the `react/` entry needs it). Ships compiled `dist/`.

**Read `AGENTS.md` for the package-boundary intent** (forbidden imports, gateway-agnostic rule, path-owner ownership). When prose and behavior disagree, the **hardening tests in [package-hardening.test.ts](src/package-hardening.test.ts) are the enforced contract** — trust them over any doc.

## Commands

```bash
npm test                 # vitest run — guardrails + behavior (only test command; ~80 tests, fast)
npm run build            # tsc → dist/ (run before publishing or linking)
npm run clean            # rm -rf dist
npx tsc --noEmit         # typecheck only (strict mode is the lint gate; no separate linter)
npx vitest run src/__tests__/core/gateway/envelope.test.ts   # single file (tests live in src/__tests__/)
npx vitest run -t "withFallback"                             # single test by name
```

## Layered architecture

Strict dependency direction: **`core` → `contracts` → `extensions/cavi` → `providers`/`react`**. Lower layers never import upward.

- **`src/core/`** — gateway-agnostic foundation, no domain knowledge. Subfolders: `http/` (`BaseHttpApiClient` fetch wrapper: timeout, bearer auth, trace hooks, `HttpApiError`), `gateway/` (`GatewayRpcClient` WebSocket RPC + `GatewayApiClient`, with `client/`, `agent/`, `run/`, `rpc/`, `snapshots/`, `resources/`, `envelope/`, `portal/`, and `providers/` plugin plumbing), `data/`, `runtime/` (generic base-path helpers), `sse/` (generic SSE helpers), `ws/` (WebSocket helpers), `env/` (env→config resolution + `repo-root.ts`: `resolveRepoRoot`/`requireRepoRoot`).
- **`src/contracts/`** — global path & surface contracts. `paths.ts` (gateway/team/kanban endpoint tables), `surfaces.ts` (`SURFACE_CONTRACTS` + `GatewayMode`), `resolve.ts` (`resolvePath(key, mode)`), `team-manifest.ts`.
- **`src/extensions/cavi/`** — CAVI domain-specific code. `contracts/` (CAVI `paths.ts`, `surfaces.ts`, `resolve.ts`→`resolveCaviPath`, `mobile.ts`, `portals.ts`), `domain/` (snapshot DTOs), `adapters/` (`create-cavi-control-adapters.ts` + `cavi-control-adapters/`), `client.ts` (`CaviControlApiClient`), `project-board/`, `operator-control/`, `discourse/`, `portal/`, `library/`, `registry/` (team-registry impl), `runtime/` (CAVI runtime wrappers), `fallbacks/snapshots/` (production degraded-mode fallback data — **not** test mocks).
- **`src/providers/{hermes,openclaw}/`** — provider-specific surfaces: `client.ts`, `agent-config.ts`, `chat-run`/`sse-run-event-provider`, `media.ts`, `wiki.ts`, `websocket.ts`, `provider-module.ts`, and thin `team-registry` wrappers over `extensions/cavi/registry`.
- **`src/react/`** — React context/hooks (optional peer dep). **`src/__tests__/`** — all test files live here, mirroring the source tree (not colocated).

`src/index.ts` is the root entry. The package also exposes **subpath exports** (`./core/http`, `./core/data`, `./core/runtime`, `./core/sse`, `./core/ws`, `./core/gateway`, `./core/env`, `./contracts`, `./extensions/cavi`, `./providers/hermes`, `./providers/openclaw`, `./react`) — consumers import the slice they need.

### Gateway model: one interface, provider overrides
HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) coexist. Core stays gateway-agnostic; provider selection lives in `core/gateway/providers/**` (plugin plumbing) while concrete Hermes/OpenClaw modules live in `src/providers/**`. Provider kinds `gateway` | `hermes` | `openclaw` map to surfaces `gateway-api` / `hermes-api-server` / `openclaw-api`; resolved from explicit `provider` then `CAVI_GATEWAY_PROVIDER` / `GATEWAY_PROVIDER` env. **Universal concepts (agent runs, run-stream events) live in `core`; `extensions/cavi` re-exports them and adds only its own aggregates** — never duplicate a core type downward.

### Graceful degradation is a contract
[core/gateway/envelope/envelope.ts](src/core/gateway/envelope/envelope.ts) `withFallback()` wraps adapter loads: on transport/backend failure it returns a `DataEnvelope` with `source: "mock"` + a structured `contractGap`, instead of throwing. CAVI fallback snapshots come from `extensions/cavi/fallbacks/snapshots/**` (production data, not test fixtures). **401/403 and `unknown`-classified errors still throw.** New loaders must route through `withFallback`/`withMutationResult` with a fallback + expected-contract summary.

## Enforced guardrails (in `package-hardening.test.ts`)

Changing the boundary means updating these tests deliberately. They fail the build on:
- Imports of `@cavi/data`, `@cavi/domain`, `@cavi/gateway-client`, `@cavi/gateway-transforms`, `@mobile-cavi/*`; or quarantined monorepo / host-registry paths.
- API route literals (bare or URL-embedded) outside `*paths.ts` and `surfaces.ts` — global routes in `contracts/paths.ts`, CAVI routes/aliases in `extensions/cavi/contracts/paths.ts`.
- Surface contracts whose canonical path isn't api-first.
- Reappearance of stale legacy source paths (`src/data/`, `src/gateway/`, top-level `src/paths.ts`, etc.); non-allowlisted files at `src/` root; a legacy compat-bridge tree; or `extensions/cavi/data/**` re-export shims.
- `tsconfig.json` `include` drifting from the canonical folder allowlist (`src/index.ts`, `core/**`, `contracts/**`, `extensions/**`, `providers/**`, `react/**` — **not** `src/**`).
- Core gateway/env/agent-config carrying provider-specific naming (`hermes`/`openclaw`/Martina identifiers leaking into core).
- Martina compatibility implementation modules in active source; Mission Control aliases; endpoint compat shims; CAVI core re-export shims.
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

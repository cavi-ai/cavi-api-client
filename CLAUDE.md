# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@cavi-ai/api-client` is a provider-agnostic TypeScript API client for agent runtime applications. It provides HTTP, WebSocket RPC, SSE, route contracts, provider modules, and optional React bindings. Pure TypeScript ESM library; React is an optional peer dep used only by the `frameworks/react` entry. Ships compiled `dist/`.

**Read `AGENTS.md` for the package-boundary intent** (forbidden imports, provider-agnostic rule, path-owner ownership). When prose and behavior disagree, the **hardening tests in [package-hardening.test.ts](src/__tests__/package-hardening.test.ts) are the enforced contract** — trust them over any doc.

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

Strict dependency direction: **`core` → `contracts` → `extensions/cavi` → `providers`/`frameworks`**. Lower layers never import upward.

- **`src/core/`** — provider-agnostic foundation, no domain knowledge. Subfolders: `http/` (`BaseHttpApiClient` fetch wrapper: timeout, bearer auth, trace hooks, `HttpApiError`), `gateway/` (`GatewayRpcClient` WebSocket RPC + `GatewayApiClient`, with `client/`, `agent/`, `run/`, `rpc/`, `snapshots/`, `resources/`, `envelope/`, `portal/`, and `providers/` plugin plumbing), `data/`, `runtime/` (the universal `RuntimeClient` contract, runtime capabilities, the canonical run/run-stream types, protocol-version guard, and base-path helpers), `sse/` (generic SSE helpers), `ws/` (WebSocket helpers), `env/` (env→config resolution + `repo-root.ts`: `resolveRepoRoot`/`requireRepoRoot`).
- **`src/contracts/`** — global path & surface contracts. `paths.ts` (gateway/team/kanban endpoint tables), `surfaces.ts` (`SURFACE_CONTRACTS`), `resolve.ts` (`resolvePath(key, params?)`), `team-manifest.ts`.
- **`src/extensions/cavi/`** — CAVI domain-specific code. `contracts/` (CAVI `paths.ts`, `surfaces.ts`, `resolve.ts`→`resolveCaviPath`, `mobile.ts`, `portals.ts`), `domain/` (snapshot DTOs), `adapters/` (`create-cavi-control-adapters.ts` + `cavi-control-adapters/`), `client.ts` (`CaviControlApiClient`), `project-board/`, `operator-control/`, `discourse/`, `portal/`, `library/`, `registry/` (team-registry impl), `runtime/` (CAVI runtime wrappers), `fallbacks/snapshots/` (production degraded-mode fallback data — **not** test mocks).
- **`src/providers/{hermes,openclaw,claude}/`** — provider-specific surfaces. Gateway providers (Hermes, OpenClaw): `client.ts`, `agent-config.ts`, `chat-run`/`sse-run-event-provider`, `media.ts`, `wiki.ts`, `websocket.ts`, `provider-module.ts`, and thin `team-registry` wrappers over `extensions/cavi/registry`. Claude (Anthropic) is **runtime-only** — `paths.ts`, `provider-module.ts`, and a `RuntimeClient` that maps `startRun` to the Messages API (no gateway/media/wiki/websocket surfaces). It also ships a `managed-agents/` subtree (beta `managed-agents-2026-04-01`): `ClaudeManagedAgentClient` (a stateful `RuntimeClient` over sessions/agents/environments, with steering, outcomes, threads, memory, vaults, webhook verification, and a `TeamManifest`→teams mapper) — additive and re-exported from the same `providers/claude` entry.
- **`src/frameworks/react/`** — React context/hooks (optional peer dep). UI-framework bindings live under `frameworks/**`; add new ones (Vue, Svelte, …) as siblings. **`src/__tests__/`** — all test files live here, mirroring the source tree (not colocated).

`src/index.ts` is the curated root entry (providers, `extensions/cavi`, and low-level primitives are reached via subpaths, not the root). The package also exposes **subpath exports** (`./core/http`, `./core/data`, `./core/errors`, `./core/memory`, `./core/runtime`, `./core/sse`, `./core/ws`, `./core/gateway`, `./core/env`, `./contracts`, `./extensions/cavi`, `./providers/hermes`, `./providers/openclaw`, `./providers/claude`, `./frameworks/react`) — consumers import the slice they need.

### Provider model: one universal contract, gateway extends it

Every provider implements the universal `RuntimeClient` contract (`core/runtime/`); `GatewayClient` **extends** it for gateway backends. HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) coexist. Core stays provider-agnostic; provider selection lives in `core/gateway/providers/**` (plugin plumbing) while concrete Hermes/OpenClaw/Claude modules live in `src/providers/**`. Provider kinds `gateway` | `hermes` | `openclaw` map to gateway surfaces `gateway-api` / `hermes-api-server` / `openclaw-api`; Claude is a runtime-only provider (no gateway surface). Resolved from explicit `provider` then `CAVI_GATEWAY_PROVIDER` / `GATEWAY_PROVIDER` env. **Universal concepts (the `RuntimeClient` contract, agent runs, run-stream events) live in `core`; `extensions/cavi` re-exports them and adds only its own aggregates** — never duplicate a core type downward.

### Graceful degradation is a contract

[core/gateway/envelope/envelope.ts](src/core/gateway/envelope/envelope.ts) `withFallback()` wraps adapter loads: on transport/backend failure it returns a `DataEnvelope` with `source: "mock"` + a structured `contractGap`, instead of throwing. CAVI fallback snapshots come from `extensions/cavi/fallbacks/snapshots/**` (production data, not test fixtures). **401/403 and `unknown`-classified errors still throw.** New loaders must route through `withFallback`/`withMutationResult` with a fallback + expected-contract summary.

## Enforced guardrails (in `src/__tests__/package-hardening.test.ts`)

Changing the boundary means updating these tests deliberately. They fail the build on:

- Imports from app-local packages, retired host packages, or quarantined monorepo / host-registry paths.
- API route literals (bare or URL-embedded) outside `*paths.ts` and `surfaces.ts` — global routes in `contracts/paths.ts`, CAVI routes/aliases in `extensions/cavi/contracts/paths.ts`.
- Surface contracts whose canonical path isn't api-first.
- Reappearance of removed source paths (`src/data/`, `src/gateway/`, top-level `src/paths.ts`, etc.); non-allowlisted files at `src/` root; bridge trees; or `extensions/cavi/data/**` re-export shims.
- `tsconfig.json` `include` drifting from the canonical folder allowlist (`src/index.ts`, `core/**`, `contracts/**`, `extensions/**`, `providers/**`, `frameworks/**` — **not** `src/**`).
- Core gateway/env/agent-config carrying provider-specific naming into shared modules.
- Product transition modules, endpoint shims, or CAVI core re-export shims in active source.
- Team-registry slugs baked into the package (registry data must be runtime-supplied; `TEAM_REGISTRY_CONFIG.teams` ships empty).
- `index.ts` exporting from shim paths, or removed package subpath exports reappearing.

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

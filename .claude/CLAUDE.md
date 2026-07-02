# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@cavi-ai/api-client` is the provider-agnostic API client package used by CAVI Control mobile and portal clients — provider-agnostic HTTP + WebSocket access to agent runtimes (the CAVI-specific surfaces live in `extensions/cavi`). It is a pure TypeScript ESM library (React is an optional peer dep; ships compiled `dist/`).

**Read `AGENTS.md` first** — it is the authoritative package-boundary contract (forbidden imports, path-literal ownership, repo-root rules). The hardening tests enforce it. This file and the root `CLAUDE.md` cover architecture and workflow that AGENTS.md does not.

## Commands

```bash
npm test                 # vitest run — guardrails + behavior (the only test command)
npm run build            # tsc → dist/ (run before publishing or linking a changed package)
npm run clean            # rm -rf dist
npm run coverage         # vitest run --coverage
npx tsc --noEmit         # typecheck only — strict mode is the lint gate (no separate linter)
npx vitest run src/__tests__/core/gateway/envelope.test.ts   # single test file
npx vitest run -t "withFallback"                             # single test by name
```

Tests live under `src/__tests__/**`, mirroring the source tree (not colocated). `tsc` under `strict` is the only type gate.

## Architecture

Strict dependency direction: **`core` → `contracts` → `extensions/cavi` → `providers`/`react`**. Lower layers never import upward.

1. **`src/core/`** — provider-agnostic foundation, no domain knowledge. `http/` is the `BaseHttpApiClient` fetch wrapper (timeout, bearer auth, trace hooks, `HttpApiError`); `gateway/` is the `GatewayRpcClient` WebSocket RPC client + `GatewayApiClient`, organized into `client/`, `agent/`, `run/`, `rpc/`, `snapshots/`, `resources/`, `envelope/`, `portal/`, and `providers/` (provider plugin plumbing). `runtime/` holds the universal `RuntimeClient` contract, runtime capabilities, the canonical run/run-stream/batch types, and the protocol-version guard; `sse/`, `ws/`, `data/`, and `env/` (env→config + `repo-root.ts`) round it out. Only `http` and `gateway` touch the network.
2. **`src/contracts/`** — global path & surface contracts: `paths.ts` (gateway/team/kanban route tables), `surfaces.ts` (`SURFACE_CONTRACTS`), `resolve.ts` (`resolvePath(key, params?)`), `team-manifest.ts` (+ `manifest-source.ts`, `route-resolver.ts`).
3. **`src/extensions/cavi/`** — CAVI domain code. `contracts/` owns CAVI route literals + dynamic route helpers (`paths.ts`), surface keys (`surfaces.ts`), `resolveCaviPath`, and `mobile.ts`/`portals.ts`. Feature folders: `project-board/`, `operator-control/`, `discourse/`, `portal/`, `library/`, `registry/`, `runtime/`, `adapters/` (`create-cavi-control-adapters.ts`), `domain/` (snapshot DTOs), and `fallbacks/snapshots/` (production degraded-mode data, **not** test mocks). `client.ts` is `CaviControlApiClient`.
4. **`src/providers/{hermes,openclaw,claude,codex,gemini}/`** — provider-specific surfaces over core: gateway providers (Hermes, OpenClaw) ship `client.ts`, `agent-config.ts`, run/SSE providers, `media.ts`, `wiki.ts`, `provider-module.ts`, and thin team-registry wrappers; Claude (Anthropic) is **runtime-only** (`paths.ts` + `provider-module.ts` + a `RuntimeClient` over the Messages API); it also implements the batch surface (`supports.batch`) over Anthropic Message Batches (`submitBatch`/`getBatch`/`cancelBatch`/`getBatchResults`). Plus a `managed-agents/` subtree (beta `managed-agents-2026-04-01`) — `ClaudeManagedAgentClient`, a stateful `RuntimeClient` over sessions/agents/environments with steering, outcomes, threads, memory, vaults, webhook verification, and a teams mapper, additively re-exported from the same `providers/claude` entry. Codex (OpenAI) is **runtime-only** — `CodexApiClient` + `createCodexProviderModule` over the OpenAI Responses API; default model `gpt-5-codex`; supports `getRun`/`cancelRun` (background responses). Gemini (Google) is **runtime-only** — `GeminiApiClient` + `createGeminiProviderModule` over the Gemini Developer API (`generativelanguage.googleapis.com`); `x-goog-api-key` auth; model in the URL path (`:generateContent` / `:streamGenerateContent`); explicit model required (no default ships); `getRun`/`cancelRun` throw `EndpointNotFound` (synchronous API).
5. **`src/frameworks/react/`** — React context/hooks (optional peer dep). UI-framework bindings live under `frameworks/**` as siblings.

`index.ts` is the curated root public entry; the package also ships subpath exports (`./core/*`, `./contracts`, `./extensions/cavi`, `./providers/hermes`, `./providers/openclaw`, `./providers/claude`, `./providers/codex`, `./providers/gemini`, `./frameworks/react`).

### One universal contract, two transports

Every provider implements the universal `RuntimeClient` contract; `GatewayClient` **extends** it for gateway backends. HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) coexist. Core interfaces stay **provider-agnostic** — `RuntimeClient` is canonical and `Gateway*` extends it; provider selection lives in `core/gateway/providers/**` while concrete Hermes/OpenClaw/Claude modules live in `src/providers/**`. Universal concepts (the `RuntimeClient` contract, agent runs, run-stream events, and batch types) live in `core`; `extensions/cavi` re-exports them and adds only its own aggregates. Do not hardcode a product gateway or provider name into core.

### Graceful degradation is a core contract, not an afterthought

`core/gateway/envelope/envelope.ts` `withFallback()` wraps adapter loads. On transport/backend failure it returns a `DataEnvelope` with `source: "mock"` and a structured `contractGap` instead of throwing; CAVI fallback snapshots come from `extensions/cavi/fallbacks/snapshots/**`. **401/403 and `unknown`-classified errors still throw.** When adding a loader, route it through `withFallback`/`withMutationResult` and supply a fallback + expected-contract summary.

### Paths are owned by `*paths.ts` / `surfaces.ts` files

Every API route literal lives in a path-owner file: global routes in `src/contracts/paths.ts`, CAVI routes and dynamic route helpers in `src/extensions/cavi/contracts/paths.ts`. Surface keys live in the matching `surfaces.ts`. The `keeps API route literals in path-owner files` hardening test fails the build if a route string leaks elsewhere.

### Repo roots are explicit

Filesystem integrations never assume a checkout layout. Pass `repoRoot` or set `REPO_ROOT` and resolve via `core/env/repo-root.ts` (`resolveRepoRoot`/`requireRepoRoot`). Mobile apps choose their root at runtime.

## Guardrails (in `src/__tests__/package-hardening.test.ts`)

These contract tests fail if you cross the package boundary. Update them only when the boundary intentionally changes:

- Route literals only in `*paths.ts` / `surfaces.ts` owner files; no routes hidden inside full URLs.
- Core gateway/env/agent-config stays provider-neutral (no `hermes`/`openclaw` identifiers in core).
- `tsconfig.json` `include` matches the canonical folder allowlist — **not** `src/**`.
- Team-registry slugs are runtime-supplied; `TEAM_REGISTRY_CONFIG.teams` ships empty.

## Conventions

- ESM throughout: relative imports use the `.js` extension even for `.ts` sources (`moduleResolution: "Bundler"`).
- `node >= 20`, target ES2022, `strict` on. `.test.ts(x)` files are excluded from the build.
- Files marked `// CANONICAL — single source of truth lives here.` must not be duplicated downstream.

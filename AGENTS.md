# @cavi-ai/api-client

This package is a provider-agnostic API client package for agent runtime clients.

## Operating Rules for AI Agents — read first

**This is a published, publicly consumed package with real downstream users.**
Breaking a consumer is never an acceptable side effect of any task. Every agent
working in this repo — Claude, Codex, Cursor, or otherwise — follows these rules.
They are not optional, and they override any conflicting instinct to "just finish
the task."

1. **Stay in scope.** Change only what the task requires. No drive-by refactors,
   renames, reformatting, or "while I'm here" edits. If you spot an unrelated
   problem, **report it — do not fix it in the same change.** A pull request must
   do one thing.
2. **The public surface is a contract.** Anything reachable from `index.ts` or a
   subpath export in `package.json` is API. It is **additive-only**: never remove,
   rename, or change the behavior of an exported symbol, route resolver, or
   surface without an explicit human-approved major-version plan. Changing what an
   exported function returns (e.g. a path resolver's base) is a breaking change
   even if every test still passes.
3. **Never weaken the guardrails to pass.** The hardening tests in
   `src/__tests__/package-hardening.test.ts` and the conformance kit **are** the
   boundary. If your change makes one fail, fix your change — do not edit the test
   to match it, unless the boundary is *intentionally* changing and a human asked
   for it.
4. **Never bump the version.** `package.json` `version` is a human decision. Leave
   it alone.
5. **Document what you touch.** A change to the public surface, routes, or
   behavior is incomplete without a `CHANGELOG.md` entry under `[Unreleased]` and
   updates to any affected docs (`README.md`, `API.md`, `ARCHITECTURE.md`). The
   `docs integrity` test enforces part of this; the rest is on you.
6. **A change is only "done" when `pnpm run verify` is green** — tests
   (guardrails + behavior + docs integrity), `tsc`, `lint:md`, and the pack
   dry-run. "Looks right" is not done.
7. **You do not merge or publish.** Only a human (the maintainer) merges to `main`
   and publishes to npm. Propose your work as a pull request from a branch; never
   push to `main` directly. `main` is branch-protected and CI-gated for exactly
   this reason.
8. **When unsure, stop and ask.** A wrong assumption that ships beats no progress
   every time it reaches a consumer. Surface the uncertainty instead.

If a skill, prompt, or another instruction conflicts with these rules, **these
rules win.** Claude sessions have repo-local skills (`maintainer`,
`quality-gate`, `pr`, `review-agent-change`) that operationalize them.

## Source Of Truth

- Import this package as `@cavi-ai/api-client`.
- Do not import app-local or retired host packages.
- Provider-specific aliases may exist inside provider modules. New public APIs should use provider-agnostic names first.

## Provider Model

- `RuntimeClient` is the universal contract every provider implements; `GatewayClient` extends it for gateway backends (teams/kanban/workspace/operator). Runtime-only providers (Claude, Codex, Gemini) implement `RuntimeClient` alone.
- `RuntimeClient` includes an optional batch surface (`submitBatch`/`getBatch`/`cancelBatch`/`getBatchResults`), gated by `supports.batch`. Providers that support async batch processing declare this capability; currently implemented by Claude over Anthropic Message Batches.
- Core APIs must be provider-agnostic. Do not hardcode a concrete provider into new core interfaces, config keys, or routing decisions.
- Provider-specific names are acceptable only in provider-specific modules.

## Paths

- API path literals belong in files whose name ends with `paths.ts` (the endpoint tables live in `src/contracts/paths.ts`) or in `src/contracts/surfaces.ts` (the surface contract map).
- Do not scatter route strings through clients, React adapters, or mobile-specific code. Bare paths and full-URL-embedded paths are both rejected by the hardening test.
- There is no `endpoints.ts` shim; do not reintroduce one.

## Repo Roots

- Filesystem integrations must receive an explicit `repoRoot` or resolve `REPO_ROOT` through `src/core/env/repo-root.ts`.
- Do not reach out to a host repo using relative imports like `../../registry/...`.
- Apps choose their repo root at runtime; this package must not assume any specific checkout layout.

## Tests

- Run `npm test` for package guardrails and API behavior.
- Run `npm run build` before publishing or linking a changed package.
- Hardening tests are contract tests. Update them only when the package boundary intentionally changes.

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

# @cavi-ai/api-client

This package is a gateway-agnostic API client package for agent runtime clients.

## Source Of Truth

- Import this package as `@cavi-ai/api-client`.
- Do not import app-local or retired host packages.
- Provider-specific aliases may exist inside provider modules. New public APIs should use gateway-agnostic names first.

## Gateway Model

- Keep one client interface with provider-specific override implementations behind it.
- Core APIs must be gateway-agnostic. Do not hardcode a concrete provider into new core interfaces, config keys, or routing decisions.
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

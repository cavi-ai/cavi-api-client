# API Reference

`@cavi-ai/api-client` is a provider-agnostic TypeScript client for agent
runtimes. Application code targets a universal `RuntimeClient` /
`CapabilityClient` contract; provider modules own wire protocols, auth, and
route literals.

This file is the **repository API index**: where to find operations, type
reference, contract sources, and documentation artifacts. It is not a full
method catalog. Canonical operation documentation (signatures, HTTP mappings,
request and response shapes, examples) is published on
[cavi-ai.xyz/docs/api-client](https://cavi-ai.xyz/docs/api-client) and committed
under [`docs/api-client/v0.15.0`](docs/api-client/v0.15.0).

Upstream runtimes (OpenClaw, gateway servers, Anthropic, OpenAI, Google, and
others) remain the owners of their protocols. This package mirrors and verifies
compatible client behavior for consumers.

## Start here

| Audience | Primary path |
| -------- | ------------ |
| Application integrators | [Online documentation](https://cavi-ai.xyz/docs/api-client) → [operation index](docs/api-client/v0.15.0/operations/index.md) |
| Library consumers (npm / checkout) | [Exports and import paths](docs/guides/exports.md), [Providers and setup](docs/guides/providers.md) |
| Docs site hosts | [Consumer contract](docs/api-client/CONSUMER.md) |
| Contributors / maintainers | [Development guide](docs/guides/development.md), [Architecture](ARCHITECTURE.md) |

Install and a minimal `RuntimeClient` example live in the [README](README.md).
Prefer `createApiClient(provider, options)` for a non-throwing
`CapabilityClient` surface, or compose a `RuntimeClient` when you need the raw
contract.

## Public entry points

| Layer | Import | Role |
| ----- | ------ | ---- |
| Root | `@cavi-ai/api-client` | Curated provider-neutral API: factories, capabilities, shared types |
| Core | `@cavi-ai/api-client/core/*` | Runtime, gateway, HTTP, SSE, WebSocket, errors, teams, kanban |
| Contracts | `@cavi-ai/api-client/contracts` | Route tables, surface maps, team-manifest types |
| Providers | `@cavi-ai/api-client/providers/{claude,codex,gemini,agy,hermes,openclaw}` | Concrete adapters |
| Extensions | `@cavi-ai/api-client/extensions/cavi` | CAVI-owned control, portal, library, registry surfaces |
| Frameworks | `@cavi-ai/api-client/frameworks/react` | Optional React gateway bindings |
| Testing | `@cavi-ai/api-client/testing` | Conformance helpers for adapters |

`package.json` `exports` is authoritative. See
[Exports and import paths](docs/guides/exports.md) for the full matrix.

## Operation reference

Developer-facing operation pages document method signatures, request bodies,
responses, runnable examples, and the HTTP or gateway RPC endpoint each
operation maps to. Generated type declarations live under `reference/`.

| Resource | Location |
| -------- | -------- |
| Source pages (editable) | [`docs/api-client/source/pages/operations`](docs/api-client/source/pages/operations) |
| Built artifact (immutable) | [`docs/api-client/v0.15.0/operations`](docs/api-client/v0.15.0/operations) |
| Start here | [`operations/index.md`](docs/api-client/v0.15.0/operations/index.md) |
| Symbol / type reference | [`reference/`](docs/api-client/v0.15.0/reference) |
| Postman (gateway surface) | [`docs/postman/cavi-api-client.postman_collection.json`](docs/postman/cavi-api-client.postman_collection.json) |

Every documented HTTP path is validated against owning `paths.ts` files by
`scripts/docs/check-operation-endpoints.mjs` (runs inside `pnpm docs:check`).

### Surface map

| Surface | Operation reference |
| ------- | ------------------- |
| Universal runtime (runs, streaming, batch) | [`operations/runtime.md`](docs/api-client/v0.15.0/operations/runtime.md) |
| Claude (Anthropic Messages) | [`operations/providers/claude-anthropic.md`](docs/api-client/v0.15.0/operations/providers/claude-anthropic.md) |
| Claude Managed Agents (beta) | [`operations/providers/claude-managed-agents.md`](docs/api-client/v0.15.0/operations/providers/claude-managed-agents.md) |
| Codex (OpenAI Responses) | [`operations/providers/codex.md`](docs/api-client/v0.15.0/operations/providers/codex.md) |
| Gemini (Google Developer API) | [`operations/providers/gemini.md`](docs/api-client/v0.15.0/operations/providers/gemini.md) |
| Antigravity / AGY | [`operations/providers/agy.md`](docs/api-client/v0.15.0/operations/providers/agy.md) |
| Hermes (gateway) | [`operations/providers/hermes.md`](docs/api-client/v0.15.0/operations/providers/hermes.md) |
| OpenClaw (gateway) | [`operations/providers/openclaw.md`](docs/api-client/v0.15.0/operations/providers/openclaw.md) |
| Gateway control-plane facade | [`operations/gateway/control-plane.md`](docs/api-client/v0.15.0/operations/gateway/control-plane.md) |
| Gateway media and wiki | [`operations/gateway/media-wiki.md`](docs/api-client/v0.15.0/operations/gateway/media-wiki.md) |
| Gateway sessions and agent config | [`operations/gateway/sessions.md`](docs/api-client/v0.15.0/operations/gateway/sessions.md) |
| Gateway teams, kanban, and vault | [`operations/gateway/teams.md`](docs/api-client/v0.15.0/operations/gateway/teams.md) |
| Gateway WebSocket RPC methods | [`operations/gateway/rpc-methods.md`](docs/api-client/v0.15.0/operations/gateway/rpc-methods.md) |
| CAVI extension surfaces | [`operations/cavi/`](docs/api-client/v0.15.0/operations/cavi) |
| Concepts, transports, errors | [`concepts/`](docs/api-client/v0.15.0/concepts), [`reference/core-errors.md`](docs/api-client/v0.15.0/reference/core-errors.md) |

## Contract ownership

API route literals belong only in files whose names end with `paths.ts`, or in
surface / team-manifest contract maps. Do not scatter route strings through
clients, React adapters, or mobile-specific code.

| Contract | Path |
| -------- | ---- |
| Global gateway / team / kanban routes | `src/contracts/paths.ts` |
| Surface contract map | `src/contracts/surfaces.ts` |
| Team-manifest helpers | `src/contracts/team-manifest.ts` |
| CAVI routes and aliases | `src/extensions/cavi/contracts/paths.ts` |
| CAVI surfaces | `src/extensions/cavi/contracts/surfaces.ts` |
| Claude Messages + Message Batches | `src/providers/claude/paths.ts` |
| Claude Managed Agents (beta) | `src/providers/claude/managed-agents/paths.ts` |
| Codex / OpenAI Responses | `src/providers/codex/paths.ts` |
| Gemini / Google Developer API | `src/providers/gemini/paths.ts` |
| Antigravity (AGY) | `src/providers/agy/paths.ts` |

## Versioned documentation artifact

Immutable product docs for the current package version:

[`docs/api-client/v0.15.0`](docs/api-client/v0.15.0)
(`manifest.json`, `navigation.json`, pages).

| Channel | Authority |
| ------- | --------- |
| Docs site ingest | **Canonical** — GitHub release asset `cavi-api-client-docs-v{VERSION}.tar.gz`. Contract: [`docs/api-client/CONSUMER.md`](docs/api-client/CONSUMER.md) |
| npm package | Convenience mirror of the same `docs/api-client/v*` tree for offline reading — not the site ingest authority |
| Repo guides | [`docs/guides`](docs/guides), [`docs/examples`](docs/examples) — contributor checkout only; not host navigation IA |

Validate a tree or release archive:

```sh
pnpm docs:check
pnpm run docs:host-ingest-check -- --dir docs/api-client/v0.15.0
```

## Conventions

Operation and surface pages use these notations:

- `:param` — path segment; callers must URL-encode values.
- `**HTTP**` — wire endpoint(s) an operation maps to, per provider.
- `gateway RPC <method>` — WebSocket RPC method with no REST path.
- `hard` degradation — surface expected for core compatibility.
- `gap` degradation — callers should report a compatibility gap or use a
  documented fallback when the route is missing.
- Gateway / team / kanban / vault route literals are owned by
  `src/contracts/surfaces.ts` and `src/contracts/team-manifest.ts`; pages
  reference the owning helper where the literal is assembled.

## Related documentation

- [README](README.md) — install, `RuntimeClient`, `createApiClient`
- [Architecture](ARCHITECTURE.md) — layer boundaries and ownership
- [Migration guide](MIGRATION.md) — supported import migrations
- [Changelog](CHANGELOG.md) — released and unreleased changes
- [Claude integrations](docs/guides/claude.md) — Messages API and Managed Agents
- [Security](SECURITY.md) — vulnerability reporting

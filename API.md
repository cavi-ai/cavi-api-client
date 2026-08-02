# API Reference

Index and pointer for `@cavi-ai/api-client` API documentation.

This package mirrors gateway, provider, and CAVI extension contracts. It is not
the canonical runtime contract for upstream OpenClaw, Caviclaw, or gateway
servers. Keep source-of-truth endpoint literals in `paths.ts` files or surface
contract maps.

Primary sources:

- `src/contracts/paths.ts`
- `src/contracts/surfaces.ts`
- `src/contracts/team-manifest.ts`
- `src/extensions/cavi/contracts/paths.ts`
- `src/extensions/cavi/contracts/surfaces.ts`
- `src/providers/claude/paths.ts` (Claude / Anthropic Messages + Message Batches, runtime-only)
- `src/providers/claude/managed-agents/paths.ts` (Claude Managed Agents, beta)
- `src/providers/codex/paths.ts` (Codex / OpenAI Responses, runtime-only)
- `src/providers/gemini/paths.ts` (Gemini / Google Developer API, runtime-only)

The companion Postman collection is
`docs/postman/cavi-api-client.postman_collection.json`.

## Operation reference

The developer-facing, OpenAI-style operation reference — method signatures,
request bodies, responses, runnable examples, and the HTTP endpoint each
operation maps to — lives in the documentation pipeline and is rendered on
cavi-ai.xyz. It is the canonical operation-level documentation; this file is only
an index.

- Source pages: [`docs/api-client/source/pages/operations`](docs/api-client/source/pages/operations)
- Built artifact: [`docs/api-client/v0.15.0/operations`](docs/api-client/v0.15.0/operations)
- Start here: [`operations/index.md`](docs/api-client/v0.15.0/operations/index.md)

Every documented HTTP path is validated against the owner `paths.ts` files by
`scripts/docs/check-operation-endpoints.mjs`, which runs inside `pnpm docs:check`.

### Where each surface is documented

| Surface | Operation reference page |
| ------- | ------------------------ |
| Universal runtime contract (runs, streaming, batch) | [`operations/runtime.md`](docs/api-client/v0.15.0/operations/runtime.md) |
| Claude / Codex / Gemini / Hermes / OpenClaw | [`operations/providers/`](docs/api-client/v0.15.0/operations/providers) |
| Claude Managed Agents (beta) | [`operations/providers/claude-managed-agents.md`](docs/api-client/v0.15.0/operations/providers/claude-managed-agents.md) |
| Gateway control-plane facade & core gateway | [`operations/gateway/control-plane.md`](docs/api-client/v0.15.0/operations/gateway/control-plane.md) |
| Gateway media & wiki | [`operations/gateway/media-wiki.md`](docs/api-client/v0.15.0/operations/gateway/media-wiki.md) |
| Gateway sessions & agent config | [`operations/gateway/sessions.md`](docs/api-client/v0.15.0/operations/gateway/sessions.md) |
| Gateway teams, kanban & vault | [`operations/gateway/teams.md`](docs/api-client/v0.15.0/operations/gateway/teams.md) |
| Gateway WebSocket RPC methods | [`operations/gateway/rpc-methods.md`](docs/api-client/v0.15.0/operations/gateway/rpc-methods.md) |
| CAVI extension surfaces | [`operations/cavi/`](docs/api-client/v0.15.0/operations/cavi) |
| Runtime concepts, transports, errors | [`concepts/`](docs/api-client/v0.15.0/concepts), [`reference/core-errors.md`](docs/api-client/v0.15.0/reference/core-errors.md) |
| Exhaustive type declarations (by subpath) | [`reference/`](docs/api-client/v0.15.0/reference) |

## Versioned documentation artifact

Immutable product docs for the current package version live at
[`docs/api-client/v0.15.0`](docs/api-client/v0.15.0) (`manifest.json`,
`navigation.json`, pages).

**Docs site ingest (canonical):** GitHub release asset
`cavi-api-client-docs-v{VERSION}.tar.gz`. Contract:
[`docs/api-client/CONSUMER.md`](docs/api-client/CONSUMER.md). Validate with
`pnpm run docs:host-ingest-check -- --dir docs/api-client/v0.15.0`.

**npm:** the same versioned tree may ship in the package for offline reading; it
is not the site ingest authority.

**Contributor guides** (repo checkout): [`docs/guides`](docs/guides),
[`docs/examples`](docs/examples). Not part of the host navigation IA.

```sh
pnpm docs:check
pnpm run docs:host-ingest-check -- --dir docs/api-client/v0.15.0
```

## Conventions

- `:param` means a path segment that must be URL-encoded by the caller.
- `**HTTP**` lines note the wire endpoint(s) an operation maps to, per provider;
  `gateway RPC <method>` denotes a WebSocket RPC method with no REST path.
- `hard` degradation means the surface is expected for core compatibility;
  `gap` degradation means callers should report a compatibility gap or use a
  fallback when the route is missing.
- Route literals for gateway/team/kanban/vault surfaces are owned by
  `src/contracts/surfaces.ts` and `src/contracts/team-manifest.ts`; pages
  reference the owning helper where the literal is assembled rather than stored.

---
documentedVersion: 0.16.0
---

# API client overview

`@cavi-ai/api-client` is a provider-agnostic TypeScript client for AI agent
runtimes. One `RuntimeClient` contract covers Claude (including Managed Agents),
Codex, Gemini, Hermes, OpenClaw, and related gateway surfaces — HTTP, WebSocket
RPC, SSE, and optional React bindings.

This documentation set is the **immutable product docs** for a published package
version. Upstream runtimes remain the protocol owners; this client mirrors and
verifies compatible behavior.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

## Start here

1. [Installation](./installation.md) — install the package and pick a provider entry.
2. [Quickstart](./quickstart.md) — first `startRun` / gateway call.
3. [Runtime client](../concepts/runtime-client.md) — the universal contract.
4. [Operations](../operations/index.md) — OpenAPI-style operation reference.
5. [Postman](../guides/postman.md) — prove gateway surfaces against a live host.

## How this docs set is published

- **Docs site (cavi-ai.xyz):** ingests the GitHub release asset
  `cavi-api-client-docs-vX.Y.Z.tar.gz` (canonical).
- **npm package:** may include the same `docs/api-client/vX.Y.Z` tree for offline
  reading; it is not the site ingest authority.

See the consumer contract in `docs/api-client/CONSUMER.md` for validation rules.

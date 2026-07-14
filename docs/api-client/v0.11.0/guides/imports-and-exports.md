---
documentedVersion: 0.11.0
---

# Imports and exports

Import universal contracts and factories from the package root. Import
implementation-specific clients, framework bindings, extensions, and low-level
transport primitives from their documented subpaths.

## Root

- `@cavi-ai/api-client` — curated universal contracts, factories, errors,
  capability helpers, and route contracts.

## Core

- `@cavi-ai/api-client/core/http`
- `@cavi-ai/api-client/core/data`
- `@cavi-ai/api-client/core/errors`
- `@cavi-ai/api-client/core/memory`
- `@cavi-ai/api-client/core/runtime`
- `@cavi-ai/api-client/core/runtime/providers`
- `@cavi-ai/api-client/core/kanban`
- `@cavi-ai/api-client/core/sse`
- `@cavi-ai/api-client/core/ws`
- `@cavi-ai/api-client/core/gateway`
- `@cavi-ai/api-client/core/env`
- `@cavi-ai/api-client/core/transport`
- `@cavi-ai/api-client/core/transport/node`

## Contracts and extensions

- `@cavi-ai/api-client/contracts`
- `@cavi-ai/api-client/extensions/cavi`
- `@cavi-ai/api-client/extensions/cavi/library-clip-contract.json`

## Provider implementations

- `@cavi-ai/api-client/providers/hermes`
- `@cavi-ai/api-client/providers/hermes/runtime`
- `@cavi-ai/api-client/providers/openclaw`
- `@cavi-ai/api-client/providers/openclaw/runtime`
- `@cavi-ai/api-client/providers/claude`
- `@cavi-ai/api-client/providers/claude/messages`
- `@cavi-ai/api-client/providers/claude/managed-agents`
- `@cavi-ai/api-client/providers/codex`
- `@cavi-ai/api-client/providers/codex/runtime`
- `@cavi-ai/api-client/providers/codex/files`
- `@cavi-ai/api-client/providers/gemini`
- `@cavi-ai/api-client/providers/gemini/runtime`
- `@cavi-ai/api-client/providers/gemini/files`

Provider implementations mirror upstream-owned APIs. Consult the
[provider guides](providers/index.md) for implementation-specific setup and
support boundaries.

## Framework and testing entries

- `@cavi-ai/api-client/frameworks/react`
- `@cavi-ai/api-client/testing`

The generated API reference lists the symbols exported by each declaration
entry. See
[migration and version support](../release/migration-and-support.md) before
changing an existing import.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

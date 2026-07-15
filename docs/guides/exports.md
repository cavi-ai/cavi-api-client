# Exports and import paths

The package root is the curated, provider-neutral API. Import concrete
providers, framework bindings, extensions, and low-level infrastructure through
subpaths so application dependencies remain explicit.

## Stable root

Use `@cavi-ai/api-client` for the universal runtime and gateway contracts,
provider registries and factories, capability guards, shared errors, graceful
degradation, route contracts, and team-manifest types.

```ts
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  runtimeSupports,
  type RuntimeClient,
} from "@cavi-ai/api-client";
```

## Core subpaths

| Import path | Purpose |
| --- | --- |
| `@cavi-ai/api-client/core/runtime` | Runtime types and run-stream contracts |
| `@cavi-ai/api-client/core/runtime/providers` | Provider registry and factory kernel |
| `@cavi-ai/api-client/core/gateway` | Gateway resource clients |
| `@cavi-ai/api-client/core/http` | Raw and JSON HTTP clients and redaction |
| `@cavi-ai/api-client/core/sse` | SSE parsing and compatibility helpers |
| `@cavi-ai/api-client/core/ws` | Gateway WebSocket compatibility helpers |
| `@cavi-ai/api-client/core/transport` | HTTP, SSE, WebSocket, JSON-RPC, and framing infrastructure |
| `@cavi-ai/api-client/core/transport/node` | Node-only stdio and Unix-socket byte channels |
| `@cavi-ai/api-client/core/data` | Shared data guards |
| `@cavi-ai/api-client/core/errors` | Error types and helpers |
| `@cavi-ai/api-client/core/memory` | Provider-neutral memory contract |
| `@cavi-ai/api-client/core/kanban` | Provider-neutral kanban contract |
| `@cavi-ai/api-client/core/env` | Environment and repository-root helpers |
| `@cavi-ai/api-client/contracts` | Route, surface, and manifest contracts |

## Provider subpaths

Broad provider entries remain available for compatibility. Prefer narrow
entries when an application needs only one provider surface.

| Provider | Broad entry | Narrow entries |
| --- | --- | --- |
| Claude | `@cavi-ai/api-client/providers/claude` | `@cavi-ai/api-client/providers/claude/messages`, `@cavi-ai/api-client/providers/claude/managed-agents` |
| Codex | `@cavi-ai/api-client/providers/codex` | `@cavi-ai/api-client/providers/codex/runtime`, `@cavi-ai/api-client/providers/codex/files` |
| Gemini | `@cavi-ai/api-client/providers/gemini` | `@cavi-ai/api-client/providers/gemini/runtime`, `@cavi-ai/api-client/providers/gemini/files` |
| Hermes | `@cavi-ai/api-client/providers/hermes` | `@cavi-ai/api-client/providers/hermes/runtime` |
| OpenClaw | `@cavi-ai/api-client/providers/openclaw` | `@cavi-ai/api-client/providers/openclaw/runtime` |

## Extensions, frameworks, and testing

| Import path | Purpose |
| --- | --- |
| `@cavi-ai/api-client/extensions/cavi` | CAVI-owned control, portal, library, registry, and adapter surfaces |
| `@cavi-ai/api-client/extensions/cavi/library-clip-contract.json` | Raw CaviClip ingest contract asset |
| `@cavi-ai/api-client/frameworks/react` | React gateway bindings |
| `@cavi-ai/api-client/testing` | Provider and gateway conformance helpers |

`package.json` is the authoritative list of published entry points. The
[generated type reference](../api-client/v0.11.0/reference/index.md) lists the
symbols available from the locked stable documentation artifact.

## Transport boundaries

The universal transport entry exports `createHttpTransport`,
`createJsonRpcTransport`, `createSseTransport`, and
`createWebSocketTransport`. The Node-only entry exports
`createStdioTransport` and `createUnixSocketTransport` without pulling Node
built-ins into browser-facing entry points.

Transport reconnects are bounded and never replay pending writes. These
factories are infrastructure, not a provider adapter, and do not imply that a
provider implements a corresponding capability.

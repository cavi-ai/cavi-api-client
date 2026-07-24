---
documentedVersion: 0.14.0
---

# Gateway control-plane operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Core gateway REST routes (`GATEWAY_API_ENDPOINTS`, aliased as
`HERMES_API_ENDPOINTS`) plus the provider-neutral runtime control-plane facade
(`@cavi-ai/api-client/core/runtime`). REST paths are relative to the gateway
base URL (`{{gatewayUrl}}`). Path literals are owned by
`src/contracts/paths.ts`.

## gateway.health

**HTTP** `GET /health`
**Capability** gateway (`hard` — required for core compat)

Primary gateway reachability check.

## gateway.healthDetailed

**HTTP** `GET /health/detailed`
**Capability** gateway (`gap` — report/fallback if missing)

Detailed health check. Absence is a compatibility gap when basic health works.

## probe.healthz

**HTTP** `GET /healthz`
**Capability** gateway (`gap` — optional probe)

Lightweight liveness probe.

## probe.readyz

**HTTP** `GET /readyz`
**Capability** gateway (`gap` — optional probe)

Readiness probe.

## models

**HTTP** `GET /v1/models`
**Capability** gateway

Gateway model inventory.

## gateway.capabilities

**HTTP** `GET /v1/capabilities`
**Capability** gateway (`hard` — required for core compat)

Authenticated capability proof for saved bearer tokens.

## chatCompletions

**HTTP** `POST /v1/chat/completions`
**Capability** gateway

OpenAI-compatible chat completions compatibility route.

## responses

**HTTP** `POST /v1/responses`
**Capability** gateway

OpenAI-compatible response creation route.

## response

**HTTP** `GET /v1/responses/:responseId`
**Capability** gateway

Retrieve a response by id.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| responseId | string | yes | Path param — id of the response to fetch. |

## runs

**HTTP** `POST /v1/runs`
**Capability** gateway

Create a gateway run.

## run

**HTTP** `GET /v1/runs/:runId`
**Capability** gateway

Fetch run status or detail.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| runId | string | yes | Path param — id of the run. |

## runEvents

**HTTP** `GET /v1/runs/:runId/events`
**Capability** gateway

Stream run events, typically Server-Sent Events.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| runId | string | yes | Path param — id of the run. |

## runApproval

**HTTP** `POST /v1/runs/:runId/approval`
**Capability** gateway

Resolve a run approval decision.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| runId | string | yes | Path param — id of the run. |

## runStop

**HTTP** `POST /v1/runs/:runId/stop`
**Capability** gateway

Request that a run stop.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| runId | string | yes | Path param — id of the run. |

## jobs

**HTTP** `GET /api/jobs`
**Capability** gateway

Gateway job inventory.

## job

**HTTP** `GET /api/jobs/:jobId`
**Capability** gateway

Gateway job detail or status.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| jobId | string | yes | Path param — id of the job. |

## gateway.websocket

**HTTP** `WS gateway RPC transport` (`gateway.websocket` surface)
**Capability** gateway (`hard` — required for core compat)

Dashboard/TUI JSON-RPC websocket transport at path `/api/ws` for chat, sessions,
logs, and health snapshots. See [rpc-methods](rpc-methods.md) for the dispatched
methods.

## ecgSharedFiles

**HTTP** `GET /api/v1/files?agent={agent}&folder={folder}`
**Capability** gateway

Template for ECG/shared files by agent and folder.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| agent | string | yes | Query param — agent id. |
| folder | string | yes | Query param — folder path. |

## Runtime control-plane facade

The control plane is a separate, optional discovery and administration surface
exported from the root and `@cavi-ai/api-client/core/runtime`. It does not change
the universal `RuntimeClient` run/stream contract; providers expose only the
focused modules they actually implement. Consumers should treat absent or
experimental modules as unsupported.

### createRuntimeControlClient

**Signature** `createRuntimeControlClient(provider, options: RuntimeControlClientOptions): Promise<RuntimeControlClient>`
**HTTP** `gateway RPC` (resolves a provider module; transport-dependent)
**Capability** gateway (`gap` — unregistered providers return a typed unavailable facade)

Resolves a provider kind or alias through the registry of shipped provider
modules and returns a required `RuntimeControlClient` facade containing the seven
focused modules (`authStatus`, `sessions`, `models`, `usage`, `tasks`,
`workspace`, `events`), an immutable `extensions` registry, and an idempotent
`dispose()`. `options` carries provider-neutral URL, token/auth resolver, abort
signal, trace, transport, registry, and optional `gatewayConnection` /
`gatewayReconnect` inputs. `gatewayConnection` composes the public
`GatewayRpcClientOptions` contract (client identity, connect-frame correlation,
device identity, requested scopes, protocol range, timeouts, request limits, and
redacted RPC tracing); OpenClaw forwards it only when creating its owned
WebSocket, an injected transport keeps precedence, and Hermes rejects each
semantically supplied setting with a field-specific `CapabilityUnavailable`.
`gatewayReconnect` reuses `TransportRetryPolicy` for opt-in, bounded,
retryable-only OpenClaw reconnect.

#### Example

```ts
import { createRuntimeControlClient } from "@cavi-ai/api-client";

const controlPlane = await createRuntimeControlClient(config.provider, {
  baseUrl: config.baseUrl,
  webSocketUrl: config.webSocketUrl,
  resolveAuth: () => authStore.resolve(config.provider),
});

const sessions = await controlPlane.sessions.listSessions({ limit: 50 });
```

The package contract is canonical for its consumers; upstream wire APIs remain
provider-owned and mirrored. Factory-created WebSocket clients are client-owned
and closed by `dispose()`; injected transports are caller-owned and remain open
unless the caller closes them. On reconnect the adapter emits `stream.reconnected`
followed by `stream.gap` when continuity cannot be proven; it does not claim
replay.

### Extensions registry and raw gateway

**Signature** `defineRuntimeControlExtension(id)` · `createRuntimeControlExtensionRegistry(entries)` · `withRuntimeControlExtensions(client, entries)`
**HTTP** `n/a (client-side)` · `gateway RPC` (for `gateway.raw` operation requests)
**Capability** gateway (`gap` — `RawGatewayChannel` operations reject when the provider exposes no raw channel)

The facade's `extensions` registry exposes provider-neutral, typed extensions by
descriptor identity. `defineRuntimeControlExtension(id)` declares a typed,
provider-neutral extension ID; `createRuntimeControlExtensionRegistry(entries)`
builds an immutable registry with descriptor-identity typed lookup and sorted
discovery, rejecting blank and duplicate IDs. The core names `authStatus`,
`sessions`, `models`, `usage`, `tasks`, `workspace`, `events`, `extensions`, and
`dispose` are reserved and cannot be extension IDs.
`withRuntimeControlExtensions(client, entries)` returns a frozen facade that
preserves the client's module objects and existing registered extensions, rejects
cross-wrap ID collisions, and delegates disposal exactly once.

`GATEWAY_RAW_EXTENSION` / `RawGatewayChannel` is an optional provider-neutral
`gateway.raw` descriptor and channel for arbitrary operation requests, raw
`{ event, payload }` subscriptions, connection state, and lifecycle ownership.
Raw events remain distinct from the normalized `RuntimeControlClient.events`
stream, and this core extension is separate from the CAVI-only `cavi.control`
surface. Retrieve it with `client.extensions.get(GATEWAY_RAW_EXTENSION)`. The
`@cavi-ai/api-client/testing` export `runRawGatewayConformance(createChannel)`
verifies the request/event/state and lifecycle contract of a raw channel.

### RuntimeControlClient focused modules

**HTTP** `gateway RPC` (per-module method dispatch)
**Capability** gateway (`gap` — each module rejects with `CapabilityUnavailable` when unimplemented)

The seven-module facade. OpenClaw ships a built-in canonical adapter; its
verified operations are narrower than the full RPC catalog:

| Canonical module | Verified OpenClaw methods |
| ----- | ----- |
| `workspace` | `agents.list` |
| `models`, `authStatus` | `models.list`, `models.authStatus` |
| `usage` | `usage.status`, `usage.cost` |
| `sessions` | `sessions.list`, `sessions.describe`, `sessions.abort` |
| `tasks` | `tasks.list`, `tasks.get`, `tasks.cancel` |
| `events` | Native gateway subscription; no additional request method |

OpenClaw native event cursor resume is unsupported; supplying a cursor rejects
with `CapabilityUnavailable("openclaw", "controlPlane.events.cursor")`. Because
the `usage.cost` wire has no validated currency field, canonical cost
availability is `unavailable`.

### createUnavailableRuntimeControlClient

**Signature** `createUnavailableRuntimeControlClient(providerId, capabilities): RuntimeControlClient`
**HTTP** `n/a (client-side)`
**Capability** gateway (`gap` — canonical unavailable shape)

Builds the complete canonical facade for a provider without an adapter. Each
module method rejects with a fresh `CapabilityUnavailable`; `dispose()` is
side-effect free and idempotent.

### createHermesRuntimeControlClient

**Signature** `createHermesRuntimeControlClient(options: HermesCaviRuntimeControlOptions): RuntimeControlClient`
**HTTP** `n/a (Hermes API Server REST/SSE + optional dashboard REST/JSON-RPC over TransportMessageChannel)`
**Capability** gateway (`gap` — modules installed only when configured)

CAVI-extension composer of Hermes API Server REST/SSE, separately configured
dashboard REST/JSON-RPC modules, and optional CAVI task and workspace adapters.
Always returns the complete canonical shape, uses typed unavailable modules for
missing configuration, and borrows an injected channel unless `ownsChannel: true`.
Sessions are installed only when both a dashboard/API-server source and a channel
are configured.

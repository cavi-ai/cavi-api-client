---
documentedVersion: 0.18.0
---

# Antigravity (AGY) operations

Runtime-only provider over the Antigravity orchestration API. Auth:
`x-agy-api-key`. `baseUrl` is required. Runs are synchronous request/response
(`POST /v1/agents/run`); `getRun`/`cancelRun` return the client-remembered
terminal status via `SynchronousRunStore` (same pattern as Claude Messages and
Gemini). Streaming uses `POST /v1/agents/stream` (SSE). Batch is not supported
in the initial surface.

Capability (`AGY_RUNTIME_SUPPORT`): runs ✅ · getRun ✅ (client-local) ·
cancelRun ✅ (client-local) · streamRun ✅ · batch ❌.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1/agents/run`
**Capability** `supports.runs`

Maps the universal body to an Antigravity run request and normalizes
`output`/`tokens` from the response. See
[runtime · startRun](../runtime.md#startrun) for the full field tables.

For application construction, see [provider setup](../../guides/providers.md#agy);
use [run handling](../../guides/requests.md) or [streaming](../../guides/streaming.md)
to consume the result.

## getRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>`
**HTTP** `n/a` (client-local `SynchronousRunStore`)
**Capability** `supports.runs`

Returns the remembered terminal status from `startRun` / `streamRun`. Unknown
ids degrade to an unknown-run status rather than throwing. See
[runtime · getRun](../runtime.md#getrun).

## cancelRun

**Signature** `client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `n/a` (client-local)
**Capability** `supports.runs`

Synchronous runs are already terminal; returns the remembered status (or
`"completed"` when unknown). See [runtime · cancelRun](../runtime.md#cancelrun).

## streamRun

**Signature** `client.streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: { signal?: AbortSignal }): Promise<void>`
**HTTP** `POST /v1/agents/stream` (SSE)
**Capability** `supports.streaming`

Streams Antigravity SSE chunks, normalized to canonical run-stream events. If
the connection closes without an upstream terminal status, `streamRun` reports
a terminal error instead of synthesizing `run.completed`. See [runtime ·
streamRun](../runtime.md#streamrun).

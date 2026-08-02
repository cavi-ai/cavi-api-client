---
documentedVersion: 0.16.0
---

# Antigravity (AGY) operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

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

### Example

```ts
import { createAgyProviderModule } from "@cavi-ai/api-client/providers/agy";
// … construct the runtime client with baseUrl (+ apiKey), then:
const run = await client.startRun({ input: "Hi", model: "default" });
```

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

Streams Antigravity SSE chunks, normalized to canonical run-stream events. See
[runtime · streamRun](../runtime.md#streamrun).

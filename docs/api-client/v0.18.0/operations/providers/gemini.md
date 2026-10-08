---
documentedVersion: 0.18.0
---

# Gemini (Google) operations

Runtime-only provider over the Gemini Developer API
(`generativelanguage.googleapis.com`). Auth: `x-goog-api-key`. The model is
part of the URL path, not the body, and an explicit model is **required** — no
default ships (`GEMINI_API_VERSION` is `v1beta`). `generateContent` is
synchronous request/response; `getRun`/`cancelRun` return the client-remembered
terminal status via `SynchronousRunStore` (they do not throw
`EndpointNotFound`). The batch surface is supported over
`batchGenerateContent`.

Capability (`GEMINI_RUNTIME_SUPPORT`): runs ✅ · getRun ✅ (client-local) ·
cancelRun ✅ (client-local) · streamRun ✅ · batch ✅.

> **Path notation.** Collection segments are shown explicitly; `:model` and
> `:id` stand for resource IDs. The path helpers apply their encoding and
> resource-name handling. Streaming also requires the `alt=sse` query parameter.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1beta/models/:model:generateContent`
**Capability** `supports.runs`

Requires `model`; maps the universal body to a Gemini `generateContent`
request and normalizes `output`/`tokens` from the response. See
[runtime · startRun](../runtime.md#startrun) for the full field tables.

### Example

```ts
import { createGeminiProviderModule } from "@cavi-ai/api-client/providers/gemini";
// … construct the runtime client (explicit model required), then:
const run = await client.startRun({ input: "Hi", model: "gemini-2.5-pro" });
```

## streamRun

**Signature** `client.streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers): Promise<void>`
**HTTP** `POST /v1beta/models/:model:streamGenerateContent` (SSE, `?alt=sse`)
**Capability** `supports.streaming`

Streams `streamGenerateContent` SSE chunks, normalized to canonical run-stream
events. See [runtime · streamRun](../runtime.md#streamrun).

## getRun / cancelRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>` ·
`client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `n/a` (client-local `SynchronousRunStore`)
**Capability** `supports.runs`

`generateContent` is synchronous — the run is terminal when `startRun` returns.
`getRun`/`cancelRun` degrade to the remembered terminal result (unknown ids do
not throw). Field tables per [runtime · getRun](../runtime.md#getrun) /
[cancelRun](../runtime.md#cancelrun).

## submitBatch / getBatch / cancelBatch / getBatchResults

**HTTP** `POST /v1beta/models/:model:batchGenerateContent` · `GET /v1beta/batches/:id` ·
`POST /v1beta/batches/:id:cancel`
**Capability** `supports.batch`

`submitBatch` posts to `batchGenerateContent`; `getBatch`/`cancelBatch` act on
the returned batch resource name; `getBatchResults` reads the batch and returns
inline or file-backed results (throwing `EndpointNotFound` while results are not
yet available — poll `getBatch` first). Field tables per
[runtime · batch operations](../runtime.md#submitbatch).

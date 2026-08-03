---
documentedVersion: {{documentedVersion}}
---

# Codex (OpenAI) operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Runtime-only provider over the OpenAI Responses API. Auth: `Authorization:
Bearer <apiKey>`. providerKind `codex-responses`, protocolVersion
`responses-v1`. Default model `gpt-5-codex` (`CODEX_DEFAULT_MODEL`) when a run
omits one. Background responses make it stateful — `getRun`/`cancelRun` are
implemented. Supports the batch surface over the OpenAI Batch API.

Capability (`CODEX_RUNTIME_SUPPORT`): runs ✅ · getRun ✅ · cancelRun ✅ ·
streamRun ✅ · batch ✅.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1/responses`
**Capability** `supports.runs`

Maps the universal body to an OpenAI Responses request; `output`/`tokens` are
normalized from the response. See [runtime · startRun](../runtime.md#startrun)
for the full field tables.

### Example

```ts
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex";
// … construct the runtime client, then:
const run = await client.startRun({ input: "Hi", model: "gpt-5-codex" });
```

## getRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>`
**HTTP** `GET /v1/responses/:id`
**Capability** `supports.runs`

Reads a background response by id. Field tables per
[runtime · getRun](../runtime.md#getrun).

## cancelRun

**Signature** `client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `POST /v1/responses/:id/cancel`
**Capability** `supports.runs`

Cancels an in-flight background response. See
[runtime · cancelRun](../runtime.md#cancelrun).

## streamRun

**Signature** `client.streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers): Promise<void>`
**HTTP** `POST /v1/responses` (SSE)
**Capability** `supports.streaming`

Streams the Responses SSE event feed, normalized to canonical run-stream
events. See [runtime · streamRun](../runtime.md#streamrun).

## submitBatch / getBatch / cancelBatch / getBatchResults

**HTTP** `POST /v1/batches` · `GET /v1/batches/:id` ·
`POST /v1/batches/:id/cancel` · `GET /v1/files/:id/content`
**Capability** `supports.batch`

`submitBatch` uploads a JSONL input file (`POST /v1/files`) and creates a batch
against the `/v1/responses` endpoint; `getBatchResults` reads the batch
(`GET /v1/batches/:id`) then downloads its output/error file
(`GET /v1/files/:id/content`). Field tables per
[runtime · batch operations](../runtime.md#submitbatch).

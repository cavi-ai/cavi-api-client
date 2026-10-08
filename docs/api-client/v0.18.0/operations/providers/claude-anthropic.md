---
documentedVersion: 0.18.0
---

# Claude (Anthropic) operations

Runtime-only provider over the Anthropic Messages API. Auth: `x-api-key` +
`anthropic-version`. Messages runs are synchronous; `getRun`/`cancelRun` return
the client-remembered terminal status via `SynchronousRunStore`. Supports the
batch surface over Anthropic Message Batches.

Capability (`CLAUDE_RUNTIME_SUPPORT`): runs ✅ · getRun ✅ (client-local) ·
cancelRun ✅ (client-local) · streamRun ✅ · batch ✅.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1/messages`
**Capability** `supports.runs`

Maps `input`→`messages`, `instructions`→`system`, `model`→`model`. Response
`output`/`tokens` normalized from the Messages response. See
[runtime · startRun](../runtime.md#startrun) for the full field tables.

For application construction, see [provider setup](../../guides/providers.md#claude-messages);
use [run handling](../../guides/requests.md) or [streaming](../../guides/streaming.md)
to consume the result.

## getRun / cancelRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>` ·
`client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `n/a` (client-local `SynchronousRunStore`)
**Capability** `supports.runs`

Messages is synchronous — the run is terminal when `startRun` returns.
`getRun`/`cancelRun` degrade to the remembered terminal result. Field tables per
[runtime · getRun](../runtime.md#getrun) /
[cancelRun](../runtime.md#cancelrun).

## submitBatch / getBatch / cancelBatch / getBatchResults

**HTTP** `POST /v1/messages/batches` · `GET /v1/messages/batches/:id` ·
`POST /v1/messages/batches/:id/cancel` · `GET /v1/messages/batches/:id/results`
**Capability** `supports.batch`

Field tables per [runtime · batch operations](../runtime.md#submitbatch).

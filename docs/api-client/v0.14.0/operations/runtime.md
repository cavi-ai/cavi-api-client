---
documentedVersion: 0.14.0
---

# Runtime operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The universal `RuntimeClient` contract every provider implements. Optional
methods are absent on providers that do not support them — null-check
(`client.getRun?.(id)`) or gate on `getRuntimeCapabilities()`.

## getRuntimeCapabilities

**Signature** `client.getRuntimeCapabilities(): Promise<RuntimeCapabilities>`
**HTTP** `n/a (provider metadata)`
**Capability** always present

### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| providerKind | string | Provider identity, e.g. `"claude"`. |
| protocolVersion | string \| null | Wire protocol version when applicable. |
| auth | { type?: string; required?: boolean } | Auth expectation. |
| supports | Partial<Record<RuntimeSurface, boolean>> | Per-surface capability flags. |

### Example

```ts
const caps = await client.getRuntimeCapabilities();
if (caps.supports.batch) { /* … */ }
```

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `POST /v1/messages` (Claude) · `POST /v1/responses` (Codex) · `POST /v1beta/models/:model:generateContent` (Gemini) · gateway RPC (Hermes/OpenClaw)
**Capability** `supports.runs`

### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| input | string \| RuntimeRunMessage[] | yes | Prompt string or conversation messages (`{ role, content }`). |
| instructions | string | no | System / developer instructions (Anthropic `system`). |
| model | string | no | Model id; provider default used when omitted (Gemini requires it). |
| tools | Record<string, unknown>[] | no | Provider-native tool definitions. |
| metadata | Record<string, unknown> | no | Opaque caller metadata. |
| dryRun | boolean | no | Validate/echo without executing; yields `status: "dry_run"`. |

### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| run_id | string | Run identifier. |
| status | RuntimeRunState | `started`/`running`/`completed`/`failed`/`cancelled`/`stopping`/`dry_run`. |
| model | string | Resolved model. |
| output | string | Final output text (when completed). |
| response | string | Alias carrying provider response text. |
| error | string | Present on `failed`. |
| tokens | RuntimeUsage | Normalized token usage (prefer over `usage`). |
| usage | Record<string, number> | **Deprecated** raw provider counts. |

### Example

```ts
const run = await client.startRun({
  input: "Summarize the changelog.",
  model: "claude-opus-4-8",
});
console.log(run.status, run.output);
```

## getRun

**Signature** `client.getRun?(runId: string): Promise<RuntimeRunStatus>`
**HTTP** `GET /v1/responses/:id` (Codex) · gateway RPC (Hermes/OpenClaw)
**Capability** `supports.runs` + stateful provider

Optional. Stateless providers (Claude Messages) omit it; Gemini exposes it but
throws `EndpointNotFound` (synchronous API). Returns the same `RuntimeRunStatus`
shape as `startRun`.

### Example

```ts
const status = await client.getRun?.(run.run_id);
```

## cancelRun

**Signature** `client.cancelRun?(runId: string): Promise<{ status: string }>`
**HTTP** `POST /v1/responses/:id/cancel` (Codex) · gateway RPC (Hermes/OpenClaw)
**Capability** `supports.runs` + cancelable provider

Optional. Same availability rules as `getRun`.

### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| status | string | Post-cancel state (e.g. `"cancelling"`, `"cancelled"`). |

## streamRun

**Signature** `client.streamRun?(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: { signal?: AbortSignal }): Promise<void>`
**HTTP** `POST /v1/messages?stream=1` (Claude) · `POST /v1/responses` (SSE, Codex) · `POST /v1beta/models/:model:streamGenerateContent` (Gemini)
**Capability** `supports.runs` (streaming)

Optional. Gateways use a subscribe-by-runId model and omit this, exposing a
`RunEventStreamProvider` instead. `handlers` receive canonical `RunStreamEvent`s.

### Example

```ts
await client.streamRun?.(
  { input: "Write a haiku.", model: "gpt-5-codex" },
  { onEvent: (e) => process.stdout.write(e.type) },
);
```

## submitBatch

**Signature** `client.submitBatch?(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>`
**HTTP** `POST /v1/messages/batches` (Claude) · `POST /v1/batches` (Codex) · `POST /v1beta/models/:model:batchGenerateContent` (Gemini)
**Capability** `supports.batch`

Implemented by Claude, Codex, and Gemini. Provider-specific batch endpoints and
result retrieval differ — see [Claude](providers/claude-anthropic.md),
[Codex](providers/codex.md), and [Gemini](providers/gemini.md).

### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| requests[].customId | string | yes | Caller correlation id, echoed on the result. |
| requests[].body | RuntimeRunStartBody | yes | The run to enqueue. |

### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| batch_id | string | Batch identifier. |
| status | RuntimeBatchState | `in_progress`/`canceling`/`completed`/`cancelled`/`failed`. |
| counts | RuntimeBatchCounts | total/processing/succeeded/errored/canceled/expired. |
| resultsAvailable | boolean | True once results are retrievable. |

### Example

```ts
const batch = await client.submitBatch?.([
  { customId: "a", body: { input: "One" } },
  { customId: "b", body: { input: "Two" } },
]);
```

## getBatch

**Signature** `client.getBatch?(batchId: string): Promise<RuntimeBatchStatus>`
**HTTP** `GET /v1/messages/batches/:id` (Claude) · `GET /v1/batches/:id` (Codex)
**Capability** `supports.batch`

Poll until `resultsAvailable` is `true`. Same `RuntimeBatchStatus` response as
`submitBatch`.

## cancelBatch

**Signature** `client.cancelBatch?(batchId: string): Promise<RuntimeBatchStatus>`
**HTTP** `POST /v1/messages/batches/:id/cancel` (Claude) · `POST /v1/batches/:id/cancel` (Codex)
**Capability** `supports.batch`

Returns the updated `RuntimeBatchStatus`.

## getBatchResults

**Signature** `client.getBatchResults?(batchId: string): Promise<RuntimeBatchResult[]>`
**HTTP** `GET /v1/messages/batches/:id/results` (Claude) · `GET /v1/batches/:id` then `GET /v1/files/:id/content` (Codex)
**Capability** `supports.batch`

Throws an `EndpointNotFound`-class error if the batch has not ended — poll
`getBatch` first. Codex has no single results endpoint: read the batch to obtain
its output/error file id, then download the JSONL via the Files API
(`GET /v1/files/:id/content`).

### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| customId | string | Echoed submission id. |
| outcome | RuntimeBatchOutcome | `succeeded`/`errored`/`canceled`/`expired`. |
| run | RuntimeRunStatus | Present when `outcome === "succeeded"`. |
| error | string | Present on failure. |

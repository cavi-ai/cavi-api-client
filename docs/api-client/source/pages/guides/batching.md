---
documentedVersion: {{documentedVersion}}
---

# Collect a batch without losing individual failures

Batching is for asynchronous groups of requests. Claude Messages and Codex
declare batch support; Managed Agents, AGY, OpenCode,
and gateways do not.

Give every request a unique `customId` from your application's record identity.
Submit bodies with provider-compatible models/tools, then persist the returned
`batch_id` with its owner. Do not correlate responses by array position.

## Resume collection in a later worker

Download [batch-collector.ts](../examples/batch-collector.ts). The function
below takes a saved ID and performs one collection attempt. It distinguishes
active work, terminal work without available results, and retrievable items.
It does not submit, cancel, or poll in a loop. The application owns the client.

Authorize access to the saved batch before calling it; a provider credential
does not establish which application user owns the batch.

```ts
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, type CapabilityClient, type RuntimeBatchResult } from "@cavi-ai/api-client";

export async function collectBatch(client: CapabilityClient, batchId: string) {
  const status = await client.getBatch(batchId);
  if (!status.ok) return status;
  const batch = status.data;
  if (!status.data.resultsAvailable) {
    const kind = ["completed", "failed", "cancelled", "expired"].includes(batch.status)
      ? "terminal" as const : "pending" as const;
    return { ok: true as const, source: status.source, data: { kind, batch } };
  }
  const results = await client.getBatchResults(batchId);
  if (!results.ok) return results;
  const items = new Map<string, RuntimeBatchResult>();
  for (const item of results.data) {
    if (!item.customId.trim() || items.has(item.customId)) {
      throw new ApiClientError("Batch results have missing or duplicate correlation IDs.", {
        type: ApiClientErrorType.Validation, code: ApiClientErrorCode.ProtocolMismatch,
        cause: { batch, customId: item.customId },
      });
    }
    items.set(item.customId, item);
  }
  return {
    ok: true as const,
    source: results.source,
    data: {
      kind: "results" as const,
      batch,
      items,
    },
  };
}
```

| Result | Worker action |
| --- | --- |
| `ok: false` | Retain the saved ID and handle the original facade gap; do not submit again |
| `pending` | Save `batch` and schedule another authorized collection attempt |
| `terminal` | Save `batch` and stop normal polling; no result artifact was advertised |
| `results` | Record each item by its correlation ID, retaining failures |

Known terminal states are `completed`, `failed`, `cancelled`, and Codex's
`expired`. Check `resultsAvailable` first: a cancelled or expired batch can
still expose useful results. A completed batch without an advertised artifact
does not become an empty successful result. Unknown provider states remain
pending; bound retries and escalate them through your application's job policy.

For collected items, inspect each `outcome`. A `succeeded` item can carry a run
result; inspect its run state and required output before calling it an answer.
Text remains optional. Keep `errored`, `canceled`, `expired`, and unknown item
outcomes in your reporting. The batch state uses `cancelled`; item outcomes
use `canceled`.

This helper requires nonblank, unique result IDs. It throws `ApiClientError`
with `ProtocolMismatch` if correlation is ambiguous, retaining the batch in
`cause` rather than overwriting a prior item. Compare returned IDs with the
request IDs you persisted: this check does not prove that every submitted
request has a returned result. Keep missing IDs visible and reconcile them.

Retrieval gaps remain facade results; authentication and unclassified failures
still reject. Store provider diagnostics in protected telemetry. A retry hint
does not establish that resubmitting a failed item or batch is safe.

## Run the collection tests

Download [batch-tests.ts](../examples/batch-tests.ts) beside the collector in
`examples/`. Use the ESM workspace and package installation from
[consumer testing](testing.md), then run:

```sh
npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --strict --skipLibCheck --types node --outDir .batch-tests \
  examples/batch-tests.ts examples/batch-collector.ts
node --test .batch-tests/batch-tests.js
```

Expected result: eight passing tests without provider credentials or network
calls. Native Claude and Codex HTTP fixtures exercise the installed adapters,
facade, and collector. They check terminal states, out-of-order mixed outcomes,
ambiguous IDs, retrieval gaps, authentication, and retrieval-only requests.
Each test disposes its client through the test cleanup hook.

## Submit and wait locally when appropriate

The [submission and bounded-wait helper](../examples/runtime-batch.ts) accepts
your request array and returns every result. It preserves the batch ID in the
error if its poll budget expires; stopping that wait does not cancel the
backend batch. It borrows the client.

Codex uses uploaded JSONL and result files; Claude uses Message Batches. Provider limits and asynchronous timing differ.
The normalized request/result contract does not remove those limits.

Facade callers inspect `result.ok`; raw callers must check both
`runtimeSupports(capabilities, "batch")` and optional method presence.
[Raw guard](../examples/runtime-capabilities.ts) ·
[Batch methods](../operations/runtime.md#submitbatch) · [Errors](errors.md)

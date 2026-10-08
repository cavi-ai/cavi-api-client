---
documentedVersion: 0.18.0
---

# Collect a batch without losing individual failures

Batching is for asynchronous groups of requests. Claude Messages, Codex, and
the legacy Gemini adapter declare batch support; Managed Agents, AGY, OpenCode,
and gateways do not.

Give every request a unique `customId` from your application's record identity.
Submit bodies with provider-compatible models/tools, then persist the returned
`batch_id` with its owner. Do not correlate responses by array position.

## Resume collection in a later worker

The function below takes a saved ID. It returns a pending state if results are
not available, or all item outcomes keyed by `customId` once they are.
It does not start a new batch or discard failed items.

```ts
import type { CapabilityClient } from "@cavi-ai/api-client";

export async function collectBatch(client: CapabilityClient, batchId: string) {
  const status = await client.getBatch(batchId);
  if (!status.ok) return status;
  if (!status.data.resultsAvailable) {
    return { ok: true as const, data: { kind: "pending" as const, batch: status.data } };
  }
  const results = await client.getBatchResults(batchId);
  if (!results.ok) return results;
  return {
    ok: true as const,
    data: {
      kind: "results" as const,
      items: new Map(results.data.map((item) => [item.customId, item])),
    },
  };
}
```

For the pending state, inspect `batch.status`: `failed` or `cancelled`
must stop your wait rather than schedule endless retries. Store this state in
your job system. A cancelled batch can still have available completed results.

For collected items, inspect each `outcome`. Only `succeeded` items carry
a run result; text remains optional. Keep `errored`, `canceled`, and
`expired` items in your application's reporting and retry policy.

## Submit and wait locally when appropriate

The [submission and bounded-wait helper](../examples/runtime-batch.ts) accepts
your request array and returns every result. It preserves the batch ID in the
error if its poll budget expires; stopping that wait does not cancel the
backend batch. It borrows the client.

Codex uses uploaded JSONL and result files; Claude uses Message Batches;
Gemini has an inline/file flow. Provider limits and asynchronous timing differ.
The normalized request/result contract does not remove those limits.

Facade callers inspect `result.ok`; raw callers must check both
`runtimeSupports(capabilities, "batch")` and optional method presence.
[Raw guard](../examples/runtime-capabilities.ts) ·
[Batch methods](../operations/runtime.md#submitbatch) · [Errors](errors.md)

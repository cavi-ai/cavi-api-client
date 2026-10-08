---
documentedVersion: {{documentedVersion}}
---

# Submit and collect a batch

Batching is for asynchronous groups of requests. Claude Messages, Codex, and the
legacy Gemini adapter declare batch support; Managed Agents, AGY, OpenCode, and
gateways do not.

On the facade, call `submitBatch` and handle its result. On a raw runtime,
check `runtimeSupports(capabilities, "batch")` and the optional method first.
The [raw capability guard](../examples/runtime-capabilities.ts) demonstrates
that distinction. The [facade batch helper](../examples/runtime-batch.ts) shows
submission, bounded polling, and result handling.

## Lifecycle

1. Assign each request a unique `customId` you can correlate later.
2. Submit the bodies with provider-compatible models and tools.
3. Store the returned `batch_id` for subsequent retrieval.
4. Poll `getBatch` with a bounded policy until `resultsAvailable`.
5. Call `getBatchResults` and inspect each item's `outcome`, not just the
   overall call result.
6. If stopping work, inspect the result of `cancelBatch`; cancellation can
   leave completed items that still need collecting.

Only succeeded items carry a run result. Errored, cancelled, or expired items
must remain visible in application reporting. Do not request results before
they are available; that can produce an endpoint-not-found error/gap.

Codex uses uploaded JSONL and result files; Claude uses Message Batches;
Gemini has its own inline/file batch flow. Result mapping is shared, but provider
limits and asynchronous timing remain different.

[Batch method reference](../operations/runtime.md#submitbatch) ·
[Failure handling](errors.md)

---
documentedVersion: 0.18.0
---

# Start work and retrieve a background run

`startRun` returns a call result and, on success, a run status.
`result.ok` answers whether the client call succeeded; `data.status` answers
where execution stands. A live call can report a failed run.

## Choose the lifecycle

| Backend | What startRun returns | Retrieval |
| --- | --- | --- |
| Claude Messages, AGY, Gemini | Terminal response | Client-remembered terminal state |
| Codex | Background response, possibly active | Upstream response resource |
| Claude Managed Agents | Server-side session status | Upstream session |
| Hermes/OpenClaw | Gateway run handle | Gateway lifecycle |
| OpenCode | Synchronous scoped message result | Cached terminal state or server session reconciliation |

Use a configured client from [provider setup](providers.md).
The following function takes application input rather than a fixed demo prompt,
bounds retrieval, and returns the last observed run to its caller.
Download [runAndWait](../examples/runtime-node.ts).

```ts
import type { CapabilityClient, RuntimeRunStartBody } from "@cavi-ai/api-client";

export async function runAndWait(
  client: CapabilityClient,
  body: RuntimeRunStartBody,
  options: { maxPolls?: number; pollIntervalMs?: number } = {},
) {
  const { maxPolls = 60, pollIntervalMs = 1_000 } = options;
  if (!Number.isInteger(maxPolls) || maxPolls < 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error("Use a non-negative poll count and interval.");
  }
  let result = await client.startRun(body);
  if (!result.ok) throw new Error(result.gap.note, { cause: result.gap });
  let run = result.data;
  const active = (status: string) => ["started", "running", "stopping"].includes(status);
  for (let poll = 0; active(run.status) && poll < maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    result = await client.getRun(run.run_id);
    if (!result.ok) throw new Error(result.gap.note, { cause: result.gap });
    run = result.data;
  }
  // A limited wait returns the last observed state; callers decide whether to cancel.
  return run;
}
```

Pass `{ model, input }` as the body, then inspect the returned `status`.
Only `completed` means completion. If the run remains active when the local
poll budget expires, keep its ID and continue in a later worker, or explicitly
call `cancelRun` according to your application's policy. The helper does not
cancel work as a side effect of reaching the poll limit.

This is a poll-count budget, not a wall-clock deadline. Each request also needs
a configured HTTP timeout. The helper borrows the client; its owner disposes it.

## Keep identity and state

Persist server-side run IDs with their application owner so a later worker can
retrieve or cancel them. Client-local terminal IDs do not survive client/process
replacement. An unknown status is neither completion nor a reason to poll forever.

Use `input` for a string or role/content messages, `instructions` for shared
instructions, and `model` for provider configuration. Native tools and metadata
remain provider-specific.

Text and usage are optional. In the pinned release, the Codex mapper reads
`output_text` without flattening native `output` items, so a completed
response can have no normalized text. Unreleased development adds native
message-text normalization; check the
[repository changelog](https://github.com/cavi-ai/cavi-api-client/blob/main/CHANGELOG.md#unreleased)
for availability.

## Cancel deliberately

Inspect the result of `cancelRun(runId)`. A local timeout, aborted wait, or
disposed client does not prove backend termination. For synchronous providers,
cancellation of a remembered terminal run cannot undo completed work.

[Server requests](server.md) · [Streaming](streaming.md) ·
[Error handling](errors.md) · [Raw runtime methods](../operations/runtime.md)

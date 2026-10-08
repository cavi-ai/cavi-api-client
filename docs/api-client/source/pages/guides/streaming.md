---
documentedVersion: {{documentedVersion}}
---

# Stream output and handle terminal states

Configure a [provider](providers.md), then use the facade's `streamRun`.
The [complete streaming helper](../examples/runtime-streaming.ts) prints message
deltas, records failed-run events, uses a caller signal, and checks the returned
call result and terminal outcome.

Handlers receive canonical events through the `event` field:

| Event | Application action |
| --- | --- |
| message.delta | Append delta text |
| run.completed | Mark the run complete; terminal output may also be present |
| run.failed | Display the run error |
| run.cancelled | Display cancellation |
| approval.request | Present the available approval choices |
| tool.call.started/completed/failed | Update the tool's progress |

`onError` reports transport or parsing failures. `run.failed` arrives through
`onEvent`, not `onError`. Some malformed frames are non-terminal; do not
equate every error callback with upstream run failure.

## Call success versus run success

Facade `streamRun` resolves a `CapabilityResult<RunStreamOutcome>`.

- `ok: false`: the call failed or was unavailable; inspect its gap.
- `ok: true`: inspect `data.outcome`, which is `completed`, `failed`,
  `cancelled`, or `null`. A failed run can still have a successful stream call.
- `outcome: null`: no terminal outcome was captured. Do not display success.

Authentication and unclassified failures still reject. Keep an exception
boundary around the streaming call.

## Gateway prerequisites

Hermes requires `sessionKey` in the `StreamRunBody`; the facade subscribes
to SSE run events. OpenClaw uses native WebSocket frames. The facade normalizes
their delivery, but cannot supply missing gateway permissions or configuration.

On a raw `RuntimeClient`, check both `supports.streaming` and the presence
of `streamRun`. Raw gateways typically expose a `RunEventStreamProvider`
subscription instead. Do not apply facade return handling to raw methods.

## Cancellation and cleanup

Pass an `AbortSignal` as the third argument. A caller abort returns a
`request-aborted` gap and makes a best-effort `cancelRun` when the run ID is
known. It does not prove upstream termination. Choose a timeout appropriate to
your UI, then reconcile server-side run state if required.

Dispose the facade when its owner shuts down. Do not automatically replay a
streamed write after connection loss: it may already have executed.

[Error handling](errors.md) · [Runtime operations](../operations/runtime.md#streamrun)

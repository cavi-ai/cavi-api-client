---
documentedVersion: 0.18.0
---

# Send streaming text to your application

Use a configured client from [provider setup](providers.md). Pass a callback
that appends text to your UI, writes to an application stream, or updates a job.
The helper below returns final text and the run ID only after a completed
outcome. It borrows the client and accepts the caller's cancellation signal.

Download [streamText](../examples/runtime-streaming.ts).

```ts
import { ApiClientError, ApiClientErrorCode, type CapabilityClient, type StreamRunBody } from "@cavi-ai/api-client";

export async function streamText(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (text: string) => void,
  signal: AbortSignal,
  reportError?: (error: unknown) => void,
) {
  let text = "";
  let terminalText: string | undefined;
  let runError: string | undefined;
  let transportError: unknown;
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") {
        text += event.delta;
        write(event.delta);
      }
      if (event.event === "run.completed") terminalText = event.output;
      if (event.event === "run.failed") runError = event.error;
    },
    onError(error) {
      transportError = error;
      reportError?.(error);
    },
  }, { signal });
  if (!result.ok) throw new ApiClientError(result.gap.note, {
    code: ApiClientErrorCode.RequestFailed, cause: result.gap,
  });
  if (result.data.outcome !== "completed") {
    const code = result.data.outcome === "failed" ? "run_failed"
      : result.data.outcome === "cancelled" ? "run_cancelled" : "run_incomplete";
    throw new ApiClientError(`Stream ended with outcome ${result.data.outcome ?? "unknown"}`, {
      type: "run", code, cause: { ...result.data, error: runError, transportError },
    });
  }
  return { ...result.data, text: terminalText ?? text };
}
```

Call it with your run body, output callback, and an `AbortSignal`.
Use the optional `reportError` callback for server diagnostics; it must not
throw. It observes parse/transport errors, including recoverable malformed
frames. A `run.failed` event is captured separately. The typed exception retains
the run ID, outcome, run error, and any transport error in `cause`; callers
branch on `run_failed`, `run_cancelled`, or `run_incomplete`. The enum aliases
are unreleased, so the example uses compatible string values.

The returned `text` uses a terminal output snapshot when one is supplied,
otherwise the accumulated deltas. Do not append a terminal snapshot as another
delta: that can duplicate the answer. Partial deltas can already be visible
when a run fails; retain them as partial output, not a successful answer.

Unreleased development builds add `requireCompletedStream` and
`requireStreamText` for applications that require completed output. The
[development collector](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/run-results.md)
preserves facade gaps, handles text snapshots, and returns normalized usage
when supplied by the terminal event. These helpers are not in the pinned
release; use the compatible implementation above with that release.

## Render more than text

| Event | Application action |
| --- | --- |
| message.delta | Append the delta |
| run.completed | Mark completion; replace with terminal text if supplied |
| run.failed | Mark partial output failed and show an application error |
| run.cancelled | Mark cancellation |
| approval.request | Present the available choices; use the provider's approval API |
| tool.call.started/completed/failed | Update tool progress |

The event vocabulary is shared; a provider need not emit every event.
Receiving an approval event does not supply a universal approval-submission API.

## Distinguish call and execution outcomes

- `ok: false`: the stream call failed or was unavailable; inspect its gap.
- `ok: true`: inspect `data.outcome`, which can still be `failed` or `cancelled`.
- `outcome: null`: no terminal event was captured; do not display completion.

Authentication and unclassified failures still reject. `onError` reports
transport/parsing problems; `run.failed` arrives via `onEvent`.

## Gateway prerequisites and cancellation

Hermes requires a gateway `sessionKey` in the body and bridges SSE run events.
OpenClaw bridges native WebSocket events. The facade cannot supply missing
permissions, origin configuration, or session identity.

Pass a caller signal as the third `streamRun` argument. Caller abort returns a
`request-aborted` gap and requests best-effort cancellation when a run ID is
known. Reconcile upstream state when your workflow requires confirmation.
Do not replay a streamed write automatically after connection loss.

Dispose at owner shutdown. On a raw `RuntimeClient`, check advertised
streaming support and method presence; raw gateways commonly expose
subscriptions instead of inline `streamRun`.

[Errors](errors.md) · [Requests](requests.md) ·
[Runtime operations](../operations/runtime.md#streamrun)

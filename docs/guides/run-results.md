# Require completed output in an application

These APIs are **unreleased**. They are available in development builds; the
versioned site examples remain compatible with the pinned npm release.
Check the [changelog](../../CHANGELOG.md#unreleased) before adopting them.

The client returns execution state without imposing an application's success
policy. A tool-oriented workflow can accept a completed run with no text; an
answer service needs text. The following opt-in helpers enforce that decision
using the package's error types, without changing any provider methods.

Import them from `@cavi-ai/api-client` or `@cavi-ai/api-client/core/runtime`.

| Helper | Returns | Requires |
| --- | --- | --- |
| `requireCompletedRun(run)` | The original run, with `status` narrowed to `"completed"` | Observed completion; text is optional |
| `requireRunText(run)` | Text from `output`, falling back to legacy `response` | Completion and supplied text |
| `requireCompletedStream(stream)` | The original object, with `outcome` narrowed to `"completed"` | Observed stream completion; text is optional |
| `requireStreamText(stream)` | Caller-collected `output` | Stream completion and supplied text |

The completion/text helpers retain the original input in an error's `cause`. Completion
helpers preserve extra fields and object identity. They do not poll, retry,
cancel, dispose clients, or infer completion from partial text or stream EOF.
Stream helpers accept the facade's `{ runId, outcome }` shape structurally;
they preserve a nullable run ID without inventing one.

## Return an answer through your service

This service accepts any configured `CapabilityClient` whose run has completed
when `startRun` returns. Background runtimes need retrieval before applying
`requireRunText`; `run_incomplete` does not mean their execution failed.
Download [answer-service.ts](../../examples/answer-service.ts).

```ts
import { requireRunText, type CapabilityClient, type RuntimeRunInput } from "@cavi-ai/api-client";

export function createAnswerService(client: CapabilityClient, model: string) {
  return {
    async answer(input: RuntimeRunInput) {
      const result = await client.startRun({ model, input });
      if (!result.ok) return result;

      const run = result.data;
      const text = requireRunText(run);
      return {
        ok: true as const,
        source: result.source,
        data: { runId: run.run_id, text, tokens: run.tokens },
      };
    },
  };
}
```

Create the client with your server-owned provider configuration, then call
`createAnswerService(client, model).answer(input)` at your authenticated
application boundary. The caller owns the client and disposes it at shutdown.
The service preserves facade gaps and lets original client exceptions reject
unchanged. A successful answer carries its run identity and normalized usage.

## Stream partial text and return a completed answer

The collector below passes normalized deltas to your application and gives
`requireStreamText` a terminal output snapshot, or accumulated deltas when no
snapshot was supplied. A snapshot replaces the deltas rather than duplicating
them. Download [stream-answer.ts](../../examples/stream-answer.ts).

```ts
import { requireStreamText, type CapabilityClient, type RuntimeUsage, type StreamRunBody } from "@cavi-ai/api-client";

export async function streamAnswer(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (delta: string) => void,
  signal: AbortSignal,
  reportError: (error: unknown) => void,
) {
  let deltas: string | undefined;
  let terminalText: string | undefined;
  let tokens: RuntimeUsage | undefined;
  let runError: string | undefined;
  let transportError: unknown;
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") {
        deltas = (deltas ?? "") + event.delta;
        write(event.delta);
      }
      if (event.event === "run.completed") {
        terminalText = event.output;
        tokens = event.usage;
      }
      if (event.event === "run.failed") runError = event.error;
    },
    onError(error) {
      transportError = error;
      reportError(error);
    },
  }, { signal });
  if (!result.ok) return result;

  const text = requireStreamText({
    ...result.data, output: terminalText ?? deltas, error: runError, transportError,
  });
  return {
    ok: true as const,
    source: result.source,
    data: { runId: result.data.runId, text, tokens },
  };
}
```

`write` updates your UI or application stream. `reportError` sends diagnostics
to protected telemetry and must not throw; it can receive recoverable parsing
errors as well as transport errors. On success, the collector returns only
text, identity, and optional terminal token usage. Error diagnostics remain in
the exception's cause. Partial deltas can already be visible when a run fails;
mark that output as partial rather than treating it as a completed answer.

## Bound a background wait and keep its last observation

`waitForRun` is available from the root and `@cavi-ai/api-client/contracts`.
It accepts a configured facade and an existing run. Start work once, persist
its ID with its application owner, and pass the successful start result's
`data`. To resume with only an ID, retrieve it first and handle that call's gap.

The defaults are 60 retrieval attempts, a 1,000 ms delay before each attempt,
and a 60,000 ms local time budget. Supply `signal` for caller cancellation.
Each request remains sequential; the time budget includes a pending retrieval.
Timer budgets are non-negative integer milliseconds up to 2,147,483,647, and
`maxPolls` must be a non-negative safe integer. Zero budgets make no retrievals
for active runs. Observed terminal or unpollable states return immediately.

Download [background-answer.ts](../../examples/background-answer.ts). This
function turns a completed run into an answer using `requireRunText`; failed
or cancelled terminal runs reject with their typed execution errors. Other
wait outcomes remain explicit so the application can resume or report them.

```ts
import { requireRunText, waitForRun, type CapabilityClient, type RuntimeRunStatus, type RunWaitOptions } from "@cavi-ai/api-client";

export async function awaitBackgroundAnswer(
  client: CapabilityClient,
  run: RuntimeRunStatus,
  options: RunWaitOptions,
) {
  const waited = await waitForRun(client, run, options);
  if (waited.reason !== "terminal") return { kind: "wait-stopped" as const, ...waited };

  return {
    kind: "answer" as const,
    runId: waited.run.run_id,
    text: requireRunText(waited.run),
    tokens: waited.run.tokens,
  };
}
```

For example, set `{ maxWaitMs: 30_000, maxPolls: 10, pollIntervalMs: 1_000,
signal: request.signal }` at your application boundary. The helper borrows the
client; its owner disposes it. It never submits another run or cancels work.

| `RunWaitResult.reason` | Meaning | Application action |
| --- | --- | --- |
| `terminal` | Observed completed, failed, or cancelled state | Inspect `run.status`; use the output helper if text is required |
| `state-not-pollable` | A state outside started/running/stopping and the three terminal states | Reconcile deliberately; unknown and `dry_run` states are not inferred success |
| `poll-limit` | Retrieval attempt budget exhausted | Keep `run` and resume in a later worker if appropriate |
| `timeout` | Local time budget elapsed | Keep `run`; upstream work may still be active |
| `aborted` | Caller ended the local wait | Keep `run`; distinguish this from backend cancellation |
| `gap` | Retrieval returned a facade gap | Inspect `gap.reason`, retain the last run, and avoid blind submission retries |

Every result retains the original last-observed run and the number of retrieval
attempts started. A timeout or abort also ends a local wait on an in-flight
`getRun`; that request is not aborted because the current retrieval contract
has no per-call signal. Its late result or rejection is safely ignored by the
wait. Configure HTTP request timeouts separately to bound transport resources.
Authentication and other rejected client calls still propagate unchanged.
The helper removes its timers and caller signal listener on every exit.

Keep stopped snapshots and gaps in application state or protected diagnostics;
do not send raw provider payloads to the frontend. Authorize stored IDs before
retrieval or explicit cancellation.
See [authorized background integration](owned-background-runs.md) for a
complete service that rechecks read access before each poll and checks
cancellation permission separately.

## Handle the three failure layers

- Facade gaps remain `{ ok: false, gap }`; branch on `gap.reason`.
- Authentication and other rejected client calls keep their original error.
- Unacceptable execution outcomes throw `ApiClientError` with `type: "run"`.

| Error code | Meaning |
| --- | --- |
| `ApiClientErrorCode.RunFailed` | The backend reported execution failure |
| `ApiClientErrorCode.RunCancelled` | The backend reported cancellation |
| `ApiClientErrorCode.RunIncomplete` | Completion was not observed, including unknown and `dry_run` run states |
| `ApiClientErrorCode.RunOutputMissing` | Completion was observed without the text required by the caller |

Use `isApiClientError` and `isAuthError` at your exception boundary. Reconcile
known IDs before retrying ambiguous submissions. Run cancellation and local
request abort are different events; a locally incomplete observation does not
prove backend termination.

## Make execution decisions from structured details

Development builds add optional `errorDetails` to `RuntimeRunStatus`,
`run.failed` events, and the facade's `RunStreamOutcome`. The
`RuntimeRunErrorDetails` type is exported from the root and `core/runtime`.
Existing run/event `error` strings remain available for protected diagnostics.
The facade preserves details from the last observed failed terminal event;
it forwards the original event to the application.

| Field | Observed value | How to use it |
| --- | --- | --- |
| `providerCode` | Native error `code`, such as Codex's `server_error` | Branch within the configured provider's code vocabulary |
| `providerType` | Native error `type`, such as Claude's `overloaded_error` | Distinguish provider failure categories without parsing messages |
| `reason` | Native failure/incompletion `reason`, such as `max_output_tokens` | Explain or adjust a later request deliberately |

The initial mappings cover Codex failed/incomplete responses and error SSE
frames, and Claude Messages error SSE frames. Other providers may omit details.
Absent details mean unavailable information, not an unknown code or a retry
instruction. Only non-empty string fields are projected; arbitrary provider
payloads, headers, and claimed retry flags are not copied into this object.
The values remain provider-specific and are not sanitized for public display.

For a configured Codex workflow, inspect `run.errorDetails?.reason` for
`max_output_tokens` before deciding whether to request more output. Codex
continues mapping an incomplete response to the existing `failed` run state.
For streaming, read `result.data.errorDetails` after checking `result.ok` and
`outcome`; the collector above retains those details in the typed error's
`cause` automatically. No text-message parsing or new submission is required
to identify the observed category.

Run details describe execution, while `getRuntimeErrorMetadata` describes
client/transport exceptions. Completion helpers retain the original details
in `cause` and keep their existing `run_failed`/`run_cancelled` codes. Never
treat a provider code as permission to replay a submission. Keep raw values
in protected diagnostics and return application-owned messages to callers.

An explicit empty string is valid output and is never trimmed or replaced by
legacy text. Absent text triggers `RunOutputMissing`. Helpers consume the
adapter's normalized values; they do not change how a provider maps empty or
non-text content. A completed tool-only run passes the completion helpers.

Keep `cause` in protected diagnostics; it may contain provider data.
`serializeError` excludes it but retains the exception message, so apply your
normal telemetry redaction policy. Return application-owned messages to users.

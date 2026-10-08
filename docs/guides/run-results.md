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

All helpers retain the original input object in an error's `cause`. Completion
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

An explicit empty string is valid output and is never trimmed or replaced by
legacy text. Absent text triggers `RunOutputMissing`. Helpers consume the
adapter's normalized values; they do not change how a provider maps empty or
non-text content. A completed tool-only run passes the completion helpers.

Keep `cause` in protected diagnostics; it may contain provider data.
`serializeError` excludes it but retains the exception message, so apply your
normal telemetry redaction policy. Return application-owned messages to users.

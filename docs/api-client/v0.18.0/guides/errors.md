---
documentedVersion: 0.18.0
---

# Handle failures without inventing success

Handle three independent layers: configuration errors during construction,
the result of the client call, and the lifecycle status of the run.

## Facade results

`CapabilityClient` accessors always exist. Calls can return
`{ ok: false, data: null, gap }` even when discovery previously showed support.
Use `gap.reason` for application decisions and `gap.note` for diagnostics.

| Situation | Response |
| --- | --- |
| capability-unsupported | Hide/disable the feature or explain the gap |
| backend-not-configured | Configure the required backend at the application boundary |
| request-invalid | Correct input, required session fields, or configuration |
| endpoint-not-found | Check backend version, route, plugin, and permissions |
| backend-unavailable | Report availability; reconcile writes before retrying |
| transport-disconnected | Restore the connection and reconcile known work |
| request-aborted | Stop the local wait; verify upstream state if necessary |

A structured gap does not prove a write had no side effects: a connection can
fail after the backend accepts work. The facade does not substitute mock data
for an unsuccessful call. Some lower-level CAVI extension helpers have their
own documented fallback envelopes; do not confuse those with facade results.

## Exceptions

401/403 authentication failures and unclassified failures still reject.
Construction errors such as an unknown provider or invalid URL can also throw.
Keep `try/catch` around construction and use, and retain the original typed
error for diagnostics. `isApiClientError` is available from the root and
`core/errors` for narrowing.

Never treat an exception as an empty successful result. Fix authentication
rather than retrying it indefinitely. Avoid logging secrets, headers, or
unfiltered provider request bodies.

The [server handler](server.md) uses `isAuthError` to distinguish server-owned
provider credential failures and returns a controlled response. Keep the
original error in protected telemetry; do not send its message or `cause` to
the frontend.

## Run outcomes

`startRun` can return a live result whose status is `failed`.
`streamRun` can return `ok: true` with `outcome: "failed"`.
Use the run error/event to explain execution failure, separately from transport
or capability failure. An `unknown` state or null stream outcome is not success.

The [answer service](../introduction/quickstart.md) uses `ApiClientError` with
`type: "run"` when the application requires a completed text answer. It retains
the run ID and state in `cause`. The streaming helper follows the same codes:

| Code | Meaning | Application action |
| --- | --- | --- |
| `run_failed` | The backend reported execution failure | Inspect protected diagnostics; show a failed answer |
| `run_cancelled` | The backend reported cancellation | Show cancellation; do not confuse it with local request abort |
| `run_incomplete` | Completion was not observed | Keep the run ID and reconcile; work may still be active |
| `run_output_missing` | A completed run lacks required text | Report a missing answer; empty text is still a valid string |

Development adds `ApiClientErrorType.Run` and `ApiClientErrorCode.RunFailed`,
`RunCancelled`, `RunIncomplete`, and `RunOutputMissing`. These enum members are
unreleased. The examples use their string values so they also work with the
pinned release, whose error constructor accepts string types and codes.
Providers still return run states; the application chooses whether to reject
an outcome that cannot satisfy its workflow.

Development builds also add optional `errorDetails` with observed provider
code/type/reason strings on runs and failed stream outcomes. Codex
responses/streams and Claude Messages error streams populate available fields;
providers without structured information leave it absent. Existing statuses
and error strings remain unchanged. See the
[development guide](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/run-results.md#make-execution-decisions-from-structured-details)
for handling them without parsing messages or inferring retry safety.

## Give callers an actionable failure

Narrow errors and branch on codes, never message text. This mapper returns only
application-owned messages. Unknown exceptions remain failures; it does not
retry submissions or expose provider diagnostics.

```ts
import { isApiClientError, isAuthError } from "@cavi-ai/api-client";

export function answerFailure(error: unknown) {
  if (isAuthError(error)) return { kind: "unavailable", message: "The runtime needs authentication." };
  if (isApiClientError(error)) {
    switch (error.code) {
      case "run_cancelled": return { kind: "cancelled", message: "The answer was cancelled." };
      case "run_incomplete": return { kind: "incomplete", message: "No completed answer was observed. Check the run state." };
      case "run_output_missing": return { kind: "failed", message: "The run completed without a text answer." };
      case "run_failed": return { kind: "failed", message: "The runtime could not produce an answer." };
    }
  }
  return { kind: "failed", message: "The answer request failed." };
}
```

Use this in your application's `catch` boundary after recording the original
error in protected telemetry. `serializeError` retains `name`, `message`,
`type`, and `code` without copying `cause`; the message still needs your
telemetry's redaction policy. `getRuntimeErrorMetadata` exposes available
provider, transport, operation, and retry hints for diagnostics. A retry hint
does not make replaying a run submission safe.

For direct HTTP clients, see [HTTP integration](http.md#handle-typed-errors-and-cancellation)
for typed response failures and original caller cancellation reasons.

## Timeouts and retries

`defaultTimeoutMs` controls supported runtime HTTP requests through the facade.
It is not a universal end-to-end run deadline and does not configure every
control-plane transport. Bound polling separately and pass a caller signal for
streaming.

There is no universal automatic retry policy. Do not replay a run submission
unless your backend and application can establish that it is safe. Reconcile
a known run ID before retrying an ambiguous write.

## Troubleshooting

- Unknown provider: register the module explicitly; the built-in registry has
  only Hermes and OpenClaw.
- Missing model: configure an account-accessible model; AGY expects an agent ID.
- Gateway streaming gap: check Hermes sessionKey or OpenClaw scopes/origin.
- Resource gap: check resolved capabilities and required gateway plugins.
- Stream ends without a terminal event: report an incomplete run and reconcile;
  do not infer completion from EOF.

[Provider setup](providers.md) · [Requests](requests.md) · [Streaming](streaming.md)

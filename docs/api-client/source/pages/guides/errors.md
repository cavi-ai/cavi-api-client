---
documentedVersion: {{documentedVersion}}
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
| Unsupported capability or unwired backend | Hide/disable the feature or explain the gap |
| request-invalid | Correct input, required session fields, or configuration |
| endpoint-not-found | Check backend version, route, plugin, and permissions |
| backend-unavailable | Report availability; reconcile writes before retrying |
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

## Run outcomes

`startRun` can return a live result whose status is `failed`.
`streamRun` can return `ok: true` with `outcome: "failed"`.
Use the run error/event to explain execution failure, separately from transport
or capability failure. An `unknown` state or null stream outcome is not success.

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

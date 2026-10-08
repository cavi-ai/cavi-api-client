---
documentedVersion: {{documentedVersion}}
---

# Start, retrieve, and cancel work

Configure a [provider](providers.md) first. On the application facade,
`startRun` returns `CapabilityResult<RuntimeRunStatus>`. Check `result.ok`,
then inspect `result.data.status`. A live call can return a failed run.

## Understand the lifecycle

| Backend | What startRun returns | Retrieval |
| --- | --- | --- |
| Claude Messages, AGY, Gemini | Terminal response | Client-remembered terminal state |
| Codex | Background response, possibly active | Upstream response resource |
| Claude Managed Agents | Server-side session status | Upstream session |
| Hermes/OpenClaw | Gateway run handle | Gateway lifecycle |
| OpenCode | Synchronous scoped message result | Cached terminal state or server session reconciliation |

A run ID from client-local storage is not durable across process restarts.
Unknown IDs can yield an `unknown` status; do not treat that as completion.
Output fields are optional. In particular, the documented release's Codex mapper reads
`output_text` without flattening native `output` items; completion alone does
not guarantee that normalized text is present.

Unreleased development adds native message-text normalization. Check the
[repository changelog](https://github.com/cavi-ai/cavi-api-client/blob/main/CHANGELOG.md#unreleased)
for release availability; it is not part of the pinned artifact described here.

## Bound background polling

The [complete Codex polling example](../examples/runtime-node.ts) takes an API
key and model, bounds the number of polls, checks every facade result, and
attempts cancellation if work remains active at the limit.

Use a request timeout as well as a poll limit. Stop on an unsuccessful call or
an unfamiliar state instead of looping forever. Persist server-side run IDs
only where the provider supports later retrieval.

## Cancel deliberately

Facade `cancelRun(runId)` returns a result that must be inspected. A local
timeout or a disposed client does not prove the backend stopped. A successful
cancel response can indicate a transition rather than an already terminal run;
reconcile status when your workflow needs confirmation.

For synchronous providers, cancellation of a remembered terminal run cannot
undo work that already finished. For streams, use the caller signal and
[stream cancellation](streaming.md#cancellation-and-cleanup).

## Request portability

Use `input` for a string or role/content messages, `instructions` for shared
instructions, and `model` for provider configuration. Native tool records and
metadata do not become portable just because the body accepts them.

[Raw method reference](../operations/runtime.md) documents request/status fields.
[Error handling](errors.md) covers gaps, exceptions, and retry decisions.

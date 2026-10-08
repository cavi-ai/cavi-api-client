---
documentedVersion: {{documentedVersion}}
---

# OpenCode operations

Use [OpenCode setup](../../guides/providers.md#opencode) to register the opt-in
provider. It targets the server version declared by `OPENCODE_SERVER_VERSION` and the `legacy-http-sse` endpoint family;
runs and streaming are supported, batch and gateway resources are not.
[Public declarations](../../reference/providers-opencode.md)

This page describes raw runtime methods. The facade wraps their values in
`CapabilityResult`; see [client contracts](../../concepts/runtime-client.md).

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `GET /global/health` · `POST /session` · `POST /session/:id/message`
**Capability** `supports.runs`

For non-dry runs, health is probed once per client, a scoped session is created,
and a synchronous message is submitted. The session ID becomes `run_id`.
Submission/validation failure after creation triggers one best-effort session
abort before the original failure is preserved. Dry runs validate locally and
make no server requests.

## getRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>`
**HTTP** `GET /session/:id` · `GET /session/status` · `GET /session/:id/message`
**Capability** `supports.runs`

A remembered terminal result is returned without a request. Otherwise the
adapter reconciles session state and message history. Busy/retrying sessions
remain running; an absent session is unknown.

## cancelRun

**Signature** `client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `POST /session/:id/abort`
**Capability** `supports.runs`

A successful server abort yields cancelled status. A negative response leaves
the run unknown unless a terminal result is already remembered.

## streamRun

**Signature** `client.streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: { signal?: AbortSignal }): Promise<void>`
**HTTP** `GET /event` · `POST /session/:id/prompt_async`
**Capability** `supports.streaming`

The SSE subscription opens before submission. HTTP 204 accepts the prompt.
There is no reconnect or replay, and EOF without a verified terminal event is
an error rather than synthesized completion. Malformed frames are reported as
non-terminal errors; terminal events are delivered once.

Caller abort and pre-terminal setup/transport/protocol/handler failures use
best-effort session cleanup. A session with an observed terminal event is not
aborted. Local cleanup does not prove that upstream work terminated.

Every scoped request carries the encoded directory and optional workspace.
Route tables and stream translators remain private; use the public adapter
rather than importing its implementation helpers.

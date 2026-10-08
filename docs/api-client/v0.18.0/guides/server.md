---
documentedVersion: 0.18.0
---

# Connect your server to an agent runtime

Keep provider credentials and model selection in server configuration. Give the
frontend your application's endpoint rather than a privileged provider key.

The handler below accepts a question and returns a run ID, state, optional text,
and token usage. It works with a configured `CapabilityClient`; it does not
construct or dispose a client per request. Download the
[complete handler](../examples/server-handler.ts).

```ts
import { isAuthError, type CapabilityClient } from "@cavi-ai/api-client";

export function createRunHandler(
  client: CapabilityClient,
  model: string,
  reportError: (error: unknown) => void,
) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405, headers: { Allow: "POST" } });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Expected JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("input" in body) ||
        typeof body.input !== "string" || body.input.trim() === "") {
      return Response.json({ error: "Provide a non-empty input string." }, { status: 400 });
    }
    try {
      const result = await client.startRun({ model, input: body.input });
      if (!result.ok) {
        reportError(result.gap);
        return Response.json({ error: "Run unavailable.", reason: result.gap.reason }, { status: 503 });
      }
      const run = result.data;
      const active = ["started", "running", "stopping"].includes(run.status);
      const status = active ? 202 : run.status === "completed" ? 200 : 502;
      return Response.json({
        runId: run.run_id,
        status: run.status,
        text: run.output ?? run.response,
        tokens: run.tokens,
      }, { status });
    } catch (error) {
      reportError(error);
      if (isAuthError(error)) {
        // These are server-owned provider credentials, not the caller's login.
        return Response.json({ error: "Runtime authentication unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Run request failed." }, { status: 502 });
    }
  };
}
```

Create a client using [provider setup](providers.md), then bind
`createRunHandler(client, model, reportError)` to your framework's request
adapter. `reportError` is your server-side telemetry function; it must not throw
or expose credentials. Mount the handler behind your application's
authentication and authorization. Apply your own input limits and usage policy
before starting paid work.

## Handle the response

These HTTP status codes are example application policy, not provider protocol
semantics.

| HTTP response | Frontend behavior |
| --- | --- |
| 200, completed | Render `text` if present; keep `runId` and optional `tokens` |
| 202, started/running/stopping | Keep `runId`; show progress and retrieve it through an authenticated application endpoint |
| 400/405 | Correct the request |
| 503 with `reason` | Display availability/validation feedback; let server diagnostics retain the full gap |
| 503, runtime authentication unavailable | Show service unavailability; the operator fixes server-owned provider credentials |
| 502 | Show failure; do not turn missing/unknown outcomes into success |

A completed run may have no text. A tool-oriented application can still consume
that completion; a text-only application should treat absent text as a missing
answer, as the [answer service](../introduction/quickstart.md) does.
The handler forwards only the accepted input field and a server-selected model,
not arbitrary tool definitions or caller-supplied credentials.

`isAuthError` recognizes provider authentication without parsing messages.
That failure is a server configuration issue here; it does not mean the
frontend user needs to log in again. The exception boundary reports the
original error and returns only an application-owned message.

## Own the lifecycle

Keep clients within one credential/configuration scope. Dispose on application
shutdown after settling in-flight work. The request's abort signal is not
forwarded by `startRun`; use [streaming](streaming.md) with an explicit caller
signal when you need a cancellable local wait. Request timeouts do not prove
that upstream work stopped.

If you add retrieval or cancellation endpoints, authorize the caller against
the stored run's owner before using its ID. Persist IDs only for providers with
server-side retrieval; synchronous Messages run IDs are client-local.

[Background runs](requests.md) · [Errors](errors.md) · [React](react.md)

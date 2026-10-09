---
documentedVersion: 0.18.0
---

# Put runtime output in a React application

For Claude, Codex, AGY, or OpenCode, keep the provider client on your server.
Call your application's [request endpoint](server.md), render its returned
run state/text, or deliver [stream deltas](streaming.md) through your
application's chosen transport. The package does not provide a universal
runtime chat hook.

## Submit through your application's server

Mount the [documented handler](server.md) on your authenticated application
POST route. Keep user authorization, ownership, and CSRF policy at that server
boundary. Pass the route URL to `AnswerForm`; keep provider keys and model
selection on the server. The browser sends only `{ input }`.

Download [react-answer.tsx](../examples/react-answer.tsx) into your React app.
Render `AnswerForm` with an `endpoint` pointing to your application's route.
It uses ordinary React hooks and browser fetch; it does not create a provider
client or gateway connection in the browser.

```tsx
import React, { useEffect, useId, useRef, useState } from "react";

type AnswerState =
  | { kind: "idle" | "loading" | "cancelled" }
  | { kind: "pending"; runId: string; status: string }
  | { kind: "completed"; runId: string; text: string }
  | { kind: "failed"; message: string; runId?: string };

export function useAnswerRequest(endpoint: string, fetchImpl: typeof fetch = fetch) {
  const [state, setState] = useState<AnswerState>({ kind: "idle" });
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    setState({ kind: "idle" });
    return () => {
      const controller = active.current;
      active.current = null;
      controller?.abort();
    };
  }, [endpoint, fetchImpl]);

  async function submit(input: string) {
    active.current?.abort();
    active.current = null;
    if (!input.trim()) {
      setState({ kind: "failed", message: "Provide a question." });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setState({ kind: "loading" });
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }),
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (active.current !== controller || controller.signal.aborted) return;
      const payload = body && typeof body === "object" && !Array.isArray(body)
        ? body as Record<string, unknown> : {};
      const runId = typeof payload.runId === "string" && payload.runId.trim() ? payload.runId : undefined;
      if (!response.ok) {
        const message = response.status === 400 ? "Provide a valid question."
          : [401, 403].includes(response.status) ? "This request is not allowed."
          : response.status === 503 ? "The runtime is unavailable. Check existing work before retrying."
          : "The answer request failed.";
        setState({ kind: "failed", message, runId });
      } else if (response.status === 202 && runId && typeof payload.status === "string" &&
          ["started", "running", "stopping"].includes(payload.status)) {
        setState({ kind: "pending", runId, status: payload.status });
      } else if (response.status === 200 && runId && payload.status === "completed" && typeof payload.text === "string") {
        setState({ kind: "completed", runId, text: payload.text });
      } else {
        setState({ kind: "failed", runId, message: "The server returned an unexpected run result." });
      }
    } catch {
      if (active.current === controller && !controller.signal.aborted) {
        setState({ kind: "failed", message: "Could not confirm the request result. Check existing work before retrying." });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  function cancel() {
    const controller = active.current;
    if (!controller) return;
    active.current = null;
    controller.abort();
    setState({ kind: "cancelled" });
  }
  return { state, submit, cancel };
}

export function AnswerForm({ endpoint, fetchImpl }: { endpoint: string; fetchImpl?: typeof fetch }) {
  const { state, submit, cancel } = useAnswerRequest(endpoint, fetchImpl);
  const question = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  return (
    <section aria-label="Ask the runtime">
      <form onSubmit={(event) => { event.preventDefault(); void submit(question.current?.value ?? ""); }}>
        <label htmlFor={inputId}>Question</label>
        <textarea id={inputId} name="question" ref={question} required />
        <button type="submit" disabled={state.kind === "loading"}>Ask</button>
        {state.kind === "loading" && <button type="button" onClick={cancel}>Stop waiting</button>}
      </form>
      <div aria-live="polite" aria-busy={state.kind === "loading"}>
        {state.kind === "idle" && <p>Ask a question to start.</p>}
        {state.kind === "loading" && <p role="status">Waiting for the server…</p>}
        {state.kind === "cancelled" && <p role="status">Stopped waiting locally. Server work may continue.</p>}
        {state.kind === "pending" && <p role="status">Pending run {state.runId} ({state.status}). Keep this ID to resume through your application.</p>}
        {state.kind === "failed" && <React.Fragment><p role="alert">{state.message}</p>{state.runId && <p>Run {state.runId}</p>}</React.Fragment>}
        {state.kind === "completed" && <React.Fragment>
          <p>Completed run {state.runId}.</p>
          {state.text === "" ? <p>The completed answer is empty.</p> : <pre>{state.text}</pre>}
        </React.Fragment>}
      </div>
    </section>
  );
}
```

| UI state | Meaning |
| --- | --- |
| Loading | One browser request is awaiting a result; duplicate form submission is disabled |
| Completed | HTTP 200 supplied a completed run, a run ID, and text; an explicit empty string remains valid |
| Pending | HTTP 202 supplied an active run; retain its ID and resume through your authorized application endpoint |
| Failed | A controlled HTTP failure or unexpected response; raw backend messages are not rendered |
| Cancelled | The browser stopped waiting locally; server work can continue |

The helper validates the handler's response envelope before displaying an
answer. It keeps a failed run's ID when available and maps HTTP errors to fixed
application messages. Unknown exceptions and invalid JSON remain failures;
neither is converted to an empty answer. It performs no automatic retries.

`Stop waiting` aborts the local fetch and invalidates its response. A cancelled,
older, or unmounted request cannot overwrite a newer answer, even if the fetch
implementation ignores its signal. Changing the endpoint or injected fetch
implementation also aborts the old request and resets the UI.

Local abort does not cancel backend execution. Persist run ownership and IDs
on the server so work can be reconciled if the browser never receives its
response. This form does not poll pending runs or submit cancellation requests;
connect those actions to your application's authorized run workflow. Keep the
optional `fetchImpl` stable while mounted; it is useful for tests or an
application-owned transport wrapper.

## Run the React workflow tests

Download [react-answer.test.tsx](../examples/react-answer.test.tsx),
[react-answer.tsx](../examples/react-answer.tsx), and
[server-handler.ts](../examples/server-handler.ts) together into `examples/`.
Start with the ESM test workspace from [consumer testing](testing.md). The
validated test dependencies below require Node 20.19+, 22.13+, or 24+:

```sh
npm install react@19 react-dom@19
npm install --save-dev vitest@4 jsdom@29 @types/react @types/react-dom
npx vitest run examples/react-answer.test.tsx --environment jsdom --maxWorkers 1
```

Expected result: seven passing tests without real provider credentials or
network calls. The tests mount the form in React Strict Mode. Native Codex
fixtures run through the installed adapter, facade, and server handler before
the UI displays their responses. Deferred browser responses check loading,
local cancellation, stale completion, endpoint changes, and unmount cleanup.
Each test unmounts its React roots and disposes its server-owned client.

## Gateway connection bindings

For a gateway that speaks the bindings' WebSocket protocol, install React 18
or later and import `@cavi-ai/api-client/frameworks/react`. These bindings
manage a gateway connection; connection success is not run completion.
They are not an adapter for every gateway's transport, including Hermes'
dashboard JSON-RPC channel.

Pass your gateway URL, browser-user token, and accepted client identity into
the mounted provider. Handle invalid addresses and handshake failures as
visible state. Download [GatewayApp](../examples/react-gateway.tsx).

```tsx
import { GatewayClientProvider, useGatewayClientContext } from "@cavi-ai/api-client/frameworks/react";

function ConnectionStatus() {
  const { state, urlError, connectionError } = useGatewayClientContext();
  if (urlError) return <p role="alert">Invalid gateway address.</p>;
  if (connectionError) return <p role="alert">Gateway connection failed.</p>;
  return <p role="status">Gateway: {state}</p>;
}

export function GatewayApp(config: { gatewayUrl: string; token: string; clientId: string }) {
  return (
    <GatewayClientProvider gatewayBaseUrl={config.gatewayUrl} authToken={config.token} clientId={config.clientId}>
      <ConnectionStatus />
    </GatewayClientProvider>
  );
}
```

Use credentials scoped to the browser user and permissions allowed by the
gateway. A provider API key does not belong in these props. The gateway must
accept the browser origin, client identity, and any requested scopes.

Let the mounted provider own the connection lifecycle. Do not create a second
facade connection just to read socket state. If your application also runs work
through a separately owned facade, use its result and terminal outcome for
execution state.

The root entry does not import React.
[React declarations](../reference/frameworks-react.md) · [Gateway resources](gateway.md)

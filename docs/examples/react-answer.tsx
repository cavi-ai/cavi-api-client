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

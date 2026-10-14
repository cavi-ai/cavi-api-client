// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";
import { AnswerForm } from "./react-answer.js";
import { createRunHandler } from "./server-handler.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: { root: Root; element: HTMLDivElement }[] = [];
const clients: { dispose(): Promise<void> }[] = [];

afterEach(async () => {
  for (const { root, element } of mounted.splice(0)) {
    await act(async () => { root.unmount(); });
    element.remove();
  }
  for (const client of clients.splice(0)) await client.dispose();
});

async function mount(fetchImpl: typeof fetch, endpoint = "/answer") {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  mounted.push({ root, element });
  const render = async (url: string) => {
    await act(async () => { root.render(<React.StrictMode><AnswerForm endpoint={url} fetchImpl={fetchImpl} /></React.StrictMode>); });
  };
  await render(endpoint);
  const submit = (input = "Question") => {
    element.querySelector("textarea")!.value = input;
    element.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
  const cancel = () => element.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
  return { element, root, render, submit, cancel };
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function server(reply: () => Response) {
  const providerBodies: unknown[] = [];
  const browserBodies: unknown[] = [];
  const client = createApiClient("codex", {
    registry: createRuntimeProviderRegistry({ modules: [createCodexProviderModule({ apiKey: "server-fixture-key" })] }),
    fetchImpl: async (_url, init) => {
      providerBodies.push(JSON.parse(String(init?.body)));
      return reply();
    },
  });
  clients.push(client);
  const handle = createRunHandler(client, "server-model", () => {});
  let response: Promise<Response>;
  const fetchImpl: typeof fetch = (url, init) => {
    browserBodies.push(JSON.parse(String(init?.body)));
    response = handle(new Request(new URL(String(url), "https://application.example"), init));
    return response;
  };
  return { fetchImpl, providerBodies, browserBodies, response: () => response };
}

describe("React answer workflow", () => {
  it("renders the real handler's answer and keeps model and credentials on the server", async () => {
    const app = server(() => Response.json({ id: "run-1", status: "completed", output_text: "Answer" }));
    const ui = await mount(app.fetchImpl);
    await act(async () => { ui.submit(); await app.response(); });
    expect(ui.element.querySelector("pre")?.textContent).toBe("Answer");
    expect(ui.element.textContent).toContain("Completed run run-1");
    expect(app.browserBodies).toEqual([{ input: "Question" }]);
    expect(app.providerBodies).toMatchObject([{ input: "Question", model: "server-model" }]);
  });

  it("keeps an active run pending without polling or displaying a completed answer", async () => {
    const app = server(() => Response.json({ id: "run-1", status: "queued" }));
    const ui = await mount(app.fetchImpl);
    await act(async () => { ui.submit(); await app.response(); });
    expect(ui.element.textContent).toContain("Pending run run-1 (started)");
    expect(ui.element.querySelector("pre")).toBeNull();
    expect(app.browserBodies).toHaveLength(1);
  });

  it("renders controlled failures without exposing provider diagnostics", async () => {
    const app = server(() => Response.json({ error: { message: "Private credential diagnostic" } }, { status: 401 }));
    const ui = await mount(app.fetchImpl);
    await act(async () => { ui.submit(); await app.response(); });
    expect(ui.element.querySelector('[role="alert"]')?.textContent).toContain("runtime is unavailable");
    expect(ui.element.textContent).not.toContain("Private");
    expect(ui.element.textContent).not.toContain("server-fixture-key");
  });

  it("rejects missing text and mismatched success states, preserving a failed run ID", async () => {
    let reply = Response.json({ runId: "run-1", status: "completed" });
    const ui = await mount(async () => reply);
    for (const response of [reply, Response.json({ runId: "run-1", status: "completed", text: "Wrong state" }, { status: 202 })]) {
      reply = response;
      await act(async () => { ui.submit(); });
      expect(ui.element.querySelector('[role="alert"]')).not.toBeNull();
      expect(ui.element.querySelector("pre")).toBeNull();
    }
    reply = Response.json({ runId: "failed-1", status: "failed", error: "Private diagnostic" }, { status: 502 });
    await act(async () => { ui.submit(); });
    expect(ui.element.textContent).toContain("failed-1");
    expect(ui.element.textContent).not.toContain("Private diagnostic");
  });

  it("ignores an older response after local cancellation and a newer submission", async () => {
    const older = deferred();
    const newer = deferred();
    const signals: AbortSignal[] = [];
    const ui = await mount(async (_url, init) => {
      signals.push(init!.signal!);
      return signals.length === 1 ? older.promise : newer.promise;
    });
    await act(async () => { ui.submit("Old"); });
    expect(ui.element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    await act(async () => { ui.cancel(); ui.submit("New"); });
    expect(signals[0].aborted).toBe(true);
    await act(async () => { newer.resolve(Response.json({ runId: "new-1", status: "completed", text: "New answer" })); });
    await act(async () => { older.resolve(Response.json({ runId: "old-1", status: "completed", text: "Old answer" })); });
    expect(ui.element.querySelector("pre")?.textContent).toBe("New answer");
  });

  it("keeps local cancellation visible when an ignored abort still produces a response", async () => {
    const pending = deferred();
    let signal: AbortSignal | undefined;
    let calls = 0;
    const ui = await mount(async (_url, init) => { calls += 1; signal = init!.signal!; return pending.promise; });
    await act(async () => { ui.submit(); });
    await act(async () => { ui.cancel(); });
    expect(signal!.aborted).toBe(true);
    expect(ui.element.textContent).toContain("Stopped waiting locally");
    await act(async () => { pending.resolve(Response.json({ runId: "late-1", status: "completed", text: "Late answer" })); });
    expect(ui.element.textContent).not.toContain("Late answer");
    expect(ui.element.textContent).toContain("Server work may continue");
    expect(calls).toBe(1);
  });

  it("aborts and invalidates requests when the endpoint changes or the component unmounts", async () => {
    const pending = deferred();
    const signals: AbortSignal[] = [];
    const ui = await mount(async (_url, init) => { signals.push(init!.signal!); return pending.promise; });
    await act(async () => { ui.submit(); });
    await ui.render("/other-answer");
    expect(signals[0].aborted).toBe(true);
    expect(ui.element.textContent).toContain("Ask a question to start");
    await act(async () => { pending.resolve(Response.json({ runId: "stale-1", status: "completed", text: "Stale answer" })); });
    expect(ui.element.querySelector("pre")).toBeNull();
    const last = deferred();
    const unmounted = await mount(async (_url, init) => { signals.push(init!.signal!); return last.promise; });
    await act(async () => { unmounted.submit(); });
    await act(async () => { unmounted.root.unmount(); });
    mounted.splice(mounted.findIndex((entry) => entry.root === unmounted.root), 1);
    expect(signals.at(-1)!.aborted).toBe(true);
    await act(async () => { last.resolve(Response.json({ runId: "late-1", status: "completed", text: "Late answer" })); });
    expect(unmounted.element.textContent).toBe("");
    unmounted.element.remove();
  });
});

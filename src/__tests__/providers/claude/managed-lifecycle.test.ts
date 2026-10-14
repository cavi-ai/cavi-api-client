import { describe, expect, it, vi } from "vitest";
import { ManagedAgentLifecycle } from "../../../providers/claude/managed-agents/lifecycle.js";
import { ClaudeManagedAgentClient } from "../../../providers/claude/managed-agents/client.js";
import { driveManagedAgentSession } from "../../../providers/claude/managed-agents/driver.js";

const idle = (type: string) => ({ type: "session.status_idle", stop_reason: { type } });

describe("observed Managed Agents lifecycle", () => {
  it("cancels an opened SSE body when history replay fails before consumption", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const client = new ClaudeManagedAgentClient({ apiKey: "test", observeRunCompletion: true, fetchImpl: async input => {
      return String(input).endsWith("/stream") ? new Response(body) : new Response(JSON.stringify({ data: "malformed" }));
    } });
    await expect(client.streamSession("session", { onEvent: () => {} })).rejects.toMatchObject({ code: "transport_protocol_error" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("retains an operation deadline when a caller supplies a signal", async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    try {
      let requestSignal: AbortSignal | undefined;
      const client = new ClaudeManagedAgentClient({ apiKey: "test", defaultTimeoutMs: 1234, fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      } });
      const operation = client.listAllEvents("session", new AbortController().signal);
      const rejection = expect(operation).rejects.toBeDefined();
      await Promise.resolve();
      deadline.abort();
      await rejection;
      expect(timeout).toHaveBeenCalledWith(1234);
      expect(requestSignal?.aborted).toBe(true);
    } finally { timeout.mockRestore(); }
  });

  it("reports observed EOF as an error and releases a reader when event handling fails", async () => {
    const onComplete = vi.fn();
    const client = {
      listEvents: async () => [], listAllEvents: async () => [],
      openEventStream: async () => new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
      confirmTool: async () => {}, respondCustomTool: async () => {},
    };
    await expect(driveManagedAgentSession(client, "session", { onComplete }, { observeRunCompletion: true, maxReconnects: 0 })).rejects.toMatchObject({ code: "transport_protocol_error" });
    expect(onComplete).not.toHaveBeenCalled();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"agent.message","content":[]}\n\n'));
    }, cancel });
    client.openEventStream = async () => body;
    await expect(driveManagedAgentSession(client, "session", { onEvent: () => { throw new Error("handler"); } }, { observeRunCompletion: true, maxReconnects: 0 })).rejects.toThrow("handler");
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
  it("streams through budget pauses and workflow completion before the final end_turn", async () => {
    const events = [
      { type: "workflow_run.created", workflow_run_id: "wrun_a" },
      idle("budget_reached"), idle("end_turn"),
      { type: "workflow_run.status_ended", workflow_run_id: "wrun_a" },
      { type: "agent.message", content: [{ type: "text", text: "answer" }] }, idle("end_turn"),
    ];
    const fetchImpl: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/stream")) return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
      return new Response(JSON.stringify(path.endsWith("/sessions") ? { id: "session" } : {}));
    };
    const client = new ClaudeManagedAgentClient({ apiKey: "test", agentId: "agent", environmentId: "env", fetchImpl, observeRunCompletion: true });
    const received: unknown[] = [];
    await client.streamRun({ input: "hello" }, { onEvent: event => received.push(event) });
    expect(received).toEqual([{ event: "message.delta", runId: "session", delta: "answer" }, { event: "run.completed", runId: "session" }]);
  });

  it("replays all history before deciding whether the interactive driver is done", async () => {
    const history = [
      { id: "1", type: "user.message" }, { id: "2", ...idle("end_turn") },
      { id: "3", type: "user.message" },
      { id: "4", type: "workflow_run.created", workflow_run_id: "wrun_a" },
      { id: "5", ...idle("end_turn") },
    ];
    const live = [{ id: "6", type: "workflow_run.status_ended", workflow_run_id: "wrun_a" }, { id: "7", ...idle("end_turn") }];
    const received: string[] = [];
    const client = {
      listEvents: async () => [], listAllEvents: async () => history,
      openEventStream: async () => new Response(live.map(event => `data: ${JSON.stringify(event)}\n\n`).join("")).body!,
      confirmTool: async () => {}, respondCustomTool: async () => {},
    };
    await driveManagedAgentSession(client, "session", { onEvent: event => { if (event.id) received.push(event.id); } }, { observeRunCompletion: true });
    expect(received).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("rejects repeated page cursors rather than returning partial history", async () => {
    const client = new ClaudeManagedAgentClient({ apiKey: "test", fetchImpl: async () => new Response(JSON.stringify({ data: [], next_page: "loop" })) });
    await expect(client.listAllEvents("session")).rejects.toMatchObject({ code: "transport_protocol_error" });
  });
  it("waits for all workflows and a later end_turn, including after an interrupt", () => {
    const lifecycle = new ManagedAgentLifecycle();
    lifecycle.accept({ type: "workflow_run.created", workflow_run_id: "wrun_a" });
    lifecycle.accept(idle("end_turn"));
    expect(lifecycle.status).toBe("running");
    lifecycle.accept({ type: "workflow_run.status_ended", workflow_run_id: "wrun_a" });
    expect(lifecycle.status).toBe("running");
    lifecycle.accept(idle("budget_reached"));
    expect(lifecycle.status).toBe("paused");
    lifecycle.accept({ type: "user.interrupt" });
    lifecycle.accept(idle("end_turn"));
    expect(lifecycle.status).toBe("paused");
    lifecycle.accept({ type: "user.message" });
    lifecycle.accept(idle("end_turn"));
    expect(lifecycle.status).toBe("completed");
  });

  it("does not count subagent status, errors, or termination as successful completion", () => {
    const lifecycle = new ManagedAgentLifecycle();
    lifecycle.accept({ ...idle("end_turn"), session_thread_id: "thread_child" });
    expect(lifecycle.status).toBe("unknown");
    lifecycle.accept({ type: "session.error" });
    expect(lifecycle.status).not.toBe("completed");
    lifecycle.accept({ type: "session.status_terminated" });
    expect(lifecycle.status).toBe("unknown");
  });

  it("retrieves all pages and uses the latest turn without changing legacy defaults", async () => {
    const fetchImpl: typeof fetch = async input => {
      const url = new URL(String(input));
      let value: unknown = { id: "session", status: "idle" };
      if (url.pathname.endsWith("/events")) value = url.searchParams.has("page")
        ? { data: [{ type: "agent.message", content: [{ type: "text", text: "  answer\n" }] }, idle("end_turn")], next_page: null }
        : { data: [{ type: "user.message" }, { type: "workflow_run.created", workflow_run_id: "wrun_a" }, idle("end_turn"), { type: "workflow_run.status_ended", workflow_run_id: "wrun_a" }], next_page: "cursor/+" };
      return new Response(JSON.stringify(value));
    };
    const client = new ClaudeManagedAgentClient({ apiKey: "test", fetchImpl, observeRunCompletion: true });
    expect(await client.getRun("session")).toMatchObject({ status: "completed", output: "  answer\n" });
    const legacy = new ClaudeManagedAgentClient({ apiKey: "test", fetchImpl });
    expect(await legacy.getRun("session")).toEqual({ run_id: "session", status: "completed" });
  });
});

import { describe, expect, it } from "vitest";
import {
  driveManagedAgentSession,
  type ManagedAgentDriverClient,
  type ManagedAgentDriverHandlers,
} from "../../../../providers/claude/managed-agents/driver";

function streamOf(frames: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const f of frames) c.enqueue(encoder.encode(`data: ${JSON.stringify(f)}\n\n`));
      c.close();
    },
  });
}

type MockOpts = {
  streams: Record<string, unknown>[][];
  histories?: Record<string, unknown>[][];
  customThrowsFirst?: boolean;
};

function mockClient(opts: MockOpts) {
  const streams = [...opts.streams];
  const histories = [...(opts.histories ?? [])];
  const calls = {
    openEvent: 0,
    listEvents: 0,
    confirm: [] as { toolUseId: string; result: string; denyMessage?: string }[],
    custom: [] as { toolUseId: string; content: unknown; isError?: boolean }[],
  };
  let customCall = 0;
  const client: ManagedAgentDriverClient & { calls: typeof calls } = {
    calls,
    async openEventStream() {
      calls.openEvent++;
      return streamOf(streams.shift() ?? []);
    },
    async listEvents() {
      calls.listEvents++;
      return histories.shift() ?? [];
    },
    async confirmTool(_s, p) {
      calls.confirm.push(p);
    },
    async respondCustomTool(_s, p) {
      customCall++;
      calls.custom.push(p);
      if (opts.customThrowsFirst && customCall === 1) throw new Error("simulated send drop");
    },
  };
  return client;
}

const IDLE_WAIT = { type: "session.status_idle", stop_reason: { type: "requires_action" } };
const IDLE_DONE = { type: "session.status_idle", stop_reason: { type: "end_turn" } };

describe("driveManagedAgentSession", () => {
  it("answers an always_ask tool confirmation and runs to terminal", async () => {
    const client = mockClient({
      streams: [[
        { type: "session.status_running" },
        { type: "agent.tool_use", id: "sevt_1", name: "bash", input: { command: "echo hi" }, evaluated_permission: "ask" },
        IDLE_WAIT,
        { type: "agent.tool_result", id: "sevt_2", is_error: false },
        { type: "agent.message", id: "sevt_3", content: [{ type: "text", text: "hi" }] },
        IDLE_DONE,
      ]],
    });
    const seen: string[] = [];
    let completed = false;
    const handlers: ManagedAgentDriverHandlers = {
      onToolConfirmation: (req) => { seen.push(`confirm:${req.name}:${req.id}`); return { result: "allow" }; },
      onMessage: (t) => seen.push(`msg:${t}`),
      onComplete: () => { completed = true; },
    };
    await driveManagedAgentSession(client, "sesn_x", handlers);

    expect(seen).toEqual(["confirm:bash:sevt_1", "msg:hi"]);
    expect(client.calls.confirm).toEqual([{ toolUseId: "sevt_1", result: "allow" }]);
    expect(completed).toBe(true);
  });

  it("executes a custom tool and replies with content", async () => {
    const client = mockClient({
      streams: [[
        { type: "agent.custom_tool_use", id: "sevt_c", name: "get_secret_number", input: { hint: "" } },
        IDLE_WAIT,
        { type: "agent.message", id: "sevt_m", content: [{ type: "text", text: "42" }] },
        IDLE_DONE,
      ]],
    });
    const handlers: ManagedAgentDriverHandlers = {
      onCustomTool: (req) => {
        expect(req.name).toBe("get_secret_number");
        return { content: [{ type: "text", text: "42" }] };
      },
    };
    await driveManagedAgentSession(client, "sesn_x", handlers);

    expect(client.calls.custom).toEqual([{ toolUseId: "sevt_c", content: [{ type: "text", text: "42" }] }]);
  });

  it("defaults: deny confirmations and error-respond custom tools when no handler", async () => {
    const client = mockClient({
      streams: [[
        { type: "agent.tool_use", id: "sevt_1", name: "bash", input: {}, evaluated_permission: "ask" },
        { type: "agent.custom_tool_use", id: "sevt_c", name: "x", input: {} },
        IDLE_DONE,
      ]],
    });
    await driveManagedAgentSession(client, "sesn_x", {});
    expect(client.calls.confirm[0]).toMatchObject({ toolUseId: "sevt_1", result: "deny" });
    expect(client.calls.custom[0]).toMatchObject({ toolUseId: "sevt_c", isError: true });
  });

  it("does NOT deadlock when the stream drops mid-send: reconnect re-answers the custom tool", async () => {
    // Stream 1 delivers the custom_tool_use; the result send throws (simulated drop)
    // before `responded` is recorded. Reconnect lists history (containing the same
    // request) and must re-answer it, then run to terminal.
    const customUse = { type: "agent.custom_tool_use", id: "sevt_c", name: "x", input: {} };
    const client = mockClient({
      streams: [
        [{ type: "session.status_running" }, customUse],          // stream 1: send throws here
        [{ type: "agent.message", id: "sevt_m", content: [{ type: "text", text: "ok" }] }, IDLE_DONE], // stream 2 (reconnect)
      ],
      histories: [[], [customUse]],   // 2nd connect's history re-surfaces the request
      customThrowsFirst: true,
    });
    let completed = false;
    let customHandlerCalls = 0;
    await driveManagedAgentSession(
      client,
      "sesn_x",
      {
        onCustomTool: () => { customHandlerCalls++; return { content: [{ type: "text", text: "answer" }] }; },
        onComplete: () => { completed = true; },
      },
    );

    // respondCustomTool attempted twice (1 dropped, 1 succeeded); never skipped → no hang.
    expect(client.calls.custom).toHaveLength(2);
    expect(client.calls.openEvent).toBe(2); // reconnected exactly once
    expect(customHandlerCalls).toBe(2);
    expect(completed).toBe(true);
  });

  it("dedupes onEvent across reconnect (each event id dispatched once)", async () => {
    const msg = { type: "agent.message", id: "sevt_m", content: [{ type: "text", text: "hi" }] };
    const client = mockClient({
      streams: [
        [{ type: "session.status_running" }, msg], // stream 1 ends without terminal -> reconnect
        [msg, IDLE_DONE],                          // stream 2 re-delivers msg, then terminal
      ],
      histories: [[], [msg]],
    });
    const messages: string[] = [];
    await driveManagedAgentSession(client, "sesn_x", { onMessage: (t) => messages.push(t) });
    expect(messages).toEqual(["hi"]); // deduped — not "hi","hi"
  });
});

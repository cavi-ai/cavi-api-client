import { describe, expect, it } from "vitest";
import {
  driveManagedAgentSession,
  type ManagedAgentDriverClient,
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

function mockClient(frames: Record<string, unknown>[]) {
  const calls = { confirm: [] as Record<string, unknown>[], custom: [] as Record<string, unknown>[] };
  const client: ManagedAgentDriverClient & { calls: typeof calls } = {
    calls,
    async openEventStream() { return streamOf(frames); },
    async listEvents() { return []; },
    async confirmTool(_s, p) { calls.confirm.push(p); },
    async respondCustomTool(_s, p) { calls.custom.push(p); },
  };
  return client;
}

const IDLE_DONE = { type: "session.status_idle", stop_reason: { type: "end_turn" } };

describe("driveManagedAgentSession — features", () => {
  it("surfaces outcome evaluations and thread events to their handlers", async () => {
    const client = mockClient([
      { type: "session.thread_created", id: "sevt_t", session_thread_id: "sthr_1", agent_name: "reviewer" },
      { type: "agent.thread_message_received", id: "sevt_r", from_session_thread_id: "sthr_1", from_agent_name: "reviewer", content: [{ type: "text", text: "APPROVED" }] },
      { type: "span.outcome_evaluation_start", id: "sevt_s", iteration: 0, outcome_id: "outc_1" },
      { type: "span.outcome_evaluation_end", id: "sevt_e", iteration: 0, outcome_id: "outc_1", result: "satisfied", explanation: "met" },
      IDLE_DONE,
    ]);
    const outcomes: string[] = [];
    const threads: string[] = [];
    let completed = false;
    await driveManagedAgentSession(client, "sesn_x", {
      onOutcomeEvaluation: (e) => outcomes.push(e.result),
      onThreadEvent: (e) => threads.push(e.kind),
      onComplete: () => { completed = true; },
    });
    expect(outcomes).toEqual(["satisfied"]);
    expect(threads).toEqual(["thread_created", "thread_message"]);
    expect(completed).toBe(true);
  });

  it("echoes session_thread_id when confirming a cross-posted subagent tool call", async () => {
    const client = mockClient([
      { type: "agent.tool_use", id: "sevt_1", name: "bash", input: { command: "ls" }, evaluated_permission: "ask", session_thread_id: "sthr_sub" },
      IDLE_DONE,
    ]);
    await driveManagedAgentSession(client, "sesn_x", {
      onToolConfirmation: () => ({ result: "allow" }),
    });
    expect(client.calls.confirm).toEqual([
      { toolUseId: "sevt_1", result: "allow", sessionThreadId: "sthr_sub" },
    ]);
  });
});

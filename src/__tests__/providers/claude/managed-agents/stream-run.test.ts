import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../../../core/runtime/run-stream";

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const block of blocks) controller.enqueue(encoder.encode(block));
      controller.close();
    },
  });
}

// Managed Agents session SSE: events carry their kind in `data.type` (no `event:` line).
const SESSION_SSE = [
  'data: {"type":"session.status_running"}\n\n',
  'data: {"type":"agent.message","content":[{"type":"text","text":"Hel"}]}\n\n',
  'data: {"type":"agent.message","content":[{"type":"text","text":"lo"}]}\n\n',
  'data: {"type":"session.status_idle","stop_reason":{"type":"end_turn"}}\n\n',
];

describe("ClaudeManagedAgentClient.streamRun", () => {
  it("creates a session, opens the stream before the kickoff, and maps events", async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.endsWith("/v1/sessions") && method === "POST") {
        order.push("create");
        return new Response(JSON.stringify({ id: "sesn_s", status: "running" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.endsWith("/v1/sessions/sesn_s/events/stream") && method === "GET") {
        order.push("stream");
        return new Response(sseStream(SESSION_SSE), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      if (u.endsWith("/v1/sessions/sesn_s/events") && method === "POST") {
        order.push("kickoff");
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`unexpected ${method} ${u}`);
    }) as unknown as typeof fetch;

    const client = new ClaudeManagedAgentClient({
      apiKey: "sk-test",
      agentId: "agent_x",
      environmentId: "env_x",
      fetchImpl,
    });

    const events: RunStreamEvent[] = [];
    let completed = false;
    await client.streamRun(
      { input: "Hi" },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    // Stream-first ordering: session created, stream opened, THEN kickoff sent.
    expect(order).toEqual(["create", "stream", "kickoff"]);

    const deltas = events.filter((e) => e.event === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA);
    expect(deltas.map((e) => (e as { delta: string }).delta).join("")).toBe("Hello");
    expect(deltas.every((e) => (e as { runId: string }).runId === "sesn_s")).toBe(true);
    expect(events.at(-1)).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "sesn_s" });
    expect(completed).toBe(true);
  });
});

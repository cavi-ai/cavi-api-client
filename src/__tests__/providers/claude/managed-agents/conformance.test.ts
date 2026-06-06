import { describe, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  type RuntimeConformanceContext,
} from "../../../support/runtime-conformance";

const SESSION = { id: "sesn_conf", status: "running" };

// Managed Agents session SSE — events carry their kind in `data.type`.
const SSE = [
  'data: {"type":"agent.message","content":[{"type":"text","text":"ok"}]}\n\n',
  'data: {"type":"session.status_idle","stop_reason":{"type":"end_turn"}}\n\n',
];

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const b of blocks) c.enqueue(encoder.encode(b));
      c.close();
    },
  });
}

// One fetch routing session create, the SSE stream, and event sends.
function managedAgentFetch(): typeof fetch {
  return vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    if (u.endsWith("/events/stream") && method === "GET") {
      return new Response(sseStream(SSE), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    if (u.endsWith("/events") && method === "POST") {
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }
    // session create / retrieve
    return new Response(JSON.stringify(SESSION), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const ctx: RuntimeConformanceContext = {
  makeClient: () =>
    new ClaudeManagedAgentClient({
      apiKey: "sk-test",
      agentId: "agent_x",
      environmentId: "env_x",
      fetchImpl: managedAgentFetch(),
    }),
  runBody: { input: "hi" },
  streamRunBody: { input: "hi" },
};

describe("Claude Managed Agents provider — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});

import { describe, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  type RuntimeConformanceContext,
} from "../../support/runtime-conformance";

const MESSAGE = {
  id: "msg_conf",
  type: "message",
  role: "assistant",
  model: "claude-opus-4-8",
  content: [{ type: "text", text: "ok" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 1, output_tokens: 1 },
};

const SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_conf"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
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

// One fetch that serves both the synchronous JSON run and the streaming SSE run.
function claudeFetch(): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (body.stream === true) {
      return new Response(sseStream(SSE), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    return new Response(JSON.stringify(MESSAGE), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const ctx: RuntimeConformanceContext = {
  makeClient: () => new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: claudeFetch() }),
  runBody: { input: "hi", model: "claude-opus-4-8" },
  streamRunBody: { input: "hi", model: "claude-opus-4-8" },
};

describe("Claude provider — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});

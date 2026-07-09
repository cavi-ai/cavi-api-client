import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client";
import { RUN_STREAM_EVENT_NAMES, type RunStreamEvent } from "../../../core/gateway/run/contracts";

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const block of blocks) controller.enqueue(encoder.encode(block));
      controller.close();
    },
  });
}

const ANTHROPIC_SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_42"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
];

describe("ClaudeApiClient.streamRun", () => {
  it("posts stream:true and emits mapped RunStreamEvents with the run id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(sseStream(ANTHROPIC_SSE), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl });

    const events: RunStreamEvent[] = [];
    let completed = false;
    await client.streamRun(
      { input: "Hi", model: "claude-opus-4-8" },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.stream).toBe(true);

    const deltas = events.filter((e) => e.event === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA);
    expect(deltas.map((e) => (e as { delta: string }).delta).join("")).toBe("Hello");
    expect(deltas.every((e) => (e as { runId: string }).runId === "msg_42")).toBe(true);
    expect(events.at(-1)).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "msg_42" });
    expect(completed).toBe(true);
  });

  it("attaches accumulated usage to the completed stream event", async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_s","usage":{"input_tokens":100,"cache_read_input_tokens":10}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":40}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];
    const fetchImpl = vi.fn(async () =>
      new Response(sseStream(sse), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl });

    const events: RunStreamEvent[] = [];
    await client.streamRun(
      { input: "hi", model: "claude-opus-4-8" },
      { onEvent: (e) => events.push(e) },
    );

    const completed = events.find((e) => e.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
    expect(completed).toMatchObject({
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140, cacheReadTokens: 10 },
    });
  });

  it("dryRun:true short-circuits streamRun with zero network calls and one terminal dry_run event (A3)", async () => {
    const fetchImpl = vi.fn();
    const client = new ClaudeApiClient({ apiKey: "sk-test", fetchImpl: fetchImpl as unknown as typeof fetch });
    const events: RunStreamEvent[] = [];
    let completed = false;

    await client.streamRun(
      { input: "hi", model: "claude-opus-4-8", dryRun: true },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, status: "dry_run" });
    expect(completed).toBe(true);
  });
});

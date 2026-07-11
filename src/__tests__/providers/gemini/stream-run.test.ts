import { describe, expect, it, vi } from "vitest";
import { GeminiApiClient } from "../../../providers/gemini/client";
import { RUN_STREAM_EVENT_NAMES, type RunStreamEvent } from "../../../core/runtime/run-stream";

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const block of blocks) controller.enqueue(encoder.encode(block));
      controller.close();
    },
  });
}

const GEMINI_SSE = [
  'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hel"}]}}]}\n\n',
  'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"lo"}]}}]}\n\n',
  'data: {"candidates":[{"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":40,"totalTokenCount":50}}\n\n',
];

describe("GeminiApiClient.streamRun", () => {
  it("streams deltas and a terminal completed event carrying usage", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      expect(String(url)).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      );
      return new Response(sseStream(GEMINI_SSE), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });

    const events: RunStreamEvent[] = [];
    let completed = false;
    await client.streamRun(
      { input: "hi", model: "gemini-2.5-flash" },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    const deltas = events.filter((e) => e.event === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA);
    expect(deltas.map((e) => (e as { delta: string }).delta).join("")).toBe("Hello");
    const last = events.at(-1)!;
    expect(last.event).toBe(RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
    expect((last as { usage?: unknown }).usage).toMatchObject({ inputTokens: 10, outputTokens: 40, totalTokens: 50 });
    expect((last as { runId: string }).runId).toMatch(/^gemini-/);
    expect(completed).toBe(true);
  });

  it("emits a terminal completed event even when the stream ends without a finishReason", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        sseStream(['data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n']),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const events: RunStreamEvent[] = [];
    await client.streamRun({ input: "hi", model: "gemini-2.5-flash" }, { onEvent: (e) => events.push(e) });
    expect(events.at(-1)!.event).toBe(RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
  });

  it("dryRun:true short-circuits streamRun with zero network calls and one terminal dry_run event (A3)", async () => {
    const fetchImpl = vi.fn();
    const client = new GeminiApiClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const events: RunStreamEvent[] = [];
    let completed = false;

    await client.streamRun(
      { input: "hi", model: "gemini-2.5-flash", dryRun: true },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, status: "dry_run" });
    expect(completed).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { ClaudeApiClient } from "../../providers/claude/client.js";
import { CodexApiClient } from "../../providers/codex/client.js";
import { ApiClientErrorCode } from "../../core/errors.js";
import type { RunStreamEvent } from "../../core/runtime/run-stream.js";

const fixtures = [
  {
    name: "Claude", Client: ClaudeApiClient,
    start: 'event: message_start\ndata: {"message":{"id":"run-test"}}\n\n',
    delta: 'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"partial"}}\n\n',
    end: 'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  },
  {
    name: "Codex", Client: CodexApiClient,
    start: 'event: response.created\ndata: {"response":{"id":"run-test"}}\n\n',
    delta: 'event: response.output_text.delta\ndata: {"delta":"partial"}\n\n',
    end: 'event: response.completed\ndata: {"response":{"id":"run-test"}}\n\n',
  },
];

describe.each(fixtures)("$name stream lifecycle", ({ Client, start, delta, end }) => {
  it("reports premature EOF and never reports clean completion", async () => {
    const client = new Client({ apiKey: "test", defaultModel: "test", fetchImpl: async () =>
      new Response(start + delta, { headers: { "content-type": "text/event-stream" } }) });
    const onComplete = vi.fn();
    const onError = vi.fn();
    const events: RunStreamEvent[] = [];
    await client.streamRun({ input: "test" }, { onEvent: e => events.push(e), onError, onComplete });
    expect(events.map(e => e.event)).toEqual(["message.delta"]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ApiClientErrorCode.TransportProtocolError }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("releases an open response after a terminal event and ignores later frames", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode(start + end + delta + end)); }, cancel,
    });
    const client = new Client({ apiKey: "test", defaultModel: "test", fetchImpl: async () =>
      new Response(body, { headers: { "content-type": "text/event-stream" } }) });
    const events: RunStreamEvent[] = [];
    const onComplete = vi.fn();
    const pending = client.streamRun({ input: "test" }, { onEvent: e => events.push(e), onComplete }, { signal: controller.signal });
    try {
      const settled = await Promise.race([pending.then(() => true), new Promise<false>(r => setTimeout(() => r(false), 50))]);
      expect(settled).toBe(true);
      expect(events.map(e => e.event)).toEqual(["run.completed"]);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(body.locked).toBe(false);
    } finally {
      controller.abort();
      await pending;
    }
  });
});

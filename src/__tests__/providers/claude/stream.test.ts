import { describe, expect, it } from "vitest";
import { mapAnthropicStreamEvent, readAnthropicStreamUsage } from "../../../providers/claude/stream";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/gateway/run/contracts";

const sse = (event: string, data: unknown) => ({ event, data: JSON.stringify(data) });

describe("mapAnthropicStreamEvent", () => {
  it("maps a text delta to a message.delta event", () => {
    const out = mapAnthropicStreamEvent(
      sse("content_block_delta", { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } }),
      "msg_1",
    );
    expect(out).toEqual({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "msg_1", delta: "Hi" });
  });

  it("maps message_stop to run.completed", () => {
    const out = mapAnthropicStreamEvent(sse("message_stop", { type: "message_stop" }), "msg_1");
    expect(out).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "msg_1" });
  });

  it("maps an error event to run.failed", () => {
    const out = mapAnthropicStreamEvent(
      sse("error", { type: "error", error: { message: "overloaded" } }),
      "msg_1",
    );
    expect(out).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: "msg_1", error: "overloaded" });
  });

  it("returns null for non-mapped events (message_start, ping, content_block_start)", () => {
    expect(mapAnthropicStreamEvent(sse("message_start", { type: "message_start" }), "msg_1")).toBeNull();
    expect(mapAnthropicStreamEvent(sse("ping", { type: "ping" }), "msg_1")).toBeNull();
    expect(mapAnthropicStreamEvent({ event: undefined, data: "x" }, "msg_1")).toBeNull();
  });

  it("returns null on unparseable data", () => {
    expect(mapAnthropicStreamEvent({ event: "content_block_delta", data: "{not json" }, "msg_1")).toBeNull();
  });
});

describe("readAnthropicStreamUsage", () => {
  it("reads usage from message_start and message_delta events", () => {
    expect(
      readAnthropicStreamUsage(
        sse("message_start", { message: { usage: { input_tokens: 100, cache_read_input_tokens: 10 } } }),
      ),
    ).toEqual({ input_tokens: 100, cache_read_input_tokens: 10 });

    expect(readAnthropicStreamUsage(sse("message_delta", { usage: { output_tokens: 42 } }))).toEqual({
      output_tokens: 42,
    });

    expect(readAnthropicStreamUsage(sse("message_stop", {}))).toBeNull();
  });
});

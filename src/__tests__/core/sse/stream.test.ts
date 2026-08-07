import { describe, expect, it, vi } from "vitest";
import {
  combineAbortSignals,
  consumeSseStream,
  drainSseMessages,
  isSseContentType,
  parseSseBlock,
  takeNextSseBlock,
} from "../../../core/sse";

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("core SSE stream helpers", () => {
  it("parses SSE blocks with comments, named events, ids, retry, and multi-line data", () => {
    expect(
      parseSseBlock(": heartbeat\nevent: run.delta\nid: evt-1\nretry: 2500\ndata: {\"a\":1}\ndata: {\"b\":2}"),
    ).toEqual({
      event: "run.delta",
      id: "evt-1",
      retry: 2500,
      data: "{\"a\":1}\n{\"b\":2}",
    });
    expect(parseSseBlock(": heartbeat")).toBeNull();
  });

  it("takes complete SSE blocks and leaves incomplete buffers intact", () => {
    expect(takeNextSseBlock("data: one\n\nrest")).toEqual({
      block: "data: one",
      rest: "rest",
    });
    expect(takeNextSseBlock("data: one\r\n\r\nrest")).toEqual({
      block: "data: one",
      rest: "rest",
    });
    expect(takeNextSseBlock("data: partial")).toBeNull();
  });

  it("drains complete messages from an SSE buffer", () => {
    const seen: string[] = [];
    const rest = drainSseMessages("data: one\n\ndata: two\n\npartial", (message) => {
      seen.push(message.data);
    });

    expect(seen).toEqual(["one", "two"]);
    expect(rest).toBe("partial");
  });

  it("consumes a readable SSE stream and emits trailing data", async () => {
    const seen: string[] = [];

    await consumeSseStream(
      streamFromText("data: one\n\ndata: two"),
      new AbortController().signal,
      (message) => {
        seen.push(message.data);
      },
    );

    expect(seen).toEqual(["one", "two"]);
  });

  it("rejects an incomplete SSE event that exceeds the configured buffer limit", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${"a".repeat(16)}`));
        controller.enqueue(new TextEncoder().encode("b".repeat(16)));
      },
      cancel,
    });
    const onMessage = vi.fn();

    await expect(consumeSseStream(
      body,
      new AbortController().signal,
      onMessage,
      { maxBufferBytes: 24 },
    )).rejects.toThrow("SSE buffer exceeds the configured size limit");
    expect(onMessage).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("validates the buffer limit before locking the response body", async () => {
    const body = streamFromText("data: ready\n\n");

    await expect(consumeSseStream(
      body,
      new AbortController().signal,
      () => undefined,
      { maxBufferBytes: 0 },
    )).rejects.toThrow("maxBufferBytes must be a positive safe integer");
    expect(body.locked).toBe(false);
  });

  it("combines abort signals", () => {
    const left = new AbortController();
    const right = new AbortController();
    const signal = combineAbortSignals(left.signal, right.signal);
    const listener = vi.fn();
    signal.addEventListener("abort", listener);

    right.abort();

    expect(signal.aborted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("recognizes SSE content types", () => {
    expect(isSseContentType("text/event-stream")).toBe(true);
    expect(isSseContentType("text/event-stream; charset=utf-8")).toBe(true);
    expect(isSseContentType("application/json")).toBe(false);
    expect(isSseContentType(null)).toBe(false);
  });
});

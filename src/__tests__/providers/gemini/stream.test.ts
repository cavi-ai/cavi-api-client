import { describe, expect, it } from "vitest";
import {
  mapGeminiStreamChunk,
  readGeminiStreamUsage,
  readGeminiFinishReason,
} from "../../../providers/gemini/stream";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";

const sse = (chunk: unknown) => ({ data: JSON.stringify(chunk) });

describe("mapGeminiStreamChunk", () => {
  it("maps candidate text parts to a message.delta event", () => {
    const out = mapGeminiStreamChunk(
      sse({ candidates: [{ content: { role: "model", parts: [{ text: "Hel" }, { text: "lo" }] } }] }),
      "gemini-1",
    );
    expect(out).toEqual({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "gemini-1", delta: "Hello" });
  });

  it("returns null when a chunk carries no text", () => {
    expect(mapGeminiStreamChunk(sse({ usageMetadata: { totalTokenCount: 5 } }), "gemini-1")).toBeNull();
    expect(mapGeminiStreamChunk({ data: "{not json" }, "gemini-1")).toBeNull();
  });
});

describe("readGeminiStreamUsage", () => {
  it("reads usageMetadata from a chunk", () => {
    expect(
      readGeminiStreamUsage(sse({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 } })),
    ).toEqual({ promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 });
  });
  it("returns null without usage", () => {
    expect(readGeminiStreamUsage(sse({ candidates: [] }))).toBeNull();
  });
});

describe("readGeminiFinishReason", () => {
  it("returns the candidate finishReason", () => {
    expect(readGeminiFinishReason(sse({ candidates: [{ finishReason: "STOP" }] }))).toBe("STOP");
  });
  it("returns null when not finished", () => {
    expect(readGeminiFinishReason(sse({ candidates: [{ content: { parts: [{ text: "x" }] } }] }))).toBeNull();
  });
});

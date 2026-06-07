import { describe, expect, it } from "vitest";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";
import {
  mapOpenAIResponseStreamEvent,
  readOpenAIResponseRunId,
} from "../../../providers/codex/stream";

const sse = (event: string, data: unknown) => ({
  event,
  data: JSON.stringify(data),
});

describe("mapOpenAIResponseStreamEvent", () => {
  it("reads the run id from response.created", () => {
    expect(readOpenAIResponseRunId(sse("response.created", {
      type: "response.created",
      response: { id: "resp_1" },
    }))).toBe("resp_1");
  });

  it("maps output text deltas to message.delta events", () => {
    expect(mapOpenAIResponseStreamEvent(
      sse("response.output_text.delta", {
        type: "response.output_text.delta",
        delta: "hello",
      }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      runId: "resp_1",
      delta: "hello",
    });
  });

  it("maps completed, failed, incomplete, cancelled, and error events", () => {
    expect(mapOpenAIResponseStreamEvent(
      sse("response.completed", {
        type: "response.completed",
        response: { output_text: "done" },
      }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "resp_1",
      output: "done",
    });
    expect(mapOpenAIResponseStreamEvent(
      sse("response.failed", {
        type: "response.failed",
        response: { error: { message: "bad" } },
      }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId: "resp_1",
      error: "bad",
    });
    expect(mapOpenAIResponseStreamEvent(
      sse("response.incomplete", {
        type: "response.incomplete",
        response: { incomplete_details: { reason: "max_output_tokens" } },
      }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId: "resp_1",
      error: "max_output_tokens",
    });
    expect(mapOpenAIResponseStreamEvent(
      sse("response.cancelled", { type: "response.cancelled" }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
      runId: "resp_1",
    });
    expect(mapOpenAIResponseStreamEvent(
      sse("error", { type: "error", message: "stream broke" }),
      "resp_1",
    )).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId: "resp_1",
      error: "stream broke",
    });
  });

  it("returns null for unmapped or malformed events", () => {
    expect(mapOpenAIResponseStreamEvent(sse("response.in_progress", { type: "response.in_progress" }), "resp_1")).toBeNull();
    expect(mapOpenAIResponseStreamEvent({ event: "response.output_text.delta", data: "{no" }, "resp_1")).toBeNull();
    expect(mapOpenAIResponseStreamEvent({ event: undefined, data: "{}" }, "resp_1")).toBeNull();
  });
});

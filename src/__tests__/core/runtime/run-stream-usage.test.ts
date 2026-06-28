import { describe, expect, it } from "vitest";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamRunCompletedEvent,
} from "../../../core/runtime/run-stream";

describe("RunStreamRunCompletedEvent.usage", () => {
  it("accepts normalized usage on the completed event", () => {
    const event: RunStreamRunCompletedEvent = {
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "r1",
      output: "done",
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
    };
    expect(event.usage?.totalTokens).toBe(8);
  });
});

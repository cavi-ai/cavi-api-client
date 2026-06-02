import { describe, expect, it } from "vitest";
import type { RuntimeClient } from "../../../core/runtime/client";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";

// A start-and-stream provider implements streamRun via the universal contract.
const streaming: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "fake",
    supports: { runs: true, streaming: true },
  }),
  startRun: async () => ({ run_id: "r1", status: "completed" }),
  streamRun: async (_body, handlers) => {
    handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "r1", delta: "hi" });
    handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "r1" });
    handlers.onComplete?.();
  },
};

// A non-streaming provider omits streamRun and still satisfies RuntimeClient.
const minimal: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "fake", supports: { runs: true } }),
  startRun: async () => ({ run_id: "r1", status: "completed" }),
};

describe("RuntimeClient.streamRun (optional, universal)", () => {
  it("a streaming provider drives the handlers", async () => {
    const events: string[] = [];
    await streaming.streamRun?.({ input: "hi" }, { onEvent: (e) => events.push(e.event) });
    expect(events).toEqual([RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, RUN_STREAM_EVENT_NAMES.RUN_COMPLETED]);
  });

  it("a non-streaming provider has no streamRun", () => {
    expect(minimal.streamRun).toBeUndefined();
  });
});

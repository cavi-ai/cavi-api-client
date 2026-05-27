import { describe, expect, it } from "vitest";
import {
  RunPreviewPollProvider,
  createRunStreamWithToolFallback,
  type RunEventStreamProvider,
} from "../../../../core/gateway/run/event-stream";
import { RUN_STREAM_EVENT_NAMES } from "../../../../core/gateway/run/contracts";

describe("run event stream helpers", () => {
  it("passes caller aborts into preview snapshot polling", async () => {
    const caller = new AbortController();
    let snapshotSignal: AbortSignal | undefined;
    let resolveCalled: (() => void) | undefined;
    const called = new Promise<void>((resolve) => {
      resolveCalled = resolve;
    });
    const provider = new RunPreviewPollProvider({
      fetchSnapshot: async (_runId, signal) => {
        snapshotSignal = signal;
        resolveCalled?.();
        return null;
      },
    });

    await provider.subscribe(
      { runId: "run_1", signal: caller.signal },
      { onEvent: () => undefined },
    );
    await called;

    caller.abort();

    expect(snapshotSignal?.aborted).toBe(true);
  });

  it("waits for async tool fallback events before completing", async () => {
    const events: string[] = [];
    const primary: RunEventStreamProvider = {
      async subscribe(_params, handlers) {
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          runId: "run_1",
        });
        handlers.onComplete?.();
        return { dispose: () => undefined };
      },
    };
    const fallback: RunEventStreamProvider = {
      async subscribe(_params, handlers) {
        await Promise.resolve();
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
          runId: "run_1",
          toolCall: {
            id: "tool_1",
            name: "lookup",
            status: "completed",
          },
        });
        handlers.onComplete?.();
        return { dispose: () => undefined };
      },
    };

    await createRunStreamWithToolFallback({
      primary,
      toolEventFallback: fallback,
    }).subscribe(
      { runId: "run_1" },
      {
        onEvent: (event) => events.push(event.event),
        onComplete: () => events.push("complete"),
      },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual([
      RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
      "complete",
    ]);
  });
});

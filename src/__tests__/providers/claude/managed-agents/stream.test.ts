import { describe, expect, it } from "vitest";
import {
  isTerminalRunStreamEvent,
  mapManagedAgentStreamEvent,
} from "../../../../providers/claude/managed-agents/stream";
import { RUN_STREAM_EVENT_NAMES } from "../../../../core/runtime/run-stream";

function sse(data: unknown) {
  return { data: JSON.stringify(data) };
}

const RUN = "sesn_1";

describe("mapManagedAgentStreamEvent", () => {
  it("maps agent.message text blocks to a MESSAGE_DELTA", () => {
    const event = mapManagedAgentStreamEvent(
      sse({ type: "agent.message", content: [{ type: "text", text: "hi" }, { type: "thinking" }] }),
      RUN,
    );
    expect(event).toEqual({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: RUN, delta: "hi" });
  });

  it("drops an agent.message with no text content", () => {
    expect(
      mapManagedAgentStreamEvent(sse({ type: "agent.message", content: [] }), RUN),
    ).toBeNull();
  });

  it("maps tool_use to TOOL_CALL_STARTED", () => {
    const event = mapManagedAgentStreamEvent(
      sse({ type: "agent.tool_use", id: "sevt_9", name: "bash" }),
      RUN,
    );
    expect(event).toMatchObject({
      event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED,
      runId: RUN,
      toolCall: { id: "sevt_9", name: "bash", status: "running" },
    });
  });

  it("maps a failed tool_result to TOOL_CALL_FAILED", () => {
    const event = mapManagedAgentStreamEvent(
      sse({ type: "agent.tool_result", tool_use_id: "sevt_9", is_error: true }),
      RUN,
    );
    expect(event).toMatchObject({
      event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED,
      toolCall: { id: "sevt_9", status: "failed" },
    });
  });

  it("maps session.error to RUN_FAILED", () => {
    const event = mapManagedAgentStreamEvent(
      sse({ type: "session.error", error: { message: "boom" } }),
      RUN,
    );
    expect(event).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: "boom" });
  });

  it("treats terminal idle as RUN_COMPLETED but transient (requires_action) idle as null", () => {
    expect(
      mapManagedAgentStreamEvent(
        sse({ type: "session.status_idle", stop_reason: { type: "end_turn" } }),
        RUN,
      ),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: RUN });

    expect(
      mapManagedAgentStreamEvent(
        sse({ type: "session.status_idle", stop_reason: { type: "requires_action" } }),
        RUN,
      ),
    ).toBeNull();
  });

  it("maps session.status_terminated to RUN_COMPLETED", () => {
    expect(
      mapManagedAgentStreamEvent(sse({ type: "session.status_terminated" }), RUN),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: RUN });
  });

  it("also accepts namespace-stripped lifecycle discriminators (defensive)", () => {
    // Guards the terminal-detection path against the dotted-vs-stripped ambiguity.
    expect(
      mapManagedAgentStreamEvent(sse({ type: "status_idle", stop_reason: { type: "end_turn" } }), RUN),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: RUN });
    expect(mapManagedAgentStreamEvent(sse({ type: "status_terminated" }), RUN)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: RUN,
    });
    expect(
      mapManagedAgentStreamEvent(sse({ type: "error", error: { message: "x" } }), RUN),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: "x" });
  });

  it("returns null for events with no canonical equivalent", () => {
    expect(mapManagedAgentStreamEvent(sse({ type: "session.status_running" }), RUN)).toBeNull();
    expect(mapManagedAgentStreamEvent(sse({ type: "agent.thinking" }), RUN)).toBeNull();
    expect(mapManagedAgentStreamEvent({ data: "not json" }, RUN)).toBeNull();
  });
});

describe("isTerminalRunStreamEvent", () => {
  it("is true for completed/failed/cancelled and false otherwise", () => {
    expect(isTerminalRunStreamEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: RUN })).toBe(true);
    expect(isTerminalRunStreamEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: "x" })).toBe(true);
    expect(
      isTerminalRunStreamEvent({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: RUN, delta: "x" }),
    ).toBe(false);
  });
});

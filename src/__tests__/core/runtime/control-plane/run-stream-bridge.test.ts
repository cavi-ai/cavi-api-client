import { describe, expect, it, vi } from "vitest";
import {
  createControlPlaneRunStreamTranslator,
  createRunEventStreamFromControlPlane,
} from "../../../../core/runtime/control-plane/run-stream-bridge.js";
import { RUN_STREAM_EVENT_NAMES } from "../../../../core/runtime/run-stream.js";
import type {
  RuntimeControlPlaneEvent,
  RuntimeEventClient,
} from "../../../../core/runtime/control-plane/events.js";

const metadata = {
  provider: "openclaw",
  stability: "stable" as const,
  source: { transport: "websocket" as const, method: "native" },
};

function cpEvent(partial: Record<string, unknown>): RuntimeControlPlaneEvent {
  return { operationId: "run-1", metadata, ...partial } as RuntimeControlPlaneEvent;
}

describe("createControlPlaneRunStreamTranslator", () => {
  it("maps lifecycle, delta, tool, and approval events onto the canonical union", () => {
    const translate = createControlPlaneRunStreamTranslator();

    expect(translate(cpEvent({ event: "message.delta", delta: "hi" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      runId: "run-1",
      delta: "hi",
    });
    expect(translate(cpEvent({ event: "operation.completed" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "run-1",
    });
    expect(
      translate(cpEvent({ event: "operation.failed", error: { message: "boom" } })),
    ).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: "run-1", error: "boom" });
    expect(translate(cpEvent({ event: "operation.cancelled" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
      runId: "run-1",
    });
    expect(translate(cpEvent({ event: "operation.interrupted", reason: "steer" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
      runId: "run-1",
      reason: "steer",
    });
  });

  it("remembers tool names across started→completed", () => {
    const translate = createControlPlaneRunStreamTranslator();
    translate(cpEvent({ event: "tool.started", toolCallId: "t1", toolName: "grep" }));
    const completed = translate(cpEvent({ event: "tool.completed", toolCallId: "t1" }));
    expect(completed).toMatchObject({
      event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
      toolCall: { id: "t1", name: "grep", status: "completed" },
    });
  });

  it("falls back to a 'tool' name when tool.completed arrives without a matching tool.started", () => {
    const translate = createControlPlaneRunStreamTranslator();
    const completed = translate(cpEvent({ event: "tool.completed", toolCallId: "unknown-1" }));
    expect(completed).toMatchObject({
      toolCall: { id: "unknown-1", name: "tool", status: "completed" },
    });
  });

  it("stringifies a tool.completed result payload onto toolCall.output", () => {
    const translate = createControlPlaneRunStreamTranslator();
    translate(cpEvent({ event: "tool.started", toolCallId: "t1", toolName: "grep" }));
    const completed = translate(
      cpEvent({ event: "tool.completed", toolCallId: "t1", result: { matches: 3, ok: true } }),
    );
    expect(completed).toMatchObject({
      event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
      toolCall: { id: "t1", name: "grep", status: "completed", output: JSON.stringify({ matches: 3, ok: true }) },
    });
  });

  it("maps approval.requested with valid choices filtered", () => {
    const translate = createControlPlaneRunStreamTranslator();
    const approval = translate(
      cpEvent({ event: "approval.requested", approvalId: "a1", request: { choices: ["once", "bogus", "deny"] } }),
    );
    expect(approval).toEqual({
      event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST,
      runId: "run-1",
      choices: ["once", "deny"],
    });
  });

  it("falls back to the full choice set when choices are missing, non-array, or all invalid", () => {
    const translate = createControlPlaneRunStreamTranslator();
    const fullSet = ["once", "session", "always", "deny"];

    expect(translate(cpEvent({ event: "approval.requested", approvalId: "a1", request: {} }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST,
      runId: "run-1",
      choices: fullSet,
    });
    expect(
      translate(cpEvent({ event: "approval.requested", approvalId: "a2", request: { choices: "not-an-array" } })),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST, runId: "run-1", choices: fullSet });
    expect(
      translate(
        cpEvent({ event: "approval.requested", approvalId: "a3", request: { choices: ["bogus", "also-bogus"] } }),
      ),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST, runId: "run-1", choices: fullSet });
  });

  it("carries the last-seen usage onto the terminal run.completed event", () => {
    const translate = createControlPlaneRunStreamTranslator();
    const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    expect(translate(cpEvent({ event: "usage.updated", usage }))).toBeNull();
    expect(translate(cpEvent({ event: "operation.completed" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "run-1",
      usage,
    });
  });

  it("omits usage from run.completed when no usage.updated event was seen", () => {
    const translate = createControlPlaneRunStreamTranslator();
    expect(translate(cpEvent({ event: "operation.completed" }))).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "run-1",
    });
  });

  it("returns null for events with no run-stream projection", () => {
    const translate = createControlPlaneRunStreamTranslator();
    expect(translate(cpEvent({ event: "reasoning.delta", delta: "…" }))).toBeNull();
    expect(translate(cpEvent({ event: "stream.gap", reason: "reconnect" }))).toBeNull();
    expect(translate(cpEvent({ event: "operation.started" }))).toBeNull();
  });
});

describe("createRunEventStreamFromControlPlane", () => {
  it("subscribes by runId, forwards translated events, and disposes through", async () => {
    let captured: Parameters<RuntimeEventClient["subscribe"]>[1] | null = null;
    const dispose = vi.fn();
    const events: RuntimeEventClient = {
      subscribe: async (params, handlers) => {
        expect(params.operationId).toBe("run-9");
        captured = handlers;
        return { dispose };
      },
    };
    const provider = createRunEventStreamFromControlPlane(events);
    const onEvent = vi.fn();
    const sub = await provider.subscribe({ runId: "run-9" }, { onEvent });

    captured!.onEvent({ ...cpEvent({ event: "message.delta", delta: "x" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, delta: "x", runId: "run-9" }),
    );
    // untranslatable events are swallowed, not forwarded
    captured!.onEvent({ ...cpEvent({ event: "reasoning.delta", delta: "y" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    expect(onEvent).toHaveBeenCalledTimes(1);

    await sub.dispose();
    expect(dispose).toHaveBeenCalled();
  });

  it("forwards onError when provided", async () => {
    let captured: Parameters<RuntimeEventClient["subscribe"]>[1] | null = null;
    const events: RuntimeEventClient = {
      subscribe: async (_params, handlers) => {
        captured = handlers;
        return { dispose: () => undefined };
      },
    };
    const provider = createRunEventStreamFromControlPlane(events);
    const onError = vi.fn();
    await provider.subscribe({ runId: "run-9" }, { onEvent: () => undefined, onError });
    captured!.onError?.(new Error("ws down"));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "ws down" }));
  });

  it("forwards the caller's AbortSignal to the control-plane subscribe call", async () => {
    let capturedParams: Parameters<RuntimeEventClient["subscribe"]>[0] | null = null;
    const events: RuntimeEventClient = {
      subscribe: async (params, _handlers) => {
        capturedParams = params;
        return { dispose: () => undefined };
      },
    };
    const provider = createRunEventStreamFromControlPlane(events);
    const controller = new AbortController();
    await provider.subscribe({ runId: "run-9", signal: controller.signal }, { onEvent: () => undefined });
    expect(capturedParams!.signal).toBe(controller.signal);
  });

  it("fires onComplete exactly once after a terminal event, and not for non-terminal events", async () => {
    let captured: Parameters<RuntimeEventClient["subscribe"]>[1] | null = null;
    const events: RuntimeEventClient = {
      subscribe: async (_params, handlers) => {
        captured = handlers;
        return { dispose: () => undefined };
      },
    };
    const provider = createRunEventStreamFromControlPlane(events);
    const onEvent = vi.fn();
    const onComplete = vi.fn();
    await provider.subscribe({ runId: "run-9" }, { onEvent, onComplete });

    captured!.onEvent({ ...cpEvent({ event: "message.delta", delta: "x" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    expect(onComplete).not.toHaveBeenCalled();

    captured!.onEvent({ ...cpEvent({ event: "operation.completed" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // further frames after terminal are ignored entirely
    captured!.onEvent({ ...cpEvent({ event: "message.delta", delta: "late" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    captured!.onEvent({ ...cpEvent({ event: "operation.cancelled" }), operationId: "run-9" } as RuntimeControlPlaneEvent);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(2); // message.delta + run.completed only
  });
});

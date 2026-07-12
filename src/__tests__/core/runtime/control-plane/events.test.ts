import { describe, expect, expectTypeOf, it } from "vitest";
import {
  inspectRuntimeEventSequence,
  RUNTIME_CONTROL_PLANE_EVENT_NAMES,
  type RuntimeControlPlane,
  type RuntimeControlPlaneEvent,
} from "../../../../core/runtime/control-plane/index";

const metadata = {
  provider: "acme",
  stability: "stable" as const,
  source: { transport: "sse" as const, method: "/runs/1/events" },
};

describe("runtime event sequence", () => {
  it("accepts one terminal event", () => {
    const events: RuntimeControlPlaneEvent[] = [
      { event: "operation.started", operationId: "1", metadata },
      { event: "message.delta", operationId: "1", delta: "hi", metadata },
      { event: "operation.completed", operationId: "1", metadata },
    ];

    expect(inspectRuntimeEventSequence(events)).toEqual({
      valid: true,
      terminalCount: 1,
      gaps: 0,
    });
  });

  it("rejects duplicate terminals and reports continuity gaps", () => {
    const events: RuntimeControlPlaneEvent[] = [
      { event: "stream.gap", operationId: "1", reason: "cursor unavailable", metadata },
      { event: "operation.failed", operationId: "1", error: "lost", metadata },
      { event: "operation.cancelled", operationId: "1", metadata },
    ];

    expect(inspectRuntimeEventSequence(events)).toEqual({
      valid: false,
      terminalCount: 2,
      gaps: 1,
    });
  });

  it("exports the complete normalized event vocabulary and aggregate", () => {
    expect(RUNTIME_CONTROL_PLANE_EVENT_NAMES).toHaveLength(16);
    expectTypeOf<RuntimeControlPlane>().toBeObject();
  });
});

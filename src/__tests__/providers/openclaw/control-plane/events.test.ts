import { describe, expect, it, vi } from "vitest";

import { ApiClientErrorCode } from "../../../../core/errors";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client";
import type { RuntimeControlPlaneEvent } from "../../../../core/runtime/control-plane/events";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory";
import { createOpenClawRuntimeEventClient } from "../../../../providers/openclaw/control-plane/events";
import type {
  OpenClawRpc,
  OpenClawRpcEvent,
} from "../../../../providers/openclaw/control-plane/rpc";

class EventRpc implements OpenClawRpc {
  readonly listeners = new Set<(event: OpenClawRpcEvent) => void>();
  request = vi.fn<OpenClawRpc["request"]>();
  dispose = vi.fn(async () => undefined);

  subscribe(listener: (event: OpenClawRpcEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, payload: unknown): void {
    for (const listener of [...this.listeners]) listener({ event, payload });
  }
}

describe("OpenClaw native control-plane events", () => {
  it("normalizes session and task events and filters by operation before delivery", async () => {
    const rpc = new EventRpc();
    const client = createOpenClawRuntimeEventClient(rpc);
    const received: RuntimeControlPlaneEvent[] = [];
    await client.subscribe({ operationId: "run-1" }, { onEvent: (event) => received.push(event) });

    rpc.emit("session.operation", {
      operationId: "other-run",
      event: "message.delta",
      delta: "do not deliver",
    });
    rpc.emit("session.operation", {
      operationId: "run-1",
      event: "message.delta",
      delta: "hello",
    });
    rpc.emit("task.updated", { operationId: "run-1", status: "running", progress: "half" });
    rpc.emit("task.completed", { operationId: "run-1" });

    expect(received).toEqual([
      expect.objectContaining({ event: "message.delta", operationId: "run-1", delta: "hello" }),
      expect.objectContaining({ event: "operation.updated", operationId: "run-1", update: { status: "running", progress: "half" } }),
      expect.objectContaining({ event: "operation.completed", operationId: "run-1" }),
    ]);
    expect(received[0]?.metadata).toEqual({
      provider: "openclaw",
      stability: "experimental",
      source: { transport: "websocket", method: "session.operation" },
    });
  });

  it("maps safe unknown events to operation.updated and rejects unsafe payloads", async () => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    const errors: unknown[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => received.push(event), onError: (error) => errors.push(error) },
    );

    rpc.emit("plugin.progress", { operationId: "run-1", phase: "safe" });
    rpc.emit("plugin.secret", { operationId: "run-1", authorization: "Bearer secret" });
    rpc.emit("plugin.exotic", { operationId: "run-1", value: new Date() });

    expect(received).toEqual([
      expect.objectContaining({
        event: "operation.updated",
        operationId: "run-1",
        update: { nativeEvent: "plugin.progress", payload: { operationId: "run-1", phase: "safe" } },
      }),
    ]);
    expect(errors).toHaveLength(2);
    expect(errors.every((error) => error instanceof Error)).toBe(true);
  });

  it.each([
    "Bearer top-secret",
    "plugin.progress\nAuthorization: Bearer top-secret",
    `plugin.${"x".repeat(256)}`,
  ])("rejects hostile native event names without delivery or disclosure", async (nativeName) => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    const errors: unknown[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => received.push(event), onError: (error) => errors.push(error) },
    );

    rpc.emit(nativeName, { operationId: "run-1", phase: "safe" });

    expect(received).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: ApiClientErrorCode.TransportProtocolError,
      message: "OpenClaw native event returned an invalid protocol payload",
      runtime: { provider: "openclaw", transport: "websocket", operation: "events.native", retryable: false },
    });
    expect(JSON.stringify(errors[0])).not.toContain(nativeName);
    expect(JSON.stringify(errors[0])).not.toContain("top-secret");
  });

  it("treats unrecognized safe task-like names as bounded unknown events", async () => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => received.push(event) },
    );

    rpc.emit("task.plugin-progress", { operationId: "run-1", phase: "safe" });

    expect(received).toEqual([
      expect.objectContaining({
        event: "operation.updated",
        operationId: "run-1",
        update: { nativeEvent: "task.plugin-progress", payload: { operationId: "run-1", phase: "safe" } },
        metadata: expect.objectContaining({ source: { transport: "websocket", method: "task.plugin-progress" } }),
      }),
    ]);
  });

  it.each([
    ["operation.updated", "update"],
    ["tool.progress", "progress"],
    ["tool.completed", "result"],
    ["approval.requested", "request"],
    ["operation.failed", "error"],
  ] as const)("rejects unsafe session %s payload fields before delivery", async (event, field) => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    const errors: unknown[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (value) => received.push(value), onError: (error) => errors.push(error) },
    );
    const cyclic: Record<string, unknown> = { authorization: "secret" };
    cyclic.self = cyclic;
    rpc.emit("session.operation", {
      operationId: "run-1",
      event,
      ...(field === "progress" || field === "result" ? { toolCallId: "tool-1" } : {}),
      ...(field === "request" ? { approvalId: "approval-1" } : {}),
      [field]: cyclic,
    });

    expect(received).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: ApiClientErrorCode.TransportProtocolError,
      runtime: { provider: "openclaw", transport: "websocket", operation: "session.operation", retryable: false },
    });
    expect(JSON.stringify(errors[0])).not.toContain("secret");
  });

  it("rejects unsafe task payloads before delivery", async () => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    const errors: unknown[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (value) => received.push(value), onError: (error) => errors.push(error) },
    );
    rpc.emit("task.updated", { operationId: "run-1", update: { password: "secret" } });
    rpc.emit("task.failed", { operationId: "run-1", error: { token: "secret" } });
    expect(received).toEqual([]);
    expect(errors).toHaveLength(2);
  });

  it("keeps listeners independent and detaches the native listener after the last unsubscribe", async () => {
    const rpc = new EventRpc();
    const client = createOpenClawRuntimeEventClient(rpc);
    const first: RuntimeControlPlaneEvent[] = [];
    const second: RuntimeControlPlaneEvent[] = [];
    const one = await client.subscribe({ operationId: "run-1" }, { onEvent: (event) => first.push(event) });
    const two = await client.subscribe({ operationId: "run-1" }, { onEvent: (event) => second.push(event) });

    expect(rpc.listeners.size).toBe(1);
    await one.dispose();
    rpc.emit("task.completed", { operationId: "run-1" });
    expect(first).toHaveLength(0);
    expect(second).toHaveLength(1);
    expect(rpc.listeners.size).toBe(1);

    await two.dispose();
    expect(rpc.listeners.size).toBe(0);
  });

  it("isolates a throwing event listener and its error handler from later listeners", async () => {
    const rpc = new EventRpc();
    const client = createOpenClawRuntimeEventClient(rpc);
    const error = new Error("first listener failed");
    const firstErrors: unknown[] = [];
    const second: RuntimeControlPlaneEvent[] = [];
    const one = await client.subscribe(
      { operationId: "run-1" },
      {
        onEvent: () => { throw error; },
        onError: (received) => {
          firstErrors.push(received);
          throw new Error("first error handler failed");
        },
      },
    );
    const two = await client.subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => second.push(event) },
    );

    expect(() => rpc.emit("task.completed", { operationId: "run-1" })).not.toThrow();
    expect(firstErrors).toEqual([error]);
    expect(second).toEqual([
      expect.objectContaining({ event: "operation.completed", operationId: "run-1" }),
    ]);

    await one.dispose();
    expect(rpc.listeners.size).toBe(1);
    await two.dispose();
    expect(rpc.listeners.size).toBe(0);
  });

  it("signals reconnect and a truthful gap unless native continuity is explicit", async () => {
    const rpc = new EventRpc();
    const received: RuntimeControlPlaneEvent[] = [];
    await createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => received.push(event) },
    );

    rpc.emit("connection.open", { connectionId: "c1", resumed: false });
    rpc.emit("connection.open", { connectionId: "c1", resumed: false });
    rpc.emit("connection.closed", { connectionId: "c1" });
    rpc.emit("connection.open", { connectionId: "c2", resumed: false });
    rpc.emit("connection.closed", { connectionId: "c2" });
    rpc.emit("connection.open", { connectionId: "c3", resumed: true });

    expect(received.map((event) => event.event)).toEqual([
      "stream.reconnected",
      "stream.gap",
      "stream.reconnected",
    ]);
  });

  it("isolates reconnect listener failures while preserving each reconnected-gap sequence", async () => {
    const rpc = new EventRpc();
    const client = createOpenClawRuntimeEventClient(rpc);
    const firstEvents: string[] = [];
    const firstErrors: unknown[] = [];
    const secondEvents: string[] = [];
    await client.subscribe(
      { operationId: "run-1" },
      {
        onEvent: (event) => {
          firstEvents.push(event.event);
          throw new Error(`first listener failed on ${event.event}`);
        },
        onError: (error) => firstErrors.push(error),
      },
    );
    await client.subscribe(
      { operationId: "run-1" },
      { onEvent: (event) => secondEvents.push(event.event) },
    );

    rpc.emit("connection.open", { connectionId: "c1", resumed: false });
    rpc.emit("connection.closed", { connectionId: "c1" });
    expect(() => rpc.emit("connection.open", { connectionId: "c2", resumed: false })).not.toThrow();

    expect(firstEvents).toEqual(["stream.reconnected", "stream.gap"]);
    expect(firstErrors).toHaveLength(2);
    expect(secondEvents).toEqual(["stream.reconnected", "stream.gap"]);
  });

  it("rejects cursor input explicitly", async () => {
    const rpc = new EventRpc();
    await expect(createOpenClawRuntimeEventClient(rpc).subscribe(
      { operationId: "run-1", cursor: "cursor-1" },
      { onEvent: vi.fn() },
    )).rejects.toEqual(new CapabilityUnavailable("openclaw", "controlPlane.events.cursor"));
    expect(rpc.listeners.size).toBe(0);
  });

  it("wires events through the OpenClaw control-plane factory", async () => {
    const rpc = new EventRpc();
    const plane = await createOpenClawRuntimeControlClient({ rpc });
    const received: RuntimeControlPlaneEvent[] = [];
    await plane.events.subscribe({ operationId: "run-1" }, { onEvent: (event) => received.push(event) });
    rpc.emit("task.cancelled", { operationId: "run-1" });
    expect(received[0]?.event).toBe("operation.cancelled");
  });
});

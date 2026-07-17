import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createHermesRuntimeEventClient } from "../../../../providers/hermes/control-plane/events";
import type { HermesDashboardEvent, HermesDashboardJsonRpcClient } from "../../../../providers/hermes/control-plane/types";

function driver() {
  let listener: ((event: HermesDashboardEvent) => void) | undefined;
  const detach = vi.fn();
  const rpc: HermesDashboardJsonRpcClient = {
    request: vi.fn(), subscribe: vi.fn((next) => { listener = next; return detach; }), dispose: vi.fn(async () => undefined),
  };
  return { rpc, detach, emit: (event: HermesDashboardEvent) => listener?.(event) };
}

describe("Hermes runtime events", () => {
  it("normalizes notifications once, filters operations, and isolates subscribers", async () => {
    const { rpc, emit } = driver();
    const client = createHermesRuntimeEventClient(rpc);
    const first = vi.fn(() => { throw new Error("subscriber failure"); });
    const firstError = vi.fn();
    const second = vi.fn();
    await client.subscribe({ operationId: "run-1" }, { onEvent: first, onError: firstError });
    await client.subscribe({ operationId: "run-1" }, { onEvent: second });
    emit({ type: "run.event", payload: { event: "message.delta", run_id: "run-1", delta: "hello" } });
    emit({ type: "run.event", payload: { event: "message.delta", run_id: "run-2", delta: "other" } });

    expect(second).toHaveBeenCalledWith({
      event: "message.delta", operationId: "run-1", delta: "hello",
      metadata: { provider: "hermes", stability: "experimental", source: { transport: "json-rpc", method: "run.event" } },
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(firstError).toHaveBeenCalledTimes(1);
  });

  it("reports reconnect gaps only after an explicit disconnect signal", async () => {
    const { rpc, emit } = driver();
    const onEvent = vi.fn();
    await createHermesRuntimeEventClient(rpc).subscribe({ operationId: "run-1" }, { onEvent });
    emit({ type: "gateway.ready", payload: { skin: "hermes" } });
    expect(onEvent).not.toHaveBeenCalled();
    emit({ type: "gateway.closed", payload: {} });
    emit({ type: "gateway.ready", payload: { resumed: false } });
    expect(onEvent.mock.calls.map(([event]) => event.event)).toEqual(["stream.reconnected", "stream.gap"]);
  });

  it("rejects unsupported cursors and detaches after abort/dispose without affecting peers", async () => {
    const { rpc, detach, emit } = driver();
    const client = createHermesRuntimeEventClient(rpc);
    await expect(client.subscribe({ operationId: "run-1", cursor: "1" }, { onEvent: vi.fn() }))
      .rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.events.cursor"));
    const controller = new AbortController();
    const first = vi.fn();
    const second = vi.fn();
    await client.subscribe({ operationId: "run-1", signal: controller.signal }, { onEvent: first });
    const subscription = await client.subscribe({ operationId: "run-1" }, { onEvent: second });
    controller.abort();
    emit({ type: "run.event", payload: { event: "operation.completed", run_id: "run-1" } });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    await subscription.dispose();
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it("redacts failures and never forwards tool results or unknown native payloads", async () => {
    const { rpc, emit } = driver();
    const onEvent = vi.fn();
    await createHermesRuntimeEventClient(rpc).subscribe({ operationId: "run-1" }, { onEvent });
    emit({ type: "run.event", payload: { event: "run.failed", run_id: "run-1", error: { authorization: "Bearer failure-secret" } } });
    emit({ type: "run.event", payload: { event: "tool.completed", run_id: "run-1", tool: "shell", result: { password: "result-secret" } } });
    emit({ type: "run.event", payload: { event: "future.event", run_id: "run-1", token_preview: "unknown-secret", detail: "private" } });

    const serialized = JSON.stringify(onEvent.mock.calls);
    expect(serialized).not.toMatch(/failure-secret|result-secret|unknown-secret|token_preview|password/i);
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({ event: "operation.failed", error: { message: "Hermes operation failed" } });
    expect(onEvent.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ event: "tool.completed", toolCallId: "shell" }));
    expect(onEvent.mock.calls[1]?.[0]).not.toHaveProperty("result");
    expect(onEvent.mock.calls[2]?.[0]).toMatchObject({ event: "operation.updated", update: { nativeEvent: "future.event" } });
    expect(onEvent.mock.calls[2]?.[0].update).not.toHaveProperty("payload");
  });

  it.each([
    { input_tokens: -1 },
    { input_tokens: 1.5 },
    { input_tokens: 1, output_tokens: 2, total_tokens: 99 },
    { input_tokens: 1, token_preview: "usage-secret" },
    { input_tokens: "1" },
  ])("rejects malformed usage without delivery or leakage %#", async (usage) => {
    const { rpc, emit } = driver();
    const onEvent = vi.fn();
    const onError = vi.fn();
    await createHermesRuntimeEventClient(rpc).subscribe({ operationId: "run-1" }, { onEvent, onError });
    emit({ type: "run.event", payload: { event: "usage.updated", run_id: "run-1", usage } });
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onError.mock.calls)).not.toContain("usage-secret");
  });

  it("rolls back a synchronous native attach failure without a ghost subscriber", async () => {
    let listener: ((event: HermesDashboardEvent) => void) | undefined;
    const detach = vi.fn();
    const rpc: HermesDashboardJsonRpcClient = {
      request: vi.fn(),
      subscribe: vi.fn()
        .mockImplementationOnce(() => { throw new Error("attach failed"); })
        .mockImplementationOnce((next) => { listener = next; return detach; }),
      dispose: vi.fn(async () => undefined),
    };
    const client = createHermesRuntimeEventClient(rpc);
    const ghost = vi.fn();
    await expect(client.subscribe({ operationId: "run-1" }, { onEvent: ghost })).rejects.toThrow("attach failed");
    const live = vi.fn();
    const subscription = await client.subscribe({ operationId: "run-1" }, { onEvent: live });
    listener?.({ type: "run.event", payload: { event: "operation.completed", run_id: "run-1" } });
    expect(ghost).not.toHaveBeenCalled();
    expect(live).toHaveBeenCalledTimes(1);
    await subscription.dispose();
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it.each([
    "authorization=Bearer native-type-secret",
    `run.${"x".repeat(256)}native-type-secret`,
  ])("rejects unsafe native type without publishing or leaking it: %s", async (type) => {
    const { rpc, emit } = driver();
    const onEvent = vi.fn();
    const onError = vi.fn();
    await createHermesRuntimeEventClient(rpc).subscribe({ operationId: "run-1" }, { onEvent, onError });
    emit({ type, payload: { event: "operation.completed", run_id: "run-1" } });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify({ events: onEvent.mock.calls, errors: onError.mock.calls }))
      .not.toMatch(/native-type-secret|authorization=Bearer/iu);
  });

  it("bounds and redacts interruption reasons under the same message policy as failures", async () => {
    const { rpc, emit } = driver();
    const onEvent = vi.fn();
    await createHermesRuntimeEventClient(rpc).subscribe({ operationId: "run-1" }, { onEvent });
    emit({
      type: "run.event",
      payload: {
        event: "operation.interrupted",
        run_id: "run-1",
        reason: `authorization=Bearer interruption-secret ${"x".repeat(500)}`,
      },
    });

    const event = onEvent.mock.calls[0]?.[0];
    expect(event).toMatchObject({ event: "operation.interrupted", reason: "Hermes operation interrupted" });
    expect(event.reason.length).toBeLessThanOrEqual(256);
    expect(JSON.stringify(event)).not.toContain("interruption-secret");
    expect(event.metadata.source.method).toBe("run.event");
  });
});

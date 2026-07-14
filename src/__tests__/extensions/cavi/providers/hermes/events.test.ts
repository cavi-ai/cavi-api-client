import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import { createHermesRuntimeEventClient } from "../../../../../extensions/cavi/providers/hermes/events.js";
import type { HermesDashboardEvent, HermesDashboardJsonRpcClient } from "../../../../../extensions/cavi/providers/hermes/types.js";

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
});

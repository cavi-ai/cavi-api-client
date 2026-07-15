import { describe, expect, it, vi } from "vitest";

import { TransportError } from "../../../../../core/transport/error.js";
import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RawGatewayConnectionState } from "../../../../../core/runtime/control-plane/raw-gateway.js";
import { createHermesRawGatewayChannel } from "../../../../../extensions/cavi/providers/hermes/raw-gateway.js";
import type {
  HermesDashboardEvent,
  HermesDashboardJsonRpcClient,
  HermesRawGatewayLifecycle,
} from "../../../../../extensions/cavi/providers/hermes/types.js";

function fixture() {
  const eventListeners = new Set<(event: HermesDashboardEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  const rpc: HermesDashboardJsonRpcClient = {
    request: vi.fn(async () => ({ ok: true })),
    subscribe: vi.fn((listener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    }),
    dispose: vi.fn(async () => undefined),
  };
  let state: RawGatewayConnectionState = "connected";
  const lifecycle: HermesRawGatewayLifecycle = {
    connect: vi.fn(async () => undefined),
    getConnectionState: () => state,
    onConnectionState: (listener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    dispose: vi.fn(async () => rpc.dispose()),
  };
  const emitState = (next: RawGatewayConnectionState) => {
    state = next;
    for (const listener of [...stateListeners]) listener(next);
  };
  return {
    channel: createHermesRawGatewayChannel(rpc, lifecycle),
    emitState,
    eventListeners,
    lifecycle,
    rpc,
    stateListeners,
  };
}

describe("Hermes raw gateway channel", () => {
  it("forwards normalized request parameters and the abort signal", async () => {
    const { channel, rpc } = fixture();
    const controller = new AbortController();

    await expect(channel.request("  chat.send  ", { message: "hello" }, {
      signal: controller.signal,
    })).resolves.toEqual({ ok: true });
    expect(rpc.request).toHaveBeenCalledWith(
      "chat.send",
      { message: "hello" },
      { signal: controller.signal },
    );
  });

  it("preserves the native event name and exact payload identity while isolating listeners", () => {
    const { channel, eventListeners } = fixture();
    const payload = { nested: { value: 1 } };
    const second = vi.fn();
    channel.subscribe(() => { throw new Error("consumer failed"); });
    channel.subscribe(second);

    for (const listener of [...eventListeners]) {
      listener({ type: "session.updated", payload });
    }

    expect(second).toHaveBeenCalledWith({ event: "session.updated", payload });
    expect(second.mock.calls[0]?.[0].payload).toBe(payload);
  });

  it("normalizes native ready and disconnect notifications without hiding raw events", () => {
    const { channel, eventListeners } = fixture();
    const states: RawGatewayConnectionState[] = [];
    const events = vi.fn();
    channel.onConnectionState((state) => states.push(state));
    channel.subscribe(events);

    for (const listener of [...eventListeners]) listener({ type: "disconnect", payload: null });
    for (const listener of [...eventListeners]) listener({ type: "gateway.ready", payload: { resumed: true } });

    expect(states).toEqual(["reconnecting", "connected"]);
    expect(events.mock.calls).toEqual([
      [{ event: "disconnect", payload: null }],
      [{ event: "gateway.ready", payload: { resumed: true } }],
    ]);
    expect(channel.getConnectionState()).toBe("connected");
  });

  it("forwards lifecycle transitions and cleans listener subscriptions idempotently", async () => {
    const { channel, emitState, lifecycle, stateListeners } = fixture();
    const listener = vi.fn();
    const unsubscribe = channel.onConnectionState(listener);

    emitState("reconnecting");
    expect(listener).toHaveBeenCalledWith("reconnecting");
    unsubscribe();
    unsubscribe();
    expect(stateListeners).toHaveLength(0);

    await Promise.all([channel.connect(), channel.connect()]);
    await channel.connect();
    await Promise.all([channel.dispose(), channel.dispose()]);
    expect(lifecycle.connect).toHaveBeenCalledTimes(2);
    expect(lifecycle.dispose).toHaveBeenCalledTimes(1);
  });

  it("maps only JSON-RPC method-not-found failures to capability unavailable", async () => {
    const { channel, rpc } = fixture();
    const unsupported = new TransportError("JSON-RPC request failed", {
      metadata: {
        kind: "json-rpc", phase: "request", operation: "json-rpc",
        retryable: false, attempt: 1, code: -32601,
      },
    });
    vi.mocked(rpc.request).mockRejectedValueOnce(unsupported);
    await expect(channel.request("future.call")).rejects.toEqual(
      new CapabilityUnavailable("hermes", "future.call"),
    );

    for (const error of [
      new TransportError("JSON-RPC request failed", {
        metadata: {
          kind: "json-rpc", phase: "request", operation: "json-rpc",
          retryable: false, attempt: 1, code: -32600,
        },
      }),
      Object.assign(new Error("cancelled"), { name: "AbortError" }),
      new Error("unknown runtime failure"),
    ]) {
      vi.mocked(rpc.request).mockRejectedValueOnce(error);
      await expect(channel.request("future.call")).rejects.toBe(error);
    }
  });
});

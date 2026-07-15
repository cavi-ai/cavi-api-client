import { describe, expect, it, vi } from "vitest";

import { GatewayRpcError } from "../../../../core/gateway/rpc/error.js";
import { TransportError } from "../../../../core/transport/error.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RawGatewayConnectionState } from "../../../../core/runtime/control-plane/raw-gateway.js";
import { createOpenClawRawGatewayChannel } from "../../../../providers/openclaw/control-plane/raw-gateway.js";
import type { OpenClawRpc, OpenClawRpcEvent } from "../../../../providers/openclaw/control-plane/rpc.js";

function fixture() {
  const eventListeners = new Set<(event: OpenClawRpcEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  const rpc: OpenClawRpc = {
    request: vi.fn(async () => ({ ok: true })),
    subscribe: vi.fn((listener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    }),
    dispose: vi.fn(async () => undefined),
  };
  const connect = vi.fn(async () => undefined);
  const channel = createOpenClawRawGatewayChannel(rpc, {
    connect,
    getConnectionState: () => "connected",
    onConnectionState: (listener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
  });
  return { channel, connect, eventListeners, rpc, stateListeners };
}

describe("OpenClaw raw gateway channel", () => {
  it("uses retryable lifecycle errors for opt-in automatic reconnect", async () => {
    const eventListeners = new Set<(event: OpenClawRpcEvent) => void>();
    const stateListeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const connect = vi.fn(async () => undefined);
    const rpc: OpenClawRpc = {
      request: vi.fn(async () => ({})),
      subscribe(listener) { eventListeners.add(listener); return () => eventListeners.delete(listener); },
      connect,
      getConnectionState: () => "connected",
      onConnectionState(listener) { stateListeners.add(listener); return () => stateListeners.delete(listener); },
      dispose: vi.fn(async () => undefined),
    };
    const channel = createOpenClawRawGatewayChannel(rpc, {
      connect,
      getConnectionState: () => "connected",
      onConnectionState(listener) { stateListeners.add(listener); return () => stateListeners.delete(listener); },
    }, { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 });
    const states: RawGatewayConnectionState[] = [];
    channel.onConnectionState((state) => states.push(state));
    const dropped = new TransportError("dropped", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });

    for (const listener of [...stateListeners]) listener("error", dropped);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());

    expect(states).toContain("reconnecting");
    expect(states.at(-1)).toBe("connected");
    await channel.dispose();
  });
  it("forwards normalized request parameters and the abort signal", async () => {
    const { channel, rpc } = fixture();
    const controller = new AbortController();
    const result = await channel.request("  chat.send  ", { message: "hello" }, { signal: controller.signal });

    expect(result).toEqual({ ok: true });
    expect(rpc.request).toHaveBeenCalledWith("chat.send", { message: "hello" }, { signal: controller.signal });
  });

  it("delivers raw events unchanged and isolates listener exceptions", () => {
    const { channel, eventListeners } = fixture();
    const payload = { nested: { value: 1 } };
    const emittedEvent = { event: "session.updated", payload };
    const second = vi.fn();
    channel.subscribe(() => { throw new Error("consumer failed"); });
    channel.subscribe(second);

    for (const listener of eventListeners) listener(emittedEvent);

    expect(second).toHaveBeenCalledWith({ event: "session.updated", payload });
    expect(second.mock.calls[0]?.[0]).toBe(emittedEvent);
    expect(second.mock.calls[0]?.[0].payload).toBe(payload);
  });

  it("forwards connection state and listener disposal", () => {
    const { channel, stateListeners } = fixture();
    const listener = vi.fn();
    const unsubscribe = channel.onConnectionState(listener);
    expect(channel.getConnectionState()).toBe("connected");

    for (const emit of stateListeners) emit("reconnecting");
    expect(listener).toHaveBeenCalledWith("reconnecting");
    unsubscribe();
    expect(stateListeners).toHaveLength(0);
  });

  it("connects and disposes listener resources idempotently", async () => {
    const { channel, connect, eventListeners, stateListeners } = fixture();
    channel.subscribe(() => undefined);
    channel.onConnectionState(() => undefined);

    await Promise.all([channel.connect(), channel.connect()]);
    await channel.connect();
    await Promise.all([channel.dispose(), channel.dispose()]);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(eventListeners).toHaveLength(0);
    expect(stateListeners).toHaveLength(0);
  });

  it("maps only explicit unknown-method RPC failures to capability unavailable", async () => {
    const { channel, rpc } = fixture();
    vi.mocked(rpc.request).mockRejectedValueOnce(new GatewayRpcError("unknown method: future.call", "invalid_request"));
    await expect(channel.request("future.call")).rejects.toEqual(
      new CapabilityUnavailable("openclaw", "future.call"),
    );

    for (const error of [
      new GatewayRpcError("unauthorized", "auth_required"),
      new GatewayRpcError("socket closed", "closed"),
      new GatewayRpcError("bad response", "protocol_mismatch"),
      Object.assign(new Error("cancelled"), { name: "AbortError" }),
      new Error("unknown runtime failure"),
    ]) {
      vi.mocked(rpc.request).mockRejectedValueOnce(error);
      await expect(channel.request("future.call")).rejects.toBe(error);
    }
  });
});

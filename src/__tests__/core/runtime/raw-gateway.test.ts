import { describe, expect, it, vi } from "vitest";
import {
  GATEWAY_RAW_EXTENSION,
  type RawGatewayChannel,
  type RawGatewayConnectionState,
  type RawGatewayEvent,
  type RawGatewayRequestOptions,
} from "../../../core/runtime/control-plane/index.js";
import {
  GATEWAY_RAW_EXTENSION as ROOT_GATEWAY_RAW_EXTENSION,
  type RawGatewayChannel as RootRawGatewayChannel,
  type RawGatewayConnectionState as RootRawGatewayConnectionState,
  type RawGatewayEvent as RootRawGatewayEvent,
  type RawGatewayRequestOptions as RootRawGatewayRequestOptions,
} from "../../../index.js";
import {
  createRawGatewayConnectionLifecycle,
  createRawGatewayDisposer,
  createRawGatewayEvent,
  dispatchRawGatewayListeners,
  normalizeRawGatewayRequest,
} from "../../../core/runtime/control-plane/raw-gateway.js";
import { TransportError } from "../../../core/transport/error.js";

describe("raw gateway contract", () => {
  it("reconnects retryable drops with deterministic bounded backoff", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const states: RawGatewayConnectionState[] = [];
    const sleeps: number[] = [];
    let attempts = 1;
    const transient = () => new TransportError("dropped", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect: async () => { attempts += 1; if (attempts < 3) throw transient(); },
      getConnectionState: () => "connected",
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, {
      policy: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 20 },
      dependencies: { now: () => 0, random: () => 0.5, sleep: async (delay) => { sleeps.push(delay); } },
    });
    lifecycle.onConnectionState((state) => states.push(state));

    for (const listener of listeners) listener("error", transient());
    await vi.waitFor(() => expect(attempts).toBe(3));

    expect(sleeps).toEqual([10, 20]);
    expect(states).toContain("reconnecting");
    expect(states.at(-1)).toBe("connected");
    await lifecycle.dispose?.();
  });

  it("does not reconnect non-retryable failures", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const connect = vi.fn(async () => undefined);
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect,
      getConnectionState: () => "connected",
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, { policy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 } });
    const auth = new TransportError("auth", {
      metadata: { kind: "websocket", phase: "authenticate", operation: "connect", retryable: false, attempt: 1 },
    });

    for (const listener of listeners) listener("error", auth);
    await Promise.resolve();

    expect(connect).not.toHaveBeenCalled();
    await lifecycle.dispose?.();
  });

  it("shares only an in-flight connect and reconnects manually after a drop", async () => {
    const resolvers: Array<() => void> = [];
    const connect = vi.fn(() => new Promise<void>((done) => { resolvers.push(done); }));
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect,
      getConnectionState: () => "error",
      onConnectionState: () => () => undefined,
    });

    const first = lifecycle.connect();
    expect(lifecycle.connect()).toBe(first);
    await Promise.resolve();
    resolvers.shift()?.();
    await first;
    const second = lifecycle.connect();
    expect(second).not.toBe(first);
    await Promise.resolve();
    expect(connect).toHaveBeenCalledTimes(2);
    resolvers.shift()?.();
    await second;
    await lifecycle.dispose?.();
  });

  it("cancels a pending reconnect delay on disposal", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const connect = vi.fn(async () => undefined);
    let aborted = false;
    const states: RawGatewayConnectionState[] = [];
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect,
      getConnectionState: () => "connected",
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, {
      policy: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 10 },
      dependencies: { now: () => 0, random: () => 0.5, sleep: (_delay, signal) => new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => { aborted = true; reject(signal.reason); }, { once: true });
      }) },
    });
    lifecycle.onConnectionState((state) => states.push(state));
    const dropped = new TransportError("dropped", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });
    for (const listener of listeners) listener("error", dropped);
    await Promise.resolve();

    await lifecycle.dispose?.();

    expect(aborted).toBe(true);
    expect(connect).not.toHaveBeenCalled();
    expect(states).toEqual(["error", "reconnecting"]);
  });

  it("does not reconnect again when a manual connect succeeds during backoff", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    let state: RawGatewayConnectionState = "error";
    let releaseSleep!: () => void;
    const connect = vi.fn(async () => { state = "connected"; });
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect,
      getConnectionState: () => state,
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, {
      policy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
      dependencies: {
        now: () => 0,
        random: () => 0.5,
        sleep: () => new Promise<void>((resolve) => { releaseSleep = resolve; }),
      },
    });
    const dropped = new TransportError("dropped", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });
    for (const listener of listeners) listener("error", dropped);
    await Promise.resolve();

    await lifecycle.connect();
    releaseSleep();
    await Promise.resolve();

    expect(connect).toHaveBeenCalledOnce();
    await lifecycle.dispose?.();
  });

  it("publishes terminal error when retry attempts are exhausted", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const states: RawGatewayConnectionState[] = [];
    const transient = new TransportError("still down", {
      metadata: { kind: "websocket", phase: "connect", operation: "connect", retryable: true, attempt: 1 },
    });
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect: async () => { throw transient; },
      getConnectionState: () => "error",
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, {
      policy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
      dependencies: { now: () => 0, random: () => 0.5, sleep: async () => undefined },
    });
    lifecycle.onConnectionState((state) => states.push(state));
    for (const listener of listeners) listener("error", transient);
    await vi.waitFor(() => expect(states.at(-1)).toBe("error"));

    expect(states).toEqual(["error", "reconnecting", "error"]);
    await lifecycle.dispose?.();
  });

  it("publishes the last retryable failure when the next delay exceeds the deadline", async () => {
    const driverListeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    const observed: Array<{ state: RawGatewayConnectionState; error?: unknown }> = [];
    const firstDrop = new TransportError("first drop", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });
    const lastFailure = new TransportError("retry failed", {
      metadata: { kind: "websocket", phase: "connect", operation: "connect", retryable: true, attempt: 2 },
    });
    const times = [0, 0, 11];
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect: async () => { throw lastFailure; },
      getConnectionState: () => "error",
      onConnectionState(listener) { driverListeners.add(listener); return () => driverListeners.delete(listener); },
    }, {
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, deadlineMs: 10 },
      dependencies: {
        now: () => times.shift() ?? 11,
        random: () => 0.5,
        sleep: async () => undefined,
      },
    });
    lifecycle.onConnectionState(() => { throw new Error("observer failed"); });
    lifecycle.onConnectionState((state, error) => observed.push({ state, error }));

    for (const listener of driverListeners) listener("error", firstDrop);
    await vi.waitFor(() => expect(observed.at(-1)?.state).toBe("error"));

    expect(observed).toEqual([
      { state: "error", error: firstDrop },
      { state: "reconnecting", error: firstDrop },
      { state: "error", error: lastFailure },
    ]);
    await lifecycle.dispose?.();
  });

  it("does not auto-retry after a settled non-retryable manual reconnect failure", async () => {
    const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
    let releaseSleep!: () => void;
    const auth = new TransportError("auth rejected", {
      metadata: { kind: "websocket", phase: "authenticate", operation: "connect", retryable: false, attempt: 1 },
    });
    const connect = vi.fn(async () => {
      for (const listener of listeners) listener("error", auth);
      throw auth;
    });
    const lifecycle = createRawGatewayConnectionLifecycle({
      connect,
      getConnectionState: () => "error",
      onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    }, {
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
      dependencies: {
        now: () => 0,
        random: () => 0.5,
        sleep: () => new Promise<void>((resolve) => { releaseSleep = resolve; }),
      },
    });
    const dropped = new TransportError("dropped", {
      metadata: { kind: "websocket", phase: "close", operation: "connect", retryable: true, attempt: 1 },
    });
    for (const listener of listeners) listener("error", dropped);
    await Promise.resolve();

    await expect(lifecycle.connect()).rejects.toBe(auth);
    releaseSleep();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connect).toHaveBeenCalledOnce();
    await lifecycle.dispose?.();
  });
  it("exports one frozen gateway.raw descriptor through both public matrices", () => {
    expect(GATEWAY_RAW_EXTENSION).toBe(ROOT_GATEWAY_RAW_EXTENSION);
    expect(GATEWAY_RAW_EXTENSION).toEqual({ id: "gateway.raw" });
    expect(Object.isFrozen(GATEWAY_RAW_EXTENSION)).toBe(true);

    const compileOnly = (
      channel: RawGatewayChannel & RootRawGatewayChannel,
      event: RawGatewayEvent & RootRawGatewayEvent,
      state: RawGatewayConnectionState & RootRawGatewayConnectionState,
      options: RawGatewayRequestOptions & RootRawGatewayRequestOptions,
    ) => ({ channel, event, state, options });
    expect(compileOnly).toBeTypeOf("function");
  });

  it.each(["", "   ", "\t\n"])("rejects blank operation ID %j", (operationId) => {
    expect(() => normalizeRawGatewayRequest(operationId)).toThrow(
      "Raw gateway operation ID must not be blank",
    );
  });

  it("rejects a non-string operation ID at the runtime boundary", () => {
    expect(() => normalizeRawGatewayRequest(42 as never)).toThrow(
      "Raw gateway operation ID must be a string",
    );
  });

  it.each([null, [], "payload", 42, true])(
    "rejects non-record request payload %j at the runtime boundary",
    (payload) => {
      expect(() => normalizeRawGatewayRequest("chat.send", payload as never)).toThrow(
        "Raw gateway request payload must be an object",
      );
    },
  );

  it("trims operation IDs and normalizes omitted payloads to one frozen snapshot", () => {
    const normalized = normalizeRawGatewayRequest(" chat.send ");

    expect(normalized.operationId).toBe("chat.send");
    expect(normalized.payload).toEqual({});
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.payload)).toBe(true);
  });

  it("rejects an already-aborted request before a driver can execute it", () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));

    expect(() => normalizeRawGatewayRequest("chat.send", undefined, {
      signal: controller.signal,
    })).toThrow("cancelled");
  });

  it("freezes package-created event snapshots without changing payload identity", () => {
    const payload = { nested: true };
    const event = createRawGatewayEvent("gateway.ready", payload);

    expect(event).toEqual({ event: "gateway.ready", payload });
    expect(event.payload).toBe(payload);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("isolates listener exceptions while delivering the same event snapshot", () => {
    const event = createRawGatewayEvent("gateway.ready", { ready: true });
    const second = vi.fn();

    expect(() => dispatchRawGatewayListeners([
      () => { throw new Error("listener failed"); },
      second,
    ], event)).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith(event);
  });

  it("caches the first successful disposal promise", async () => {
    const dispose = vi.fn(async () => undefined);
    const disposeOnce = createRawGatewayDisposer(dispose);

    const first = disposeOnce();
    const second = disposeOnce();

    expect(second).toBe(first);
    await first;
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("caches disposal when the delegate throws synchronously", async () => {
    const error = new Error("sync dispose failed");
    const dispose = vi.fn(() => { throw error; });
    const disposeOnce = createRawGatewayDisposer(dispose);

    const first = disposeOnce();
    const second = disposeOnce();

    expect(second).toBe(first);
    await expect(first).rejects.toBe(error);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("caches a rejected disposal promise", async () => {
    const error = new Error("async dispose failed");
    const dispose = vi.fn(() => Promise.reject(error));
    const disposeOnce = createRawGatewayDisposer(dispose);

    const first = disposeOnce();
    const second = disposeOnce();

    expect(second).toBe(first);
    await expect(first).rejects.toBe(error);
    expect(dispose).toHaveBeenCalledOnce();
  });
});

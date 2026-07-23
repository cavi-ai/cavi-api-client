import { describe, expect, it, vi } from "vitest";
import {
  createGatewayStreamRun,
  requireGatewaySessionKey,
} from "../../providers/gateway-stream-run.js";
import { CapabilityCallRejected } from "../../contracts/capability-result.js";
import {
  markNonTerminalStreamError,
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import type { RunEventStreamProvider } from "../../core/runtime/run-stream.js";
import type { RuntimeClient } from "../../core/runtime/client.js";

function fakeRuntime(runId = "run-7"): RuntimeClient {
  return {
    getRuntimeCapabilities: async () => ({ providerKind: "hermes", supports: {} }),
    startRun: vi.fn(async () => ({ run_id: runId, status: "started" })),
  };
}

function scriptedProvider(events: RunStreamEvent[]): RunEventStreamProvider & { disposed: boolean } {
  const provider = {
    disposed: false,
    async subscribe(_params: unknown, handlers: { onEvent: (e: RunStreamEvent) => void }) {
      queueMicrotask(() => {
        for (const event of events) handlers.onEvent(event);
      });
      return {
        dispose: () => {
          provider.disposed = true;
        },
      };
    },
  };
  return provider as never;
}

describe("createGatewayStreamRun", () => {
  it("starts the run, forwards events, settles on the terminal event, disposes", async () => {
    const provider = scriptedProvider([
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "run-7", delta: "he" },
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" },
    ]);
    const runtime = fakeRuntime();
    const stream = createGatewayStreamRun({ runtime, createProvider: () => provider });

    const seen: string[] = [];
    await stream({ input: "hi" }, { onEvent: (e) => seen.push(e.event) });

    expect(runtime.startRun).toHaveBeenCalledWith({ input: "hi" });
    expect(seen).toEqual([
      RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
    ]);
    expect(provider.disposed).toBe(true);
  });

  it("run.failed still settles (lifecycle failure is an event, not a rejection)", async () => {
    const provider = scriptedProvider([
      { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: "run-7", error: "boom" },
    ]);
    const stream = createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider });
    const seen: string[] = [];
    await stream({ input: "hi" }, { onEvent: (e) => seen.push(e.event) });
    expect(seen).toEqual([RUN_STREAM_EVENT_NAMES.RUN_FAILED]);
  });

  it("transport onError is terminal: forwards the error, then rejects the bridge", async () => {
    const torn = new Error("stream torn down");
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        queueMicrotask(() => handlers.onError?.(torn));
        return { dispose: () => undefined };
      },
    };
    const onError = vi.fn();
    const stream = createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider });
    await expect(
      stream({ input: "hi" }, { onEvent: () => undefined, onError }),
    ).rejects.toBe(torn);
    expect(onError).toHaveBeenCalledWith(torn);
  });

  it("onError(undefined) still rejects the bridge (contract-violating provider)", async () => {
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        queueMicrotask(() => handlers.onError?.(undefined));
        return { dispose: () => undefined };
      },
    };
    const stream = createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider });
    await expect(
      stream({ input: "hi" }, { onEvent: () => undefined }),
    ).rejects.toThrow("stream transport error");
  });

  it("a marked non-terminal error is forwarded but does NOT settle the bridge (F2)", async () => {
    const protocolError = markNonTerminalStreamError(new Error("bad frame"));
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        queueMicrotask(() => {
          handlers.onError?.(protocolError); // non-terminal → observed only
          handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" });
        });
        return { dispose: () => undefined };
      },
    };
    const onError = vi.fn();
    const seen: string[] = [];
    // Resolves (does not reject): the marked error did not settle; the terminal did.
    await createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider })(
      { input: "hi" },
      { onEvent: (e) => seen.push(e.event), onError },
    );
    expect(onError).toHaveBeenCalledWith(protocolError);
    expect(seen).toEqual([RUN_STREAM_EVENT_NAMES.RUN_COMPLETED]);
  });

  it("fires onComplete once on a terminal event even without a provider onComplete (F6)", async () => {
    const provider = scriptedProvider([
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" },
    ]);
    const onComplete = vi.fn();
    await createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider })(
      { input: "hi" },
      { onEvent: () => undefined, onComplete },
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires onComplete exactly once when the provider's own onComplete is suppressed after dispose (Hermes F6)", async () => {
    // Models the Hermes SSE provider: its natural-end onComplete is guarded on
    // !disposed, and finish() disposes it on the terminal event.
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        let disposed = false;
        queueMicrotask(() => {
          handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" });
          if (!disposed) handlers.onComplete?.();
        });
        return { dispose: () => { disposed = true; } };
      },
    };
    const onComplete = vi.fn();
    await createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider })(
      { input: "hi" },
      { onEvent: () => undefined, onComplete },
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires onComplete exactly once when the provider emits BOTH a terminal event and onComplete (F6)", async () => {
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        queueMicrotask(() => {
          handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" });
          handlers.onComplete?.();
        });
        return { dispose: () => undefined };
      },
    };
    const onComplete = vi.fn();
    await createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider })(
      { input: "hi" },
      { onEvent: () => undefined, onComplete },
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("onComplete settles even without a terminal event", async () => {
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        queueMicrotask(() => handlers.onComplete?.());
        return { dispose: () => undefined };
      },
    };
    const onComplete = vi.fn();
    await createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider })(
      { input: "hi" },
      { onEvent: () => undefined, onComplete },
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("abort settles the bridge and disposes the subscription", async () => {
    const provider = scriptedProvider([]); // never emits
    const stream = createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider });
    const controller = new AbortController();
    const pending = stream({ input: "hi" }, { onEvent: () => undefined }, { signal: controller.signal });
    controller.abort();
    await pending;
    expect(provider.disposed).toBe(true);
  });

  it("mid-stream abort settles the bridge and disposes via the addEventListener path (F13)", async () => {
    // Unlike the pre-aborted case above, here the subscription is fully attached
    // and a first event has flowed BEFORE the abort — so it exercises the
    // `signal.addEventListener('abort', …)` handler, not the pre-aborted branch.
    let emit: ((event: RunStreamEvent) => void) | null = null;
    const provider = {
      disposed: false,
      async subscribe(_params: unknown, handlers: { onEvent: (e: RunStreamEvent) => void }) {
        emit = handlers.onEvent;
        return {
          dispose: () => {
            provider.disposed = true;
          },
        };
      },
    } as RunEventStreamProvider & { disposed: boolean };
    const controller = new AbortController();
    const stream = createGatewayStreamRun({
      runtime: fakeRuntime(),
      createProvider: () => provider,
    });
    const seen: string[] = [];
    const pending = stream(
      { input: "hi" },
      { onEvent: (e) => seen.push(e.event) },
      { signal: controller.signal },
    );
    // Flush microtasks so startRun resolves, subscribe attaches, and the abort
    // listener is wired.
    await new Promise((resolve) => setTimeout(resolve, 0));
    emit?.({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "run-7", delta: "hi" });
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
    expect(seen).toEqual([RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA]);
    expect(provider.disposed).toBe(true);
  });

  it("propagates startRun failures as rejections (facade classifies them)", async () => {
    const runtime = fakeRuntime();
    (runtime.startRun as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fetch failed"));
    const stream = createGatewayStreamRun({ runtime, createProvider: () => scriptedProvider([]) });
    await expect(stream({ input: "hi" }, { onEvent: () => undefined })).rejects.toThrow("fetch failed");
  });

  it("a pre-aborted signal settles without starting a run or subscribing (I1)", async () => {
    const runtime = fakeRuntime();
    const provider = scriptedProvider([]);
    const stream = createGatewayStreamRun({ runtime, createProvider: () => provider });
    const controller = new AbortController();
    controller.abort();
    await expect(
      stream({ input: "hi" }, { onEvent: () => undefined }, { signal: controller.signal }),
    ).resolves.toBeUndefined();
    expect(runtime.startRun).not.toHaveBeenCalled();
    expect(provider.disposed).toBe(false); // never subscribed → nothing to dispose
  });

  it("drops a terminal frame that arrives AFTER an error settle (I2)", async () => {
    let emit: ((event: RunStreamEvent) => void) | null = null;
    const provider: RunEventStreamProvider = {
      subscribe: async (_p, handlers) => {
        emit = handlers.onEvent;
        queueMicrotask(() => handlers.onError?.(new Error("boom")));
        return { dispose: () => undefined };
      },
    };
    const seen: string[] = [];
    const onComplete = vi.fn();
    const stream = createGatewayStreamRun({ runtime: fakeRuntime(), createProvider: () => provider });
    await expect(
      stream({ input: "hi" }, { onEvent: (e) => seen.push(e.event), onComplete }),
    ).rejects.toThrow("boom");
    // A terminal frame racing the error settle must not forward or fire onComplete.
    emit?.({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-7" });
    expect(seen).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("validate rejects before any run starts", async () => {
    const runtime = fakeRuntime();
    const stream = createGatewayStreamRun({
      runtime,
      createProvider: () => scriptedProvider([]),
      validate: () => {
        throw new CapabilityCallRejected("missing sessionKey", 400);
      },
    });
    await expect(stream({ input: "hi" }, { onEvent: () => undefined })).rejects.toThrow(
      CapabilityCallRejected,
    );
    expect(runtime.startRun).not.toHaveBeenCalled();
  });
});

describe("requireGatewaySessionKey", () => {
  it("accepts sessionKey, session_key, or session_id", () => {
    expect(requireGatewaySessionKey({ input: "x", sessionKey: "k1" } as never)).toBe("k1");
    expect(requireGatewaySessionKey({ input: "x", session_key: "k2" } as never)).toBe("k2");
    expect(requireGatewaySessionKey({ input: "x", session_id: "k3" } as never)).toBe("k3");
  });

  it("throws CapabilityCallRejected when absent (classifies to request-invalid)", () => {
    expect(() => requireGatewaySessionKey({ input: "x" })).toThrow(CapabilityCallRejected);
  });
});

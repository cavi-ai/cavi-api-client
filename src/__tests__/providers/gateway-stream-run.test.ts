import { describe, expect, it, vi } from "vitest";
import {
  createGatewayStreamRun,
  requireGatewaySessionKey,
} from "../../providers/gateway-stream-run.js";
import { CapabilityCallRejected } from "../../contracts/capability-result.js";
import { RUN_STREAM_EVENT_NAMES, type RunStreamEvent } from "../../core/runtime/run-stream.js";
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

  it("propagates startRun failures as rejections (facade classifies them)", async () => {
    const runtime = fakeRuntime();
    (runtime.startRun as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fetch failed"));
    const stream = createGatewayStreamRun({ runtime, createProvider: () => scriptedProvider([]) });
    await expect(stream({ input: "hi" }, { onEvent: () => undefined })).rejects.toThrow("fetch failed");
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

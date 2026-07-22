import { describe, expect, it, vi } from "vitest";
import { createOpenClawRunEventStreamProvider } from "../../../providers/openclaw/stream-run-provider.js";
import { createGatewayStreamRun } from "../../../providers/gateway-stream-run.js";
import { createCapabilityClient } from "../../../contracts/capability-client.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../../core/runtime/run-stream.js";
import type { RuntimeClient, RuntimeRunStatus } from "../../../core/runtime/client.js";
import type { RawGatewayConnectionState } from "../../../core/runtime/control-plane/raw-gateway.js";
import type { OpenClawRpcEvent } from "../../../providers/openclaw/control-plane/rpc.js";

class FakeOpenClawRpc {
  readonly eventListeners = new Set<(event: OpenClawRpcEvent) => void>();
  readonly stateListeners = new Set<
    (state: RawGatewayConnectionState, error?: unknown) => void
  >();
  request = vi.fn(async () => ({}));
  dispose = vi.fn(async () => undefined);

  subscribe(listener: (event: OpenClawRpcEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onConnectionState(
    listener: (state: RawGatewayConnectionState, error?: unknown) => void,
  ): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  emit(event: string, payload: unknown): void {
    for (const listener of [...this.eventListeners]) listener({ event, payload });
  }

  setState(state: RawGatewayConnectionState, error?: unknown): void {
    for (const listener of [...this.stateListeners]) listener(state, error);
  }
}

function fakeRuntime(runId = "run-1"): RuntimeClient {
  return {
    getRuntimeCapabilities: async () => ({ providerKind: "openclaw", supports: {} }),
    startRun: vi.fn(async () => ({ run_id: runId, status: "started" })),
  };
}

async function waitFor(predicate: () => boolean, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!predicate()) throw new Error("waitFor: condition not met in time");
}

describe("createOpenClawRunEventStreamProvider", () => {
  it("propagates connection loss as a terminal transport-disconnected settlement (F1)", async () => {
    const rpc = new FakeOpenClawRpc();
    const runtime = fakeRuntime("run-1");
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
    });
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { runs: true, streaming: true },
      streamRunBridge: createGatewayStreamRun({ runtime, createProvider: () => provider }),
    });

    const pending = client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    await waitFor(() => rpc.stateListeners.size > 0);
    rpc.setState("error");

    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.reason).toBe("transport-disconnected");
  });

  it("a per-frame protocol error is observed but does NOT settle the stream; a later terminal frame does (F2)", async () => {
    const rpc = new FakeOpenClawRpc();
    const runtime = fakeRuntime("run-1");
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
    });
    const seen: string[] = [];
    const errors: unknown[] = [];
    const pending = createGatewayStreamRun({ runtime, createProvider: () => provider })(
      { input: "hi" },
      { onEvent: (e) => seen.push(e.event), onError: (e) => errors.push(e) },
    );

    await waitFor(() => rpc.eventListeners.size > 0);
    // An unsafe payload (a Date value) → openClawProtocolError to the
    // subscriber; per-frame and non-terminal.
    rpc.emit("plugin.exotic", { operationId: "run-1", value: new Date() });
    await waitFor(() => errors.length > 0);
    expect(errors).toHaveLength(1);

    // The subscription is still live: a terminal frame settles it (resolve, not reject).
    rpc.emit("task.completed", { operationId: "run-1" });
    await pending;
    expect(seen).toContain(RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
  });

  it("probes a fast-terminal run and synthesizes the terminal event (F5)", async () => {
    const rpc = new FakeOpenClawRpc(); // never emits a live frame
    const getRun = vi.fn(
      async (): Promise<RuntimeRunStatus> => ({
        run_id: "run-1",
        status: "completed",
        output: "done",
      }),
    );
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
      getRun,
    });
    const seen: RunStreamEvent[] = [];
    await provider.subscribe({ runId: "run-1" }, { onEvent: (e) => seen.push(e) });
    await waitFor(() => seen.length > 0);
    expect(seen).toEqual([
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "run-1", output: "done" },
    ]);
  });

  it("a fast-terminal probe settles the bridge instead of hanging (F5)", async () => {
    const rpc = new FakeOpenClawRpc();
    const runtime = fakeRuntime("run-1");
    (runtime as { getRun?: unknown }).getRun = vi.fn(
      async (): Promise<RuntimeRunStatus> => ({ run_id: "run-1", status: "completed", output: "hi" }),
    );
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
      getRun: (id) => runtime.getRun!(id),
    });
    const seen: string[] = [];
    await createGatewayStreamRun({ runtime, createProvider: () => provider })(
      { input: "hi" },
      { onEvent: (e) => seen.push(e.event) },
    );
    expect(seen).toEqual([RUN_STREAM_EVENT_NAMES.RUN_COMPLETED]);
  });

  it("delivers exactly one terminal event when the probe races a live terminal frame (F5)", async () => {
    const rpc = new FakeOpenClawRpc();
    let resolveProbe: (status: RuntimeRunStatus) => void = () => undefined;
    const getRun = vi.fn(
      () => new Promise<RuntimeRunStatus>((resolve) => { resolveProbe = resolve; }),
    );
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
      getRun,
    });
    const seen: RunStreamEvent[] = [];
    await provider.subscribe({ runId: "run-1" }, { onEvent: (e) => seen.push(e) });

    // Live terminal wins the race; the probe resolves afterward and is dropped.
    rpc.emit("task.completed", { operationId: "run-1" });
    resolveProbe({ run_id: "run-1", status: "completed", output: "from-probe" });
    await waitFor(() => seen.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const terminals = seen.filter((e) => e.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
    expect(terminals).toHaveLength(1);
    // The LIVE frame (no output) settled it, not the probe (output "from-probe").
    expect((terminals[0] as { output?: string }).output).toBeUndefined();
  });

  it("does not synthesize an event when the probe reports a non-terminal status (F5)", async () => {
    const rpc = new FakeOpenClawRpc();
    const getRun = vi.fn(
      async (): Promise<RuntimeRunStatus> => ({ run_id: "run-1", status: "running" }),
    );
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
      getRun,
    });
    const seen: RunStreamEvent[] = [];
    await provider.subscribe({ runId: "run-1" }, { onEvent: (e) => seen.push(e) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual([]);
  });

  it("unregisters the connection-state listener on dispose", async () => {
    const rpc = new FakeOpenClawRpc();
    const provider = createOpenClawRunEventStreamProvider({
      rpc: rpc as never,
      connect: async () => undefined,
    });
    const sub = await provider.subscribe({ runId: "run-1" }, { onEvent: () => undefined });
    expect(rpc.stateListeners.size).toBe(1);
    await sub.dispose();
    expect(rpc.stateListeners.size).toBe(0);
  });
});

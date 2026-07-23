import { getEventListeners } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { trackStreamRunBridge } from "../../providers/stream-run-lifecycle.js";
import { createGatewayStreamRun } from "../../providers/gateway-stream-run.js";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import { normalizeTeamManifest } from "../../contracts/team-manifest.js";
import type { GatewayStreamRunBridge } from "../../providers/gateway-stream-run.js";
import type { ResolvedProviderCapabilities } from "../../contracts/capability-source.js";
import type { RunEventStreamProvider } from "../../core/runtime/run-stream.js";
import type { RuntimeClient } from "../../core/runtime/client.js";

/** A provider that only ever hands back a disposable, never emitting a frame. */
const inertProvider: RunEventStreamProvider = {
  subscribe: async () => ({ dispose: async () => undefined }),
};

const runtime: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "hermes", supports: { runs: true } }),
  startRun: async () => ({ run_id: "run-1", status: "started" }),
};

/**
 * A bridge that only settles when its (composed) abort signal fires, and
 * signals via `started` once it is actually in-flight — so a test can wait
 * until the tracked call is registered before disposing (mirroring a real
 * "in-flight at dispose" stream rather than one still resolving its gate).
 */
function makeNeverBridge(): { bridge: GatewayStreamRunBridge; started: Promise<void> } {
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const bridge: GatewayStreamRunBridge = (_body, _handlers, options) =>
    new Promise<void>((resolve) => {
      markStarted();
      options?.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  return { bridge, started };
}

describe("trackStreamRunBridge (F3 dispose teardown)", () => {
  it("dispose() settles an in-flight streamRun by aborting the tracked bridge", async () => {
    const { bridge: never, started } = makeNeverBridge();
    const { bridge, disposeAll } = trackStreamRunBridge(never);
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { runs: true, streaming: true },
      streamRunBridge: bridge,
      onDispose: async () => disposeAll(),
    });

    const pending = client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    await started; // the tracked bridge is now in-flight
    await client.dispose();
    // Abort settles the bridge → the facade resolves ok:true (documented abort
    // semantics), so the pending call never hangs.
    await expect(pending).resolves.toEqual({ ok: true, data: { runId: null, outcome: null }, source: "live" });
  });

  it("also settles an in-flight OpenClaw-style streamRun on dispose (both wirings share the mechanism)", async () => {
    const openclawRuntime: RuntimeClient = {
      getRuntimeCapabilities: async () => ({ providerKind: "openclaw", supports: { runs: true } }),
      startRun: async () => ({ run_id: "run-9", status: "started" }),
    };
    const { bridge: never, started } = makeNeverBridge();
    const { bridge, disposeAll } = trackStreamRunBridge(never);
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime: openclawRuntime,
      fallbackSupports: { runs: true, streaming: true },
      streamRunBridge: bridge,
      onDispose: async () => {
        disposeAll();
      },
    });
    const pending = client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    await started;
    await client.dispose();
    await expect(pending).resolves.toEqual({ ok: true, data: { runId: null, outcome: null }, source: "live" });
  });

  it("a settled call removes itself from the live set; disposeAll is then a no-op", async () => {
    const noopBridge: GatewayStreamRunBridge = async () => undefined;
    const { bridge, disposeAll } = trackStreamRunBridge(noopBridge);
    await bridge({ input: "hi" }, { onEvent: () => undefined });
    expect(() => disposeAll()).not.toThrow();
  });

  it("composes the caller's own signal so a caller abort still settles the call", async () => {
    const { bridge: never } = makeNeverBridge();
    const { bridge } = trackStreamRunBridge(never);
    const controller = new AbortController();
    const pending = bridge(
      { input: "hi" },
      { onEvent: () => undefined },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
  });
});

describe("trackStreamRunBridge (R9c: dispose latch + listener hygiene)", () => {
  it("a bridge invoked AFTER disposeAll settles immediately without starting a run (I1)", async () => {
    const startRun = vi.fn(async () => ({ run_id: "run-1", status: "started" }));
    const gatewayRuntime: RuntimeClient = {
      getRuntimeCapabilities: async () => ({ providerKind: "hermes", supports: {} }),
      startRun,
    };
    const { bridge, disposeAll } = trackStreamRunBridge(
      createGatewayStreamRun({ runtime: gatewayRuntime, createProvider: () => inertProvider }),
    );
    disposeAll(); // latch disposed BEFORE the bridge is ever invoked
    await expect(
      bridge({ input: "hi" }, { onEvent: () => undefined }),
    ).resolves.toBeUndefined();
    expect(startRun).not.toHaveBeenCalled();
  });

  it("dispose during a slow capability gate settles a late streamRun with no run started (I1)", async () => {
    const startRun = vi.fn(async () => ({ run_id: "run-1", status: "started" }));
    const gatewayRuntime: RuntimeClient = {
      getRuntimeCapabilities: async () => ({ providerKind: "hermes", supports: {} }),
      startRun,
    };
    // A resolver that stays pending until released, so dispose() wins the race
    // while streamRun is still inside its capability gate.
    let releaseResolver: () => void = () => undefined;
    const resolver = () =>
      new Promise<ResolvedProviderCapabilities>((resolve) => {
        releaseResolver = () =>
          resolve({
            providerKind: "hermes",
            supports: { streaming: true },
            manifest: normalizeTeamManifest(null),
          });
      });
    const { bridge, disposeAll } = trackStreamRunBridge(
      createGatewayStreamRun({ runtime: gatewayRuntime, createProvider: () => inertProvider }),
    );
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime: gatewayRuntime,
      fallbackSupports: { runs: true, streaming: true },
      resolver,
      streamRunBridge: bridge,
      onDispose: async () => disposeAll(),
    });
    const pending = client.streamRun({ input: "hi" }, { onEvent: () => undefined });
    await client.dispose(); // disposeAll latches disposed while the gate is pending
    releaseResolver(); // gate resolves → the late bridge invocation fires, pre-aborted
    await expect(pending).resolves.toEqual({ ok: true, data: { runId: null, outcome: null }, source: "live" });
    expect(startRun).not.toHaveBeenCalled();
  });

  it("does not accumulate abort listeners on a reused caller signal across settled calls (M1)", async () => {
    const noopBridge: GatewayStreamRunBridge = async () => undefined;
    const { bridge } = trackStreamRunBridge(noopBridge);
    const controller = new AbortController();
    for (let i = 0; i < 15; i += 1) {
      await bridge({ input: "hi" }, { onEvent: () => undefined }, { signal: controller.signal });
    }
    // Every settled call detached its listener — no growth on the shared signal.
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });
});

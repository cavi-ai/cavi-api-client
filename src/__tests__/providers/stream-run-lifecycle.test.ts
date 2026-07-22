import { describe, expect, it } from "vitest";
import { trackStreamRunBridge } from "../../providers/stream-run-lifecycle.js";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import type { GatewayStreamRunBridge } from "../../providers/gateway-stream-run.js";
import type { RuntimeClient } from "../../core/runtime/client.js";

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
    await expect(pending).resolves.toEqual({ ok: true, data: undefined, source: "live" });
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
    await expect(pending).resolves.toEqual({ ok: true, data: undefined, source: "live" });
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

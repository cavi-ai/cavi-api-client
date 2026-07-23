import type { GatewayStreamRunBridge } from "./gateway-stream-run.js";

export type TrackedStreamRunBridge = {
  /** The bridge to wire onto the facade — identical contract, plus teardown. */
  bridge: GatewayStreamRunBridge;
  /**
   * Abort every in-flight bridge call. Wired into the provider's `onDispose`
   * so `client.dispose()` settles pending `streamRun`s (spec §3.3 step 5)
   * instead of leaving their transports open. Abort → the bridge resolves
   * (matching the documented abort-settles-ok behavior). It also latches a
   * `disposed` flag so a call that arrives AFTER dispose (e.g. one still inside
   * its capability gate when dispose ran) starts nothing — see below.
   */
  disposeAll: () => void;
};

/**
 * Compose an internal controller signal with the caller's own signal, returning
 * the composed signal plus a `cleanup` that detaches the listeners on settle.
 *
 * Manual composition (not `AbortSignal.any`) keeps this inside the package's
 * `node >= 20.0.0` engines floor — `AbortSignal.any` only lands in 20.3. Unlike
 * `combineAbortSignals`, `cleanup()` removes the listener it added to the
 * (potentially reused) caller signal, so N settled calls on one shared caller
 * signal leave zero lingering listeners (M1).
 */
function composeTrackedSignal(
  internal: AbortSignal,
  caller: AbortSignal | undefined,
): { signal: AbortSignal; cleanup: () => void } {
  if (!caller) return { signal: internal, cleanup: () => undefined };
  const controller = new AbortController();
  if (internal.aborted || caller.aborted) {
    controller.abort();
    return { signal: controller.signal, cleanup: () => undefined };
  }
  const onInternalAbort = (): void => controller.abort();
  const onCallerAbort = (): void => controller.abort();
  internal.addEventListener("abort", onInternalAbort, { once: true });
  caller.addEventListener("abort", onCallerAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      internal.removeEventListener("abort", onInternalAbort);
      caller.removeEventListener("abort", onCallerAbort);
    },
  };
}

/**
 * Wrap a gateway streamRun bridge so every invocation is tracked by an
 * `AbortController` composed with the caller's own signal. `disposeAll()`
 * aborts all live calls, tearing down their subscriptions/transports, and
 * latches `disposed` so any LATER invocation (one whose capability gate was
 * still resolving when dispose ran) gets an already-aborted signal — the
 * gateway bridge treats that as a resolve, so it starts no run and opens no
 * transport (I1). Each call removes itself from the live set on settle, so a
 * completed stream is never re-aborted, and detaches its signal listeners so a
 * reused caller signal never accumulates them (M1).
 */
export function trackStreamRunBridge(
  bridge: GatewayStreamRunBridge,
): TrackedStreamRunBridge {
  const live = new Set<AbortController>();
  let disposed = false;

  const tracked: GatewayStreamRunBridge = async (body, handlers, options) => {
    const controller = new AbortController();
    // Latch: a bridge invocation that lands AFTER disposeAll() must not start a
    // run or open a transport. Pre-abort its controller so the composed signal
    // is already aborted; the gateway bridge settles immediately (no startRun,
    // no connect). Such a call never joins the live set.
    if (disposed) controller.abort();
    else live.add(controller);
    const { signal, cleanup } = composeTrackedSignal(controller.signal, options?.signal);
    try {
      // Forward every caller option (e.g. `onRunId`) — only `signal` is
      // replaced with the composed one.
      await bridge(body, handlers, { ...options, signal });
    } finally {
      cleanup();
      live.delete(controller);
    }
  };

  return {
    bridge: tracked,
    disposeAll: () => {
      disposed = true;
      for (const controller of [...live]) controller.abort();
      live.clear();
    },
  };
}

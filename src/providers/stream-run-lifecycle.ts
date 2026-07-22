import { combineAbortSignals } from "../core/sse/index.js";
import type { GatewayStreamRunBridge } from "./gateway-stream-run.js";

export type TrackedStreamRunBridge = {
  /** The bridge to wire onto the facade — identical contract, plus teardown. */
  bridge: GatewayStreamRunBridge;
  /**
   * Abort every in-flight bridge call. Wired into the provider's `onDispose`
   * so `client.dispose()` settles pending `streamRun`s (spec §3.3 step 5)
   * instead of leaving their transports open. Abort → the bridge resolves
   * (matching the documented abort-settles-ok behavior).
   */
  disposeAll: () => void;
};

/**
 * Wrap a gateway streamRun bridge so every invocation is tracked by an
 * `AbortController` composed with the caller's own signal. `disposeAll()`
 * aborts all live calls, tearing down their subscriptions/transports. Each
 * call removes itself from the live set on settle, so a completed stream is
 * never re-aborted.
 */
export function trackStreamRunBridge(
  bridge: GatewayStreamRunBridge,
): TrackedStreamRunBridge {
  const live = new Set<AbortController>();

  const tracked: GatewayStreamRunBridge = async (body, handlers, options) => {
    const controller = new AbortController();
    live.add(controller);
    const signal = combineAbortSignals(controller.signal, options?.signal);
    try {
      await bridge(body, handlers, { signal });
    } finally {
      live.delete(controller);
    }
  };

  return {
    bridge: tracked,
    disposeAll: () => {
      for (const controller of [...live]) controller.abort();
      live.clear();
    },
  };
}

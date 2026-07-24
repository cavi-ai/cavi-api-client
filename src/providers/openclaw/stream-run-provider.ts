import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import type { RawGatewayConnectionState } from "../../core/runtime/control-plane/raw-gateway.js";
import type { OpenClawRpc } from "./control-plane/rpc.js";
import { createOpenClawRunNativeEventStream } from "./run-event-stream.js";

const TERMINAL_RUN_STREAM_EVENTS: ReadonlySet<string> = new Set([
  RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
  RUN_STREAM_EVENT_NAMES.RUN_FAILED,
  RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
]);

/** An RPC that may also expose the socket's connection-state stream. */
type ConnectionStateSource = {
  onConnectionState?(
    listener: (state: RawGatewayConnectionState, error?: unknown) => void,
  ): () => void;
};

export type OpenClawRunEventStreamDeps = {
  /** The shared OpenClaw socket/RPC (also the connection-state source). */
  rpc: OpenClawRpc & ConnectionStateSource;
  /** Establish/await the socket connection before subscribing. */
  connect: () => Promise<void>;
  /**
   * Optional one-shot run-status probe. A run that reached a terminal state
   * before the subscriber attached would otherwise never emit a terminal frame
   * on the live fan-out (no replay/cursor), so the bridge would hang; the probe
   * recovers it. Omit to skip probing.
   */
  getRun?: (runId: string) => Promise<RuntimeRunStatus>;
};

/**
 * OpenClaw's `streamRun` provider: bridges the subscribe-by-runId run-event
 * contract onto the control-plane event client, and closes the two lifecycle
 * gaps a pure live fan-out leaves open.
 *
 * - F1 (close propagation): the control-plane event client never notifies
 *   subscribers on connection loss (a server 'connection.closed' frame or a
 *   socket drop just flips `connected=false`). We register `onConnectionState`
 *   and, on the socket's `error` state, deliver a TERMINAL onError so an
 *   in-flight stream settles instead of hanging.
 * - F5 (event loss before attach): a fast-terminal run may have emitted its
 *   terminal frame before we subscribed. We probe `getRun` once and synthesize
 *   the terminal run event through the same guarded handler path.
 *
 * A single `settled` guard makes both recovery paths idempotent against a live
 * terminal frame — exactly one terminal event is ever delivered.
 */
export function createOpenClawRunEventStreamProvider(
  deps: OpenClawRunEventStreamDeps,
): RunEventStreamProvider {
  // Run events arrive as native `chat`/`agent` frames keyed by `runId` — NOT
  // the control-plane `operation.*` vocabulary. Translate them directly.
  const events = createOpenClawRunNativeEventStream(deps.rpc);

  return {
    async subscribe(params, handlers) {
      // I1: an already-aborted call must not connect or subscribe. `connect()`
      // would REOPEN the shared socket that dispose just closed (a permanent
      // leak). Settle silently with a no-op subscription — the gateway bridge
      // treats abort as a resolve.
      if (params.signal?.aborted) {
        return { dispose: async () => undefined };
      }
      await deps.connect();

      // Terminal reached — from a live frame, connection loss, or the probe.
      // Blocks any later terminal delivery so consumers see exactly one. A
      // dispose/abort (I2) also flips this so a late probe result — the probe
      // rides the still-alive runtime socket — is dropped after teardown.
      let settled = false;
      const onSignalAbort = (): void => {
        settled = true;
      };
      if (params.signal) {
        params.signal.addEventListener("abort", onSignalAbort, { once: true });
      }
      const guarded: RunEventStreamHandlers = {
        onEvent: (event) => {
          if (settled) return;
          if (TERMINAL_RUN_STREAM_EVENTS.has(event.event)) settled = true;
          handlers.onEvent(event);
        },
        ...(handlers.onError ? { onError: handlers.onError } : {}),
        ...(handlers.onComplete ? { onComplete: handlers.onComplete } : {}),
      };

      const subscription = await events.subscribe(params, guarded);

      // F1: connection loss is terminal. The error message classifies as
      // transport-disconnected (isTransportFailureMessage matches "websocket").
      let unsubscribeState: (() => void) | undefined;
      if (typeof deps.rpc.onConnectionState === "function") {
        unsubscribeState = deps.rpc.onConnectionState((state) => {
          if (state !== "error" || settled) return;
          settled = true;
          handlers.onError?.(new Error("gateway websocket disconnected"));
        });
      }

      // F5: recover a run that terminated before we attached.
      if (deps.getRun) {
        void deps.getRun(params.runId).then(
          (status) => {
            if (settled) return;
            const terminal = toTerminalRunStreamEvent(status, params.runId);
            if (terminal) guarded.onEvent(terminal);
          },
          () => {
            // A failed probe is non-fatal: the live subscription still governs.
          },
        );
      }

      return {
        dispose: async () => {
          // I2: mark settled first so a late probe result (racing this dispose
          // on the still-alive socket) is dropped rather than synthesizing a
          // terminal event after teardown.
          settled = true;
          params.signal?.removeEventListener("abort", onSignalAbort);
          unsubscribeState?.();
          await subscription.dispose();
        },
      };
    },
  };
}

/** Map a terminal run status onto the canonical run-stream event, or null. */
function toTerminalRunStreamEvent(
  status: RuntimeRunStatus,
  runId: string,
): RunStreamEvent | null {
  const resolvedRunId = status.run_id?.trim() ? status.run_id : runId;
  switch (status.status) {
    case "completed":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId: resolvedRunId,
        ...(status.output !== undefined ? { output: status.output } : {}),
        ...(status.tokens !== undefined ? { usage: status.tokens } : {}),
      };
    case "failed":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId: resolvedRunId,
        error: status.error ?? "run failed",
      };
    // OpenClaw passes native statuses through verbatim: "canceled" (one l —
    // KNOWN_TASK_EVENTS "task.canceled") and "aborted" (stopRun) alias the
    // canonical cancellation, so map them too or the F5 probe hangs for them.
    case "cancelled":
    case "canceled":
    case "aborted":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
        runId: resolvedRunId,
        ...(status.error !== undefined ? { reason: status.error } : {}),
      };
    default:
      return null;
  }
}

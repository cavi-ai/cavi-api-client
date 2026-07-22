import type { RuntimeClient, RuntimeRunStartBody } from "../core/runtime/client.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscription,
} from "../core/runtime/run-stream.js";
import { CapabilityCallRejected } from "../contracts/capability-result.js";
import { toError } from "../core/errors.js";

const TERMINAL_EVENTS: ReadonlySet<string> = new Set([
  RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
  RUN_STREAM_EVENT_NAMES.RUN_FAILED,
  RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
]);

export type GatewayStreamRunBridge = (
  body: RuntimeRunStartBody,
  handlers: RunEventStreamHandlers,
  options?: { signal?: AbortSignal },
) => Promise<void>;

/**
 * The gateway half of the unified `streamRun`: start the run through the
 * gateway runtime, subscribe to its run-event stream, forward canonical
 * events, and settle on the terminal lifecycle event or onComplete
 * (run.failed is an EVENT — the bridge only rejects on validation and
 * transport-level start failures, which the facade classifies into gaps).
 *
 * `onError` is treated as TERMINAL (matching the SSE provider's contract:
 * onError and onComplete are mutually exclusive and either ends the stream), so
 * a mid-stream transport failure rejects the bridge for the facade to classify.
 * The bridge has NO internal timeout — a silent contract-violating provider
 * (one that emits neither a terminal event, onComplete, nor onError) hangs
 * until the caller's AbortSignal fires.
 */
export function createGatewayStreamRun(params: {
  runtime: RuntimeClient;
  createProvider: (body: RuntimeRunStartBody, runId: string) => RunEventStreamProvider;
  /** Validate the body before the run starts; throw CapabilityCallRejected to refuse. */
  validate?: (body: RuntimeRunStartBody) => void;
}): GatewayStreamRunBridge {
  return async (body, handlers, options) => {
    params.validate?.(body);
    const status = await params.runtime.startRun(body);
    const runId = status.run_id;
    const provider = params.createProvider(body, runId);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let subscription: RunEventStreamSubscription | null = null;
      const finish = (error?: unknown): void => {
        if (settled) return;
        settled = true;
        options?.signal?.removeEventListener("abort", onAbort);
        void subscription?.dispose();
        if (error === undefined) resolve();
        else reject(toError(error));
      };
      const onAbort = (): void => finish();
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      provider
        .subscribe(
          { runId, ...(options?.signal ? { signal: options.signal } : {}) },
          {
            onEvent: (event) => {
              handlers.onEvent(event);
              if (TERMINAL_EVENTS.has(event.event)) finish();
            },
            onError: (error) => {
              handlers.onError?.(error);
              finish(error);
            },
            onComplete: () => {
              handlers.onComplete?.();
              finish();
            },
          },
        )
        .then((sub) => {
          subscription = sub;
          if (settled) void sub.dispose();
        }, finish);

      // A signal already aborted before subscribe was wired won't fire the
      // listener (listeners added to an aborted signal never run), so settle
      // explicitly — the `.then` above disposes the subscription once it lands.
      if (options?.signal?.aborted) finish();
    });
  };
}

/**
 * Hermes SSE requires a session key header; the universal body carries it via
 * the gateway superset fields. Missing key is a caller mistake, named before
 * any request happens.
 */
export function requireGatewaySessionKey(body: RuntimeRunStartBody): string {
  const gatewayBody = body as {
    sessionKey?: string;
    session_key?: string;
    session_id?: string;
  };
  const sessionKey = (
    gatewayBody.sessionKey ??
    gatewayBody.session_key ??
    gatewayBody.session_id ??
    ""
  ).trim();
  if (!sessionKey) {
    throw new CapabilityCallRejected(
      "Hermes streaming requires sessionKey (or session_key/session_id) on the run body",
      400,
    );
  }
  return sessionKey;
}

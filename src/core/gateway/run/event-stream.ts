import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
  type RunStreamEventName,
  type RunStreamToolCall,
  type RunStreamToolEvent,
  type RunStreamToolStatus,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
} from "../../runtime/run-stream.js";
import {
  type AgentRunDetailSnapshot,
  type AgentRunPreviewItem,
} from "./contracts.js";
import { combineAbortSignals } from "../../sse/index.js";

// The stream interfaces live in core/runtime; re-exported here so existing
// importers of `./event-stream.js` keep resolving them.
export {
  type RunEventStreamSubscription,
  type RunEventStreamSubscribeParams,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
} from "../../runtime/run-stream.js";

const NOOP_SUBSCRIPTION: RunEventStreamSubscription = { dispose: () => undefined };

// ---------------------------------------------------------------------------
// RunPreviewPollProvider
// ---------------------------------------------------------------------------

export type RunPreviewSnapshotFetcher = (
  runId: string,
  signal?: AbortSignal,
) => Promise<AgentRunDetailSnapshot | null>;

export type RunPreviewPollProviderOptions = {
  /** Caller-supplied fetcher for the run-detail snapshot (mobile uses gateway loaders; web hits HTTP directly). */
  fetchSnapshot: RunPreviewSnapshotFetcher;
  /**
   * Cap on how many snapshots to poll before giving up. Each poll synthesizes
   * tool events for items newer than the previous snapshot.
   *
   * Set to 1 for one-shot "stitch tool events after run completed" usage.
   * Set higher to track in-progress tool calls before backend SSE catches up.
   */
  maxPolls?: number;
  /** Delay between polls when {@link maxPolls} > 1. */
  pollIntervalMs?: number;
};

const POLL_DEFAULT_MAX = 1;
const POLL_DEFAULT_INTERVAL_MS = 1_500;

/**
 * Synthesizes tool events from {@link AgentRunPreviewItem}s by polling the
 * run-detail snapshot. Used as a stopgap until the Hermes SSE protocol emits
 * `tool.call.*` events natively.
 *
 * Default mode is one-shot: subscribe → fetch snapshot once → emit a
 * `tool.call.completed` event for each tool item → fire `onComplete` → dispose.
 *
 * For in-progress polling (multi-shot), pass `maxPolls > 1` and a
 * `pollIntervalMs`. The provider dedupes by `(toolName, at)` so the same tool
 * call is never emitted twice.
 *
 * This provider DOES NOT emit lifecycle events (`message.delta`,
 * `run.completed`, etc.). Compose it alongside a Hermes/gateway provider that
 * handles the lifecycle.
 */
export class RunPreviewPollProvider implements RunEventStreamProvider {
  private readonly fetchSnapshot: RunPreviewSnapshotFetcher;
  private readonly maxPolls: number;
  private readonly pollIntervalMs: number;

  constructor(options: RunPreviewPollProviderOptions) {
    this.fetchSnapshot = options.fetchSnapshot;
    this.maxPolls = Math.max(1, options.maxPolls ?? POLL_DEFAULT_MAX);
    this.pollIntervalMs = Math.max(250, options.pollIntervalMs ?? POLL_DEFAULT_INTERVAL_MS);
  }

  async subscribe(
    params: RunEventStreamSubscribeParams,
    handlers: RunEventStreamHandlers,
  ): Promise<RunEventStreamSubscription> {
    let disposed = false;
    const seen = new Set<string>();
    const localController = new AbortController();
    const signal = combineAbortSignals(localController.signal, params.signal);

    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      localController.abort();
    };

    const pollOnce = async (): Promise<void> => {
      if (disposed) return;
      const snapshot = await this.fetchSnapshot(params.runId, signal);
      if (disposed || !snapshot) return;
      const items = snapshot.preview?.items ?? [];
      for (const item of items) {
        if (!isToolItem(item)) continue;
        const key = `${item.toolName ?? ""}#${item.at ?? "na"}#${item.text.slice(0, 64)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const event = previewItemToToolEvent(params.runId, item);
        if (event) handlers.onEvent(event);
      }
    };

    void (async () => {
      try {
        for (let i = 0; i < this.maxPolls; i += 1) {
          if (disposed) return;
          await pollOnce();
          if (disposed || i + 1 >= this.maxPolls) break;
          await wait(this.pollIntervalMs, signal);
        }
        if (!disposed) handlers.onComplete?.();
      } catch (error) {
        if (!disposed) handlers.onError?.(error);
      } finally {
        disposed = true;
      }
    })();

    return { dispose };
  }
}

function isToolItem(item: AgentRunPreviewItem): boolean {
  if (item.eventType?.trim().toLowerCase() === "tool") return true;
  if (item.toolName && item.toolName.trim().length > 0) return true;
  const role = item.role?.trim().toLowerCase() ?? "";
  return role.includes("tool");
}

function previewItemToToolEvent(
  runId: string,
  item: AgentRunPreviewItem,
): RunStreamToolEvent | null {
  const name = item.toolName?.trim();
  const text = item.text?.trim() ?? "";
  if (!name && !text) return null;

  const status: RunStreamToolStatus = item.error ? "failed" : "completed";
  const eventName: RunStreamToolEvent["event"] = item.error
    ? RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED
    : RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED;

  const toolCall: RunStreamToolCall = {
    id: `${runId}:${name ?? "tool"}:${item.at ?? Date.now()}`,
    name: name ?? deriveToolNameFromText(text) ?? "tool",
    status,
    event: item.eventType?.trim() || undefined,
    output: text || undefined,
    error: item.error?.trim() || undefined,
    durationMs:
      typeof item.durationMs === "number" && Number.isFinite(item.durationMs) && item.durationMs > 0
        ? item.durationMs
        : undefined,
    at: item.at ?? undefined,
  };

  return {
    event: eventName,
    runId,
    toolCall,
    at: item.at ?? undefined,
  };
}

function deriveToolNameFromText(text: string): string | null {
  const match = text.match(/^([a-zA-Z][a-zA-Z0-9_-]{1,40})[:(\s]/);
  return match?.[1] ?? null;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onAbort = (): void => {
      if (timeout) clearTimeout(timeout);
      reject(new Error("aborted"));
    };
    timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// composeRunEventProviders
// ---------------------------------------------------------------------------

/**
 * Fan a single subscription out to multiple providers. Events from each
 * provider are forwarded to the shared handler in arrival order; disposing the
 * composite disposes every child subscription. Errors from any child are
 * surfaced via {@link RunEventStreamHandlers.onError}; the others keep running
 * unless the consumer disposes.
 */
export function composeRunEventProviders(
  ...providers: RunEventStreamProvider[]
): RunEventStreamProvider {
  return {
    async subscribe(params, handlers) {
      if (providers.length === 0) return NOOP_SUBSCRIPTION;
      const subs = await Promise.all(
        providers.map((provider) => provider.subscribe(params, handlers)),
      );
      let disposed = false;
      return {
        dispose: async () => {
          if (disposed) return;
          disposed = true;
          await Promise.all(subs.map((sub) => Promise.resolve(sub.dispose())));
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// createRunStreamWithToolFallback
// ---------------------------------------------------------------------------

const TERMINAL_LIFECYCLE_EVENTS: ReadonlySet<RunStreamEventName> = new Set([
  RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
  RUN_STREAM_EVENT_NAMES.RUN_FAILED,
  RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
]);

const TOOL_EVENT_NAMES: ReadonlySet<RunStreamEventName> = new Set([
  RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED,
  RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
  RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED,
]);

export type CreateRunStreamWithToolFallbackOptions = {
  /** Authoritative source for lifecycle + (eventually) tool events. */
  primary: RunEventStreamProvider;
  /**
   * One-shot fallback that fires only after the primary emits `run.completed`
   * AND the primary did not emit any tool events during the run. Typically a
   * {@link RunPreviewPollProvider}. Optional — when omitted the composer
   * behaves like `primary` alone.
   */
  toolEventFallback?: RunEventStreamProvider;
};

/**
 * Wraps a primary {@link RunEventStreamProvider} with a tool-event fallback
 * that fires only when the primary's run completes without ever emitting tool
 * events. Used to bridge the gap while the Hermes SSE protocol does not yet
 * surface `tool.call.*` events natively: the
 * {@link RunPreviewPollProvider}-backed fallback stitches tool events in from
 * the post-hoc run preview. When the primary starts emitting tool events
 * natively, the fallback becomes a no-op automatically.
 */
export function createRunStreamWithToolFallback(
  options: CreateRunStreamWithToolFallbackOptions,
): RunEventStreamProvider {
  return {
    async subscribe(params, handlers) {
      const { primary, toolEventFallback } = options;
      if (!toolEventFallback) {
        return primary.subscribe(params, handlers);
      }

      let disposed = false;
      let sawToolEventOnPrimary = false;
      let fallbackSub: RunEventStreamSubscription | null = null;
      let fallbackStarted = false;
      let primaryComplete = false;
      let fallbackComplete = false;
      let completedEmitted = false;

      const maybeComplete = (): void => {
        if (disposed || completedEmitted) return;
        const fallbackNeeded =
          primaryComplete &&
          !sawToolEventOnPrimary &&
          fallbackStarted;
        if (primaryComplete && (!fallbackNeeded || fallbackComplete)) {
          completedEmitted = true;
          handlers.onComplete?.();
        }
      };

      const wrappedHandlers: RunEventStreamHandlers = {
        onEvent: (event) => {
          handlers.onEvent(event);
          if (TOOL_EVENT_NAMES.has(event.event)) {
            sawToolEventOnPrimary = true;
          }
          if (
            event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED &&
            !sawToolEventOnPrimary &&
            !disposed
          ) {
            fallbackStarted = true;
            void toolEventFallback
              .subscribe(params, {
                onEvent: handlers.onEvent,
                onError: handlers.onError,
                onComplete: () => {
                  fallbackComplete = true;
                  maybeComplete();
                },
              })
              .then((sub) => {
                if (disposed) {
                  void Promise.resolve(sub.dispose());
                  return;
                }
                fallbackSub = sub;
                maybeComplete();
              })
              .catch((error) => {
                fallbackComplete = true;
                handlers.onError?.(error);
                maybeComplete();
              });
          }
          if (TERMINAL_LIFECYCLE_EVENTS.has(event.event)) {
            primaryComplete = true;
          }
        },
        onError: handlers.onError,
        onComplete: () => {
          primaryComplete = true;
          maybeComplete();
        },
      };

      const primarySub = await primary.subscribe(params, wrappedHandlers);

      return {
        dispose: async () => {
          if (disposed) return;
          disposed = true;
          await Promise.resolve(primarySub.dispose());
          if (fallbackSub) await Promise.resolve(fallbackSub.dispose());
        },
      };
    },
  };
}

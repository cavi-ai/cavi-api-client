import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
  type RunStreamApprovalChoice,
  type RunStreamEvent,
  type RunStreamEventName,
} from "../run-stream.js";
import type { RuntimeUsage } from "../usage.js";
import type { RuntimeControlPlaneEvent, RuntimeEventClient } from "./events.js";

const APPROVAL_CHOICES: ReadonlySet<RunStreamApprovalChoice> = new Set([
  "once",
  "session",
  "always",
  "deny",
]);

// Matches the gateway SSE producer's normalizeApprovalChoices convention
// (core/gateway/run/sse-run-event-provider.ts): an empty/missing/all-invalid
// choice list would otherwise deadlock the approval UI with nothing to pick,
// so it falls back to the full choice set rather than an empty array.
const FULL_APPROVAL_CHOICES: RunStreamApprovalChoice[] = ["once", "session", "always", "deny"];

const TERMINAL_RUN_STREAM_EVENTS: ReadonlySet<RunStreamEventName> = new Set([
  RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
  RUN_STREAM_EVENT_NAMES.RUN_FAILED,
  RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "run failed");
}

function approvalChoices(request: unknown): RunStreamApprovalChoice[] {
  const choices = (request as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices)) return FULL_APPROVAL_CHOICES;
  const filtered = choices.filter((c): c is RunStreamApprovalChoice =>
    APPROVAL_CHOICES.has(c as RunStreamApprovalChoice),
  );
  return filtered.length > 0 ? filtered : FULL_APPROVAL_CHOICES;
}

// Tool results are provider-supplied payloads; core can't rely on a
// provider-layer assertSafe/sanitization pass having run first, so guard
// JSON.stringify (circular refs, BigInt, etc.) with a String() fallback.
function stringifyToolResult(result: unknown): string {
  try {
    return JSON.stringify(result) ?? String(result);
  } catch {
    return String(result);
  }
}

/**
 * Stateful translator from normalized control-plane events onto the canonical
 * run-stream union. Stateful in two ways: tool.completed frames omit the tool
 * name, so the translator remembers it from tool.started; and usage.updated
 * frames carry usage on their own, so the last-seen usage is remembered and
 * attached to the terminal RUN_COMPLETED event (matching the Gemini provider's
 * precedent of surfacing accumulated usage on the terminal event). Events with
 * no run-visible projection (reasoning deltas, usage ticks, stream
 * housekeeping) map to null.
 */
export function createControlPlaneRunStreamTranslator(): (
  event: RuntimeControlPlaneEvent,
) => RunStreamEvent | null {
  const toolNames = new Map<string, string>();
  let lastUsage: RuntimeUsage | undefined;
  return (event) => {
    const runId = event.operationId;
    switch (event.event) {
      case "message.delta":
        return { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta: event.delta };
      case "usage.updated":
        lastUsage = event.usage;
        return null;
      case "operation.completed":
        return {
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          runId,
          ...(lastUsage !== undefined ? { usage: lastUsage } : {}),
        };
      case "operation.failed":
        return { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId, error: errorMessage(event.error) };
      case "operation.cancelled":
        return { event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED, runId };
      case "operation.interrupted":
        return {
          event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
          runId,
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
        };
      case "tool.started":
        toolNames.set(event.toolCallId, event.toolName);
        return {
          event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED,
          runId,
          toolCall: { id: event.toolCallId, name: event.toolName, status: "running" },
        };
      case "tool.completed":
        return {
          event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
          runId,
          toolCall: {
            id: event.toolCallId,
            name: toolNames.get(event.toolCallId) ?? "tool",
            status: "completed",
            ...(event.result !== undefined ? { output: stringifyToolResult(event.result) } : {}),
          },
        };
      case "approval.requested":
        return {
          event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST,
          runId,
          choices: approvalChoices(event.request),
        };
      default:
        return null;
    }
  };
}

/**
 * Adapt a control-plane event client (subscribe-by-operationId) into the
 * run-event stream contract (subscribe-by-runId) — the WS half of the gateway
 * streamRun bridge, but provider-agnostic: any RuntimeEventClient fits.
 *
 * `RuntimeEventClient` has no onComplete slot of its own, so it is synthesized
 * here: once a translated terminal event (run.completed / run.failed /
 * run.cancelled) is forwarded, `handlers.onComplete` fires exactly once and
 * any further control-plane frames for this subscription are ignored — every
 * other RunEventStreamProvider in this package honors that contract (see
 * core/gateway/run/sse-run-event-provider.ts and event-stream.ts) and
 * consumers (e.g. hermes/chat-run.ts) rely on it to resolve.
 */
export function createRunEventStreamFromControlPlane(
  events: RuntimeEventClient,
): RunEventStreamProvider {
  return {
    async subscribe(
      params: RunEventStreamSubscribeParams,
      handlers: RunEventStreamHandlers,
    ): Promise<RunEventStreamSubscription> {
      const translate = createControlPlaneRunStreamTranslator();
      let completed = false;
      const subscription = await events.subscribe(
        { operationId: params.runId, ...(params.signal ? { signal: params.signal } : {}) },
        {
          onEvent: (event) => {
            if (completed) return;
            const mapped = translate(event);
            if (!mapped) return;
            handlers.onEvent(mapped);
            if (TERMINAL_RUN_STREAM_EVENTS.has(mapped.event)) {
              completed = true;
              handlers.onComplete?.();
            }
          },
          ...(handlers.onError ? { onError: handlers.onError } : {}),
        },
      );
      return { dispose: () => subscription.dispose() };
    },
  };
}

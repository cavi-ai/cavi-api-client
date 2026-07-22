import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
  type RunStreamApprovalChoice,
  type RunStreamEvent,
} from "../run-stream.js";
import type { RuntimeControlPlaneEvent, RuntimeEventClient } from "./events.js";

const APPROVAL_CHOICES: ReadonlySet<RunStreamApprovalChoice> = new Set([
  "once",
  "session",
  "always",
  "deny",
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
  if (!Array.isArray(choices)) return [];
  return choices.filter((c): c is RunStreamApprovalChoice =>
    APPROVAL_CHOICES.has(c as RunStreamApprovalChoice),
  );
}

/**
 * Stateful translator from normalized control-plane events onto the canonical
 * run-stream union. Stateful because tool.completed frames omit the tool name
 * — the translator remembers it from tool.started. Events with no run-visible
 * projection (reasoning deltas, usage ticks, stream housekeeping) map to null.
 */
export function createControlPlaneRunStreamTranslator(): (
  event: RuntimeControlPlaneEvent,
) => RunStreamEvent | null {
  const toolNames = new Map<string, string>();
  return (event) => {
    const runId = event.operationId;
    switch (event.event) {
      case "message.delta":
        return { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta: event.delta };
      case "operation.completed":
        return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId };
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
            name: toolNames.get(event.toolCallId) ?? "",
            status: "completed",
            ...(event.result !== undefined ? { output: JSON.stringify(event.result) } : {}),
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
      const subscription = await events.subscribe(
        { operationId: params.runId, ...(params.signal ? { signal: params.signal } : {}) },
        {
          onEvent: (event) => {
            const mapped = translate(event);
            if (mapped) handlers.onEvent(mapped);
          },
          ...(handlers.onError ? { onError: handlers.onError } : {}),
        },
      );
      return { dispose: () => subscription.dispose() };
    },
  };
}

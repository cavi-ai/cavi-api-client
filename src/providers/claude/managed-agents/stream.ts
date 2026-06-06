import type { SseMessage } from "../../../core/sse/index.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../../core/runtime/run-stream.js";

function parse(data: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(data);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Concatenate the `text` of any text content blocks on an `agent.message`. */
function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      text += (block as { text: string }).text;
    }
  }
  return text;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

/**
 * A `session.status_idle` event is terminal only when its `stop_reason` is NOT
 * `requires_action` — the session also idles transiently while waiting on a tool
 * confirmation or a custom-tool result. Mirrors the Managed Agents idle-break
 * gate (shared client pattern 5).
 */
function isTerminalIdle(data: Record<string, unknown>): boolean {
  const stopReason = data.stop_reason as { type?: unknown } | undefined;
  return !stopReason || stopReason.type !== "requires_action";
}

/**
 * Map one Managed Agents session SSE event to a canonical RunStreamEvent.
 * Returns null for events with no RunStreamEvent equivalent (status_running,
 * thinking, span.*, thread/echo events) — the caller skips those. `runId` is the
 * session id (known before the stream opens, unlike the Messages surface which
 * captures it from `message_start`).
 *
 * Discriminator note: the SSE event kind is read from `data.type`. The
 * authoritative sources (event-type table, the SSE-vs-webhook namespace note,
 * and the SDK examples) use the DOTTED form (`session.status_idle`,
 * `agent.message`); one events-doc payload example shows a namespace-stripped
 * form (`status_idle`). Because a MISSED terminal event would hang `streamRun`
 * (no terminal → no abort → no onComplete), the lifecycle/terminal cases accept
 * BOTH forms defensively. The text/tool cases stay dotted-only: a bare `message`
 * would collide with echoed `user.message` events and surface user input as
 * agent output. Verified against a live session (2026-06-05): the wire uses the
 * DOTTED form (`session.status_idle`, `agent.message`, …, plus `user.message`
 * echoes, `span.*`, `agent.thinking`, `session.thread_status_*`); the
 * stripped-form lifecycle cases remain as defensive backup.
 */
export function mapManagedAgentStreamEvent(
  sse: SseMessage,
  runId: string,
): RunStreamEvent | null {
  const data = parse(sse.data);
  const type = data?.type;
  if (!data || typeof type !== "string") return null;

  switch (type) {
    case "agent.message": {
      const delta = textFromContent(data.content);
      return delta
        ? { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta }
        : null;
    }
    case "agent.tool_use":
    case "agent.mcp_tool_use":
    case "agent.custom_tool_use":
      return {
        event: RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED,
        runId,
        toolCall: {
          id: asString(data.id, ""),
          name: asString(data.name, type),
          status: "running",
        },
      };
    case "agent.tool_result":
    case "agent.mcp_tool_result": {
      const isError = data.is_error === true;
      return {
        event: isError
          ? RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED
          : RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED,
        runId,
        toolCall: {
          id: asString(data.tool_use_id ?? data.id, ""),
          name: asString(data.name, type),
          status: isError ? "failed" : "completed",
        },
      };
    }
    // Lifecycle/terminal: accept dotted AND namespace-stripped forms (see note).
    case "session.error":
    case "error": {
      const error = data.error as { message?: unknown } | undefined;
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: asString(error?.message, "claude managed-agents session error"),
      };
    }
    case "session.status_terminated":
    case "status_terminated":
      return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId };
    case "session.status_idle":
    case "status_idle":
      return isTerminalIdle(data)
        ? { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId }
        : null;
    default:
      return null;
  }
}

/** True for events that end a run, so the caller can stop reading the stream. */
export function isTerminalRunStreamEvent(event: RunStreamEvent): boolean {
  return (
    event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED ||
    event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED ||
    event.event === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED
  );
}

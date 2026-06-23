import type { SseMessage } from "../../core/sse/index.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";

function parse(data: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(data);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Map one Anthropic Messages SSE event to a canonical RunStreamEvent.
 * Returns null for events with no RunStreamEvent equivalent (message_start,
 * ping, content_block_start/stop, message_delta) — the caller skips those.
 * `runId` is supplied by the caller (captured from `message_start`).
 */
export function mapAnthropicStreamEvent(
  sse: SseMessage,
  runId: string,
): RunStreamEvent | null {
  if (!sse.event) return null;
  const data = parse(sse.data);
  if (!data) return null;

  switch (sse.event) {
    case "content_block_delta": {
      const delta = data.delta as { type?: string; text?: unknown } | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        return { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta: delta.text };
      }
      return null;
    }
    case "message_stop":
      return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId };
    case "error": {
      const error = data.error as { message?: unknown } | undefined;
      const message =
        typeof error?.message === "string" ? error.message : "claude stream error";
      return { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId, error: message };
    }
    default:
      return null;
  }
}

/** Extract the run id from an Anthropic `message_start` SSE event, if present. */
export function readAnthropicRunId(sse: SseMessage): string | null {
  if (sse.event !== "message_start") return null;
  const data = parse(sse.data);
  const message = data?.message as { id?: unknown } | undefined;
  return typeof message?.id === "string" ? message.id : null;
}

function numericUsage(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number") out[key] = raw;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Extract a usage delta from an Anthropic streaming event. Usage arrives on
 * `message_start` (input/cache) and `message_delta` (cumulative output); the
 * caller merges deltas and attaches the result to the completed event.
 */
export function readAnthropicStreamUsage(sse: SseMessage): Record<string, number> | null {
  const data = parse(sse.data);
  if (!data) return null;
  if (sse.event === "message_start") {
    const message = data.message as { usage?: unknown } | undefined;
    return numericUsage(message?.usage);
  }
  if (sse.event === "message_delta") {
    return numericUsage(data.usage);
  }
  return null;
}

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

function eventTypeOf(sse: SseMessage, data: Record<string, unknown>): string | null {
  if (typeof sse.event === "string" && sse.event) return sse.event;
  return typeof data.type === "string" && data.type ? data.type : null;
}

function responseOf(data: Record<string, unknown>): Record<string, unknown> {
  const response = data.response;
  return response && typeof response === "object"
    ? (response as Record<string, unknown>)
    : data;
}

function errorMessageOf(value: unknown, fallback: string): string {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.reason === "string" && record.reason) return record.reason;
  }
  return fallback;
}

export function readOpenAIResponseRunId(sse: SseMessage): string | null {
  const data = parse(sse.data);
  if (!data) return null;
  const eventType = eventTypeOf(sse, data);
  if (eventType !== "response.created") return null;
  const response = responseOf(data);
  return typeof response.id === "string" && response.id ? response.id : null;
}

export function mapOpenAIResponseStreamEvent(
  sse: SseMessage,
  runId: string,
): RunStreamEvent | null {
  const data = parse(sse.data);
  if (!data) return null;
  const eventType = eventTypeOf(sse, data);
  if (!eventType) return null;
  const response = responseOf(data);

  switch (eventType) {
    case "response.output_text.delta": {
      const delta = data.delta;
      if (typeof delta === "string" && delta) {
        return { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta };
      }
      return null;
    }
    case "response.completed": {
      const output = response.output_text;
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId,
        ...(typeof output === "string" && output ? { output } : {}),
      };
    }
    case "response.failed":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(response.error ?? data.error, "codex response failed"),
      };
    case "response.incomplete":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(
          response.incomplete_details ?? data.incomplete_details,
          "codex response incomplete",
        ),
      };
    case "response.cancelled":
      return { event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED, runId };
    case "error":
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(data.error ?? data.message, "codex stream error"),
      };
    default:
      return null;
  }
}

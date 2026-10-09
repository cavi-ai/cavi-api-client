import type { SseMessage } from "../../core/sse/index.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { flattenOpenAIUsage } from "./usage.js";
import { readCodexOutputText } from "./output.js";
import { readNativeRunErrorDetails } from "../../core/runtime/run-error-details.js";

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
      const output = readCodexOutputText(response);
      const tokens = normalizeRuntimeUsage(
        flattenOpenAIUsage(response.usage),
        "codex-responses",
      );
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId,
        ...(output !== undefined ? { output } : {}),
        ...(tokens ? { usage: tokens } : {}),
      };
    }
    case "response.failed": {
      const errorDetails = readNativeRunErrorDetails(response.error ?? data.error);
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(response.error ?? data.error, "codex response failed"),
        ...(errorDetails ? { errorDetails } : {}),
      };
    }
    case "response.incomplete": {
      const errorDetails = readNativeRunErrorDetails(response.incomplete_details ?? data.incomplete_details);
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(
          response.incomplete_details ?? data.incomplete_details,
          "codex response incomplete",
        ),
        ...(errorDetails ? { errorDetails } : {}),
      };
    }
    case "response.cancelled":
      return { event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED, runId };
    case "error": {
      // The envelope's type is "error"; only a nested type describes the backend failure.
      const errorDetails = readNativeRunErrorDetails(data.error ?? { code: data.code });
      return {
        event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
        runId,
        error: errorMessageOf(data.error ?? data.message, "codex stream error"),
        ...(errorDetails ? { errorDetails } : {}),
      };
    }
    default:
      return null;
  }
}

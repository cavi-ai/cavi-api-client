import type { SseMessage } from "../../core/sse/index.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import { flattenGeminiUsageMetadata } from "./usage.js";

function parse(data: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(data);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function firstCandidate(chunk: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = chunk.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const candidate = candidates[0];
  return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : null;
}

function candidateText(candidate: Record<string, unknown> | null): string {
  const content = candidate?.content as { parts?: unknown } | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
      ? (part as { text: string }).text
      : ""))
    .join("");
}

/** Map one Gemini SSE chunk to a MESSAGE_DELTA, or null when it carries no text. */
export function mapGeminiStreamChunk(sse: SseMessage, runId: string): RunStreamEvent | null {
  const chunk = parse(sse.data);
  if (!chunk) return null;
  const text = candidateText(firstCandidate(chunk));
  if (!text) return null;
  return { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta: text };
}

/** Extract the flat usageMetadata numbers from a chunk, if present. */
export function readGeminiStreamUsage(sse: SseMessage): Record<string, number> | null {
  const chunk = parse(sse.data);
  if (!chunk) return null;
  return flattenGeminiUsageMetadata(chunk.usageMetadata) ?? null;
}

/** Return the first candidate's finishReason, if the chunk is terminal. */
export function readGeminiFinishReason(sse: SseMessage): string | null {
  const chunk = parse(sse.data);
  if (!chunk) return null;
  const reason = firstCandidate(chunk)?.finishReason;
  return typeof reason === "string" && reason ? reason : null;
}

import type {
  RuntimeBatchCounts,
  RuntimeBatchResult,
  RuntimeBatchStatus,
} from "../../core/runtime/batch.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import type { AnthropicMessage } from "./message.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const COUNT_KEYS = ["processing", "succeeded", "errored", "canceled", "expired"] as const;

/** Map an Anthropic MessageBatch object to the canonical batch status. */
export function mapMessageBatch(raw: unknown): RuntimeBatchStatus {
  const record = isRecord(raw) ? raw : {};
  const processing = typeof record.processing_status === "string" ? record.processing_status : "";
  const status =
    processing === "ended" ? "completed" : processing === "canceling" ? "canceling" : "in_progress";

  const rc = isRecord(record.request_counts) ? record.request_counts : {};
  const counts: RuntimeBatchCounts = {};
  for (const key of COUNT_KEYS) {
    if (typeof rc[key] === "number") counts[key] = rc[key] as number;
  }
  const present = COUNT_KEYS.map((k) => counts[k]).filter((n): n is number => typeof n === "number");
  if (present.length) counts.total = present.reduce((a, b) => a + b, 0);

  const out: RuntimeBatchStatus = {
    batch_id: typeof record.id === "string" ? record.id : "",
    status,
    resultsAvailable: processing === "ended",
  };
  if (Object.keys(counts).length) out.counts = counts;
  if (typeof record.created_at === "string" || typeof record.created_at === "number") {
    out.createdAt = record.created_at as string | number;
  }
  if (typeof record.ended_at === "string" || typeof record.ended_at === "number") {
    out.endedAt = record.ended_at as string | number;
  }
  return out;
}

function extractErrorMessage(value: unknown): string {
  if (isRecord(value)) {
    const inner = value.error;
    if (isRecord(inner) && typeof inner.message === "string") return inner.message;
    if (typeof value.message === "string") return value.message;
  }
  return "batch request errored";
}

/**
 * Parse Anthropic batch results JSONL (one JSON object per line) into canonical
 * results. `mapMessage` maps a succeeded line's Anthropic message to a run status.
 */
export function parseMessageBatchResults(
  jsonlText: string,
  mapMessage: (message: AnthropicMessage) => RuntimeRunStatus,
): RuntimeBatchResult[] {
  const out: RuntimeBatchResult[] = [];
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const customId = typeof parsed.custom_id === "string" ? parsed.custom_id : "";
    const result = isRecord(parsed.result) ? parsed.result : {};
    const type = typeof result.type === "string" ? result.type : "errored";
    if (type === "succeeded" && isRecord(result.message)) {
      out.push({ customId, outcome: "succeeded", run: mapMessage(result.message as AnthropicMessage) });
    } else if (type === "errored") {
      out.push({ customId, outcome: "errored", error: extractErrorMessage(result.error) });
    } else {
      out.push({ customId, outcome: type });
    }
  }
  return out;
}

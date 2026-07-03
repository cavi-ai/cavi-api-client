import type {
  RuntimeBatchCounts,
  RuntimeBatchRequest,
  RuntimeBatchResult,
  RuntimeBatchStatus,
} from "../../core/runtime/batch.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import { CODEX_API_ENDPOINTS } from "./paths.js";
import type { OpenAIResponse } from "./response.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Build the OpenAI Batch input file (JSONL). Each line targets the Responses endpoint. */
export function buildBatchInputJsonl(
  requests: RuntimeBatchRequest[],
  buildBody: (body: RuntimeBatchRequest["body"]) => Record<string, unknown>,
): string {
  return requests
    .map((request) =>
      JSON.stringify({
        custom_id: request.customId,
        method: "POST",
        url: CODEX_API_ENDPOINTS.responses,
        body: buildBody(request.body),
      }),
    )
    .join("\n");
}

const OPENAI_BATCH_STATUS: Record<string, RuntimeBatchStatus["status"]> = {
  validating: "in_progress",
  in_progress: "in_progress",
  finalizing: "in_progress",
  completed: "completed",
  failed: "failed",
  cancelling: "canceling",
  cancelled: "cancelled",
  expired: "expired",
};

/** Map an OpenAI Batch object to the canonical batch status. */
export function mapOpenAIBatch(raw: unknown): RuntimeBatchStatus {
  const record = isRecord(raw) ? raw : {};
  const rawStatus = typeof record.status === "string" ? record.status : "";
  const status = OPENAI_BATCH_STATUS[rawStatus] ?? "in_progress";

  const rc = isRecord(record.request_counts) ? record.request_counts : {};
  const counts: RuntimeBatchCounts = {};
  if (typeof rc.total === "number") counts.total = rc.total;
  if (typeof rc.completed === "number") counts.succeeded = rc.completed;
  if (typeof rc.failed === "number") counts.errored = rc.failed;

  const out: RuntimeBatchStatus = {
    batch_id: typeof record.id === "string" ? record.id : "",
    status,
    // A batch can end with only an error file (all requests failed), so results
    // are retrievable when EITHER the output or error file is present.
    resultsAvailable:
      typeof record.output_file_id === "string" || typeof record.error_file_id === "string",
  };
  if (Object.keys(counts).length) out.counts = counts;
  const created = record.created_at;
  if (typeof created === "number" || typeof created === "string") out.createdAt = created;
  const ended = record.completed_at ?? record.failed_at ?? record.expired_at ?? record.cancelled_at;
  if (typeof ended === "number" || typeof ended === "string") out.endedAt = ended;
  return out;
}

function errorMessage(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.message === "string") return value.message;
    const inner = value.error;
    if (isRecord(inner) && typeof inner.message === "string") return inner.message;
  }
  return "batch request errored";
}

/** Parse an OpenAI batch output/error file (JSONL) into canonical results. */
export function parseOpenAIBatchOutput(
  jsonlText: string,
  mapResponse: (response: OpenAIResponse) => RuntimeRunStatus,
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
    const response = isRecord(parsed.response) ? parsed.response : null;
    const statusCode = response && typeof response.status_code === "number" ? response.status_code : undefined;
    const bodyOk = response != null && isRecord(response.body);
    if (parsed.error == null && statusCode !== undefined && statusCode >= 200 && statusCode < 300 && bodyOk) {
      out.push({ customId, outcome: "succeeded", run: mapResponse(response!.body as OpenAIResponse) });
    } else {
      out.push({ customId, outcome: "errored", error: errorMessage(parsed.error ?? (response ? response.body : undefined)) });
    }
  }
  return out;
}

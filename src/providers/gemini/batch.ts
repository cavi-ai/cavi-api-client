import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type {
  RuntimeBatchCounts,
  RuntimeBatchRequest,
  RuntimeBatchResult,
  RuntimeBatchStatus,
} from "../../core/runtime/batch.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import { buildGeminiRequestBody } from "./request.js";
import {
  mapGeminiGenerateContentToRunStatus,
  type GeminiGenerateContentResponse,
} from "./response.js";

export const GEMINI_BATCH_INLINE_MAX_BYTES = 18 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeGeminiBatchName(batchId: string): string {
  const trimmed = batchId.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("batches/") ? trimmed : `batches/${trimmed}`;
}

const GEMINI_BATCH_STATE: Record<string, RuntimeBatchStatus["status"]> = {
  JOB_STATE_PENDING: "in_progress",
  JOB_STATE_RUNNING: "in_progress",
  JOB_STATE_SUCCEEDED: "completed",
  JOB_STATE_FAILED: "failed",
  JOB_STATE_CANCELLED: "cancelled",
  JOB_STATE_EXPIRED: "expired",
};

function readBatchState(record: Record<string, unknown>): string {
  const metadata = isRecord(record.metadata) ? record.metadata : undefined;
  if (typeof metadata?.state === "string") return metadata.state;
  if (typeof record.state === "string") return record.state;
  return "";
}

function readBatchName(record: Record<string, unknown>): string {
  if (typeof record.name === "string") return record.name;
  return "";
}

/** Resolve one model for the whole batch; throws when models disagree or are missing. */
export function resolveGeminiBatchModel(
  requests: RuntimeBatchRequest[],
  defaultModel?: string,
): string {
  if (!requests.length) {
    throw new ApiClientError("gemini: submitBatch requires at least one request", {
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  let resolved: string | undefined;
  for (const request of requests) {
    const model = buildGeminiRequestBody(request.body, defaultModel).model;
    if (!resolved) resolved = model;
    else if (resolved !== model) {
      throw new ApiClientError(
        "gemini: all batch requests must use the same model",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
  }
  return resolved!;
}

export type GeminiBatchInlineEntry = {
  request: Record<string, unknown>;
  metadata: { key: string };
};

/** Build inline batch request entries keyed by customId. */
export function buildGeminiBatchInlineEntries(
  requests: RuntimeBatchRequest[],
  defaultModel?: string,
): { model: string; entries: GeminiBatchInlineEntry[] } {
  const model = resolveGeminiBatchModel(requests, defaultModel);
  const entries = requests.map((request) => ({
    metadata: { key: request.customId },
    request: buildGeminiRequestBody(request.body, defaultModel).payload,
  }));
  return { model, entries };
}

/** Build JSONL for file-based batch submission. */
export function buildGeminiBatchInputJsonl(
  requests: RuntimeBatchRequest[],
  defaultModel?: string,
): { model: string; jsonl: string } {
  const model = resolveGeminiBatchModel(requests, defaultModel);
  const jsonl = requests
    .map((request) =>
      JSON.stringify({
        key: request.customId,
        request: buildGeminiRequestBody(request.body, defaultModel).payload,
      }),
    )
    .join("\n");
  return { model, jsonl };
}

export function estimateGeminiBatchInlineBytes(entries: GeminiBatchInlineEntry[]): number {
  const body = {
    batch: {
      input_config: {
        requests: {
          requests: entries.map((entry) => ({
            request: entry.request,
            metadata: entry.metadata,
          })),
        },
      },
    },
  };
  return new TextEncoder().encode(JSON.stringify(body)).length;
}

/** Map a Gemini batch job object to canonical batch status. */
export function mapGeminiBatch(raw: unknown): RuntimeBatchStatus {
  const record = isRecord(raw) ? raw : {};
  const rawState = readBatchState(record);
  const status = GEMINI_BATCH_STATE[rawState] ?? "in_progress";
  const resultsAvailable = rawState === "JOB_STATE_SUCCEEDED" || rawState === "JOB_STATE_FAILED";

  const counts: RuntimeBatchCounts = {};
  const batchStats = isRecord(record.batchStats) ? record.batchStats : undefined;
  if (typeof batchStats?.totalRequestCount === "number") counts.total = batchStats.totalRequestCount;
  if (typeof batchStats?.successfulRequestCount === "number") counts.succeeded = batchStats.successfulRequestCount;
  if (typeof batchStats?.failedRequestCount === "number") counts.errored = batchStats.failedRequestCount;

  const out: RuntimeBatchStatus = {
    batch_id: normalizeGeminiBatchName(readBatchName(record)),
    status,
    resultsAvailable,
  };
  if (Object.keys(counts).length) out.counts = counts;
  const createTime = record.createTime ?? record.create_time;
  if (typeof createTime === "string" || typeof createTime === "number") out.createdAt = createTime;
  const endTime = record.endTime ?? record.end_time;
  if (typeof endTime === "string" || typeof endTime === "number") out.endedAt = endTime;
  return out;
}

function extractErrorMessage(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.message === "string") return value.message;
    const inner = value.error;
    if (isRecord(inner) && typeof inner.message === "string") return inner.message;
  }
  return "batch request errored";
}

export type ParseGeminiBatchResultsOptions = {
  malformedLine?: "skip" | "throw";
};

function handleMalformedLine(
  lineNumber: number,
  options: ParseGeminiBatchResultsOptions,
  cause?: unknown,
): null {
  if (options.malformedLine === "throw") {
    throw new ApiClientError(`gemini: invalid batch JSONL at line ${lineNumber}`, {
      code: ApiClientErrorCode.InvalidJson,
      cause,
    });
  }
  return null;
}

function parseJsonlRecord(
  line: string,
  lineNumber: number,
  options: ParseGeminiBatchResultsOptions,
): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    return handleMalformedLine(lineNumber, options, error);
  }
  if (!isRecord(parsed)) return handleMalformedLine(lineNumber, options);
  return parsed;
}

function mapGeminiBatchResultEntry(
  customId: string,
  response: GeminiGenerateContentResponse | undefined,
  error: unknown,
  model: string,
  mapResponse: (response: GeminiGenerateContentResponse) => RuntimeRunStatus,
): RuntimeBatchResult {
  if (response) {
    return { customId, outcome: "succeeded", run: mapResponse(response) };
  }
  if (error != null) {
    return { customId, outcome: "errored", error: extractErrorMessage(error) };
  }
  return { customId, outcome: "errored", error: "batch request errored" };
}

/** Parse inline batch responses from a GET batch payload. */
export function parseGeminiInlineBatchResults(
  raw: unknown,
  model: string,
  mapResponse: (response: GeminiGenerateContentResponse) => RuntimeRunStatus = (response) =>
    mapGeminiGenerateContentToRunStatus(model, response),
): RuntimeBatchResult[] {
  const record = isRecord(raw) ? raw : {};
  const response = isRecord(record.response) ? record.response : record;
  const dest = isRecord(record.dest) ? record.dest : undefined;
  const inlined =
    (Array.isArray(response.inlinedResponses) ? response.inlinedResponses : undefined) ??
    (Array.isArray(dest?.inlinedResponses) ? dest.inlinedResponses : undefined) ??
    [];
  const out: RuntimeBatchResult[] = [];
  for (const entry of inlined) {
    if (!isRecord(entry)) continue;
    const metadata = isRecord(entry.metadata) ? entry.metadata : undefined;
    const customId = typeof metadata?.key === "string" ? metadata.key : "";
    const succeeded = isRecord(entry.response) ? (entry.response as GeminiGenerateContentResponse) : undefined;
    out.push(mapGeminiBatchResultEntry(customId, succeeded, entry.error, model, mapResponse));
  }
  return out;
}

/** Parse file-based batch result JSONL. */
export function parseGeminiBatchOutputJsonl(
  jsonlText: string,
  model: string,
  mapResponse: (response: GeminiGenerateContentResponse) => RuntimeRunStatus = (response) =>
    mapGeminiGenerateContentToRunStatus(model, response),
  options: ParseGeminiBatchResultsOptions = {},
): RuntimeBatchResult[] {
  const out: RuntimeBatchResult[] = [];
  let lineStart = 0;
  let lineNumber = 1;
  for (let index = 0; index <= jsonlText.length; index += 1) {
    if (index < jsonlText.length && jsonlText.charCodeAt(index) !== 10) continue;
    const trimmed = jsonlText.slice(lineStart, index).trim();
    lineStart = index + 1;
    const currentLineNumber = lineNumber;
    lineNumber += 1;
    if (!trimmed) continue;
    const parsed = parseJsonlRecord(trimmed, currentLineNumber, options);
    if (!parsed) continue;
    const customId = typeof parsed.key === "string" ? parsed.key : "";
    const succeeded = isRecord(parsed.response) ? (parsed.response as GeminiGenerateContentResponse) : undefined;
    out.push(mapGeminiBatchResultEntry(customId, succeeded, parsed.error, model, mapResponse));
  }
  return out;
}

export function readGeminiBatchResponsesFile(raw: unknown): string | undefined {
  const record = isRecord(raw) ? raw : {};
  const response = isRecord(record.response) ? record.response : record;
  const dest = isRecord(record.dest) ? record.dest : undefined;
  if (typeof response.responsesFile === "string") return response.responsesFile;
  if (typeof dest?.fileName === "string") return dest.fileName;
  return undefined;
}

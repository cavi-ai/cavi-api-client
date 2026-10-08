import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { flattenOpenAIUsage } from "./usage.js";
import { readCodexOutputText } from "./output.js";
import { readNativeRunErrorDetails } from "../../core/runtime/run-error-details.js";

export type OpenAIResponse = {
  id: string;
  status?: string;
  model?: string;
  output_text?: string;
  /** Native heterogeneous response items; only message output_text content is normalized. */
  output?: unknown;
  error?: unknown;
  incomplete_details?: unknown;
  // OpenAI nests detail objects (e.g. input_tokens_details.cached_tokens);
  // flattenOpenAIUsage lifts the nested counts.
  usage?: Record<string, unknown>;
};

export function mapResponseStatus(status: string | undefined): RuntimeRunStatus["status"] {
  switch (status) {
    case "queued":
      return "started";
    case "in_progress":
      return "running";
    case "completed":
      return "completed";
    case "failed":
    case "incomplete":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return status || "running";
  }
}

export function errorMessageOf(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.reason === "string" && record.reason) return record.reason;
  }
  return undefined;
}

/** Build the OpenAI Responses request body from the universal run-start body. */
export function buildCodexResponseBody(
  body: RuntimeRunStartBody,
  defaultModel: string,
  options: { background?: boolean; store?: boolean; stream?: boolean } = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: body.model ?? defaultModel,
    input: body.input,
  };
  if (options.background) payload.background = true;
  if (options.store) payload.store = true;
  if (options.stream) payload.stream = true;
  if (body.instructions) payload.instructions = body.instructions;
  if (body.tools?.length) payload.tools = body.tools;
  if (body.metadata) payload.metadata = body.metadata;
  return payload;
}

/** Map an OpenAI Response object to the canonical run status (incl. normalized tokens). */
export function mapOpenAIResponseToRunStatus(response: OpenAIResponse): RuntimeRunStatus {
  const status = mapResponseStatus(response.status);
  const usage = flattenOpenAIUsage(response.usage);
  const tokens = normalizeRuntimeUsage(usage, "codex-responses");
  const output = readCodexOutputText(response);
  const errorDetails = status === "failed"
    ? readNativeRunErrorDetails(response.error ?? response.incomplete_details) : undefined;
  return {
    run_id: response.id,
    status,
    ...(response.model ? { model: response.model } : {}),
    ...(output ? { output } : {}),
    ...(status === "failed"
      ? { error: errorMessageOf(response.error ?? response.incomplete_details) ?? "codex response failed" }
      : {}),
    ...(errorDetails ? { errorDetails } : {}),
    ...(usage ? { usage } : {}),
    ...(tokens ? { tokens } : {}),
  };
}

import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import { readNativeRunErrorDetails } from "../../core/runtime/run-error-details.js";

/**
 * Standard shape of an Antigravity orchestration synchronous response.
 */
export interface AgyGenerateResponse {
  run_id?: string;
  status?: string;
  result?: {
    output?: string;
    artifacts?: string[];
  };
  error?: string | Record<string, unknown>;
  errorMessage?: string;
  error_message?: string;
  errorDetails?: Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAgyStatus(rawStatus: unknown): RuntimeRunStatus["status"] {
  if (typeof rawStatus !== "string") return "running";
  const trimmed = rawStatus.trim();
  if (!trimmed) return "running";
  switch (trimmed) {
    case "in_progress":
      return "running";
    case "queued":
      return "started";
    case "canceled":
      return "cancelled";
    default:
      return trimmed;
  }
}

/**
 * Maps an AGY orchestration response back to the universal RuntimeRunStatus contract.
 */
export function mapAgyResponseToRunStatus(
  agentId: string,
  response: AgyGenerateResponse,
  fallbackRunId: string,
): RuntimeRunStatus {
  const runId = response.run_id || fallbackRunId;
  const status = normalizeAgyStatus(response.status);
  const rawError = response.error;
  const errorRecord =
    rawError !== null && typeof rawError === "object" && !Array.isArray(rawError)
      ? (rawError as Record<string, unknown>)
      : null;
  const error =
    nonEmptyString(rawError) ??
    nonEmptyString(errorRecord?.message) ??
    nonEmptyString(response.errorMessage) ??
    nonEmptyString(response.error_message);
  const errorDetails =
    readNativeRunErrorDetails(response.errorDetails) ??
    readNativeRunErrorDetails(rawError);

  return {
    run_id: runId,
    status,
    ...(typeof response.result?.output === "string" ? { output: response.result.output } : {}),
    model: agentId,
    ...(error !== undefined ? { error } : {}),
    ...(errorDetails ? { errorDetails } : {}),
  };
}

import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../errors.js";
import type { RuntimeRunStatus } from "./run.js";

function outcomeErrorCode(outcome: string | null): ApiClientErrorCode {
  if (outcome === "failed") return ApiClientErrorCode.RunFailed;
  if (outcome === "cancelled") return ApiClientErrorCode.RunCancelled;
  return ApiClientErrorCode.RunIncomplete;
}

/**
 * Require an observed completion, returning the original run with a narrowed
 * status and all provider-specific fields intact. Failed and cancelled runs
 * throw their dedicated run codes; every other state (including dry_run and
 * unknown states) throws RunIncomplete. The original run is retained in cause.
 * This opt-in check never polls, retries, cancels, or changes client behavior.
 */
export function requireCompletedRun<T extends RuntimeRunStatus>(
  run: T,
): T & { status: "completed" } {
  if (run.status !== "completed") {
    throw new ApiClientError(`Run ${run.run_id} is not completed (status: ${run.status})`, {
      type: ApiClientErrorType.Run,
      code: outcomeErrorCode(run.status),
      cause: run,
    });
  }
  return run as T & { status: "completed" };
}

/**
 * Require a completed run with text. Prefer output over the legacy response
 * field, preserving an explicit empty string and whitespace. A completed
 * tool-only run is valid for requireCompletedRun but throws RunOutputMissing
 * here. Error causes retain the original run for protected diagnostics.
 */
export function requireRunText<T extends RuntimeRunStatus>(run: T): string {
  const completed = requireCompletedRun(run);
  const text = completed.output ?? completed.response;
  if (typeof text !== "string") {
    throw new ApiClientError(`Run ${run.run_id} completed without required text`, {
      type: ApiClientErrorType.Run,
      code: ApiClientErrorCode.RunOutputMissing,
      cause: run,
    });
  }
  return text;
}

/**
 * Require an observed stream completion. Accepts the facade's RunStreamOutcome
 * structurally, keeping core independent of application contracts, and returns
 * the original object with its outcome narrowed. Extra caller diagnostics are
 * retained in cause when rejected. Null or unknown outcomes are incomplete;
 * this check does not validate run identity or collect/require text.
 */
export function requireCompletedStream<T extends { runId: string | null; outcome: string | null }>(
  stream: T,
): T & { outcome: "completed" } {
  if (stream.outcome !== "completed") {
    throw new ApiClientError(`Stream is not completed (outcome: ${stream.outcome ?? "unknown"})`, {
      type: ApiClientErrorType.Run,
      code: outcomeErrorCode(stream.outcome),
      cause: stream,
    });
  }
  return stream as T & { outcome: "completed" };
}

/**
 * Require a completed stream with caller-collected output. Pass a terminal
 * output snapshot or accumulated text as output, leaving it undefined when
 * no text was observed. An explicit empty string is valid. The original
 * stream object, including any supplied diagnostics, is retained in cause.
 * This helper consumes no events and performs no transport operations.
 */
export function requireStreamText<T extends { runId: string | null; outcome: string | null; output?: string }>(
  stream: T,
): string {
  const completed = requireCompletedStream(stream);
  if (typeof completed.output !== "string") {
    throw new ApiClientError("Stream completed without required text", {
      type: ApiClientErrorType.Run,
      code: ApiClientErrorCode.RunOutputMissing,
      cause: stream,
    });
  }
  return completed.output;
}

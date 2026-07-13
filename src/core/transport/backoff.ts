import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../errors.js";
import type { TransportRetryPolicy } from "./types.js";

function requireFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiClientError(`${name} must be a finite non-negative number`, {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
}

export function validateTransportRetryPolicy(policy: TransportRetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new ApiClientError("maxAttempts must be a positive integer", {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  requireFiniteNonNegative(policy.baseDelayMs, "baseDelayMs");
  requireFiniteNonNegative(policy.maxDelayMs, "maxDelayMs");
  if (policy.maxDelayMs < policy.baseDelayMs) {
    throw new ApiClientError("maxDelayMs must be at least baseDelayMs", {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  const jitterRatio = policy.jitterRatio ?? 0;
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
    throw new ApiClientError("jitterRatio must be between 0 and 1", {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  if (policy.deadlineMs !== undefined) {
    requireFiniteNonNegative(policy.deadlineMs, "deadlineMs");
  }
}

export function computeBackoffDelay(
  policy: TransportRetryPolicy,
  attempt: number,
  random: number,
  retryAfterMs?: number,
): number {
  validateTransportRetryPolicy(policy);
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new ApiClientError("attempt must be a positive integer", {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  if (!Number.isFinite(random) || random < 0 || random > 1) {
    throw new ApiClientError("random must be between 0 and 1", {
      type: ApiClientErrorType.Validation,
      code: ApiClientErrorCode.ValidationFailed,
    });
  }
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  const jitterRatio = policy.jitterRatio ?? 0;
  const jittered = exponential * (1 + (random * 2 - 1) * jitterRatio);
  const requested = retryAfterMs === undefined || !Number.isFinite(retryAfterMs)
    ? jittered
    : Math.max(jittered, Math.max(0, retryAfterMs));
  return Math.round(Math.min(policy.maxDelayMs, Math.max(0, requested)));
}

function abortedError(cause?: unknown): ApiClientError {
  return new ApiClientError("Operation aborted", {
    type: ApiClientErrorType.Abort,
    code: ApiClientErrorCode.Aborted,
    cause,
  });
}

export function abortableSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(abortedError(signal.reason));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, Math.max(0, delayMs));
    function finish(): void {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(abortedError(signal?.reason));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function normalizeTransportAbort(signal?: AbortSignal, cause?: unknown): ApiClientError {
  return abortedError(signal?.reason ?? cause);
}

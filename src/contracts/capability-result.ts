import {
  ApiClientErrorCode,
  getErrorCode,
  getErrorStatus,
  isAuthError,
} from "../core/errors.js";
import {
  classifyFallbackError,
  fallbackGap,
} from "../core/gateway/envelope/envelope.js";
import type { ContractGap, ContractGapReason } from "../core/gateway/envelope/types.js";
import { GatewayRpcError } from "../core/gateway/rpc/error.js";

/**
 * Map a gateway RPC wire code (gRPC-style, e.g. `UNAVAILABLE`) onto a gap
 * reason. Auth codes return null → the caller rethrows (carve-out). These are
 * the gateway's own codes, distinct from the `ApiClientErrorCode` enum.
 */
function gatewayRpcCodeReason(code: string): ContractGapReason | null {
  switch (code) {
    case "UNAUTHENTICATED":
    case "PERMISSION_DENIED":
      return null; // auth — rethrow
    case "INVALID_REQUEST":
    case "INVALID_ARGUMENT":
    case "FAILED_PRECONDITION":
      return "request-invalid";
    case "NOT_FOUND":
    case "UNIMPLEMENTED":
      return "endpoint-not-found";
    default:
      // UNAVAILABLE, INTERNAL, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED,
      // and any unknown gateway code → transient backend degradation.
      return "backend-unavailable";
  }
}

/**
 * The non-throwing capability contract (design decision 2026-07-21): every
 * facade method resolves one of these. `ok: false` states honestly that
 * nothing happened and why — there is no mock data and no fabricated success.
 * The only throws left on the facade are auth errors (401/403) and
 * unknown-classified errors, the same carve-outs as `withFallback`.
 */
export type CapabilityResult<T> =
  | { ok: true; data: T; source: "live" }
  | { ok: false; data: null; gap: ContractGap };

export function liveResult<T>(data: T): CapabilityResult<T> {
  return { ok: true, data, source: "live" };
}

export function gapResult<T>(gap: ContractGap): CapabilityResult<T> {
  return { ok: false, data: null, gap };
}

/**
 * Thrown by internal plumbing (e.g. the gateway streamRun bridges) for a
 * caller mistake the transport can name before any request is made. The
 * facade classifies it into a `request-invalid` gap — consumers never see it.
 */
export class CapabilityCallRejected extends Error {
  override readonly name = "CapabilityCallRejected";

  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Classify a failed capability call into a gap, preserving the envelope
 * contract's carve-outs: auth errors and unknown-classified errors rethrow.
 * HTTP 4xx caller errors (except 401/403/404) become `request-invalid`.
 *
 * 404 and 5xx are classified explicitly here rather than left to
 * `classifyFallbackError`: that classifier only recognizes `GatewayHttpError`
 * instances via `instanceof`, so a bare `{ status }` error (as thrown by
 * non-gateway transports) would otherwise fall through as `unknown`.
 * This deliberately diverges from `classifyFallbackError` for the 4xx band
 * (e.g. it reports `GatewayHttpError` 429 as `request-invalid`, not
 * `backend-unavailable`) because 4xx other than 401/403/404 is a caller
 * error, not backend degradation.
 */
export function classifyCapabilityFailure(params: {
  error: unknown;
  area: string;
  expectedContract: string;
  call: string;
}): ContractGap {
  const { error } = params;
  if (isAuthError(error)) throw error;

  // Gateway RPC errors carry gRPC-style wire codes (not `ApiClientErrorCode`
  // enum values), so a control-plane RPC failure must be classified by its
  // code — otherwise it reaches `classifyFallbackError`, classifies `unknown`,
  // and THROWS out of a read (violating the non-throwing contract). Auth codes
  // rethrow (carve-out); everything else degrades to a gap.
  if (error instanceof GatewayRpcError) {
    const reason = gatewayRpcCodeReason(error.code);
    if (reason === null) throw error;
    return fallbackGap(
      params.area,
      params.expectedContract,
      `${params.call} failed: ${errorMessageOf(error)}`,
      reason,
    );
  }

  if (error instanceof CapabilityCallRejected) {
    return fallbackGap(
      params.area,
      params.expectedContract,
      `${params.call} rejected: ${error.message}`,
      "request-invalid",
      error.httpStatus,
    );
  }

  const status = getErrorStatus(error);
  if (status !== undefined) {
    if (status === 404) {
      return fallbackGap(
        params.area,
        params.expectedContract,
        `${params.call} failed: ${errorMessageOf(error)}`,
        "endpoint-not-found",
        status,
      );
    }
    if (status >= 500) {
      return fallbackGap(
        params.area,
        params.expectedContract,
        `${params.call} failed: ${errorMessageOf(error)}`,
        "backend-unavailable",
        status,
      );
    }
    if (status >= 400) {
      // 401/403 already rethrew above via isAuthError.
      return fallbackGap(
        params.area,
        params.expectedContract,
        `${params.call} rejected: ${errorMessageOf(error)}`,
        "request-invalid",
        status,
      );
    }
  }

  // A statusless typed error names a caller-input error the transport caught
  // before (or without) an HTTP round-trip — e.g. `TeamDirectory.requireTeam`
  // throwing `ValidationFailed`. Map those to their gap reason instead of
  // letting `classifyFallbackError` treat them as `unknown` and rethrow.
  // Duck-type the code (as the auth path does via `getErrorCode`) rather than
  // gating on `instanceof ApiClientError`: `GatewayRpcError` is a plain Error
  // subclass carrying the server code verbatim, and it must map the same way.
  // Auth codes already rethrew above via `isAuthError`; transport/config codes
  // intentionally fall through to `classifyFallbackError` unchanged (they are
  // not caller-input errors).
  const code = getErrorCode(error);
  if (
    code === ApiClientErrorCode.ValidationFailed ||
    code === ApiClientErrorCode.InvalidRequest
  ) {
    return fallbackGap(
      params.area,
      params.expectedContract,
      `${params.call} rejected: ${errorMessageOf(error)}`,
      "request-invalid",
    );
  }
  if (code === ApiClientErrorCode.EndpointNotFound) {
    return fallbackGap(
      params.area,
      params.expectedContract,
      `${params.call} failed: ${errorMessageOf(error)}`,
      "endpoint-not-found",
    );
  }

  const classified = classifyFallbackError(error);
  if (classified.reason === "unknown") throw error;
  return fallbackGap(
    params.area,
    params.expectedContract,
    `${params.call} failed: ${classified.message}`,
    classified.reason,
    classified.httpStatus,
  );
}

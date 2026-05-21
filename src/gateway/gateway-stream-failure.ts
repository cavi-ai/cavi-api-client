// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

import { GatewayRpcError } from "./gateway-rpc-error.js";

const TERMINAL_GATEWAY_RPC_CODES = new Set(
  [
    "unauthorized",
    "forbidden",
    "invalid_token",
    "auth_failed",
    "authentication_failed",
    "not_authenticated",
    "not_paired",
    "pairing_required",
    "device_identity_required",
    "origin_not_allowed",
    "socket_policy_violation",
  ].map((c) => c.toLowerCase()),
);

const RETRYABLE_GATEWAY_RPC_CODES = new Set(
  ["socket_error", "socket_closed", "socket_unavailable", "timeout", "closed"].map((c) =>
    c.toLowerCase(),
  ),
);

function isTerminalGatewayRpcError(error: GatewayRpcError): boolean {
  return TERMINAL_GATEWAY_RPC_CODES.has(error.code.trim().toLowerCase());
}

function isAuthLikeStreamError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("authentication") ||
    normalized.includes("pairing required") ||
    normalized.includes("not paired") ||
    normalized.includes("device identity required") ||
    normalized.includes("not authorized") ||
    normalized.includes("401") ||
    normalized.includes("403")
  );
}

function isOriginPolicyLikeStreamError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("origin not allowed") ||
    normalized.includes("gateway.controlui.allowedorigins") ||
    (normalized.includes("code=1008") && normalized.includes("policy"))
  );
}

function isDevicePairingLikeStreamError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("pairing") ||
    normalized.includes("not paired") ||
    normalized.includes("device pairing") ||
    (normalized.includes("device") &&
      (normalized.includes("approve") ||
        normalized.includes("pending") ||
        normalized.includes("pair")))
  );
}

function isTerminalStreamErrorMessage(message: string): boolean {
  return (
    isAuthLikeStreamError(message) ||
    isOriginPolicyLikeStreamError(message) ||
    isDevicePairingLikeStreamError(message)
  );
}

function describeUnknownError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return `${error}`;
  }
  if (typeof error === "symbol") {
    return error.description ? `Symbol(${error.description})` : "Symbol()";
  }
  if (error === undefined) {
    return "undefined";
  }
  if (error === null) {
    return "null";
  }
  try {
    const json = JSON.stringify(error);
    if (typeof json === "string" && json.length > 0) {
      return json;
    }
  } catch {
    // Fall through to a stable object tag when JSON serialization is unavailable.
  }
  return Object.prototype.toString.call(error);
}

export type NormalizedGatewayStreamFailure = {
  state: "idle" | "connecting" | "reconnecting" | "connected" | "error";
  error: string | null;
  retryable: boolean;
};

/**
 * Classifies stream / RPC failures for reconnect vs hard-error UX.
 * GatewayRpcError codes are checked before substring heuristics on messages.
 */
export function normalizeGatewayStreamFailure(error: unknown): NormalizedGatewayStreamFailure {
  if (!error) {
    return { state: "idle", error: null, retryable: false };
  }

  const normalizedError = error instanceof Error ? error : new Error(describeUnknownError(error));

  if (normalizedError instanceof GatewayRpcError && isTerminalGatewayRpcError(normalizedError)) {
    return { state: "error", error: normalizedError.message, retryable: false };
  }

  if (isTerminalStreamErrorMessage(normalizedError.message)) {
    return { state: "error", error: normalizedError.message, retryable: false };
  }

  if (normalizedError instanceof GatewayRpcError) {
    if (RETRYABLE_GATEWAY_RPC_CODES.has(normalizedError.code.trim().toLowerCase())) {
      return { state: "reconnecting", error: normalizedError.message, retryable: true };
    }
  }

  return { state: "reconnecting", error: normalizedError.message, retryable: true };
}

import { GatewayHttpError } from "../../http/gateway-error.js";
import { getErrorMessage } from "../../errors.js";
import type {
  ContractGap,
  ContractGapReason,
  DataEnvelope,
  MutationResult,
} from "./types.js";

export type {
  ConnectivityDomain,
  ConnectivityStatus,
  ContractGap,
  ContractGapReason,
  DataEnvelope,
  DataSourceMode,
  MutationResult,
} from "./types.js";

export function fallbackGap(
  area: string,
  expectedContract: string,
  note: string,
  reason?: ContractGapReason,
  httpStatus?: number,
): ContractGap {
  return {
    area,
    expectedContract,
    note,
    reason,
    httpStatus,
  };
}

function isBackendFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unavailable") ||
    normalized.includes("not available") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error") ||
    normalized.includes("networkerror") ||
    normalized.includes("econn") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("refused")
  );
}

function isTransportFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not connected") ||
    normalized.includes("gateway client not connected") ||
    normalized.includes("socket") ||
    normalized.includes("websocket")
  );
}

export function classifyFallbackError(error: unknown): {
  message: string;
  reason: ContractGapReason;
  httpStatus?: number;
} {
  if (error instanceof GatewayHttpError) {
    if (error.status === 404) {
      return {
        message: "The current gateway does not expose one or more required routes yet.",
        reason: "endpoint-not-found",
        httpStatus: 404,
      };
    }
    if (error.status === 502 || error.status === 503) {
      return {
        message: `Backend unavailable (${error.status}).`,
        reason: "backend-unavailable",
        httpStatus: error.status,
      };
    }
    return {
      message: `Gateway request failed with ${error.status}.`,
      reason: "backend-unavailable",
      httpStatus: error.status,
    };
  }

  const msg = getErrorMessage(error);
  // Gateway returns `unknown method: …` when the running binary predates a WS handler.
  // Treat as unavailable so dashboards degrade to mock data + contract gap instead of hard-failing queries.
  if (/unknown method\b/i.test(msg)) {
    return {
      message: `Gateway RPC not supported: ${msg}`,
      reason: "backend-unavailable",
    };
  }
  if (isTransportFailureMessage(msg)) {
    return {
      message: `Transport disconnected: ${msg}.`,
      reason: "transport-disconnected",
    };
  }
  if (isBackendFailureMessage(msg)) {
    return {
      message: error instanceof TypeError
        ? "The gateway request failed before a response was received."
        : `Backend unavailable: ${msg}.`,
      reason: "backend-unavailable",
    };
  }
  if (error instanceof TypeError) {
    return {
      message: `Runtime: ${msg}.`,
      reason: "unknown",
    };
  }

  return {
    message: `Runtime: ${msg}.`,
    reason: "unknown",
  };
}

export async function withFallback<TData>(params: {
  run: () => Promise<TData>;
  fallback: TData;
  area: string;
  expectedContract: string;
  note: string;
}): Promise<DataEnvelope<TData>> {
  try {
    const data = await params.run();
    return {
      data,
      source: "gateway",
      fetchedAt: Date.now(),
      contractGaps: [],
    };
  } catch (error) {
    if (
      error instanceof GatewayHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }

    const classified = classifyFallbackError(error);
    if (classified.reason === "unknown") {
      throw error;
    }
    return {
      data: params.fallback,
      source: "mock",
      fetchedAt: Date.now(),
      contractGaps: [
        fallbackGap(
          params.area,
          params.expectedContract,
          `${params.note}. ${classified.message}`,
          classified.reason,
          classified.httpStatus,
        ),
      ],
    };
  }
}

export async function withMutationResult<TData>(params: {
  run: () => Promise<TData>;
  fallback: () => TData;
  area: string;
  expectedContract: string;
  note: string;
}): Promise<MutationResult<TData>> {
  try {
    const data = await params.run();
    return {
      data,
      source: "gateway",
      appliedAt: Date.now(),
      contractGaps: [],
    };
  } catch (error) {
    if (
      error instanceof GatewayHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    const classified = classifyFallbackError(error);
    if (classified.reason === "unknown") {
      const reason = getErrorMessage(error);
      throw new Error(
        `${params.note}. ${params.expectedContract} unavailable: ${reason}`,
        { cause: error },
      );
    }
    return {
      data: params.fallback(),
      source: "mock",
      appliedAt: Date.now(),
      contractGaps: [
        fallbackGap(
          params.area,
          params.expectedContract,
          `${params.note}. ${classified.message}`,
          classified.reason,
          classified.httpStatus,
        ),
      ],
    };
  }
}

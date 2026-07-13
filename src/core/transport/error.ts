import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../errors.js";
import type { TransportKind, TransportPhase } from "./types.js";

export type TransportErrorMetadata = Readonly<{
  kind: TransportKind;
  phase: TransportPhase;
  operation: string;
  retryable: boolean;
  attempt: number;
  status?: number;
  code?: string | number;
  retryAfterMs?: number;
}>;

const kinds = new Set<TransportKind>(["http", "sse", "websocket", "json-rpc", "stdio", "unix"]);
const phases = new Set<TransportPhase>(["configure", "authenticate", "connect", "request", "decode", "close"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getTransportErrorMetadata(error: unknown): TransportErrorMetadata | undefined {
  if (!isRecord(error) || !isRecord(error.transport)) return undefined;
  const { kind, phase, operation, retryable, attempt, status, code, retryAfterMs } = error.transport;
  if (
    typeof kind !== "string" || !kinds.has(kind as TransportKind) ||
    typeof phase !== "string" || !phases.has(phase as TransportPhase) ||
    typeof operation !== "string" || operation.trim().length === 0 ||
    typeof retryable !== "boolean" ||
    typeof attempt !== "number" || !Number.isInteger(attempt) || attempt < 1 ||
    (status !== undefined && (typeof status !== "number" || !Number.isFinite(status))) ||
    (code !== undefined && typeof code !== "string" && typeof code !== "number") ||
    (typeof code === "number" && !Number.isFinite(code)) ||
    (retryAfterMs !== undefined &&
      (typeof retryAfterMs !== "number" || !Number.isFinite(retryAfterMs) || retryAfterMs < 0))
  ) return undefined;
  return error.transport as TransportErrorMetadata;
}

export class TransportError extends ApiClientError {
  readonly transport: TransportErrorMetadata;

  constructor(message: string, options: { metadata: TransportErrorMetadata; cause?: unknown }) {
    super(message, {
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.TransportUnavailable,
      cause: options.cause,
    });
    this.name = "TransportError";
    this.transport = Object.freeze({ ...options.metadata });
  }
}

export enum ApiClientErrorType {
  Unknown = "unknown",
  Validation = "validation",
  Configuration = "configuration",
  Http = "http",
  GatewayHttp = "gateway_http",
  GatewayRpc = "gateway_rpc",
  Transport = "transport",
  Timeout = "timeout",
  Abort = "abort",
  BackendUnavailable = "backend_unavailable",
  Auth = "auth",
}

export enum ApiClientErrorCode {
  Unknown = "unknown",
  ValidationFailed = "validation_failed",
  InvalidConfig = "invalid_config",
  InvalidJson = "invalid_json",
  HttpRequestFailed = "http_request_failed",
  GatewayError = "gateway_error",
  RequestFailed = "request_failed",
  Timeout = "timeout",
  Aborted = "aborted",
  SocketError = "socket_error",
  SocketClosed = "socket_closed",
  SocketUnavailable = "socket_unavailable",
  ConnectFailed = "connect_failed",
  BackendUnavailable = "backend_unavailable",
  EndpointNotFound = "endpoint_not_found",
  ProtocolMismatch = "protocol_mismatch",
  AuthRequired = "auth_required",
  AuthForbidden = "auth_forbidden",
  CapabilityUnavailable = "capability_unavailable",
  PermissionDenied = "permission_denied",
  InvalidRequest = "invalid_request",
  Conflict = "conflict",
  RateLimited = "rate_limited",
  TransportUnavailable = "transport_unavailable",
  TransportProtocolError = "transport_protocol_error",
  ServerOverloaded = "server_overloaded",
}

export type RuntimeErrorMetadata = {
  provider: string;
  transport: string;
  operation: string;
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;
  providerCode?: string;
};

export type ApiClientErrorOptions = {
  type?: ApiClientErrorType | string;
  code?: ApiClientErrorCode | string;
  cause?: unknown;
  runtime?: RuntimeErrorMetadata;
};

export type SerializedApiClientError = {
  name: string;
  message: string;
  type?: string;
  code?: string;
};

export class ApiClientError extends Error {
  readonly type: ApiClientErrorType | string;
  readonly code: ApiClientErrorCode | string;
  readonly runtime?: RuntimeErrorMetadata;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApiClientError";
    this.type = options.type ?? ApiClientErrorType.Unknown;
    this.code = options.code ?? ApiClientErrorCode.Unknown;
    this.runtime = options.runtime;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const raw = value[key];
  return typeof raw === "string" && raw.trim() ? raw : undefined;
}

export function getRuntimeErrorMetadata(error: unknown): RuntimeErrorMetadata | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const runtime = error.runtime;
  if (!isRecord(runtime) || Array.isArray(runtime)) {
    return undefined;
  }
  const { provider, transport, operation, retryable, retryAfterMs, status, providerCode } = runtime;
  if (
    typeof provider !== "string" || !provider.trim() ||
    typeof transport !== "string" || !transport.trim() ||
    typeof operation !== "string" || !operation.trim() ||
    typeof retryable !== "boolean" ||
    (retryAfterMs !== undefined &&
      (typeof retryAfterMs !== "number" || !Number.isFinite(retryAfterMs))) ||
    (status !== undefined && (typeof status !== "number" || !Number.isFinite(status))) ||
    (providerCode !== undefined && typeof providerCode !== "string")
  ) {
    return undefined;
  }
  return runtime as RuntimeErrorMetadata;
}

export function stringifyUnknownError(error: unknown): string {
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

export function getErrorMessage(error: unknown, fallbackMessage = "Unknown error"): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const message = stringifyUnknownError(error).trim();
  return message || fallbackMessage;
}

export function getErrorCode(error: unknown): string | undefined {
  return readStringProperty(error, "code");
}

export function getErrorType(error: unknown): string | undefined {
  return readStringProperty(error, "type");
}

export function toError(error: unknown, fallbackMessage = "Unknown error"): Error {
  if (error instanceof Error) {
    return error;
  }
  return new ApiClientError(getErrorMessage(error, fallbackMessage), {
    type: ApiClientErrorType.Unknown,
    code: ApiClientErrorCode.Unknown,
    cause: error,
  });
}

export function isAbortError(error: unknown): boolean {
  const type = getErrorType(error);
  const code = getErrorCode(error);
  const name = readStringProperty(error, "name");
  return (
    type === ApiClientErrorType.Abort ||
    code === ApiClientErrorCode.Aborted ||
    code === "ABORT_ERR" ||
    name === "AbortError"
  );
}

/**
 * HTTP status carried by a typed transport error (`HttpApiError`,
 * `GatewayHttpError`, or any error exposing a numeric `status`). `undefined`
 * for non-HTTP failures (transport, abort, RPC) so callers branch on the value,
 * never on the message string.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const status = error.status;
  return typeof status === "number" && Number.isFinite(status) ? status : undefined;
}

/**
 * True when an error is an authentication/authorization failure (HTTP 401/403,
 * or a synthesized `Auth`-typed/`auth_required`/`auth_forbidden` error). Use
 * this to trigger token refresh or re-auth instead of inspecting `.status`
 * inline at every call site.
 */
export function isAuthError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) {
    return true;
  }
  if (getErrorType(error) === ApiClientErrorType.Auth) {
    return true;
  }
  const code = getErrorCode(error);
  return (
    code === ApiClientErrorCode.AuthRequired ||
    code === ApiClientErrorCode.AuthForbidden
  );
}

/**
 * True when an error is a synthesized `EndpointNotFound` failure — the
 * everyday cross-provider branch for a surface a provider declares
 * unsupported (Gemini `getRun`/`cancelRun`, OpenClaw wiki/media).
 */
export function isEndpointNotFoundError(error: unknown): boolean {
  return getErrorCode(error) === ApiClientErrorCode.EndpointNotFound;
}

export function serializeError(
  error: unknown,
  fallbackMessage = "Unknown error",
): SerializedApiClientError {
  const normalized = toError(error, fallbackMessage);
  const result: SerializedApiClientError = {
    name: normalized.name || "Error",
    message: getErrorMessage(normalized, fallbackMessage),
  };
  const type = getErrorType(normalized);
  if (type) {
    result.type = type;
  }
  const code = getErrorCode(normalized);
  if (code) {
    result.code = code;
  }
  return result;
}

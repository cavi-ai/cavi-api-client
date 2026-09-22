# @cavi-ai/api-client/core/errors

Package subpath: ./core/errors

<a id="symbol-core-errors-apiclienterror"></a>

## ApiClientError

Kind: class

```ts
export declare class ApiClientError extends Error {
    readonly type: ApiClientErrorType | string;
    readonly code: ApiClientErrorCode | string;
    readonly runtime?: RuntimeErrorMetadata;
    constructor(message: string, options?: ApiClientErrorOptions);
}
```

<a id="symbol-core-errors-apiclienterrorcode"></a>

## ApiClientErrorCode

Kind: enum

```ts
export declare enum ApiClientErrorCode {
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
    ServerOverloaded = "server_overloaded"
}
```

<a id="symbol-core-errors-apiclienterroroptions"></a>

## ApiClientErrorOptions

Kind: type

```ts
export type ApiClientErrorOptions = {
    type?: ApiClientErrorType | string;
    code?: ApiClientErrorCode | string;
    cause?: unknown;
    runtime?: RuntimeErrorMetadata;
};
```

<a id="symbol-core-errors-apiclienterrortype"></a>

## ApiClientErrorType

Kind: enum

```ts
export declare enum ApiClientErrorType {
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
    Auth = "auth"
}
```

<a id="symbol-core-errors-geterrorcode"></a>

## getErrorCode

Kind: function

```ts
export declare function getErrorCode(error: unknown): string | undefined;
```

<a id="symbol-core-errors-geterrormessage"></a>

## getErrorMessage

Kind: function

```ts
export declare function getErrorMessage(error: unknown, fallbackMessage?: string): string;
```

<a id="symbol-core-errors-geterrorstatus"></a>

## getErrorStatus

Kind: function

```ts
/**
 * HTTP status carried by a typed transport error (`HttpApiError`,
 * `GatewayHttpError`, or any error exposing a numeric `status`). `undefined`
 * for non-HTTP failures (transport, abort, RPC) so callers branch on the value,
 * never on the message string.
 */
export declare function getErrorStatus(error: unknown): number | undefined;
```

<a id="symbol-core-errors-geterrortype"></a>

## getErrorType

Kind: function

```ts
export declare function getErrorType(error: unknown): string | undefined;
```

<a id="symbol-core-errors-getruntimeerrormetadata"></a>

## getRuntimeErrorMetadata

Kind: function

```ts
export declare function getRuntimeErrorMetadata(error: unknown): RuntimeErrorMetadata | undefined;
```

<a id="symbol-core-errors-isaborterror"></a>

## isAbortError

Kind: function

```ts
export declare function isAbortError(error: unknown): boolean;
```

<a id="symbol-core-errors-isautherror"></a>

## isAuthError

Kind: function

```ts
/**
 * True when an error is an authentication/authorization failure (HTTP 401/403,
 * or a synthesized `Auth`-typed/`auth_required`/`auth_forbidden` error). Use
 * this to trigger token refresh or re-auth instead of inspecting `.status`
 * inline at every call site.
 */
export declare function isAuthError(error: unknown): boolean;
```

<a id="symbol-core-errors-isendpointnotfounderror"></a>

## isEndpointNotFoundError

Kind: function

```ts
/**
 * True when an error is a synthesized `EndpointNotFound` failure — the
 * everyday cross-provider branch for a surface a provider declares
 * unsupported (Gemini `getRun`/`cancelRun`, OpenClaw wiki/media).
 */
export declare function isEndpointNotFoundError(error: unknown): boolean;
```

<a id="symbol-core-errors-runtimeerrormetadata"></a>

## RuntimeErrorMetadata

Kind: type

```ts
export type RuntimeErrorMetadata = {
    provider: string;
    transport: string;
    operation: string;
    retryable: boolean;
    retryAfterMs?: number;
    status?: number;
    providerCode?: string;
};
```

<a id="symbol-core-errors-serializedapiclienterror"></a>

## SerializedApiClientError

Kind: type

```ts
export type SerializedApiClientError = {
    name: string;
    message: string;
    type?: string;
    code?: string;
};
```

<a id="symbol-core-errors-serializeerror"></a>

## serializeError

Kind: function

```ts
export declare function serializeError(error: unknown, fallbackMessage?: string): SerializedApiClientError;
```

<a id="symbol-core-errors-stringifyunknownerror"></a>

## stringifyUnknownError

Kind: function

```ts
export declare function stringifyUnknownError(error: unknown): string;
```

<a id="symbol-core-errors-toerror"></a>

## toError

Kind: function

```ts
export declare function toError(error: unknown, fallbackMessage?: string): Error;
```

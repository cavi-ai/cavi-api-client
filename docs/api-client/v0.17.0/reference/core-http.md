# @cavi-ai/api-client/core/http

Package subpath: ./core/http

<a id="symbol-core-http-apikeycredentialoptions"></a>

## ApiKeyCredentialOptions

Kind: type

```ts
export type ApiKeyCredentialOptions = {
    /** Header name for the key. Defaults to "Authorization". */
    header?: string;
    /** Extra static headers (e.g. { "anthropic-version": "2023-06-01" }). */
    extra?: Record<string, string>;
};
```

<a id="symbol-core-http-apikeycredentials"></a>

## apiKeyCredentials

Kind: function

```ts
/** API-key scheme (e.g. Anthropic: header "x-api-key" + "anthropic-version"). */
export declare function apiKeyCredentials(key: string, options?: ApiKeyCredentialOptions): CredentialResolver;
```

<a id="symbol-core-http-basehttpapiclient"></a>

## BaseHttpApiClient

Kind: class

```ts
export declare class BaseHttpApiClient {
    readonly surface: HttpApiTrace["surface"];
    readonly baseUrl: string;
    readonly basePath: string;
    readonly authToken: string;
    readonly clientId: string;
    readonly sendsPortalClientId: boolean;
    readonly defaultHeaders: Record<string, string>;
    readonly resolveAuthHeaders?: () => Record<string, string>;
    readonly defaultTimeoutMs: number;
    readonly cache: RequestCache;
    readonly credentials?: RequestCredentials;
    private readonly fetchImpl;
    private readonly onTrace?;
    constructor(surface: HttpApiTrace["surface"], options: HttpApiClientOptions);
    protected resolvePath(path: string): string;
    protected resolveUrl(path: string): string;
    protected buildHeaders(init?: HttpApiRequestInit): Record<string, string>;
    protected buildBody(init?: HttpApiRequestInit): BodyInit | undefined;
    protected buildFetchInit(method: HttpApiHttpMethod, headers: Record<string, string>, body: BodyInit | undefined, signal: AbortSignal, init?: HttpApiRequestInit): RequestInit;
    protected emitTrace(trace: HttpApiTrace): void;
    protected requestRaw(path: string, init?: HttpApiRequestInit): Promise<Response>;
    protected requestJson<TResponse>(path: string, init?: HttpApiRequestInit): Promise<TResponse>;
    protected requestBlob(path: string, init?: HttpApiRequestInit): Promise<Blob>;
    createTransport(): HttpApiTransport;
}
```

<a id="symbol-core-http-bearercredentials"></a>

## bearerCredentials

Kind: function

```ts
/** Standard bearer scheme. Emits nothing when the token is empty. */
export declare function bearerCredentials(token: string | null | undefined): CredentialResolver;
```

<a id="symbol-core-http-buildgatewayhttperror"></a>

## buildGatewayHttpError

Kind: function

```ts
export declare function buildGatewayHttpError(params: {
    label: string;
    status: number;
    statusText: string;
    message?: string | null;
    code?: string | null;
}): GatewayHttpError;
```

<a id="symbol-core-http-cleangatewayerrortext"></a>

## cleanGatewayErrorText

Kind: function

```ts
export declare function cleanGatewayErrorText(value: unknown): string | null;
```

<a id="symbol-core-http-createjsonhttprequest"></a>

## createJsonHttpRequest

Kind: function

```ts
export declare function createJsonHttpRequest(opts: {
    surface: HttpApiTrace["surface"];
    httpBase: string;
    authToken: string | null;
    clientId?: string | null;
    defaultHeaders?: Record<string, string>;
    credentials?: RequestCredentials;
    cache?: RequestCache;
}): JsonHttpRequest;
```

<a id="symbol-core-http-createrawhttpapiclient"></a>

## createRawHttpApiClient

Kind: function

```ts
export declare function createRawHttpApiClient(params: {
    surface: HttpApiTrace["surface"];
    baseUrl: string;
    authToken: string | null;
    clientId?: string | null;
    defaultHeaders?: Record<string, string>;
    credentials?: RequestCredentials;
    cache?: RequestCache;
    fetchImpl?: typeof fetch;
}): RawHttpApiClient;
```

<a id="symbol-core-http-credentialheaders"></a>

## CredentialHeaders

Kind: type

```ts
/** Auth headers a credential resolver contributes to a request. */
export type CredentialHeaders = Record<string, string>;
```

<a id="symbol-core-http-credentialresolver"></a>

## CredentialResolver

Kind: type

```ts
/**
 * Provider-supplied auth scheme. Returns the headers to merge onto a request.
 * Closes over whatever secret the provider needs (token, api key, cookie).
 */
export type CredentialResolver = () => CredentialHeaders;
```

<a id="symbol-core-http-default-preview-max-chars"></a>

## DEFAULT_PREVIEW_MAX_CHARS

Kind: variable

```ts
export declare const DEFAULT_PREVIEW_MAX_CHARS = 12000;
```

<a id="symbol-core-http-describehttpcontract"></a>

## describeHttpContract

Kind: function

```ts
/** Human-readable HTTP contract line for envelopes and diagnostics. */
export declare function describeHttpContract(method: string, path: string, bodyHint?: string): string;
```

<a id="symbol-core-http-extractgatewayerrordetails"></a>

## extractGatewayErrorDetails

Kind: function

```ts
export declare function extractGatewayErrorDetails(payload: unknown): {
    message: string | null;
    code: string | null;
};
```

<a id="symbol-core-http-gatewayhttperror"></a>

## GatewayHttpError

Kind: class

```ts
export declare class GatewayHttpError extends Error {
    readonly type = ApiClientErrorType.GatewayHttp;
    readonly status: number;
    readonly code: string | null;
    constructor(message: string, status: number, code?: string | null);
}
```

<a id="symbol-core-http-httpapiclientauth"></a>

## HttpApiClientAuth

Kind: type

```ts
export type HttpApiClientAuth = {
    bearerToken?: string | null;
    clientId?: string | null;
    /**
     * Provider-supplied auth scheme. When present, its headers replace the
     * default bearer Authorization header. See core/http/credentials.ts.
     */
    resolveHeaders?: CredentialResolver;
};
```

<a id="symbol-core-http-httpapiclientoptions"></a>

## HttpApiClientOptions

Kind: type

```ts
export type HttpApiClientOptions = {
    baseUrl: string;
    basePath?: string;
    allowRelativeBaseUrl?: boolean;
    defaultHeaders?: Record<string, string>;
    /** Send the X-Portal-Client-Id header. Default true; set false for non-gateway backends. */
    includePortalClientIdHeader?: boolean;
    auth?: HttpApiClientAuth;
    defaultTimeoutMs?: number;
    fetchImpl?: typeof fetch;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    onTrace?: (trace: HttpApiTrace) => void;
};
```

<a id="symbol-core-http-httpapiclientsurface"></a>

## HttpApiClientSurface

Kind: type

```ts
export type HttpApiClientSurface = string;
```

<a id="symbol-core-http-httpapierror"></a>

## HttpApiError

Kind: class

```ts
export declare class HttpApiError extends Error {
    readonly type = ApiClientErrorType.Http;
    readonly code = ApiClientErrorCode.HttpRequestFailed;
    readonly path: string;
    readonly url: string;
    readonly method: HttpApiHttpMethod;
    readonly status: number;
    readonly body: string;
    constructor(params: {
        message: string;
        path: string;
        url: string;
        method: HttpApiHttpMethod;
        status: number;
        body: string;
    });
}
```

<a id="symbol-core-http-httpapihttpmethod"></a>

## HttpApiHttpMethod

Kind: type

```ts
export type HttpApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
```

<a id="symbol-core-http-httpapirequestinit"></a>

## HttpApiRequestInit

Kind: type

```ts
export type HttpApiRequestInit = {
    method?: HttpApiHttpMethod;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    idempotencyKey?: string;
    cache?: RequestCache;
    credentials?: RequestCredentials;
};
```

<a id="symbol-core-http-httpapitrace"></a>

## HttpApiTrace

Kind: type

```ts
export type HttpApiTrace = {
    at: number;
    surface: HttpApiClientSurface;
    method: HttpApiHttpMethod;
    path: string;
    url: string;
    ok: boolean;
    status?: number;
    durationMs: number;
    error?: string;
};
```

<a id="symbol-core-http-httpapitransport"></a>

## HttpApiTransport

Kind: type

```ts
export type HttpApiTransport = <TResponse>(path: string, init?: HttpApiRequestInit) => Promise<TResponse>;
```

<a id="symbol-core-http-idempotency-key-header"></a>

## IDEMPOTENCY_KEY_HEADER

Kind: variable

```ts
export declare const IDEMPOTENCY_KEY_HEADER: "Idempotency-Key";
```

<a id="symbol-core-http-isgatewayhttperror"></a>

## isGatewayHttpError

Kind: function

```ts
export declare function isGatewayHttpError(error: unknown): error is GatewayHttpError;
```

<a id="symbol-core-http-ishttpapierror"></a>

## isHttpApiError

Kind: function

```ts
export declare function isHttpApiError(error: unknown): error is HttpApiError;
```

<a id="symbol-core-http-issensitivekey"></a>

## isSensitiveKey

Kind: function

```ts
export declare function isSensitiveKey(key: string): boolean;
```

<a id="symbol-core-http-isvalidportalclientid"></a>

## isValidPortalClientId

Kind: function

```ts
export declare function isValidPortalClientId(value: string | null | undefined): boolean;
```

<a id="symbol-core-http-jsonhttpapiclient"></a>

## JsonHttpApiClient

Kind: class

```ts
export declare class JsonHttpApiClient extends BaseHttpApiClient {
    request<TData>(path: string, init?: HttpApiRequestInit): Promise<TData>;
    private requestJsonBody;
}
```

<a id="symbol-core-http-jsonhttprequest"></a>

## JsonHttpRequest

Kind: type

```ts
export type JsonHttpRequest = <TData>(path: string, init?: HttpApiRequestInit) => Promise<TData>;
```

<a id="symbol-core-http-normalizeportalclientid"></a>

## normalizePortalClientId

Kind: function

```ts
export declare function normalizePortalClientId(value: string | null | undefined): string | null;
```

<a id="symbol-core-http-parsegatewayerrortext"></a>

## parseGatewayErrorText

Kind: function

```ts
export declare function parseGatewayErrorText(text: string, contentType: string): {
    message: string | null;
    code: string | null;
};
```

<a id="symbol-core-http-portal-client-id-header"></a>

## PORTAL_CLIENT_ID_HEADER

Kind: variable

```ts
export declare const PORTAL_CLIENT_ID_HEADER: "X-Portal-Client-Id";
```

<a id="symbol-core-http-rawhttpapiclient"></a>

## RawHttpApiClient

Kind: class

```ts
export declare class RawHttpApiClient extends BaseHttpApiClient {
    raw(path: string, init?: HttpApiRequestInit): Promise<Response>;
}
```

<a id="symbol-core-http-redaction-placeholder"></a>

## REDACTION_PLACEHOLDER

Kind: variable

```ts
/**
 * Single source of truth for scrubbing secrets out of values, text, and config
 * keys before they are logged, previewed, or rendered.
 *
 * Gateway-agnostic: the same sensitivity rule governs HTTP request/response
 * previews and config-path filtering so the two can never drift apart.
 */
export declare const REDACTION_PLACEHOLDER = "[REDACTED]";
```

<a id="symbol-core-http-redactpreviewtext"></a>

## redactPreviewText

Kind: function

```ts
export declare function redactPreviewText(text: string, maxChars?: number): string;
```

<a id="symbol-core-http-redactsensitivetext"></a>

## redactSensitiveText

Kind: function

```ts
export declare function redactSensitiveText(text: string): string;
```

<a id="symbol-core-http-redactsensitivevalue"></a>

## redactSensitiveValue

Kind: function

```ts
export declare function redactSensitiveValue(value: unknown): unknown;
```

<a id="symbol-core-http-requireportalclientid"></a>

## requirePortalClientId

Kind: function

```ts
export declare function requirePortalClientId(value: string | null | undefined): string;
```

<a id="symbol-core-http-sensitive-key-pattern"></a>

## SENSITIVE_KEY_PATTERN

Kind: variable

```ts
/**
 * Matches a key segment that names a credential. Segments may be separated by
 * `.`, `_`, or `-` (e.g. `model.api_key`, `auth-token`, `refreshToken`).
 */
export declare const SENSITIVE_KEY_PATTERN: RegExp;
```

<a id="symbol-core-http-stringifyredacted"></a>

## stringifyRedacted

Kind: function

```ts
export declare function stringifyRedacted(value: unknown, maxChars?: number): string | undefined;
```

<a id="symbol-core-http-tohttprequestinit"></a>

## toHttpRequestInit

Kind: function

```ts
export declare function toHttpRequestInit(init: RequestInit | undefined, headers?: Record<string, string>): HttpApiRequestInit;
```

<a id="symbol-core-http-withquery"></a>

## withQuery

Kind: function

```ts
export declare function withQuery(path: string, params: Record<string, string | number | undefined>): string;
```

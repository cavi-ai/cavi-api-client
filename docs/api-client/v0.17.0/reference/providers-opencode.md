# @cavi-ai/api-client/providers/opencode

Package subpath: ./providers/opencode

<a id="symbol-providers-opencode-createopencodeprovidermodule"></a>

## createOpenCodeProviderModule

Kind: function

```ts
export declare function createOpenCodeProviderModule(config: OpenCodeApiClientOptions): OpenCodeProviderModule;
```

<a id="symbol-providers-opencode-encodeopencodesessionid"></a>

## encodeOpenCodeSessionId

Kind: function

```ts
/** Validate and URL-encode a dynamic OpenCode session identifier. */
export declare function encodeOpenCodeSessionId(sessionId: unknown): string;
```

<a id="symbol-providers-opencode-opencode-endpoint-family"></a>

## OPENCODE_ENDPOINT_FAMILY

Kind: variable

```ts
/** The route and transport family used by `opencode serve`. */
export declare const OPENCODE_ENDPOINT_FAMILY: "legacy-http-sse";
```

<a id="symbol-providers-opencode-opencode-openapi-sha256"></a>

## OPENCODE_OPENAPI_SHA256

Kind: variable

```ts
/** SHA-256 of the verified live OpenCode OpenAPI document. */
export declare const OPENCODE_OPENAPI_SHA256: "46db986090aae41846cd6dbe16225a1d883f0bbcb4c48814008d3f6ce140aa5c";
```

<a id="symbol-providers-opencode-opencode-runtime-support"></a>

## OPENCODE_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const OPENCODE_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-opencode-opencode-server-version"></a>

## OPENCODE_SERVER_VERSION

Kind: variable

```ts
/** The OpenCode server release whose legacy HTTP/SSE contract is supported. */
export declare const OPENCODE_SERVER_VERSION: "1.18.27";
```

<a id="symbol-providers-opencode-opencodeapiclient"></a>

## OpenCodeApiClient

Kind: class

```ts
export declare class OpenCodeApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    readonly scope: OpenCodeScope;
    private readonly defaultModel?;
    private readonly configuredPassword;
    private readonly authSecrets;
    private readonly runStore;
    private healthPromise?;
    constructor(options: OpenCodeApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    probeHealth(): Promise<OpenCodeHealthResponse>;
    private ensureHealth;
    private requestChecked;
    private cleanupSession;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    private modelString;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
}
```

<a id="symbol-providers-opencode-opencodeapiclientoptions"></a>

## OpenCodeApiClientOptions

Kind: type

```ts
export type OpenCodeApiClientOptions = {
    baseUrl: string;
    scope: OpenCodeScope;
    username?: string;
    password?: string;
    defaultModel?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
    defaultTimeoutMs?: number;
    cache?: RequestCache;
    credentials?: RequestCredentials;
};
```

<a id="symbol-providers-opencode-opencodescope"></a>

## OpenCodeScope

Kind: type

```ts
export type OpenCodeScope = {
    directory: string;
    workspace?: string;
};
```

<a id="symbol-providers-opencode-validateopencodescope"></a>

## validateOpenCodeScope

Kind: function

```ts
/**
 * Validate a request scope while preserving the caller's path strings exactly.
 * Whitespace is used only for presence checks; path normalization is not part
 * of the OpenCode protocol contract.
 */
export declare function validateOpenCodeScope(scope: unknown): OpenCodeScope;
```

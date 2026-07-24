# @cavi-ai/api-client/providers/codex/runtime

Package subpath: ./providers/codex/runtime

<a id="symbol-providers-codex-runtime-buildcodexresponsebody"></a>

## buildCodexResponseBody

Kind: function

```ts
/** Build the OpenAI Responses request body from the universal run-start body. */
export declare function buildCodexResponseBody(body: RuntimeRunStartBody, defaultModel: string, options?: {
    background?: boolean;
    store?: boolean;
    stream?: boolean;
}): Record<string, unknown>;
```

<a id="symbol-providers-codex-runtime-codex-runtime-support"></a>

## CODEX_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const CODEX_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-codex-runtime-codexapiclient"></a>

## CodexApiClient

Kind: class

```ts
export declare class CodexApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly defaultModel;
    private readonly files;
    constructor(options: CodexApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
    getBatch(batchId: string): Promise<RuntimeBatchStatus>;
    cancelBatch(batchId: string): Promise<RuntimeBatchStatus>;
    getBatchResults(batchId: string): Promise<RuntimeBatchResult[]>;
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
}
```

<a id="symbol-providers-codex-runtime-codexapiclientoptions"></a>

## CodexApiClientOptions

Kind: type

```ts
export type CodexApiClientOptions = {
    /** OpenAI API key. Keep this backend-owned; do not expose it to browsers/mobile clients. */
    apiKey: string;
    /** Default model when a run does not specify one. */
    defaultModel?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
    defaultTimeoutMs?: number;
};
```

<a id="symbol-providers-codex-runtime-createcodexprovidermodule"></a>

## createCodexProviderModule

Kind: function

```ts
export declare function createCodexProviderModule(config: CodexApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-codex-runtime-mapopenairesponsestreamevent"></a>

## mapOpenAIResponseStreamEvent

Kind: function

```ts
export declare function mapOpenAIResponseStreamEvent(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-codex-runtime-mapopenairesponsetorunstatus"></a>

## mapOpenAIResponseToRunStatus

Kind: function

```ts
/** Map an OpenAI Response object to the canonical run status (incl. normalized tokens). */
export declare function mapOpenAIResponseToRunStatus(response: OpenAIResponse): RuntimeRunStatus;
```

<a id="symbol-providers-codex-runtime-readopenairesponserunid"></a>

## readOpenAIResponseRunId

Kind: function

```ts
export declare function readOpenAIResponseRunId(sse: SseMessage): string | null;
```

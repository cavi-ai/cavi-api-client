# @cavi-ai/api-client/providers/gemini/runtime

Package subpath: ./providers/gemini/runtime

<a id="symbol-providers-gemini-runtime-buildgeminirequestbody"></a>

## buildGeminiRequestBody

Kind: function

```ts
/**
 * Build the Gemini request body from the universal run-start body. Full role
 * fidelity: `system`-role array messages and `instructions` both feed
 * `systemInstruction`; `assistant`->`model`, everything else->`user`. Throws
 * ValidationFailed if no model is resolvable.
 */
export declare function buildGeminiRequestBody(body: RuntimeRunStartBody, defaultModel?: string): {
    model: string;
    payload: Record<string, unknown>;
};
```

<a id="symbol-providers-gemini-runtime-creategeminiprovidermodule"></a>

## createGeminiProviderModule

Kind: function

```ts
export declare function createGeminiProviderModule(config: GeminiApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-gemini-runtime-gemini-runtime-support"></a>

## GEMINI_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const GEMINI_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-gemini-runtime-geminiapiclient"></a>

## GeminiApiClient

Kind: class

```ts
export declare class GeminiApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly defaultModel?;
    private readonly files;
    private readonly runStore;
    constructor(options: GeminiApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
    getBatch(batchId: string): Promise<RuntimeBatchStatus>;
    cancelBatch(batchId: string): Promise<RuntimeBatchStatus>;
    getBatchResults(batchId: string): Promise<RuntimeBatchResult[]>;
    private readBatchModel;
}
```

<a id="symbol-providers-gemini-runtime-geminiapiclientoptions"></a>

## GeminiApiClientOptions

Kind: type

```ts
export type GeminiApiClientOptions = {
    /** Gemini Developer API (AI Studio) key. Keep backend-owned; do not embed in browsers/mobile. */
    apiKey: string;
    /** Default model when a run does not specify one. No id ships by default. */
    defaultModel?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
};
```

<a id="symbol-providers-gemini-runtime-mapgeministreamchunk"></a>

## mapGeminiStreamChunk

Kind: function

```ts
/** Map one Gemini SSE chunk to a MESSAGE_DELTA, or null when it carries no text. */
export declare function mapGeminiStreamChunk(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-gemini-runtime-readgeminifinishreason"></a>

## readGeminiFinishReason

Kind: function

```ts
/** Return the first candidate's finishReason, if the chunk is terminal. */
export declare function readGeminiFinishReason(sse: SseMessage): string | null;
```

<a id="symbol-providers-gemini-runtime-readgeministreamusage"></a>

## readGeminiStreamUsage

Kind: function

```ts
/** Extract the flat usageMetadata numbers from a chunk, if present. */
export declare function readGeminiStreamUsage(sse: SseMessage): Record<string, number> | null;
```

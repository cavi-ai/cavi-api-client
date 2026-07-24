# @cavi-ai/api-client/providers/gemini

Package subpath: ./providers/gemini

<a id="symbol-providers-gemini-buildgeminibatchinlineentries"></a>

## buildGeminiBatchInlineEntries

Kind: function

```ts
/** Build inline batch request entries keyed by customId. */
export declare function buildGeminiBatchInlineEntries(requests: RuntimeBatchRequest[], defaultModel?: string): {
    model: string;
    entries: GeminiBatchInlineEntry[];
};
```

<a id="symbol-providers-gemini-buildgeminibatchinputjsonl"></a>

## buildGeminiBatchInputJsonl

Kind: function

```ts
/** Build JSONL for file-based batch submission. */
export declare function buildGeminiBatchInputJsonl(requests: RuntimeBatchRequest[], defaultModel?: string): {
    model: string;
    jsonl: string;
};
```

<a id="symbol-providers-gemini-buildgeminirequestbody"></a>

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

<a id="symbol-providers-gemini-creategeminiprovidermodule"></a>

## createGeminiProviderModule

Kind: function

```ts
export declare function createGeminiProviderModule(config: GeminiApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-gemini-estimategeminibatchinlinebytes"></a>

## estimateGeminiBatchInlineBytes

Kind: function

```ts
export declare function estimateGeminiBatchInlineBytes(entries: GeminiBatchInlineEntry[]): number;
```

<a id="symbol-providers-gemini-flattengeminiusagemetadata"></a>

## flattenGeminiUsageMetadata

Kind: function

```ts
/**
 * Flatten Gemini `usageMetadata` into a flat numeric record. usageMetadata is a
 * flat object of token counts (promptTokenCount, candidatesTokenCount,
 * totalTokenCount, cachedContentTokenCount?); newer responses add nested
 * `*Details` arrays which are not named counts and are ignored. The core
 * `normalizeRuntimeUsage` already aliases the Gemini keys.
 */
export declare function flattenGeminiUsageMetadata(value: unknown): Record<string, number> | undefined;
```

<a id="symbol-providers-gemini-gemini-api-base-url"></a>

## GEMINI_API_BASE_URL

Kind: variable

```ts
export declare const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
```

<a id="symbol-providers-gemini-gemini-api-version"></a>

## GEMINI_API_VERSION

Kind: variable

```ts
export declare const GEMINI_API_VERSION = "v1beta";
```

<a id="symbol-providers-gemini-gemini-batch-inline-max-bytes"></a>

## GEMINI_BATCH_INLINE_MAX_BYTES

Kind: variable

```ts
export declare const GEMINI_BATCH_INLINE_MAX_BYTES: number;
```

<a id="symbol-providers-gemini-gemini-files-upload-path"></a>

## GEMINI_FILES_UPLOAD_PATH

Kind: variable

```ts
export declare const GEMINI_FILES_UPLOAD_PATH = "/upload/v1beta/files";
```

<a id="symbol-providers-gemini-gemini-runtime-support"></a>

## GEMINI_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const GEMINI_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-gemini-geminiapiclient"></a>

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

<a id="symbol-providers-gemini-geminiapiclientoptions"></a>

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

<a id="symbol-providers-gemini-geminibatchcancelpath"></a>

## geminiBatchCancelPath

Kind: function

```ts
export declare function geminiBatchCancelPath(batchId: string): string;
```

<a id="symbol-providers-gemini-geminibatchgeneratecontentpath"></a>

## geminiBatchGenerateContentPath

Kind: function

```ts
export declare function geminiBatchGenerateContentPath(model: string): string;
```

<a id="symbol-providers-gemini-geminibatchpath"></a>

## geminiBatchPath

Kind: function

```ts
export declare function geminiBatchPath(batchId: string): string;
```

<a id="symbol-providers-gemini-geminifiledownloadpath"></a>

## geminiFileDownloadPath

Kind: function

```ts
export declare function geminiFileDownloadPath(fileName: string): string;
```

<a id="symbol-providers-gemini-geminifileobject"></a>

## GeminiFileObject

Kind: type

```ts
export type GeminiFileObject = {
    name: string;
} & Record<string, unknown>;
```

<a id="symbol-providers-gemini-geminifilepath"></a>

## geminiFilePath

Kind: function

```ts
export declare function geminiFilePath(fileName: string): string;
```

<a id="symbol-providers-gemini-geminifilesclient"></a>

## GeminiFilesClient

Kind: class

```ts
/** Gemini Files API client (resumable upload + download). */
export declare class GeminiFilesClient extends BaseHttpApiClient {
    readonly request: HttpApiTransport;
    private readonly uploadFetch;
    constructor(options: GeminiFilesClientOptions);
    /** Upload text content via Google's resumable upload protocol. */
    uploadFile(content: string, options?: {
        displayName?: string;
        mimeType?: string;
    }): Promise<GeminiFileObject>;
    /** Download raw file content (batch output JSONL). */
    downloadFile(fileName: string): Promise<string>;
    retrieveFile(fileName: string): Promise<GeminiFileObject>;
    deleteFile(fileName: string): Promise<Record<string, unknown>>;
}
```

<a id="symbol-providers-gemini-geminifilesclientoptions"></a>

## GeminiFilesClientOptions

Kind: type

```ts
export type GeminiFilesClientOptions = {
    /** Gemini Developer API (AI Studio) key. Keep backend-owned. */
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
    defaultTimeoutMs?: number;
};
```

<a id="symbol-providers-gemini-geminigeneratecontentpath"></a>

## geminiGenerateContentPath

Kind: function

```ts
export declare function geminiGenerateContentPath(model: string): string;
```

<a id="symbol-providers-gemini-geminigeneratecontentresponse"></a>

## GeminiGenerateContentResponse

Kind: type

```ts
export type GeminiGenerateContentResponse = {
    candidates?: GeminiCandidate[];
    promptFeedback?: {
        blockReason?: string;
    };
    usageMetadata?: Record<string, unknown>;
    modelVersion?: string;
};
```

<a id="symbol-providers-gemini-geministreamgeneratecontentpath"></a>

## geminiStreamGenerateContentPath

Kind: function

```ts
export declare function geminiStreamGenerateContentPath(model: string): string;
```

<a id="symbol-providers-gemini-mapgeminibatch"></a>

## mapGeminiBatch

Kind: function

```ts
/** Map a Gemini batch job object to canonical batch status. */
export declare function mapGeminiBatch(raw: unknown): RuntimeBatchStatus;
```

<a id="symbol-providers-gemini-mapgeminigeneratecontenttorunstatus"></a>

## mapGeminiGenerateContentToRunStatus

Kind: function

```ts
/** Map a Gemini generateContent response to the universal run status. */
export declare function mapGeminiGenerateContentToRunStatus(model: string, response: GeminiGenerateContentResponse): RuntimeRunStatus;
```

<a id="symbol-providers-gemini-mapgeministreamchunk"></a>

## mapGeminiStreamChunk

Kind: function

```ts
/** Map one Gemini SSE chunk to a MESSAGE_DELTA, or null when it carries no text. */
export declare function mapGeminiStreamChunk(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-gemini-normalizegeminibatchname"></a>

## normalizeGeminiBatchName

Kind: function

```ts
export declare function normalizeGeminiBatchName(batchId: string): string;
```

<a id="symbol-providers-gemini-parsegeminibatchoutputjsonl"></a>

## parseGeminiBatchOutputJsonl

Kind: function

```ts
/** Parse file-based batch result JSONL. */
export declare function parseGeminiBatchOutputJsonl(jsonlText: string, model: string, mapResponse?: (response: GeminiGenerateContentResponse) => RuntimeRunStatus, options?: ParseGeminiBatchResultsOptions): RuntimeBatchResult[];
```

<a id="symbol-providers-gemini-parsegeminibatchresultsoptions"></a>

## ParseGeminiBatchResultsOptions

Kind: type

```ts
export type ParseGeminiBatchResultsOptions = {
    malformedLine?: "skip" | "throw";
};
```

<a id="symbol-providers-gemini-parsegeminiinlinebatchresults"></a>

## parseGeminiInlineBatchResults

Kind: function

```ts
/** Parse inline batch responses from a GET batch payload. */
export declare function parseGeminiInlineBatchResults(raw: unknown, model: string, mapResponse?: (response: GeminiGenerateContentResponse) => RuntimeRunStatus): RuntimeBatchResult[];
```

<a id="symbol-providers-gemini-readgeminibatchresponsesfile"></a>

## readGeminiBatchResponsesFile

Kind: function

```ts
export declare function readGeminiBatchResponsesFile(raw: unknown): string | undefined;
```

<a id="symbol-providers-gemini-readgeminifinishreason"></a>

## readGeminiFinishReason

Kind: function

```ts
/** Return the first candidate's finishReason, if the chunk is terminal. */
export declare function readGeminiFinishReason(sse: SseMessage): string | null;
```

<a id="symbol-providers-gemini-readgeministreamusage"></a>

## readGeminiStreamUsage

Kind: function

```ts
/** Extract the flat usageMetadata numbers from a chunk, if present. */
export declare function readGeminiStreamUsage(sse: SseMessage): Record<string, number> | null;
```

<a id="symbol-providers-gemini-resolvegeminibatchmodel"></a>

## resolveGeminiBatchModel

Kind: function

```ts
/** Resolve one model for the whole batch; throws when models disagree or are missing. */
export declare function resolveGeminiBatchModel(requests: RuntimeBatchRequest[], defaultModel?: string): string;
```

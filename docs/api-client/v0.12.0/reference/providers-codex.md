# @cavi-ai/api-client/providers/codex

Package subpath: ./providers/codex

<a id="symbol-providers-codex-buildbatchinputjsonl"></a>

## buildBatchInputJsonl

Kind: function

```ts
/** Build the OpenAI Batch input file (JSONL). Each line targets the Responses endpoint. */
export declare function buildBatchInputJsonl(requests: RuntimeBatchRequest[], buildBody: (body: RuntimeBatchRequest["body"]) => Record<string, unknown>): string;
```

<a id="symbol-providers-codex-buildcodexresponsebody"></a>

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

<a id="symbol-providers-codex-codex-api-base-url"></a>

## CODEX_API_BASE_URL

Kind: variable

```ts
export declare const CODEX_API_BASE_URL = "https://api.openai.com";
```

<a id="symbol-providers-codex-codex-api-endpoints"></a>

## CODEX_API_ENDPOINTS

Kind: variable

```ts
export declare const CODEX_API_ENDPOINTS: {
    readonly responses: "/v1/responses";
    readonly files: "/v1/files";
    readonly batches: "/v1/batches";
};
```

<a id="symbol-providers-codex-codex-default-model"></a>

## CODEX_DEFAULT_MODEL

Kind: variable

```ts
export declare const CODEX_DEFAULT_MODEL = "gpt-5-codex";
```

<a id="symbol-providers-codex-codex-runtime-support"></a>

## CODEX_RUNTIME_SUPPORT

Kind: variable

```ts
export declare const CODEX_RUNTIME_SUPPORT: Readonly<{
    runs: true;
    streaming: true;
    batch: true;
}>;
```

<a id="symbol-providers-codex-codexapiclient"></a>

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

<a id="symbol-providers-codex-codexapiclientoptions"></a>

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

<a id="symbol-providers-codex-codexbatchcancelpath"></a>

## codexBatchCancelPath

Kind: function

```ts
export declare function codexBatchCancelPath(batchId: string): string;
```

<a id="symbol-providers-codex-codexbatchpath"></a>

## codexBatchPath

Kind: function

```ts
export declare function codexBatchPath(batchId: string): string;
```

<a id="symbol-providers-codex-codexfilecontentpath"></a>

## codexFileContentPath

Kind: function

```ts
export declare function codexFileContentPath(fileId: string): string;
```

<a id="symbol-providers-codex-codexfileobject"></a>

## CodexFileObject

Kind: type

```ts
export type CodexFileObject = {
    id: string;
} & Record<string, unknown>;
```

<a id="symbol-providers-codex-codexfilepath"></a>

## codexFilePath

Kind: function

```ts
export declare function codexFilePath(fileId: string): string;
```

<a id="symbol-providers-codex-codexfilesclient"></a>

## CodexFilesClient

Kind: class

```ts
/** Minimal OpenAI Files client (multipart upload + content download + retrieve/delete). */
export declare class CodexFilesClient extends BaseHttpApiClient {
    readonly request: HttpApiTransport;
    constructor(options: CodexFilesClientOptions);
    /** Upload a file (multipart). `content` is the file text (e.g. batch input JSONL). */
    uploadFile(content: string, purpose: string, filename?: string): Promise<CodexFileObject>;
    /** Download raw file content (e.g. a batch output/error file's JSONL). */
    downloadFileContent(fileId: string): Promise<string>;
    retrieveFile(fileId: string): Promise<CodexFileObject>;
    deleteFile(fileId: string): Promise<Record<string, unknown>>;
}
```

<a id="symbol-providers-codex-codexfilesclientoptions"></a>

## CodexFilesClientOptions

Kind: type

```ts
export type CodexFilesClientOptions = {
    /** OpenAI API key. Backend-owned. */
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
    defaultTimeoutMs?: number;
};
```

<a id="symbol-providers-codex-codexresponsecancelpath"></a>

## codexResponseCancelPath

Kind: function

```ts
export declare function codexResponseCancelPath(responseId: string): string;
```

<a id="symbol-providers-codex-codexresponsepath"></a>

## codexResponsePath

Kind: function

```ts
export declare function codexResponsePath(responseId: string): string;
```

<a id="symbol-providers-codex-createcodexprovidermodule"></a>

## createCodexProviderModule

Kind: function

```ts
export declare function createCodexProviderModule(config: CodexApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-codex-errormessageof"></a>

## errorMessageOf

Kind: function

```ts
export declare function errorMessageOf(value: unknown): string | undefined;
```

<a id="symbol-providers-codex-mapopenaibatch"></a>

## mapOpenAIBatch

Kind: function

```ts
/** Map an OpenAI Batch object to the canonical batch status. */
export declare function mapOpenAIBatch(raw: unknown): RuntimeBatchStatus;
```

<a id="symbol-providers-codex-mapopenairesponsestreamevent"></a>

## mapOpenAIResponseStreamEvent

Kind: function

```ts
export declare function mapOpenAIResponseStreamEvent(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-codex-mapopenairesponsetorunstatus"></a>

## mapOpenAIResponseToRunStatus

Kind: function

```ts
/** Map an OpenAI Response object to the canonical run status (incl. normalized tokens). */
export declare function mapOpenAIResponseToRunStatus(response: OpenAIResponse): RuntimeRunStatus;
```

<a id="symbol-providers-codex-mapresponsestatus"></a>

## mapResponseStatus

Kind: function

```ts
export declare function mapResponseStatus(status: string | undefined): RuntimeRunStatus["status"];
```

<a id="symbol-providers-codex-openairesponse"></a>

## OpenAIResponse

Kind: type

```ts
export type OpenAIResponse = {
    id: string;
    status?: string;
    model?: string;
    output_text?: string;
    error?: unknown;
    incomplete_details?: unknown;
    usage?: Record<string, unknown>;
};
```

<a id="symbol-providers-codex-parseopenaibatchoutput"></a>

## parseOpenAIBatchOutput

Kind: function

```ts
/** Parse an OpenAI batch output/error file (JSONL) into canonical results. */
export declare function parseOpenAIBatchOutput(jsonlText: string, mapResponse: (response: OpenAIResponse) => RuntimeRunStatus, options?: ParseOpenAIBatchOutputOptions): RuntimeBatchResult[];
```

<a id="symbol-providers-codex-parseopenaibatchoutputoptions"></a>

## ParseOpenAIBatchOutputOptions

Kind: type

```ts
export type ParseOpenAIBatchOutputOptions = {
    /**
     * `skip` preserves the historical low-level parser behavior. `throw` is used
     * by CodexApiClient for downloaded batch files so malformed JSONL cannot
     * silently hide missing request results.
     */
    malformedLine?: "skip" | "throw";
};
```

<a id="symbol-providers-codex-readopenairesponserunid"></a>

## readOpenAIResponseRunId

Kind: function

```ts
export declare function readOpenAIResponseRunId(sse: SseMessage): string | null;
```

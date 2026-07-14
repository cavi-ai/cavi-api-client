# @cavi-ai/api-client/providers/gemini/files

Package subpath: ./providers/gemini/files

<a id="symbol-providers-gemini-files-geminifileobject"></a>

## GeminiFileObject

Kind: type

```ts
export type GeminiFileObject = {
    name: string;
} & Record<string, unknown>;
```

<a id="symbol-providers-gemini-files-geminifilesclient"></a>

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

<a id="symbol-providers-gemini-files-geminifilesclientoptions"></a>

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

# @cavi-ai/api-client/providers/codex/files

Package subpath: ./providers/codex/files

<a id="symbol-providers-codex-files-codexfileobject"></a>

## CodexFileObject

Kind: type

```ts
export type CodexFileObject = {
    id: string;
} & Record<string, unknown>;
```

<a id="symbol-providers-codex-files-codexfilesclient"></a>

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

<a id="symbol-providers-codex-files-codexfilesclientoptions"></a>

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

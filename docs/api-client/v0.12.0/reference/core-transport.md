# @cavi-ai/api-client/core/transport

Package subpath: ./core/transport

<a id="symbol-core-transport-abortablesleep"></a>

## abortableSleep

Kind: function

```ts
export declare function abortableSleep(delayMs: number, signal?: AbortSignal): Promise<void>;
```

<a id="symbol-core-transport-computebackoffdelay"></a>

## computeBackoffDelay

Kind: function

```ts
export declare function computeBackoffDelay(policy: TransportRetryPolicy, attempt: number, random: number, retryAfterMs?: number): number;
```

<a id="symbol-core-transport-contentlengthcodec"></a>

## contentLengthCodec

Kind: function

```ts
export declare function contentLengthCodec<T = unknown>(options?: ContentLengthCodecOptions): TransportFrameCodec<T>;
```

<a id="symbol-core-transport-contentlengthcodecoptions"></a>

## ContentLengthCodecOptions

Kind: type

```ts
export type ContentLengthCodecOptions = Readonly<{
    maxHeaderBytes?: number;
    maxBodyBytes?: number;
}>;
```

<a id="symbol-core-transport-createframedmessagechannel"></a>

## createFramedMessageChannel

Kind: function

```ts
export declare function createFramedMessageChannel<T>(bytes: TransportByteChannel, codec: TransportFrameCodec<T>): TransportMessageChannel<T>;
```

<a id="symbol-core-transport-createhttptransport"></a>

## createHttpTransport

Kind: function

```ts
export declare function createHttpTransport(options: HttpTransportOptions): HttpTransport;
```

<a id="symbol-core-transport-createjsonrpctransport"></a>

## createJsonRpcTransport

Kind: function

```ts
export declare function createJsonRpcTransport(options: CreateJsonRpcTransportOptions): JsonRpcTransport;
```

<a id="symbol-core-transport-createjsonrpctransportoptions"></a>

## CreateJsonRpcTransportOptions

Kind: type

```ts
export type CreateJsonRpcTransportOptions = Readonly<{
    channel: TransportMessageChannel<unknown>;
    id?: () => JsonRpcId;
    onProtocolError?: (error: TransportError) => void;
}>;
```

<a id="symbol-core-transport-createssetransport"></a>

## createSseTransport

Kind: function

```ts
export declare function createSseTransport(transportOptions: SseTransportOptions): SseTransport;
```

<a id="symbol-core-transport-createtransportlifecycle"></a>

## createTransportLifecycle

Kind: function

```ts
export declare function createTransportLifecycle(listener?: (event: TransportLifecycleEvent) => void): TransportLifecycle;
```

<a id="symbol-core-transport-createwebsockettransport"></a>

## createWebSocketTransport

Kind: function

```ts
export declare function createWebSocketTransport(transportOptions?: WebSocketTransportOptions): WebSocketTransport;
```

<a id="symbol-core-transport-gettransporterrormetadata"></a>

## getTransportErrorMetadata

Kind: function

```ts
export declare function getTransportErrorMetadata(error: unknown): TransportErrorMetadata | undefined;
```

<a id="symbol-core-transport-httptransport"></a>

## HttpTransport

Kind: interface

```ts
export interface HttpTransport {
    request<T = unknown>(request: HttpTransportRequest): Promise<T>;
}
```

<a id="symbol-core-transport-httptransportoptions"></a>

## HttpTransportOptions

Kind: type

```ts
export type HttpTransportOptions = Readonly<{
    baseUrl: string;
    defaultHeaders?: Readonly<Record<string, string>>;
    auth?: TransportAuthResolver;
    fetchImpl?: typeof fetch;
    dependencies?: Partial<TransportDependencies>;
    onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;
```

<a id="symbol-core-transport-httptransportrequest"></a>

## HttpTransportRequest

Kind: type

```ts
export type HttpTransportRequest = Readonly<{
    method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    headers?: Readonly<Record<string, string>>;
    body?: BodyInit | null;
    response?: "response" | "json" | "text" | "bytes";
    idempotencyKey?: string;
    retry?: TransportRetryPolicy;
    signal?: AbortSignal;
}>;
```

<a id="symbol-core-transport-jsonframecodecoptions"></a>

## JsonFrameCodecOptions

Kind: type

```ts
export type JsonFrameCodecOptions = Readonly<{
    maxFrameBytes?: number;
}>;
```

<a id="symbol-core-transport-jsonlinescodec"></a>

## jsonLinesCodec

Kind: function

```ts
export declare function jsonLinesCodec<T = unknown>(options?: JsonFrameCodecOptions): TransportFrameCodec<T>;
```

<a id="symbol-core-transport-jsonrpctransport"></a>

## JsonRpcTransport

Kind: interface

```ts
export interface JsonRpcTransport {
    request<T = unknown>(method: string, params?: unknown, options?: {
        signal?: AbortSignal;
    }): Promise<T>;
    notify(method: string, params?: unknown, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    onNotification(listener: (method: string, params: unknown) => void): () => void;
    close(): Promise<void>;
}
```

<a id="symbol-core-transport-jsontextcodec"></a>

## jsonTextCodec

Kind: function

```ts
export declare function jsonTextCodec<T = unknown>(options?: JsonFrameCodecOptions): TransportFrameCodec<T>;
```

<a id="symbol-core-transport-normalizetransportabort"></a>

## normalizeTransportAbort

Kind: function

```ts
export declare function normalizeTransportAbort(signal?: AbortSignal, cause?: unknown): ApiClientError;
```

<a id="symbol-core-transport-resolvetransportheaders"></a>

## resolveTransportHeaders

Kind: function

```ts
export declare function resolveTransportHeaders(defaults?: Readonly<Record<string, string>>, resolver?: TransportAuthResolver): Promise<Record<string, string>>;
```

<a id="symbol-core-transport-runtransportattempts"></a>

## runTransportAttempts

Kind: function

```ts
export declare function runTransportAttempts<T>(options: Readonly<{
    kind: TransportKind;
    operation: string;
    safety: TransportOperationSafety;
    policy: TransportRetryPolicy;
    execute: (context: TransportAttemptContext) => Promise<T>;
    auth?: TransportAuthResolver;
    headers?: Readonly<Record<string, string>>;
    dependencies?: Partial<TransportDependencies>;
    lifecycle?: TransportLifecycle;
    signal?: AbortSignal;
}>): Promise<T>;
```

<a id="symbol-core-transport-sseconnectoptions"></a>

## SseConnectOptions

Kind: type

```ts
export type SseConnectOptions = Readonly<{
    path: string;
    headers?: Readonly<Record<string, string>>;
    cursor?: string;
    reconnect?: TransportReconnectPolicy;
    signal?: AbortSignal;
    onMessage: (message: SseMessage) => void;
}>;
```

<a id="symbol-core-transport-ssesubscription"></a>

## SseSubscription

Kind: interface

```ts
export interface SseSubscription {
    readonly done: Promise<void>;
    close(): void;
}
```

<a id="symbol-core-transport-ssetransport"></a>

## SseTransport

Kind: interface

```ts
export interface SseTransport {
    subscribe(options: SseConnectOptions): SseSubscription;
}
```

<a id="symbol-core-transport-ssetransportoptions"></a>

## SseTransportOptions

Kind: type

```ts
export type SseTransportOptions = Readonly<{
    baseUrl: string;
    defaultHeaders?: Readonly<Record<string, string>>;
    auth?: TransportAuthResolver;
    fetchImpl?: typeof fetch;
    dependencies?: Partial<TransportDependencies>;
    onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;
```

<a id="symbol-core-transport-transportattemptcontext"></a>

## TransportAttemptContext

Kind: type

```ts
export type TransportAttemptContext = Readonly<{
    attempt: number;
    headers: Readonly<Record<string, string>>;
    signal?: AbortSignal;
}>;
```

<a id="symbol-core-transport-transportauth"></a>

## TransportAuth

Kind: type

```ts
export type TransportAuth = Readonly<{
    headers?: Readonly<Record<string, string>>;
}>;
```

<a id="symbol-core-transport-transportauthresolver"></a>

## TransportAuthResolver

Kind: type

```ts
export type TransportAuthResolver = () => TransportAuth | Promise<TransportAuth>;
```

<a id="symbol-core-transport-transportbytechannel"></a>

## TransportByteChannel

Kind: interface

```ts
export interface TransportByteChannel {
    write(chunk: Uint8Array, signal?: AbortSignal): Promise<void>;
    subscribe(listener: (chunk: Uint8Array) => void): () => void;
    /** Invokes once on local or remote close, immediately when already closed. */
    subscribeClose(listener: (error?: unknown) => void): () => void;
    close(): Promise<void>;
}
```

<a id="symbol-core-transport-transportdependencies"></a>

## TransportDependencies

Kind: type

```ts
export type TransportDependencies = Readonly<{
    now: () => number;
    random: () => number;
    sleep: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}>;
```

<a id="symbol-core-transport-transporterror"></a>

## TransportError

Kind: class

```ts
export declare class TransportError extends ApiClientError {
    readonly transport: TransportErrorMetadata;
    constructor(message: string, options: {
        metadata: TransportErrorMetadata;
        cause?: unknown;
    });
}
```

<a id="symbol-core-transport-transporterrormetadata"></a>

## TransportErrorMetadata

Kind: type

```ts
export type TransportErrorMetadata = Readonly<{
    kind: TransportKind;
    phase: TransportPhase;
    operation: string;
    retryable: boolean;
    attempt: number;
    status?: number;
    code?: string | number;
    retryAfterMs?: number;
}>;
```

<a id="symbol-core-transport-transportframecodec"></a>

## TransportFrameCodec

Kind: interface

```ts
export interface TransportFrameCodec<T> {
    encode(value: T): Uint8Array;
    createDecoder(): TransportFrameDecoder<T>;
}
```

<a id="symbol-core-transport-transportframedecoder"></a>

## TransportFrameDecoder

Kind: interface

```ts
export interface TransportFrameDecoder<T> {
    push(chunk: Uint8Array): readonly T[];
    finish(): readonly T[];
}
```

<a id="symbol-core-transport-transportkind"></a>

## TransportKind

Kind: type

```ts
export type TransportKind = "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix";
```

<a id="symbol-core-transport-transportlifecycle"></a>

## TransportLifecycle

Kind: type

```ts
export type TransportLifecycle = Readonly<{
    emit: (event: TransportLifecycleEvent) => void;
    subscribe: (listener: (event: TransportLifecycleEvent) => void) => () => void;
}>;
```

<a id="symbol-core-transport-transportlifecycleevent"></a>

## TransportLifecycleEvent

Kind: type

```ts
export type TransportLifecycleEvent = Readonly<{
    state: "connecting" | "connected" | "retrying" | "reconnected" | "closed";
    kind: TransportKind;
    operation: string;
    attempt: number;
    delayMs?: number;
}>;
```

<a id="symbol-core-transport-transportmessagechannel"></a>

## TransportMessageChannel

Kind: interface

```ts
export interface TransportMessageChannel<T = unknown> {
    send(message: T, signal?: AbortSignal): Promise<void>;
    subscribe(listener: (message: T) => void): () => void;
    /** Invokes once on local or remote close, immediately when already closed. */
    subscribeClose(listener: (error?: unknown) => void): () => void;
    close(reason?: string): Promise<void>;
}
```

<a id="symbol-core-transport-transportoperationsafety"></a>

## TransportOperationSafety

Kind: type

```ts
export type TransportOperationSafety = "read" | "idempotent" | "connection" | "mutation";
```

<a id="symbol-core-transport-transportphase"></a>

## TransportPhase

Kind: type

```ts
export type TransportPhase = "configure" | "authenticate" | "connect" | "request" | "decode" | "close";
```

<a id="symbol-core-transport-transportreconnectpolicy"></a>

## TransportReconnectPolicy

Kind: type

```ts
export type TransportReconnectPolicy = TransportRetryPolicy & Readonly<{
    dedupeCapacity?: number;
}>;
```

<a id="symbol-core-transport-transportretrypolicy"></a>

## TransportRetryPolicy

Kind: type

```ts
export type TransportRetryPolicy = Readonly<{
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterRatio?: number;
    deadlineMs?: number;
}>;
```

<a id="symbol-core-transport-validatetransportretrypolicy"></a>

## validateTransportRetryPolicy

Kind: function

```ts
export declare function validateTransportRetryPolicy(policy: TransportRetryPolicy): void;
```

<a id="symbol-core-transport-websocketconnectoptions"></a>

## WebSocketConnectOptions

Kind: type

```ts
export type WebSocketConnectOptions = Readonly<{
    url: string | (() => string | Promise<string>);
    protocols?: readonly string[] | (() => readonly string[] | Promise<readonly string[]>);
    reconnect?: TransportReconnectPolicy;
    signal?: AbortSignal;
    decode?: (data: unknown) => unknown | Promise<unknown>;
    encode?: (message: unknown) => string | ArrayBufferLike | Blob | ArrayBufferView;
}>;
```

<a id="symbol-core-transport-websocketlike"></a>

## WebSocketLike

Kind: interface

```ts
export interface WebSocketLike {
    readonly readyState: number;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
}
```

<a id="symbol-core-transport-websockettransport"></a>

## WebSocketTransport

Kind: interface

```ts
export interface WebSocketTransport {
    connect(options: WebSocketConnectOptions): TransportMessageChannel<unknown> & Readonly<{
        ready: Promise<void>;
    }>;
}
```

<a id="symbol-core-transport-websockettransportoptions"></a>

## WebSocketTransportOptions

Kind: type

```ts
export type WebSocketTransportOptions = Readonly<{
    webSocketFactory?: (url: string, protocols?: readonly string[]) => WebSocketLike;
    dependencies?: Partial<TransportDependencies>;
    onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;
```

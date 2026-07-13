# @cavi-ai/api-client/core/sse

Package subpath: ./core/sse

<a id="symbol-core-sse-combineabortsignals"></a>

## combineAbortSignals

Kind: function

```ts
export declare function combineAbortSignals(a: AbortSignal, b: AbortSignal | undefined): AbortSignal;
```

<a id="symbol-core-sse-consumessestream"></a>

## consumeSseStream

Kind: function

```ts
export declare function consumeSseStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, onMessage: SseMessageHandler): Promise<void>;
```

<a id="symbol-core-sse-drainssemessages"></a>

## drainSseMessages

Kind: function

```ts
export declare function drainSseMessages(buffer: string, onMessage: SseMessageHandler): string;
```

<a id="symbol-core-sse-isssecontenttype"></a>

## isSseContentType

Kind: function

```ts
export declare function isSseContentType(contentType: string | null | undefined): boolean;
```

<a id="symbol-core-sse-parsesseblock"></a>

## parseSseBlock

Kind: function

```ts
export declare function parseSseBlock(block: string): SseMessage | null;
```

<a id="symbol-core-sse-ssemessage"></a>

## SseMessage

Kind: type

```ts
export type SseMessage = {
    data: string;
    event?: string;
    id?: string;
    retry?: number;
};
```

<a id="symbol-core-sse-ssemessagehandler"></a>

## SseMessageHandler

Kind: type

```ts
export type SseMessageHandler = (message: SseMessage) => void;
```

<a id="symbol-core-sse-takenextsseblock"></a>

## takeNextSseBlock

Kind: function

```ts
export declare function takeNextSseBlock(buffer: string): {
    block: string;
    rest: string;
} | null;
```

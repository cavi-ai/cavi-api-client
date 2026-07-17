# @cavi-ai/api-client/core/transport/node

Package subpath: ./core/transport/node

<a id="symbol-core-transport-node-createstdiotransport"></a>

## createStdioTransport

Kind: function

```ts
export declare function createStdioTransport(options: StdioTransportOptions): TransportByteChannel & Readonly<{
    closed: Promise<void>;
}>;
```

<a id="symbol-core-transport-node-createunixsockettransport"></a>

## createUnixSocketTransport

Kind: function

```ts
export declare function createUnixSocketTransport(options: UnixSocketTransportOptions): TransportByteChannel & Readonly<{
    ready: Promise<void>;
    closed: Promise<void>;
}>;
```

<a id="symbol-core-transport-node-stdiochildlike"></a>

## StdioChildLike

Kind: interface

```ts
export interface StdioChildLike {
    readonly stdin: {
        write(chunk: Uint8Array): boolean;
        end(): void;
        once(event: "drain", listener: () => void): void;
    };
    readonly stdout: {
        on(event: "data", listener: (chunk: Uint8Array) => void): void;
    };
    readonly stderr: {
        on(event: "data", listener: (chunk: Uint8Array) => void): void;
    } | null;
    once(event: "error" | "exit", listener: (...args: unknown[]) => void): void;
    kill(signal?: string): boolean;
}
```

<a id="symbol-core-transport-node-stdiospawn"></a>

## StdioSpawn

Kind: type

```ts
export type StdioSpawn = (command: string, args: readonly string[], options: {
    cwd?: string;
    env?: Readonly<Record<string, string>>;
}) => StdioChildLike;
```

<a id="symbol-core-transport-node-stdiotransportoptions"></a>

## StdioTransportOptions

Kind: type

```ts
export type StdioTransportOptions = Readonly<{
    command: string;
    args?: readonly string[];
    cwd?: string;
    env?: Readonly<Record<string, string>>;
    stderr?: "ignore" | "inherit" | ((chunk: Uint8Array) => void);
    signal?: AbortSignal;
    spawnImpl?: StdioSpawn;
}>;
```

<a id="symbol-core-transport-node-unixsocketconnect"></a>

## UnixSocketConnect

Kind: type

```ts
export type UnixSocketConnect = (path: string) => UnixSocketLike;
```

<a id="symbol-core-transport-node-unixsocketlike"></a>

## UnixSocketLike

Kind: interface

```ts
export interface UnixSocketLike {
    write(chunk: Uint8Array): boolean;
    end(): void;
    destroy(error?: Error): void;
    on(event: "connect" | "drain" | "end" | "close", listener: () => void): void;
    on(event: "data", listener: (chunk: Uint8Array) => void): void;
    on(event: "error", listener: (error: Error) => void): void;
}
```

<a id="symbol-core-transport-node-unixsockettransportoptions"></a>

## UnixSocketTransportOptions

Kind: type

```ts
export type UnixSocketTransportOptions = Readonly<{
    path: string;
    reconnect?: TransportReconnectPolicy;
    signal?: AbortSignal;
    connectImpl?: UnixSocketConnect;
    dependencies?: Partial<TransportDependencies>;
}>;
```

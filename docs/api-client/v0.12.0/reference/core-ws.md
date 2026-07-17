# @cavi-ai/api-client/core/ws

Package subpath: ./core/ws

<a id="symbol-core-ws-describewebsocketclose"></a>

## describeWebSocketClose

Kind: function

```ts
export declare function describeWebSocketClose(event?: WebSocketCloseLike | null, fallbackMessage?: string): WebSocketCloseDescription;
```

<a id="symbol-core-ws-deviceidentity"></a>

## DeviceIdentity

Kind: type

```ts
export type DeviceIdentity = {
    deviceId: string;
    privateKey: CryptoKey;
    publicKeyBase64Url: string;
};
```

<a id="symbol-core-ws-gatewaywebsocketclient"></a>

## GatewayWebSocketClient

Kind: class

```ts
export declare class GatewayRpcClient {
    private readonly wsUrl;
    private readonly authToken;
    private readonly options;
    private socket;
    private connectPromise;
    private pending;
    private activeRpcRequests;
    private queuedRpcRequests;
    private sequence;
    private connected;
    /** Set when a connect RPC is explicitly rejected (auth failure, etc.) so onClose
     *  does not emit a retryable socket_closed error that triggers an infinite reconnect loop. */
    private connectRejected;
    private eventListeners;
    private stateListeners;
    private state;
    private lastError;
    private intentionalClose;
    private emitRpcTrace;
    private deviceIdentity;
    private deviceIdentityReady;
    /** Incremented on each connect attempt; stale async connect paths must not resolve the outer promise. */
    private connectAttemptSeq;
    constructor(wsUrl: string, authToken: string | null, options?: GatewayRpcClientOptions);
    getConnectionState(): GatewayConnectionState;
    getLastError(): Error | null;
    onEvent(listener: (event: GatewayStreamEvent) => void): () => void;
    onStateChange(listener: (state: GatewayConnectionState, error: Error | null) => void): () => void;
    connect(): Promise<void>;
    request<TPayload>(method: string, params?: Record<string, unknown>): Promise<TPayload>;
    close(): Promise<void>;
    private setState;
    private getConnectClientInfo;
    private ensureConnected;
    private requestRaw;
    private runWithRpcBackpressure;
    private drainQueuedRpcRequests;
    private rejectQueuedRpcRequests;
    private handleMessage;
}
```

<a id="symbol-core-ws-gatewaywebsocketclientoptions"></a>

## GatewayWebSocketClientOptions

Kind: type

```ts
export type GatewayRpcClientOptions = {
    clientId?: string;
    clientVersion?: string;
    clientMode?: string;
    clientPlatform?: string;
    /**
     * Correlation-id strategy for the initial `connect` handshake frame.
     * - `"monotonic"` (default): connect uses the same per-client monotonic id as
     *   every other RPC.
     * - `"client-id"`: connect reuses the advertised `clientId` as its frame id.
     *   Opt into this for gateways that correlate the connect response on the
     *   advertised client id rather than echoing an arbitrary request id.
     * Subsequent (non-connect) RPCs always use monotonic ids regardless.
     */
    connectFrameId?: "monotonic" | "client-id";
    /**
     * Gateway protocol compatibility range to advertise during connect.
     * Defaults to the current generic gateway protocol. Override only when
     * talking to a gateway with a known alternate compatibility contract.
     */
    minProtocol?: number;
    maxProtocol?: number;
    enableDeviceIdentity?: boolean;
    /**
     * Optional platform-specific device identity loader. Browser callers use the
     * built-in IndexedDB/WebCrypto store; React Native callers can provide a
     * SecureStore-backed loader while still using the shared connect signer.
     */
    deviceIdentityLoader?: () => Promise<DeviceIdentity | null>;
    /**
     * Operator scopes to request on connect. Empty/blank entries are ignored.
     * When omitted, defaults to `["operator.read"]` for backwards compatibility;
     * callers needing admin-level methods (e.g. `device.pair.approve`) must opt in
     * explicitly so the gateway does not silently downgrade them to read-only.
     */
    requestedScopes?: readonly string[];
    /**
     * Gateway pre-auth handshake budget (ms). Set this to the same value as server
     * handshake config when it is not the default, especially for browser clients
     * that cannot read gateway env.
     */
    preauthHandshakeTimeoutMs?: number;
    /**
     * Env bag and keys for provider-specific pre-auth handshake config. Core uses
     * GATEWAY_* keys by default; providers can pass their own keys without baking
     * product names into the core client.
     */
    preauthHandshakeEnv?: GatewayPreauthHandshakeEnv;
    preauthHandshakeEnvKeys?: GatewayPreauthHandshakeEnvKeys;
    /** Override the per-RPC response timeout. */
    requestTimeoutMs?: number;
    /** Override client-side RPC concurrency. */
    maxConcurrentRequests?: number;
    /** Override the default requested scopes used when requestedScopes is omitted. */
    defaultRequestedScopes?: readonly string[];
    /**
     * Optional hook for completed RPCs (success, gateway error, timeout, or send failure).
     * Params are redacted; payloads are truncated. Must not throw.
     */
    onRpcTrace?: (entry: GatewayRpcTraceEntry) => void;
};
```

<a id="symbol-core-ws-gatewaywebsocketconnectionstate"></a>

## GatewayWebSocketConnectionState

Kind: type

```ts
export type GatewayConnectionState = "idle" | "connecting" | "reconnecting" | "connected" | "error";
```

<a id="symbol-core-ws-gatewaywebsocketevent"></a>

## GatewayWebSocketEvent

Kind: type

```ts
export type GatewayStreamEvent = {
    event: string;
    payload: unknown;
};
```

<a id="symbol-core-ws-gatewaywebsockettraceentry"></a>

## GatewayWebSocketTraceEntry

Kind: type

```ts
/** Completed WebSocket RPC (after response or failure). Params are redacted. */
export type GatewayRpcTraceEntry = {
    at: number;
    transport: "websocket";
    correlationId: string;
    method: string;
    durationMs: number;
    ok: boolean;
    params: Record<string, unknown>;
    /** JSON preview of successful payload (bounded). */
    resultPreview?: string;
    /** Populated when `ok` is false. */
    error?: {
        name: string;
        message: string;
        code?: string;
    };
};
```

<a id="symbol-core-ws-httpwebsockettargets"></a>

## HttpWebSocketTargets

Kind: type

```ts
export type HttpWebSocketTargets = {
    httpBase: string;
    wsUrl: string;
};
```

<a id="symbol-core-ws-resolvegatewaytargets"></a>

## resolveGatewayTargets

Kind: variable

```ts
export declare const resolveGatewayTargets: typeof resolveHttpWebSocketTargets;
```

<a id="symbol-core-ws-resolvehttpwebsockettargets"></a>

## resolveHttpWebSocketTargets

Kind: function

```ts
/**
 * Resolve paired HTTP and WebSocket targets from any supported input scheme:
 * `http://`, `https://`, `ws://`, or `wss://`.
 *
 * HTTP(S) inputs preserve their pathname for `httpBase` and use `/ws` for the
 * socket path. WS(S) inputs preserve their socket pathname and expose the HTTP
 * origin as `httpBase`.
 */
export declare function resolveHttpWebSocketTargets(baseUrl: string): HttpWebSocketTargets;
```

<a id="symbol-core-ws-tryresolvegatewaytargets"></a>

## tryResolveGatewayTargets

Kind: variable

```ts
export declare const tryResolveGatewayTargets: typeof tryResolveHttpWebSocketTargets;
```

<a id="symbol-core-ws-tryresolvehttpwebsockettargets"></a>

## tryResolveHttpWebSocketTargets

Kind: function

```ts
/**
 * Safe variant of {@link resolveHttpWebSocketTargets}; returns null for empty,
 * malformed, or unsupported values.
 */
export declare function tryResolveHttpWebSocketTargets(baseUrl: string): HttpWebSocketTargets | null;
```

<a id="symbol-core-ws-websocketclosedescription"></a>

## WebSocketCloseDescription

Kind: type

```ts
export type WebSocketCloseDescription = {
    code: number | null;
    reason: string | null;
    message: string;
};
```

<a id="symbol-core-ws-websocketcloselike"></a>

## WebSocketCloseLike

Kind: type

```ts
export type WebSocketCloseLike = {
    code?: unknown;
    reason?: unknown;
};
```

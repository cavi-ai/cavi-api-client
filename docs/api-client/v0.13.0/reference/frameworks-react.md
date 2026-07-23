# @cavi-ai/api-client/frameworks/react

Package subpath: ./frameworks/react

<a id="symbol-frameworks-react-gatewayclientcontextvalue"></a>

## GatewayClientContextValue

Kind: type

```ts
export type GatewayClientContextValue = {
    client: GatewayRpcClient | null;
    state: GatewayConnectionState;
    /** Malformed / unparseable gateway base URL (from provider props). */
    urlError: Error | null;
    /** Transport or gateway handshake failure after a client exists or was attempted. */
    connectionError: Error | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
};
```

<a id="symbol-frameworks-react-gatewayclientoverrideoptions"></a>

## GatewayClientOverrideOptions

Kind: type

```ts
export type GatewayClientOverrideOptions = Pick<GatewayRpcClientOptions, "minProtocol" | "maxProtocol" | "defaultRequestedScopes" | "preauthHandshakeEnv" | "preauthHandshakeEnvKeys" | "requestTimeoutMs" | "maxConcurrentRequests">;
```

<a id="symbol-frameworks-react-gatewayclientprovider"></a>

## GatewayClientProvider

Kind: function

```ts
/**
 * Provider that creates and manages a shared GatewayRpcClient for the subtree.
 */
export declare function GatewayClientProvider({ gatewayBaseUrl, authToken, clientId, clientVersion, requestedScopes, preauthHandshakeTimeoutMs, gatewayClientOverrides, enableDeviceIdentity, clientPlatform, clientMode, autoReconnect, onRpcTrace, deviceIdentityLoader, children, }: GatewayClientProviderProps): React.ReactElement;
```

<a id="symbol-frameworks-react-gatewayclientproviderprops"></a>

## GatewayClientProviderProps

Kind: type

```ts
export type GatewayClientProviderProps = {
    gatewayBaseUrl: string;
    authToken: string | null;
    clientId: string;
    clientVersion?: string;
    /** Same as `GatewayRpcClientOptions.requestedScopes`. */
    requestedScopes?: readonly string[];
    /** Same as `GatewayRpcClientOptions.preauthHandshakeTimeoutMs`. */
    preauthHandshakeTimeoutMs?: number;
    /** Same as `UseGatewayClientOptions.gatewayClientOverrides`. */
    gatewayClientOverrides?: GatewayClientOverrideOptions;
    /** Same as `UseGatewayClientOptions.enableDeviceIdentity`. */
    enableDeviceIdentity?: boolean;
    clientPlatform?: string;
    clientMode?: string;
    children: ReactNode;
    /** When true, retry transient transport failures (see `useGatewayClient` `autoReconnect`). */
    autoReconnect?: boolean;
    /** See {@link GatewayRpcClientOptions.onRpcTrace}. */
    onRpcTrace?: (entry: GatewayRpcTraceEntry) => void;
    /** Same as `UseGatewayClientOptions.deviceIdentityLoader`. */
    deviceIdentityLoader?: () => Promise<DeviceIdentity | null>;
};
```

<a id="symbol-frameworks-react-gatewayconnectionstate"></a>

## GatewayConnectionState

Kind: type

```ts
export type GatewayConnectionState = "idle" | "connecting" | "reconnecting" | "connected" | "error";
```

<a id="symbol-frameworks-react-gatewayeventstreamstate"></a>

## GatewayEventStreamState

Kind: type

```ts
export type GatewayEventStreamState = {
    state: GatewayConnectionState;
    error: string | null;
    connectedAt: number | null;
    lastEventAt: number | null;
    /** Shared client for RPC calls; null when auth is unavailable. */
    client: GatewayRpcClient | null;
};
```

<a id="symbol-frameworks-react-gatewayrpctraceentry"></a>

## GatewayRpcTraceEntry

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

<a id="symbol-frameworks-react-gatewaystreamevent"></a>

## GatewayStreamEvent

Kind: type

```ts
export type GatewayStreamEvent = {
    event: string;
    payload: unknown;
};
```

<a id="symbol-frameworks-react-usegatewayclient"></a>

## useGatewayClient

Kind: function

```ts
/**
 * Manages GatewayRpcClient lifecycle and provides it via context.
 * Call connect() to establish the WebSocket connection.
 */
export declare function useGatewayClient(options: UseGatewayClientOptions): GatewayClientContextValue;
```

<a id="symbol-frameworks-react-usegatewayclientcontext"></a>

## useGatewayClientContext

Kind: function

```ts
/**
 * Access the gateway client from context.
 */
export declare function useGatewayClientContext(): GatewayClientContextValue;
```

<a id="symbol-frameworks-react-usegatewayclientoptions"></a>

## UseGatewayClientOptions

Kind: type

```ts
export type UseGatewayClientOptions = {
    gatewayBaseUrl: string;
    authToken: string | null;
    clientId: string;
    clientVersion?: string;
    /** See `GatewayRpcClientOptions.requestedScopes`. Defaults to `["operator.read"]` when omitted. */
    requestedScopes?: readonly string[];
    /** See `GatewayRpcClientOptions.preauthHandshakeTimeoutMs` (browser deploys need this when gateway timeout is non-default). */
    preauthHandshakeTimeoutMs?: number;
    /** Core GatewayRpcClient override knobs that are safe to express as React props. */
    gatewayClientOverrides?: GatewayClientOverrideOptions;
    /**
     * Set to `false` to skip the device-identity challenge handshake on connect.
     * Deployments that require paired devices should keep this enabled and
     * provide `deviceIdentityLoader` on platforms without IndexedDB.
     */
    enableDeviceIdentity?: boolean;
    clientPlatform?: string;
    clientMode?: string;
    /**
     * When true, retry transient WebSocket failures with exponential backoff
     * (same policy as `useGatewayEventStream`). Default false for callers that
     * manage their own reconnect loops.
     */
    autoReconnect?: boolean;
    /** See {@link GatewayRpcClientOptions.onRpcTrace}. */
    onRpcTrace?: (entry: GatewayRpcTraceEntry) => void;
    /** See {@link GatewayRpcClientOptions.deviceIdentityLoader}. */
    deviceIdentityLoader?: () => Promise<DeviceIdentity | null>;
};
```

<a id="symbol-frameworks-react-usegatewayconnectionstate"></a>

## useGatewayConnectionState

Kind: function

```ts
/**
 * Hook for connection status to drive UI indicators.
 */
export declare function useGatewayConnectionState(client: GatewayRpcClient | null): GatewayConnectionState;
```

<a id="symbol-frameworks-react-usegatewayevents"></a>

## useGatewayEvents

Kind: function

```ts
/**
 * Subscribe to specific gateway event types.
 */
export declare function useGatewayEvents(client: GatewayRpcClient | null, filter: string | string[] | ((event: GatewayStreamEvent) => boolean), handler: (event: GatewayStreamEvent) => void): void;
```

<a id="symbol-frameworks-react-usegatewayeventstream"></a>

## useGatewayEventStream

Kind: function

```ts
/**
 * Manages gateway WebSocket connection with auto-reconnect and event forwarding.
 * Drop-in replacement for the Cavi Control UI useGatewayEventStream hook.
 *
 * When the gateway uses a custom pre-auth handshake window, pass the same value
 * as `preauthHandshakeTimeoutMs` so browser clients align token-only connect timing.
 */
export declare function useGatewayEventStream(params: {
    gatewayBaseUrl: string;
    authToken: string | null;
    clientId: string;
    clientVersion?: string;
    /** See `GatewayRpcClientOptions.requestedScopes`. Defaults to `["operator.read"]` when omitted. */
    requestedScopes?: readonly string[];
    preauthHandshakeTimeoutMs?: number;
    gatewayClientOverrides?: GatewayClientOverrideOptions;
    /** See `UseGatewayClientOptions.enableDeviceIdentity`. */
    enableDeviceIdentity?: boolean;
    enabled?: boolean;
    trackLastEventAt?: boolean;
    onEvent: (event: GatewayStreamEvent) => void;
}): GatewayEventStreamState;
```

<a id="symbol-frameworks-react-usegatewayrpc"></a>

## useGatewayRpc

Kind: function

```ts
/**
 * Hook to call a gateway RPC method and optionally refresh on relevant events.
 */
export declare function useGatewayRpc<T>(client: GatewayRpcClient | null, method: string, params?: Record<string, unknown>, options?: {
    refreshOnEvents?: string[];
    deps?: unknown[];
    defaultData?: T | null;
}): {
    data: T | null;
    error: Error | null;
    loading: boolean;
    refresh: () => Promise<void>;
};
```

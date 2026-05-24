// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeGatewayStreamFailure } from "../core/gateway/run/stream-failure.js";
import {
  GatewayRpcError,
  type GatewayConnectionState,
  type GatewayRpcTraceEntry,
  type GatewayStreamEvent,
} from "../core/gateway/rpc/client.js";
import {
  GatewayWebSocketClient,
  tryResolveGatewayTargets,
  type DeviceIdentity,
  type GatewayWebSocketClientOptions,
} from "../core/ws/index.js";

const GatewayRpcClient = GatewayWebSocketClient;
type GatewayRpcClient = GatewayWebSocketClient;
type GatewayRpcClientOptions = GatewayWebSocketClientOptions;

export type { GatewayConnectionState, GatewayRpcTraceEntry, GatewayStreamEvent };

export type GatewayClientContextValue = {
  client: GatewayRpcClient | null;
  state: GatewayConnectionState;
  /** Malformed / unparseable gateway base URL (from provider props). */
  urlError: Error | null;
  /** Transport or gateway handshake failure after a client exists or was attempted. */
  connectionError: Error | null;
  /**
   * @deprecated Use {@link GatewayClientContextValue.urlError} and
   * {@link GatewayClientContextValue.connectionError}. This field mirrors
   * `urlError ?? connectionError` for one release of backward compatibility.
   */
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const GatewayClientContext = createContext<GatewayClientContextValue | null>(null);

export type UseGatewayClientOptions = {
  gatewayBaseUrl: string;
  authToken: string | null;
  clientId: string;
  clientVersion?: string;
  /** See `GatewayRpcClientOptions.requestedScopes`. Defaults to `["operator.read"]` when omitted. */
  requestedScopes?: readonly string[];
  /** See `GatewayRpcClientOptions.preauthHandshakeTimeoutMs` (browser deploys need this when gateway timeout is non-default). */
  preauthHandshakeTimeoutMs?: number;
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

function resolveGatewayRpcClientOptions(params: {
  clientId?: string;
  clientVersion?: string;
  requestedScopes?: readonly string[];
  preauthHandshakeTimeoutMs?: number;
  enableDeviceIdentity?: boolean;
  clientPlatform?: string;
  clientMode?: string;
  onRpcTrace?: GatewayRpcClientOptions["onRpcTrace"];
  deviceIdentityLoader?: GatewayRpcClientOptions["deviceIdentityLoader"];
}): GatewayRpcClientOptions {
  return {
    clientId: params.clientId,
    clientVersion: params.clientVersion,
    requestedScopes: params.requestedScopes,
    preauthHandshakeTimeoutMs: params.preauthHandshakeTimeoutMs,
    enableDeviceIdentity: params.enableDeviceIdentity,
    clientPlatform: params.clientPlatform,
    clientMode: params.clientMode,
    onRpcTrace: params.onRpcTrace,
    deviceIdentityLoader: params.deviceIdentityLoader,
  };
}

function buildGatewayClientConnectionKey(params: {
  wsUrl: string | null;
  authToken: string | null;
  clientOptions: GatewayRpcClientOptions;
}): string | null {
  if (!params.wsUrl || !params.authToken) {
    return null;
  }
  return JSON.stringify({
    wsUrl: params.wsUrl,
    authToken: params.authToken,
    clientId: params.clientOptions.clientId ?? null,
    clientVersion: params.clientOptions.clientVersion ?? null,
    requestedScopes: params.clientOptions.requestedScopes
      ? [...params.clientOptions.requestedScopes]
      : null,
    preauthHandshakeTimeoutMs: params.clientOptions.preauthHandshakeTimeoutMs ?? null,
    enableDeviceIdentity: params.clientOptions.enableDeviceIdentity ?? null,
    clientPlatform: params.clientOptions.clientPlatform ?? null,
    clientMode: params.clientOptions.clientMode ?? null,
  });
}

/**
 * Manages GatewayRpcClient lifecycle and provides it via context.
 * Call connect() to establish the WebSocket connection.
 */
export function useGatewayClient(options: UseGatewayClientOptions): GatewayClientContextValue {
  const {
    gatewayBaseUrl,
    authToken,
    clientId,
    clientVersion,
    requestedScopes,
    preauthHandshakeTimeoutMs,
    enableDeviceIdentity,
    clientPlatform,
    clientMode,
    autoReconnect = false,
    onRpcTrace,
    deviceIdentityLoader,
  } = options;
  const onRpcTraceRef = useRef(onRpcTrace);
  onRpcTraceRef.current = onRpcTrace;
  const target = useMemo(
    () => tryResolveGatewayTargets(gatewayBaseUrl ?? ""),
    [gatewayBaseUrl],
  );
  const clientOptions = useMemo(
    () =>
      resolveGatewayRpcClientOptions({
        clientId,
        clientVersion,
        requestedScopes,
        preauthHandshakeTimeoutMs,
        enableDeviceIdentity,
        clientPlatform,
        clientMode,
        onRpcTrace: (entry) => {
          onRpcTraceRef.current?.(entry);
        },
        deviceIdentityLoader,
      }),
    [
      clientId,
      clientVersion,
      requestedScopes,
      preauthHandshakeTimeoutMs,
      enableDeviceIdentity,
      clientPlatform,
      clientMode,
      deviceIdentityLoader,
    ],
  );
  const connectionKey = useMemo(
    () =>
      buildGatewayClientConnectionKey({
        wsUrl: target?.wsUrl ?? null,
        authToken,
        clientOptions,
      }),
    [target?.wsUrl, authToken, clientOptions],
  );

  const [client, setClient] = useState<GatewayRpcClient | null>(null);
  const [state, setState] = useState<GatewayConnectionState>("idle");
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [urlError, setUrlError] = useState<Error | null>(null);
  const clientRef = useRef<GatewayRpcClient | null>(null);
  const clientKeyRef = useRef<string | null>(null);
  const clientStateUnsubscribeRef = useRef<(() => void) | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const clearClientSubscription = () => {
    if (clientStateUnsubscribeRef.current) {
      clientStateUnsubscribeRef.current();
      clientStateUnsubscribeRef.current = null;
    }
  };

  const trackConnectPromise = (promise: Promise<void>) => {
    const tracked = promise.finally(() => {
      if (connectPromiseRef.current === tracked) {
        connectPromiseRef.current = null;
      }
    });
    connectPromiseRef.current = tracked;
    return tracked;
  };

  const disconnectCurrentClient = useCallback(async () => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    const c = clientRef.current;
    connectPromiseRef.current = null;
    clientKeyRef.current = null;
    clientRef.current = null;
    clearClientSubscription();
    setClient(null);
    setState("idle");
    setConnectionError(null);
    if (c) {
      await c.close();
    }
  }, []);

  const connect = useCallback(async () => {
    if (!target || !authToken || !connectionKey) {
      return;
    }
    const existing = clientRef.current;
    if (existing && clientKeyRef.current === connectionKey) {
      if (existing.getConnectionState() === "connected") {
        return;
      }
      if (connectPromiseRef.current) {
        await connectPromiseRef.current;
        return;
      }
      await trackConnectPromise(existing.connect());
      return;
    }

    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    const prev = clientRef.current;
    connectPromiseRef.current = null;
    clearClientSubscription();
    clientKeyRef.current = null;
    clientRef.current = null;

    const c = new GatewayRpcClient(target.wsUrl, authToken, clientOptions);
    clientKeyRef.current = connectionKey;
    clientRef.current = c;
    setClient(c);
    clientStateUnsubscribeRef.current = c.onStateChange((s, e) => {
      setState(s);
      setConnectionError(e);
    });
    if (prev) {
      void prev.close();
    }
    await trackConnectPromise(c.connect());
  }, [target, authToken, clientOptions, connectionKey]);

  const disconnect = useCallback(async () => {
    await disconnectCurrentClient();
  }, [disconnectCurrentClient]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    if (!autoReconnect) {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }
    if (!connectionKey || urlError) {
      return;
    }
    if (state === "connecting" || state === "connected") {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (state === "connected") {
        reconnectAttemptRef.current = 0;
      }
      return;
    }
    if (state !== "error" || !connectionError) {
      return;
    }
    const norm = normalizeGatewayStreamFailure(connectionError);
    if (!norm.retryable) {
      return;
    }
    if (reconnectTimerRef.current !== null) {
      return;
    }
    const attempt = reconnectAttemptRef.current;
    const delayMs = computeReconnectDelay(attempt);
    reconnectAttemptRef.current = attempt + 1;
    setState("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectRef.current();
    }, delayMs);
  }, [autoReconnect, state, connectionError, connectionKey, urlError]);

  useEffect(() => {
    if (!connectionKey) {
      if (clientRef.current) {
        void disconnectCurrentClient();
      }
      return;
    }
    if (clientRef.current && clientKeyRef.current !== connectionKey) {
      void connectRef.current();
    }
  }, [connectionKey, disconnectCurrentClient]);

  useEffect(() => {
    return () => {
      void disconnectCurrentClient();
    };
  }, [disconnectCurrentClient]);

  useEffect(() => {
    const trimmed = gatewayBaseUrl?.trim() ?? "";
    if (!trimmed) {
      setUrlError(null);
      return;
    }
    if (!target) {
      setUrlError(
        new Error(
          "Invalid gateway URL. Use a full URL such as http://127.0.0.1:18789 (or https://, ws://, wss://).",
        ),
      );
      return;
    }
    setUrlError(null);
  }, [gatewayBaseUrl, target]);

  return {
    client,
    state,
    urlError,
    connectionError,
    error: urlError ?? connectionError,
    connect,
    disconnect,
  };
}

/**
 * Hook to call a gateway RPC method and optionally refresh on relevant events.
 */
export function useGatewayRpc<T>(
  client: GatewayRpcClient | null,
  method: string,
  params: Record<string, unknown> = {},
  options?: { refreshOnEvents?: string[]; deps?: unknown[]; defaultData?: T | null },
): {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(options?.defaultData ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const deps = options?.deps ?? [];
  const refreshOnEvents = options?.refreshOnEvents ?? [];

  const refresh = useCallback(async () => {
    if (!client) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await client.request<T>(method, params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new GatewayRpcError(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, method, JSON.stringify(params), ...deps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!client || refreshOnEvents.length === 0) {
      return undefined;
    }
    const eventSet = new Set(refreshOnEvents);
    const unsubscribe = client.onEvent((event) => {
      if (eventSet.has(event.event)) {
        void refresh();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [client, refresh, JSON.stringify(refreshOnEvents)]);

  return { data, error, loading, refresh };
}

/**
 * Subscribe to specific gateway event types.
 */
export function useGatewayEvents(
  client: GatewayRpcClient | null,
  filter: string | string[] | ((event: GatewayStreamEvent) => boolean),
  handler: (event: GatewayStreamEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client) {
      return undefined;
    }
    const predicate =
      typeof filter === "function"
        ? filter
        : Array.isArray(filter)
          ? (e: GatewayStreamEvent) => filter.includes(e.event)
          : (e: GatewayStreamEvent) => e.event === filter;

    const unsubscribe = client.onEvent((event) => {
      if (predicate(event)) {
        handlerRef.current(event);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [client, filter]);
}

/**
 * Hook for connection status to drive UI indicators.
 */
export function useGatewayConnectionState(client: GatewayRpcClient | null): GatewayConnectionState {
  const [state, setState] = useState<GatewayConnectionState>("idle");

  useEffect(() => {
    if (!client) {
      setState("idle");
      return undefined;
    }
    setState(client.getConnectionState());
    const unsubscribe = client.onStateChange((s, _e) => {
      setState(s);
    });
    return () => {
      unsubscribe();
    };
  }, [client]);

  return state;
}

export type GatewayEventStreamState = {
  state: GatewayConnectionState;
  error: string | null;
  connectedAt: number | null;
  lastEventAt: number | null;
  /** Shared client for RPC calls; null when auth is unavailable. */
  client: GatewayRpcClient | null;
};

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;
const RECONNECT_JITTER_RATIO = 0.2;

function computeReconnectDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    RECONNECT_MAX_DELAY_MS,
    RECONNECT_BASE_DELAY_MS * 2 ** Math.max(0, attempt),
  );
  const jitterSpan = Math.round(exponentialDelay * RECONNECT_JITTER_RATIO);
  const jitter = jitterSpan > 0 ? Math.round((Math.random() * 2 - 1) * jitterSpan) : 0;
  return Math.max(RECONNECT_BASE_DELAY_MS, exponentialDelay + jitter);
}

/**
 * Manages gateway WebSocket connection with auto-reconnect and event forwarding.
 * Drop-in replacement for the Cavi Control UI useGatewayEventStream hook.
 *
 * When the gateway uses a custom pre-auth handshake window, pass the same value
 * as `preauthHandshakeTimeoutMs` so browser clients align token-only connect timing.
 */
export function useGatewayEventStream(params: {
  gatewayBaseUrl: string;
  authToken: string | null;
  clientId: string;
  clientVersion?: string;
  /** See `GatewayRpcClientOptions.requestedScopes`. Defaults to `["operator.read"]` when omitted. */
  requestedScopes?: readonly string[];
  preauthHandshakeTimeoutMs?: number;
  /** See `UseGatewayClientOptions.enableDeviceIdentity`. */
  enableDeviceIdentity?: boolean;
  enabled?: boolean;
  trackLastEventAt?: boolean;
  onEvent: (event: GatewayStreamEvent) => void;
}): GatewayEventStreamState {
  const target = useMemo(
    () => tryResolveGatewayTargets(params.gatewayBaseUrl ?? ""),
    [params.gatewayBaseUrl],
  );
  const clientOptions = useMemo(
    () =>
      resolveGatewayRpcClientOptions({
        clientId: params.clientId,
        clientVersion: params.clientVersion,
        requestedScopes: params.requestedScopes,
        preauthHandshakeTimeoutMs: params.preauthHandshakeTimeoutMs,
        enableDeviceIdentity: params.enableDeviceIdentity,
      }),
    [
      params.clientId,
      params.clientVersion,
      params.requestedScopes,
      params.preauthHandshakeTimeoutMs,
      params.enableDeviceIdentity,
    ],
  );
  const client = useMemo(() => {
    if (!target || !params.authToken) {
      return null;
    }
    return new GatewayRpcClient(target.wsUrl, params.authToken, clientOptions);
  }, [target, params.authToken, clientOptions]);
  const enabled = params.enabled !== false;
  const trackLastEventAt = params.trackLastEventAt !== false;
  const [streamState, setStreamState] = useState<Omit<GatewayEventStreamState, "client">>({
    state: !client || !enabled ? "idle" : "connecting",
    error: null,
    connectedAt: null,
    lastEventAt: null,
  });
  const onEventRef = useRef(params.onEvent);

  useEffect(() => {
    onEventRef.current = params.onEvent;
  }, [params.onEvent]);

  useEffect(() => {
    setStreamState((prev) =>
      prev.lastEventAt === null
        ? prev
        : {
            ...prev,
            lastEventAt: null,
          },
    );
  }, [client, trackLastEventAt]);

  useEffect(() => {
    if (!client) {
      setStreamState({
        state: "idle",
        error: null,
        connectedAt: null,
        lastEventAt: null,
      });
      return undefined;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let hadConnected = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (cancelled) {
        return;
      }
      void client.connect().catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const norm = normalizeGatewayStreamFailure(error);
        if (norm.retryable) {
          scheduleReconnect(norm.error);
          return;
        }
        clearReconnectTimer();
        setStreamState((prev) => ({
          ...prev,
          state: norm.state,
          error: norm.error,
        }));
      });
    };

    const scheduleReconnect = (message: string | null) => {
      if (cancelled || reconnectTimer !== null) {
        return;
      }
      const delayMs = computeReconnectDelay(reconnectAttempts);
      reconnectAttempts += 1;
      setStreamState((prev) => ({
        ...prev,
        state: "reconnecting",
        error: message ?? "gateway websocket closed",
      }));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    if (!enabled) {
      void client.close();
      setStreamState((prev) =>
        prev.state === "idle"
          ? prev
          : {
              ...prev,
              state: "idle",
            },
      );
      return undefined;
    }

    setStreamState((prev) => ({
      ...prev,
      state: "connecting",
      error: null,
    }));

    const unsubscribeState = client.onStateChange((state, error) => {
      if (cancelled) {
        return;
      }
      if (state === "connected") {
        hadConnected = true;
        reconnectAttempts = 0;
        clearReconnectTimer();
        setStreamState((prev) => ({
          ...prev,
          state: "connected",
          error: null,
          connectedAt: Date.now(),
        }));
        return;
      }
      if (state === "connecting") {
        setStreamState((prev) => ({
          ...prev,
          state: hadConnected || reconnectAttempts > 0 ? "reconnecting" : "connecting",
          error: prev.state === "reconnecting" ? prev.error : null,
        }));
        return;
      }
      if (state === "error") {
        const norm = normalizeGatewayStreamFailure(error);
        if (norm.retryable) {
          scheduleReconnect(norm.error);
          return;
        }
        clearReconnectTimer();
        setStreamState((prev) => ({ ...prev, state: norm.state, error: norm.error }));
        return;
      }
      if (state === "idle" && hadConnected) {
        scheduleReconnect(error?.message ?? null);
        return;
      }
      clearReconnectTimer();
      setStreamState((prev) => ({
        ...prev,
        state: "idle",
        error: null,
        connectedAt: null,
      }));
    });

    const unsubscribeEvents = client.onEvent((event) => {
      if (trackLastEventAt) {
        setStreamState((prev) => ({
          ...prev,
          lastEventAt: Date.now(),
        }));
      }
      onEventRef.current(event);
    });

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      unsubscribeEvents();
      unsubscribeState();
      void client.close();
    };
  }, [client, enabled, trackLastEventAt]);

  return { ...streamState, client };
}

export type GatewayClientProviderProps = {
  gatewayBaseUrl: string;
  authToken: string | null;
  clientId: string;
  clientVersion?: string;
  /** Same as `GatewayRpcClientOptions.requestedScopes`. */
  requestedScopes?: readonly string[];
  /** Same as `GatewayRpcClientOptions.preauthHandshakeTimeoutMs`. */
  preauthHandshakeTimeoutMs?: number;
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

/**
 * Provider that creates and manages a shared GatewayRpcClient for the subtree.
 */
export function GatewayClientProvider({
  gatewayBaseUrl,
  authToken,
  clientId,
  clientVersion,
  requestedScopes,
  preauthHandshakeTimeoutMs,
  enableDeviceIdentity,
  clientPlatform,
  clientMode,
  autoReconnect,
  onRpcTrace,
  deviceIdentityLoader,
  children,
}: GatewayClientProviderProps): React.ReactElement {
  const value = useGatewayClient({
    gatewayBaseUrl,
    authToken,
    clientId,
    clientVersion,
    requestedScopes,
    preauthHandshakeTimeoutMs,
    enableDeviceIdentity,
    clientPlatform,
    clientMode,
    autoReconnect,
    onRpcTrace,
    deviceIdentityLoader,
  });

  return <GatewayClientContext.Provider value={value}>{children}</GatewayClientContext.Provider>;
}

/**
 * Access the gateway client from context.
 */
export function useGatewayClientContext(): GatewayClientContextValue {
  const ctx = useContext(GatewayClientContext);
  if (!ctx) {
    throw new Error("useGatewayClientContext must be used within GatewayClientProvider");
  }
  return ctx;
}

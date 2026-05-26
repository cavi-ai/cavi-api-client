// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

import { buildDeviceAuthPayloadV3, signPayload } from "./device-crypto.js";
import {
  loadOrCreateDeviceIdentity,
  isDeviceIdentitySupported,
  type DeviceIdentity,
} from "./device-store.js";
import { GatewayRpcError } from "./error.js";
import {
  GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS,
  resolveDeviceTokenOnlyFallbackMs,
  type GatewayPreauthHandshakeEnv,
  type GatewayPreauthHandshakeEnvKeys,
} from "./preauth-handshake.js";
import {
  describeWebSocketClose,
  type WebSocketCloseLike,
} from "../../ws/close.js";

declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

export { GatewayRpcError } from "./error.js";
export {
  DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS,
  GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS,
  resolvePreauthHandshakeTimeoutMs,
  resolveDeviceTokenOnlyFallbackMs,
  resolvePreauthHandshakeTimeoutMsFromEnv,
  type GatewayPreauthHandshakeEnv,
  type GatewayPreauthHandshakeEnvKeys,
  type ResolvePreauthHandshakeTimeoutMsParams,
  type ResolveDeviceTokenOnlyFallbackMsParams,
} from "./preauth-handshake.js";
export { signPayload } from "./device-crypto.js";

export {
  loadOrCreateDeviceIdentity,
  isDeviceIdentitySupported,
  type DeviceIdentity,
} from "./device-store.js";

export {
  BASELINE_SESSIONS_LIST_PARAMS,
  EMPTY_SESSIONS_USAGE,
  SESSIONS_DETAIL_CACHE_TTL_MS,
  canonicalizeSessionDetailParams,
  canonicalizeSessionsListParams,
  canonicalizeSessionsPreviewParams,
  canonicalizeSessionsUsageParams,
  createSessionLoaders,
  isUnchangedSessionsListPayload,
  normalizeSessionsListPayload,
  type SessionDetailPayload,
  type SessionDetailRequestParams,
  type SessionLoaders,
  type SessionPatchInput,
  type SessionsListPayloadWithCache,
  type SessionsListRequestParams,
  type SessionsListRpcPayload,
  type SessionsListUnchangedPayload,
  type SessionsPreviewRequestParams,
} from "../snapshots/session-loaders.js";

type GatewayRpcRequest = {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type GatewayRpcResponse = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string };
};

type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
};

type GatewayHello = {
  type: "hello-ok";
  protocol: number;
  auth?: {
    scopes?: string[];
    role?: string;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type QueuedRequest = {
  resolve: () => void;
  reject: (error: Error) => void;
};

export type GatewayStreamEvent = {
  event: string;
  payload: unknown;
};

export type GatewayConnectionState =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_RPC_REQUESTS = 3;
export const DEFAULT_GATEWAY_PROTOCOL_VERSION = 4;
const DEFAULT_GATEWAY_RPC_CLIENT_VERSION = "0.1.0";
const DEFAULT_GATEWAY_RPC_CLIENT_SCOPES = ["operator.read"] as const;

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
  error?: { name: string; message: string; code?: string };
};

export type GatewayRpcClientOptions = {
  clientId?: string;
  clientVersion?: string;
  clientMode?: string;
  clientPlatform?: string;
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

function normalizeGatewayScopes(scopes: readonly string[] | undefined): string[] {
  if (!scopes || scopes.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const scope of scopes) {
    if (typeof scope !== "string") {
      continue;
    }
    const trimmed = scope.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function resolveGatewayConnectScopes(
  options?: GatewayRpcClientOptions,
): string[] {
  const requested = normalizeGatewayScopes(options?.requestedScopes);
  if (requested.length > 0) {
    return requested;
  }
  const defaultRequested = normalizeGatewayScopes(options?.defaultRequestedScopes);
  if (defaultRequested.length > 0) {
    return defaultRequested;
  }
  return [...DEFAULT_GATEWAY_RPC_CLIENT_SCOPES];
}

/** Resolved client fields for `connect` and device-auth v3 signing (must stay aligned). */
export type ResolvedGatewayRpcClientProfile = {
  clientId: string;
  clientVersion: string;
  clientPlatform: string;
  clientMode: string;
};

export function resolveGatewayRpcClientProfile(
  options?: GatewayRpcClientOptions,
): ResolvedGatewayRpcClientProfile {
  const clientId = options?.clientId?.trim();
  if (!clientId) {
    throw new Error(
      "Missing clientId. Pass clientId to useGatewayEventStream, GatewayClientProvider, or useGatewayClient.",
    );
  }
  return {
    clientId,
    clientVersion: options?.clientVersion ?? DEFAULT_GATEWAY_RPC_CLIENT_VERSION,
    clientPlatform: options?.clientPlatform ?? "web",
    clientMode: options?.clientMode ?? "webchat",
  };
}

function resolveGatewayProtocolRange(options?: GatewayRpcClientOptions): {
  minProtocol: number;
  maxProtocol: number;
} {
  const minProtocol = options?.minProtocol ?? DEFAULT_GATEWAY_PROTOCOL_VERSION;
  const maxProtocol = options?.maxProtocol ?? DEFAULT_GATEWAY_PROTOCOL_VERSION;
  if (
    !Number.isInteger(minProtocol) ||
    !Number.isInteger(maxProtocol) ||
    minProtocol < 1 ||
    maxProtocol < 1 ||
    minProtocol > maxProtocol
  ) {
    throw new Error("Gateway protocol range must be positive integers with minProtocol <= maxProtocol.");
  }
  return { minProtocol, maxProtocol };
}

/** Defaults for React Native while preserving caller-provided client identity. */
export function mergeGatewayRpcClientOptionsForReactNative(
  options?: GatewayRpcClientOptions,
): GatewayRpcClientOptions {
  return {
    ...options,
    enableDeviceIdentity: options?.enableDeviceIdentity ?? true,
    clientPlatform: options?.clientPlatform ?? "react-native",
    clientMode: options?.clientMode,
  };
}

export function createGatewayRpcConnectParams(params: {
  authToken: string | null;
  userAgent: string;
  locale: string;
  options?: GatewayRpcClientOptions;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  } | null;
}): Record<string, unknown> {
  const client = resolveGatewayRpcClientProfile(params.options);
  const protocol = resolveGatewayProtocolRange(params.options);
  const result: Record<string, unknown> = {
    minProtocol: protocol.minProtocol,
    maxProtocol: protocol.maxProtocol,
    client: {
      id: client.clientId,
      version: client.clientVersion,
      platform: client.clientPlatform,
      mode: client.clientMode,
    },
    role: "operator",
    scopes: resolveGatewayConnectScopes(params.options),
    caps: [],
    auth: params.authToken
      ? {
          token: params.authToken,
          password: params.authToken,
        }
      : undefined,
    userAgent: params.userAgent,
    locale: params.locale,
  };
  if (params.device) {
    result.device = params.device;
  }
  return result;
}

function normalizeGatewayRpcError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode = "gateway_error",
): GatewayRpcError {
  if (error instanceof GatewayRpcError) {
    return error;
  }
  if (error instanceof Error) {
    return new GatewayRpcError(error.message, fallbackCode);
  }
  return new GatewayRpcError(fallbackMessage, fallbackCode);
}

function redactGatewayRpcTraceParams(
  method: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const clone = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
    if (method === "connect") {
      const auth = clone.auth;
      if (auth && typeof auth === "object" && !Array.isArray(auth)) {
        const a = auth as Record<string, unknown>;
        if (typeof a.token === "string") a.token = "***";
        if (typeof a.password === "string") a.password = "***";
      }
      const device = clone.device;
      if (device && typeof device === "object" && !Array.isArray(device)) {
        const d = device as Record<string, unknown>;
        if (typeof d.signature === "string") d.signature = "***";
        if (typeof d.publicKey === "string" && d.publicKey.length > 24) {
          d.publicKey = `${String(d.publicKey).slice(0, 12)}…(redacted)`;
        }
      }
    }
    return clone;
  } catch {
    return { _redactionNote: "params not JSON-serializable", method };
  }
}

function summarizeRpcTraceResult(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}…[truncated ${s.length - maxChars} chars]`;
  } catch {
    return String(value);
  }
}

function serializeRpcTraceError(error: Error): {
  name: string;
  message: string;
  code?: string;
} {
  if (error instanceof GatewayRpcError) {
    return { name: error.name, message: error.message, code: error.code };
  }
  return { name: error.name, message: error.message };
}

function createGatewaySocketClosedError(
  event?: WebSocketCloseLike | null,
): GatewayRpcError {
  const closed = describeWebSocketClose(event, "gateway closed");
  return new GatewayRpcError(
    closed.code === null && closed.reason === null
      ? "gateway websocket closed"
      : closed.message,
    "socket_closed",
  );
}

function readGatewayPreauthHandshakeEnv(): GatewayPreauthHandshakeEnv | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  const env: Record<string, string | undefined> = {
    [GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.timeoutMs]:
      process.env[GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.timeoutMs],
  };
  if (GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testTimeoutMs) {
    env[GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testTimeoutMs] =
      process.env[GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testTimeoutMs];
  }
  if (GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testFlag) {
    env[GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testFlag] =
      process.env[GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS.testFlag];
  }
  return env;
}

function resolvePositiveIntegerOption(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export class GatewayRpcClient {
  private socket: WebSocket | null = null;

  private connectPromise: Promise<void> | null = null;

  private pending = new Map<string, PendingRequest>();

  private activeRpcRequests = 0;

  private queuedRpcRequests: QueuedRequest[] = [];

  private sequence = 0;

  private connected = false;

  /** Set when a connect RPC is explicitly rejected (auth failure, etc.) so onClose
   *  does not emit a retryable socket_closed error that triggers an infinite reconnect loop. */
  private connectRejected = false;

  private eventListeners = new Set<(event: GatewayStreamEvent) => void>();

  private stateListeners = new Set<
    (state: GatewayConnectionState, error: Error | null) => void
  >();

  private state: GatewayConnectionState = "idle";

  private lastError: Error | null = null;

  private intentionalClose = false;

  private emitRpcTrace(entry: GatewayRpcTraceEntry): void {
    const hook = this.options.onRpcTrace;
    if (!hook) {
      return;
    }
    try {
      hook(entry);
    } catch {
      /* ignore observer failures */
    }
  }

  private deviceIdentity: DeviceIdentity | null = null;

  private deviceIdentityReady: Promise<void>;

  /** Incremented on each connect attempt; stale async connect paths must not resolve the outer promise. */
  private connectAttemptSeq = 0;

  constructor(
    private readonly wsUrl: string,
    private readonly authToken: string | null,
    private readonly options: GatewayRpcClientOptions = {},
  ) {
    const enableDevice = options.enableDeviceIdentity !== false;
    const identityLoader =
      enableDevice && options.deviceIdentityLoader
        ? options.deviceIdentityLoader
        : enableDevice && isDeviceIdentitySupported()
          ? loadOrCreateDeviceIdentity
          : null;
    if (identityLoader) {
      this.deviceIdentityReady = identityLoader().then(
        (identity) => {
          this.deviceIdentity = identity;
        },
        () => {
          /* graceful degradation */
        },
      );
    } else {
      this.deviceIdentityReady = Promise.resolve();
    }
  }

  getConnectionState(): GatewayConnectionState {
    return this.state;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  onEvent(listener: (event: GatewayStreamEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onStateChange(
    listener: (state: GatewayConnectionState, error: Error | null) => void,
  ): () => void {
    this.stateListeners.add(listener);
    // Defer the initial snapshot so React subscribers don't run setState synchronously
    // during the same commit as subscribe (Strict Mode / navigation mount → "state update
    // before component mounted" warnings on RN/React 19).
    const deliverInitial = () => {
      if (!this.stateListeners.has(listener)) {
        return;
      }
      listener(this.state, this.lastError);
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(deliverInitial);
    } else {
      void Promise.resolve().then(deliverInitial);
    }
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  async request<TPayload>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<TPayload> {
    await this.ensureConnected();
    return this.runWithRpcBackpressure(() =>
      this.requestRaw<TPayload>(method, params),
    );
  }

  async close(): Promise<void> {
    this.connectAttemptSeq += 1;
    this.intentionalClose = true;
    this.connected = false;
    this.connectPromise = null;
    if (!this.socket) {
      this.setState("idle", null);
      return;
    }
    this.socket.close();
    this.socket = null;
    for (const pending of this.pending.values()) {
      pending.reject(new GatewayRpcError("connection closed", "closed"));
    }
    this.pending.clear();
    this.rejectQueuedRpcRequests(
      new GatewayRpcError("connection closed", "closed"),
    );
    this.setState("idle", null);
  }

  private setState(state: GatewayConnectionState, error: Error | null): void {
    this.state = state;
    this.lastError = error;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }

  private getConnectClientInfo(): { userAgent: string; locale: string } {
    if (typeof navigator !== "undefined") {
      return {
        userAgent: navigator.userAgent,
        locale: navigator.language,
      };
    }
    return { userAgent: "unknown", locale: "en" };
  }

  private async ensureConnected(): Promise<void> {
    if (
      this.connected &&
      this.socket &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.setState("connecting", null);
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.socket = ws;
      this.intentionalClose = false;
      this.connectRejected = false;
      let connectPhase: "waiting" | "requesting" | "settled" = "waiting";
      let connectTimer: ReturnType<typeof setTimeout> | null = null;

      const clearConnectTimer = () => {
        if (connectTimer !== null) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
      };

      const { userAgent, locale } = this.getConnectClientInfo();

      const preferDeviceChallengeFirst =
        this.options.enableDeviceIdentity !== false &&
        Boolean(this.options.deviceIdentityLoader ?? isDeviceIdentitySupported());
      const handshakeEnv =
        this.options.preauthHandshakeEnv ?? readGatewayPreauthHandshakeEnv();
      const tokenOnlyFallbackMs = preferDeviceChallengeFirst
        ? resolveDeviceTokenOnlyFallbackMs({
            env: handshakeEnv,
            envKeys: this.options.preauthHandshakeEnvKeys,
            preauthHandshakeTimeoutMs: this.options.preauthHandshakeTimeoutMs,
          })
        : 0;

      const isCurrentOpenSocket = () =>
        this.socket === ws && ws.readyState === WebSocket.OPEN;

      const sendConnect = (nonce?: string) => {
        if (connectPhase !== "waiting" || !isCurrentOpenSocket()) {
          return;
        }
        clearConnectTimer();
        connectPhase = "requesting";
        const seq = ++this.connectAttemptSeq;

        const doConnect = async () => {
          await this.deviceIdentityReady;

          let device: {
            id: string;
            publicKey: string;
            signature: string;
            signedAt: number;
            nonce: string;
          } | null = null;
          if (this.deviceIdentity && nonce) {
            const client = resolveGatewayRpcClientProfile(this.options);
            const role = "operator";
            const scopes = resolveGatewayConnectScopes(this.options);
            const signedAtMs = Date.now();
            const token = this.authToken ?? "";

            const payload = buildDeviceAuthPayloadV3({
              deviceId: this.deviceIdentity.deviceId,
              clientId: client.clientId,
              clientMode: client.clientMode,
              role,
              scopes,
              signedAtMs,
              token,
              nonce,
              platform: client.clientPlatform,
            });
            const signature = await signPayload(
              this.deviceIdentity.privateKey,
              payload,
            );

            device = {
              id: this.deviceIdentity.deviceId,
              publicKey: this.deviceIdentity.publicKeyBase64Url,
              signature,
              signedAt: signedAtMs,
              nonce,
            };
          }

          return this.requestRaw<GatewayHello>(
            "connect",
            createGatewayRpcConnectParams({
              authToken: this.authToken,
              userAgent,
              locale,
              options: this.options,
              device,
            }),
          );
        };

        void doConnect()
          .then(() => {
            if (seq !== this.connectAttemptSeq || connectPhase === "settled") {
              return;
            }
            if (!isCurrentOpenSocket()) {
              connectPhase = "settled";
              const closeError = createGatewaySocketClosedError();
              reject(closeError);
              return;
            }
            connectPhase = "settled";
            this.connected = true;
            this.setState("connected", null);
            resolve();
          })
          .catch((error) => {
            if (seq !== this.connectAttemptSeq || connectPhase === "settled") {
              return;
            }
            if (this.connected) {
              return;
            }
            connectPhase = "settled";
            const normalizedError = normalizeGatewayRpcError(
              error,
              "gateway connect failed",
              "connect_failed",
            );
            this.setState("error", normalizedError);
            this.connectRejected = true;
            this.intentionalClose = true;
            if (
              ws.readyState === WebSocket.OPEN ||
              ws.readyState === WebSocket.CONNECTING
            ) {
              ws.close();
            }
            reject(normalizedError);
          });
      };

      const onOpen = () => {
        if (tokenOnlyFallbackMs <= 0) {
          sendConnect(undefined);
          return;
        }
        connectTimer = setTimeout(() => {
          sendConnect(undefined);
        }, tokenOnlyFallbackMs);
      };

      const onMessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data) as {
              type?: unknown;
              event?: unknown;
              payload?: { nonce?: string };
            };
            if (
              connectPhase === "waiting" &&
              parsed.type === "event" &&
              parsed.event === "connect.challenge" &&
              isCurrentOpenSocket()
            ) {
              const nonce =
                typeof parsed.payload?.nonce === "string"
                  ? parsed.payload.nonce
                  : undefined;
              sendConnect(nonce);
              return;
            }
          } catch {
            // Let the regular frame handler ignore invalid payloads.
          }
        }
        this.handleMessage(event);
      };

      const onError = () => {
        clearConnectTimer();
        const error = new GatewayRpcError(
          "gateway websocket failed",
          "socket_error",
        );
        this.setState("error", error);
        if (connectPhase !== "settled") {
          connectPhase = "settled";
        }
        reject(error);
      };

      const onClose = (event: Event) => {
        clearConnectTimer();
        this.connected = false;
        this.connectPromise = null;
        if (this.socket === ws) {
          this.socket = null;
        }
        const closeError = createGatewaySocketClosedError(
          event as WebSocketCloseLike,
        );
        for (const pending of this.pending.values()) {
          pending.reject(closeError);
        }
        this.pending.clear();
        this.rejectQueuedRpcRequests(closeError);
        if (this.connectRejected) {
          this.intentionalClose = false;
          this.connectRejected = false;
          return;
        }
        if (this.intentionalClose) {
          this.intentionalClose = false;
          return;
        }
        this.setState("error", closeError);
        if (connectPhase !== "settled") {
          connectPhase = "settled";
          reject(closeError);
        }
      };

      ws.addEventListener("open", onOpen, { once: true });
      ws.addEventListener("message", onMessage);
      ws.addEventListener("error", onError, { once: true });
      ws.addEventListener("close", onClose);
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async requestRaw<TPayload>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<TPayload> {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new GatewayRpcError(
        "gateway websocket is not connected",
        "socket_unavailable",
      );
    }

    // Per-client monotonic sequence + time; duplicate ids across tabs/processes are negligible for this protocol.
    const id = `mc-${Date.now()}-${this.sequence++}`;
    const frame: GatewayRpcRequest = {
      type: "req",
      id,
      method,
      params,
    };

    const startedAt = Date.now();
    const redactedParams = redactGatewayRpcTraceParams(method, params);

    return await new Promise<TPayload>((resolve, reject) => {
      const emitDone = (
        outcome:
          | {
              ok: true;
              value: unknown;
            }
          | {
              ok: false;
              error: Error;
            },
      ): void => {
        const durationMs = Date.now() - startedAt;
        if (outcome.ok) {
          this.emitRpcTrace({
            at: Date.now(),
            transport: "websocket",
            correlationId: id,
            method,
            durationMs,
            ok: true,
            params: redactedParams,
            resultPreview: summarizeRpcTraceResult(outcome.value, 24_000),
          });
        } else {
          this.emitRpcTrace({
            at: Date.now(),
            transport: "websocket",
            correlationId: id,
            method,
            durationMs,
            ok: false,
            params: redactedParams,
            error: serializeRpcTraceError(outcome.error),
          });
        }
      };

      const requestTimeoutMs = resolvePositiveIntegerOption(
        this.options.requestTimeoutMs,
        REQUEST_TIMEOUT_MS,
      );
      const timeout = setTimeout(() => {
        const p = this.pending.get(id);
        this.pending.delete(id);
        if (p) {
          p.reject(
            new GatewayRpcError(`request timed out: ${method}`, "timeout"),
          );
        }
      }, requestTimeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          emitDone({ ok: true, value });
          resolve(value as TPayload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          const err = error instanceof Error ? error : new Error(String(error));
          emitDone({ ok: false, error: err });
          reject(err);
        },
      });

      try {
        ws.send(JSON.stringify(frame));
      } catch (error) {
        const p = this.pending.get(id);
        this.pending.delete(id);
        clearTimeout(timeout);
        const err = normalizeGatewayRpcError(
          error,
          `gateway request failed: ${method}`,
          "socket_error",
        );
        if (p) {
          p.reject(err);
        } else {
          reject(err);
        }
      }
    });
  }

  private async runWithRpcBackpressure<TPayload>(
    run: () => Promise<TPayload>,
  ): Promise<TPayload> {
    let slotReserved = false;
    const maxConcurrentRequests = resolvePositiveIntegerOption(
      this.options.maxConcurrentRequests,
      MAX_CONCURRENT_RPC_REQUESTS,
    );
    if (this.activeRpcRequests >= maxConcurrentRequests) {
      await new Promise<void>((resolve, reject) => {
        this.queuedRpcRequests.push({
          resolve: () => {
            slotReserved = true;
            resolve();
          },
          reject,
        });
      });
    }

    if (!slotReserved) {
      this.activeRpcRequests += 1;
    }
    try {
      return await run();
    } finally {
      this.activeRpcRequests = Math.max(0, this.activeRpcRequests - 1);
      this.drainQueuedRpcRequests();
    }
  }

  private drainQueuedRpcRequests(): void {
    const maxConcurrentRequests = resolvePositiveIntegerOption(
      this.options.maxConcurrentRequests,
      MAX_CONCURRENT_RPC_REQUESTS,
    );
    while (
      this.activeRpcRequests < maxConcurrentRequests &&
      this.queuedRpcRequests.length > 0
    ) {
      const next = this.queuedRpcRequests.shift();
      next?.resolve();
      this.activeRpcRequests += 1;
    }
  }

  private rejectQueuedRpcRequests(error: Error): void {
    const queued = this.queuedRpcRequests.splice(0);
    for (const request of queued) {
      request.reject(error);
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const eventFrame = parsed as Partial<GatewayEventFrame>;
    if (eventFrame.type === "event" && typeof eventFrame.event === "string") {
      const streamEvent: GatewayStreamEvent = {
        event: eventFrame.event,
        payload: eventFrame.payload,
      };
      for (const listener of this.eventListeners) {
        listener(streamEvent);
      }
      return;
    }

    const frame = parsed as Partial<GatewayRpcResponse>;
    if (frame.type !== "res" || typeof frame.id !== "string") {
      return;
    }

    const pending = this.pending.get(frame.id);
    if (!pending) {
      return;
    }
    this.pending.delete(frame.id);

    if (!frame.ok) {
      const message = frame.error?.message ?? "gateway request failed";
      pending.reject(
        new GatewayRpcError(message, frame.error?.code ?? "request_failed"),
      );
      return;
    }

    pending.resolve(frame.payload);
  }
}

export {
  resolveGatewayTargets,
  tryResolveGatewayTargets,
} from "../../ws/targets.js";

export {
  PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER,
  PORTAL_CONFIG_PATCH_CONTRACT,
  PORTAL_CONFIG_PATCH_CONTRACT_VERSION,
  PortalConfigPatchError,
  portalConfigPatchPath,
  postPortalConfigPatch,
  unflattenPortalConfigPatchKeys,
  type PortalConfigPatchRequestBody,
  type PostPortalConfigPatchParams,
} from "../portal/config-patch.js";

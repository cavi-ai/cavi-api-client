import {
  abortableSleep,
  computeBackoffDelay,
  validateTransportRetryPolicy,
} from "./backoff.js";
import type { TransportMessageChannel } from "./channel.js";
import { TransportError } from "./error.js";
import { createTransportLifecycle } from "./lifecycle.js";
import type {
  TransportDependencies,
  TransportLifecycleEvent,
  TransportReconnectPolicy,
} from "./types.js";

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface WebSocketTransport {
  connect(options: WebSocketConnectOptions): TransportMessageChannel<unknown> &
    Readonly<{ ready: Promise<void> }>;
}

export type WebSocketConnectOptions = Readonly<{
  url: string | (() => string | Promise<string>);
  protocols?: readonly string[] | (() => readonly string[] | Promise<readonly string[]>);
  reconnect?: TransportReconnectPolicy;
  signal?: AbortSignal;
  decode?: (data: unknown) => unknown | Promise<unknown>;
  encode?: (message: unknown) => string | ArrayBufferLike | Blob | ArrayBufferView;
}>;

export type WebSocketTransportOptions = Readonly<{
  webSocketFactory?: (url: string, protocols?: readonly string[]) => WebSocketLike;
  /** Maximum accepted inbound frame size in bytes. Defaults to 16 MiB. */
  maxFrameBytes?: number;
  dependencies?: Partial<TransportDependencies>;
  onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;

const noReconnect: TransportReconnectPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

const DEFAULT_MAX_FRAME_BYTES = 16 * 1024 * 1024;
const textEncoder = new TextEncoder();

function resolveMaxFrameBytes(value: number | undefined): number {
  const limit = value ?? DEFAULT_MAX_FRAME_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError("maxFrameBytes must be a positive safe integer");
  }
  return limit;
}

function inboundFrameExceedsLimit(data: unknown, maxFrameBytes: number): boolean {
  if (typeof data === "string") {
    return data.length > maxFrameBytes || textEncoder.encode(data).byteLength > maxFrameBytes;
  }
  if (data instanceof ArrayBuffer) return data.byteLength > maxFrameBytes;
  if (ArrayBuffer.isView(data)) return data.byteLength > maxFrameBytes;
  if (typeof Blob === "function" && data instanceof Blob) return data.size > maxFrameBytes;
  return false;
}

function defaultFactory(url: string, protocols?: readonly string[]): WebSocketLike {
  if (typeof globalThis.WebSocket !== "function") {
    throw new TransportError("WebSocket is unavailable", {
      metadata: {
        kind: "websocket", phase: "configure", operation: "connect", retryable: false, attempt: 1,
      },
    });
  }
  return new globalThis.WebSocket(url, protocols ? [...protocols] : undefined);
}

function defaultDecode(data: unknown): unknown {
  if (typeof data === "string") return JSON.parse(data) as unknown;
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as unknown;
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(new TextDecoder().decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    )) as unknown;
  }
  return data;
}

function defaultEncode(message: unknown): string {
  const encoded = JSON.stringify(message);
  if (typeof encoded !== "string") throw new TypeError("Message is not JSON encodable");
  return encoded;
}

export function createWebSocketTransport(
  transportOptions: WebSocketTransportOptions = {},
): WebSocketTransport {
  const factory = transportOptions.webSocketFactory ?? defaultFactory;
  const dependencies: TransportDependencies = {
    now: transportOptions.dependencies?.now ?? (() => Date.now()),
    random: transportOptions.dependencies?.random ?? (() => Math.random()),
    sleep: transportOptions.dependencies?.sleep ?? abortableSleep,
  };
  const lifecycle = createTransportLifecycle(transportOptions.onLifecycleEvent);
  const maxFrameBytes = resolveMaxFrameBytes(transportOptions.maxFrameBytes);

  return {
    connect(connectOptions) {
      const policy = connectOptions.reconnect ?? noReconnect;
      validateTransportRetryPolicy(policy);
      const listeners = new Set<(message: unknown) => void>();
      const closeListeners = new Set<(error?: unknown) => void>();
      const controller = new AbortController();
      const startedAt = dependencies.now();
      let socket: WebSocketLike | undefined;
      let cleanupSocket = () => {};
      let attempt = 1;
      let opened = false;
      let terminal = false;
      let closeError: unknown;
      let resolveReady!: () => void;
      let rejectReady!: (error: unknown) => void;
      const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      void ready.catch(() => undefined);

      const makeError = (
        message: string,
        phase: "configure" | "connect" | "request" | "decode" | "close",
        retryable: boolean,
        status?: number,
      ) => new TransportError(message, {
        metadata: {
          kind: "websocket", phase, operation: phase === "request" ? "send" : "connect",
          retryable, attempt, ...(status === undefined ? {} : { status }),
        },
      });

      const finish = (error?: unknown): void => {
        if (terminal) return;
        terminal = true;
        closeError = error;
        controller.abort();
        cleanupSocket();
        connectOptions.signal?.removeEventListener("abort", onAbort);
        if (!opened) rejectReady(error ?? makeError("WebSocket connection closed", "close", false));
        lifecycle.emit({ state: "closed", kind: "websocket", operation: "connect", attempt });
        const current = [...closeListeners];
        closeListeners.clear();
        listeners.clear();
        for (const listener of current) {
          try { listener(error); } catch { /* Close observers are isolated. */ }
        }
      };

      const closeSocket = (): void => {
        const current = socket;
        cleanupSocket();
        if (current && current.readyState < 2) {
          try { current.close(); } catch { /* Closing is best effort. */ }
        }
      };

      const failDecode = (origin: WebSocketLike): void => {
        if (terminal || origin !== socket) return;
        const error = makeError("WebSocket message decoding failed", "decode", false);
        closeSocket();
        finish(error);
      };

      const attach = (current: WebSocketLike): void => {
        socket = current;
        let decodeChain = Promise.resolve();
        let disconnectHandled = false;
        const onOpen: EventListener = () => {
          if (terminal || current !== socket) return;
          opened = true;
          lifecycle.emit({
            state: attempt === 1 ? "connected" : "reconnected",
            kind: "websocket", operation: "connect", attempt,
          });
          resolveReady();
        };
        const onMessage: EventListener = (event) => {
          const data = (event as Event & { data?: unknown }).data;
          if (inboundFrameExceedsLimit(data, maxFrameBytes)) {
            failDecode(current);
            return;
          }
          const deliver = (message: unknown): void => {
            if (terminal || current !== socket) return;
            for (const listener of [...listeners]) {
              try { listener(message); } catch { /* Message observers are isolated. */ }
            }
          };
          decodeChain = decodeChain.then(async () => {
            if (terminal || current !== socket) return;
            const decoded = await (connectOptions.decode ?? defaultDecode)(data);
            deliver(decoded);
          }).catch(() => failDecode(current));
        };
        const disconnect = (code: number, wasClean: boolean): void => {
          if (disconnectHandled || terminal || current !== socket) return;
          disconnectHandled = true;
          void handleClose(code, wasClean);
        };
        const onError: EventListener = () => {
          if (current.readyState === 3) disconnect(1006, false);
        };
        const onClose: EventListener = (event) => {
          const close = event as Event & { code?: number; wasClean?: boolean };
          disconnect(close.code ?? 1006, close.wasClean ?? false);
        };
        current.addEventListener("open", onOpen);
        current.addEventListener("message", onMessage);
        current.addEventListener("error", onError);
        current.addEventListener("close", onClose);
        cleanupSocket = () => {
          current.removeEventListener("open", onOpen);
          current.removeEventListener("message", onMessage);
          current.removeEventListener("error", onError);
          current.removeEventListener("close", onClose);
        };
      };

      const resolveValue = async <T>(value: T | (() => T | Promise<T>)): Promise<T> =>
        typeof value === "function" ? (value as () => T | Promise<T>)() : value;

      const startAsync = async (): Promise<void> => {
        try {
          const url = await resolveValue(connectOptions.url);
          const protocols = connectOptions.protocols === undefined
            ? undefined
            : await resolveValue(connectOptions.protocols);
          if (terminal) return;
          attach(factory(url, protocols));
        } catch {
          finish(makeError("WebSocket connection failed", "connect", false));
        }
      };

      const start = (): void => {
        lifecycle.emit({ state: "connecting", kind: "websocket", operation: "connect", attempt });
        if (typeof connectOptions.url === "string" &&
          (connectOptions.protocols === undefined || Array.isArray(connectOptions.protocols))) {
          try { attach(factory(connectOptions.url, connectOptions.protocols as readonly string[] | undefined)); }
          catch { finish(makeError("WebSocket connection failed", "connect", false)); }
          return;
        }
        void startAsync();
      };

      const handleClose = async (code: number, wasClean: boolean): Promise<void> => {
        if (terminal) return;
        cleanupSocket();
        const retryable = !wasClean && code !== 1000;
        if (!retryable || attempt >= policy.maxAttempts) {
          finish(makeError("WebSocket connection closed", "close", false, code));
          return;
        }
        const delayMs = computeBackoffDelay(policy, attempt, dependencies.random());
        if (policy.deadlineMs !== undefined &&
          dependencies.now() - startedAt + delayMs > policy.deadlineMs) {
          finish(makeError("WebSocket connection closed", "close", false, code));
          return;
        }
        lifecycle.emit({ state: "retrying", kind: "websocket", operation: "connect", attempt, delayMs });
        try { await dependencies.sleep(delayMs, controller.signal); }
        catch { if (!terminal) finish(makeError("WebSocket connection closed", "close", false, code)); return; }
        if (terminal) return;
        attempt += 1;
        start();
      };

      function onAbort(): void {
        if (terminal) return;
        closeSocket();
        finish(makeError("WebSocket connection aborted", "close", false));
      }
      if (connectOptions.signal?.aborted) onAbort();
      else connectOptions.signal?.addEventListener("abort", onAbort, { once: true });
      if (!terminal) start();

      return {
        ready,
        async send(message, signal) {
          if (signal?.aborted) throw makeError("WebSocket send aborted", "request", false);
          if (terminal || socket?.readyState !== 1) {
            throw makeError("WebSocket is not open", "request", false);
          }
          let encoded: string | ArrayBufferLike | Blob | ArrayBufferView;
          try { encoded = (connectOptions.encode ?? defaultEncode)(message); }
          catch { throw makeError("WebSocket message encoding failed", "request", false); }
          try { socket.send(encoded); }
          catch { throw makeError("WebSocket send failed", "request", false); }
        },
        subscribe(listener) {
          if (!terminal) listeners.add(listener);
          return () => listeners.delete(listener);
        },
        subscribeClose(listener) {
          if (terminal) {
            try { listener(closeError); } catch { /* Close observers are isolated. */ }
            return () => {};
          }
          closeListeners.add(listener);
          return () => closeListeners.delete(listener);
        },
        async close(reason) {
          if (terminal) return;
          const current = socket;
          cleanupSocket();
          terminal = true;
          if (current && current.readyState < 2) {
            try { current.close(1000, reason?.slice(0, 123)); } catch { /* Best effort. */ }
          }
          terminal = false;
          finish();
        },
      };
    },
  };
}

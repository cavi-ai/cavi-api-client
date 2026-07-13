import { connect } from "node:net";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../errors.js";
import {
  abortableSleep,
  computeBackoffDelay,
  normalizeTransportAbort,
  validateTransportRetryPolicy,
} from "../backoff.js";
import type { TransportByteChannel } from "../channel.js";
import { TransportError } from "../error.js";
import type { TransportReconnectPolicy } from "../types.js";

export type UnixSocketTransportOptions = Readonly<{
  path: string;
  reconnect?: TransportReconnectPolicy;
  signal?: AbortSignal;
  connectImpl?: UnixSocketConnect;
}>;

export interface UnixSocketLike {
  write(chunk: Uint8Array): boolean;
  end(): void;
  destroy(error?: Error): void;
  on(event: "connect" | "drain" | "end" | "close", listener: () => void): void;
  on(event: "data", listener: (chunk: Uint8Array) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}

export type UnixSocketConnect = (path: string) => UnixSocketLike;

const noReconnect: TransportReconnectPolicy = { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 };

function defaultConnect(path: string): UnixSocketLike {
  return connect(path) as unknown as UnixSocketLike;
}

function validationError(message: string): ApiClientError {
  return new ApiClientError(message, {
    type: ApiClientErrorType.Validation,
    code: ApiClientErrorCode.ValidationFailed,
  });
}

export function createUnixSocketTransport(
  options: UnixSocketTransportOptions,
): TransportByteChannel & Readonly<{ ready: Promise<void>; closed: Promise<void> }> {
  if (options.path.trim().length === 0) throw validationError("Unix socket path must be non-empty");
  const policy = options.reconnect ?? noReconnect;
  validateTransportRetryPolicy(policy);
  const factory = options.connectImpl ?? defaultConnect;
  const listeners = new Set<(chunk: Uint8Array) => void>();
  const closeListeners = new Set<(error?: unknown) => void>();
  const destroyed = new WeakSet<object>();
  const writeWaiters = new WeakMap<object, Set<(error: unknown) => void>>();
  const controller = new AbortController();
  const startedAt = Date.now();
  let socket: UnixSocketLike | undefined;
  let attempt = 1;
  let connected = false;
  let everConnected = false;
  let terminal = false;
  let closeError: unknown;
  let reconnecting = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  let resolveClosed!: () => void;
  let rejectClosed!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const closed = new Promise<void>((resolve, reject) => { resolveClosed = resolve; rejectClosed = reject; });
  void ready.catch(() => undefined);
  void closed.catch(() => undefined);

  const makeError = (message: string, phase: "connect" | "request" | "close", retryable = false) =>
    new TransportError(message, {
      metadata: {
        kind: "unix", phase, operation: phase === "request" ? "write" : "connect",
        retryable, attempt,
      },
    });
  const destroy = (current?: UnixSocketLike, graceful = false): void => {
    if (!current || destroyed.has(current as object)) return;
    destroyed.add(current as object);
    if (graceful) {
      try { current.end(); } catch { /* Best effort. */ }
    }
    try { current.destroy(); } catch { /* Best effort. */ }
  };
  const finish = (failure?: unknown, graceful = false): void => {
    if (terminal) return;
    terminal = true;
    connected = false;
    closeError = failure;
    controller.abort();
    options.signal?.removeEventListener("abort", onAbort);
    const writeFailure = failure ?? makeError("Unix socket is not connected", "request");
    if (socket) {
      for (const reject of writeWaiters.get(socket as object) ?? []) reject(writeFailure);
      writeWaiters.delete(socket as object);
    }
    destroy(socket, graceful);
    if (!everConnected) rejectReady(failure ?? makeError("Unix socket closed", "close"));
    listeners.clear();
    const current = [...closeListeners];
    closeListeners.clear();
    for (const listener of current) {
      try { listener(failure); } catch { /* Close observers are isolated. */ }
    }
    if (failure) rejectClosed(failure);
    else resolveClosed();
  };
  const scheduleReconnect = async (): Promise<void> => {
    if (terminal || reconnecting) return;
    connected = false;
    if (attempt >= policy.maxAttempts) {
      finish(makeError("Unix socket connection closed", "close"));
      return;
    }
    reconnecting = true;
    const delay = computeBackoffDelay(policy, attempt, Math.random());
    if (policy.deadlineMs !== undefined && Date.now() - startedAt + delay > policy.deadlineMs) {
      reconnecting = false;
      finish(makeError("Unix socket reconnect deadline exceeded", "close"));
      return;
    }
    try { await abortableSleep(delay, controller.signal); }
    catch { reconnecting = false; if (!terminal) finish(makeError("Unix socket connection closed", "close")); return; }
    reconnecting = false;
    if (terminal) return;
    attempt += 1;
    start();
  };
  const attach = (current: UnixSocketLike): void => {
    socket = current;
    let handledClose = false;
    const disconnected = (): void => {
      if (handledClose || terminal || current !== socket) return;
      handledClose = true;
      connected = false;
      socket = undefined;
      const failure = makeError("Unix socket is not connected", "request");
      for (const reject of writeWaiters.get(current as object) ?? []) reject(failure);
      writeWaiters.delete(current as object);
      destroy(current);
      void scheduleReconnect();
    };
    current.on("connect", () => {
      if (terminal || handledClose || current !== socket) return;
      connected = true;
      if (!everConnected) { everConnected = true; resolveReady(); }
    });
    current.on("data", (chunk) => {
      if (terminal || handledClose || current !== socket || !connected) return;
      const bytes = Uint8Array.from(chunk);
      for (const listener of [...listeners]) {
        try { listener(bytes); } catch { /* Data observers are isolated. */ }
      }
    });
    current.on("drain", () => undefined);
    current.on("error", disconnected);
    current.on("end", disconnected);
    current.on("close", disconnected);
  };
  function start(): void {
    try { attach(factory(options.path)); }
    catch {
      void scheduleReconnect();
    }
  }
  function onAbort(): void { finish(undefined, true); }

  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  if (!terminal) start();

  return {
    ready,
    closed,
    async write(chunk, signal) {
      if (signal?.aborted) throw normalizeTransportAbort(signal);
      const current = socket;
      if (terminal || !connected || !current) throw makeError("Unix socket is not connected", "request");
      let writable: boolean;
      try { writable = current.write(chunk); }
      catch { throw makeError("Unix socket write failed", "request"); }
      if (writable) return;
      if (terminal || !connected || current !== socket) {
        throw makeError("Unix socket is not connected", "request");
      }
      await new Promise<void>((resolve, reject) => {
        const waiters = writeWaiters.get(current as object) ?? new Set<(error: unknown) => void>();
        writeWaiters.set(current as object, waiters);
        const fail = (failure: unknown): void => {
          waiters.delete(fail);
          signal?.removeEventListener("abort", abort);
          reject(failure);
        };
        waiters.add(fail);
        const abort = (): void => fail(normalizeTransportAbort(signal));
        signal?.addEventListener("abort", abort, { once: true });
        current.on("drain", () => {
          if (!waiters.delete(fail)) return;
          signal?.removeEventListener("abort", abort);
          if (terminal || !connected || current !== socket) reject(makeError("Unix socket is not connected", "request"));
          else resolve();
        });
      });
    },
    subscribe(listener) {
      if (!terminal) listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeClose(listener) {
      if (terminal) {
        try { listener(closeError); } catch { /* Isolated. */ }
        return () => {};
      }
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    async close() { finish(undefined, true); },
  };
}

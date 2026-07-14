import type { TransportMessageChannel } from "./channel.js";
import { TransportError } from "./error.js";

type JsonRpcId = string | number;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  removeAbortListener: () => void;
};

export interface JsonRpcTransport {
  request<T = unknown>(method: string, params?: unknown, options?: { signal?: AbortSignal }): Promise<T>;
  notify(method: string, params?: unknown, options?: { signal?: AbortSignal }): Promise<void>;
  onNotification(listener: (method: string, params: unknown) => void): () => void;
  close(): Promise<void>;
}

export type CreateJsonRpcTransportOptions = Readonly<{
  channel: TransportMessageChannel<unknown>;
  id?: () => JsonRpcId;
  onProtocolError?: (error: TransportError) => void;
}>;

function rpcError(message: string, phase: "request" | "decode" | "close", code?: string | number): TransportError {
  return new TransportError(message, {
    metadata: {
      kind: "json-rpc", phase, operation: "json-rpc", retryable: false, attempt: 1,
      ...(code === undefined ? {} : { code }),
    },
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is JsonRpcId {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

let defaultId = 0;

export function createJsonRpcTransport(options: CreateJsonRpcTransportOptions): JsonRpcTransport {
  const pending = new Map<JsonRpcId, PendingRequest>();
  const notificationListeners = new Set<(method: string, params: unknown) => void>();
  const nextId = options.id ?? (() => ++defaultId);
  let closed = false;
  let closePromise: Promise<void> | undefined;

  const protocolError = (message: string): TransportError =>
    rpcError(message, "decode");

  const reportProtocolError = (error: TransportError): void => {
    try { options.onProtocolError?.(error); } catch { /* Protocol observers are isolated. */ }
  };

  const reportProtocolErrorMessage = (message: string): void => {
    const error = rpcError(message, "decode");
    reportProtocolError(error);
  };

  let unsubscribeMessages = () => {};
  let unsubscribeClose = () => {};

  const finish = () => {
    if (closed) return;
    closed = true;
    unsubscribeMessages();
    unsubscribeClose();
    notificationListeners.clear();
    const error = rpcError("JSON-RPC transport closed before the request completed", "close");
    for (const request of pending.values()) {
      request.removeAbortListener();
      request.reject(error);
    }
    pending.clear();
  };

  unsubscribeMessages = options.channel.subscribe((message) => {
    if (!isRecord(message) || message.jsonrpc !== "2.0") {
      reportProtocolErrorMessage("Received an invalid JSON-RPC message");
      return;
    }
    if (typeof message.method === "string" && message.id === undefined) {
      for (const listener of notificationListeners) listener(message.method, message.params);
      return;
    }
    if (!isId(message.id)) {
      reportProtocolErrorMessage("Received an invalid JSON-RPC response");
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      reportProtocolErrorMessage("Received a JSON-RPC response with an unknown id");
      return;
    }
    const hasResult = Object.prototype.hasOwnProperty.call(message, "result");
    const hasError = Object.prototype.hasOwnProperty.call(message, "error");
    const validError = hasError && isRecord(message.error) &&
      typeof message.error.code === "number" && Number.isFinite(message.error.code) &&
      typeof message.error.message === "string";
    if (hasResult === hasError || (hasError && !validError)) {
      const error = protocolError("Received a malformed JSON-RPC response");
      pending.delete(message.id);
      request.removeAbortListener();
      request.reject(error);
      reportProtocolError(error);
      return;
    }
    pending.delete(message.id);
    request.removeAbortListener();
    if (hasResult) request.resolve(message.result);
    else {
      const remoteError = message.error as { code: number };
      request.reject(rpcError("JSON-RPC request failed", "request", remoteError.code));
    }
  });
  unsubscribeClose = options.channel.subscribeClose(() => finish());
  if (closed) unsubscribeClose();

  const assertOpen = () => {
    if (closed) throw rpcError("JSON-RPC transport is closed", "close");
  };

  return {
    async request<T>(
      method: string,
      params?: unknown,
      requestOptions: { signal?: AbortSignal } = {},
    ): Promise<T> {
      assertOpen();
      if (requestOptions.signal?.aborted) throw abortError();
      const id = nextId();
      if (!isId(id)) throw rpcError("JSON-RPC id generator returned an invalid id", "request");
      if (pending.has(id)) throw rpcError("JSON-RPC id generator returned a duplicate pending id", "request");

      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          const request = pending.get(id);
          if (!request) return;
          pending.delete(id);
          request.removeAbortListener();
          reject(abortError());
        };
        const removeAbortListener = () => requestOptions.signal?.removeEventListener("abort", onAbort);
        pending.set(id, { resolve: (value) => resolve(value as T), reject, removeAbortListener });
        requestOptions.signal?.addEventListener("abort", onAbort, { once: true });
        const message = { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) };
        const failSend = () => {
          const request = pending.get(id);
          if (!request) return;
          pending.delete(id);
          request.removeAbortListener();
          reject(rpcError("JSON-RPC request could not be sent", "request"));
        };
        let send: Promise<void>;
        try {
          send = options.channel.send(message, requestOptions.signal);
        } catch {
          failSend();
          return;
        }
        void send.catch(failSend);
      });
    },
    async notify(method, params, notifyOptions: { signal?: AbortSignal } = {}) {
      assertOpen();
      if (notifyOptions.signal?.aborted) throw abortError();
      const message = { jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) };
      try {
        await options.channel.send(message, notifyOptions.signal);
      } catch {
        throw rpcError("JSON-RPC notification could not be sent", "request");
      }
    },
    onNotification(listener) {
      notificationListeners.add(listener);
      return () => notificationListeners.delete(listener);
    },
    close() {
      if (closePromise) return closePromise;
      finish();
      closePromise = options.channel.close("JSON-RPC transport closed");
      return closePromise;
    },
  };
}

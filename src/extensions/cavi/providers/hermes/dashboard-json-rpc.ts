import type { TransportMessageChannel } from "../../../../core/transport/channel.js";
import { TransportError } from "../../../../core/transport/error.js";
import { createJsonRpcTransport } from "../../../../core/transport/json-rpc.js";
import type {
  HermesDashboardEvent,
  HermesDashboardJsonRpcClient,
  HermesDashboardJsonRpcOptions,
  RequestOptions,
} from "./types.js";

const defaultMaxPendingRequests = 128;

function configurationError(message: string): TransportError {
  return new TransportError(message, {
    metadata: {
      kind: "json-rpc",
      phase: "configure",
      operation: "json-rpc",
      retryable: false,
      attempt: 1,
    },
  });
}

function requestLimitError(): TransportError {
  return new TransportError("Hermes dashboard JSON-RPC pending request limit reached", {
    metadata: {
      kind: "json-rpc",
      phase: "request",
      operation: "json-rpc",
      retryable: false,
      attempt: 1,
    },
  });
}

function validateMaxPendingRequests(value: number | undefined): number {
  const limit = value ?? defaultMaxPendingRequests;
  if (!Number.isInteger(limit) || limit < 1) {
    throw configurationError("Hermes dashboard JSON-RPC maxPendingRequests must be a positive integer");
  }
  return limit;
}

function borrowedChannel(channel: TransportMessageChannel<unknown>): TransportMessageChannel<unknown> {
  return {
    send: (message, signal) => channel.send(message, signal),
    subscribe: (listener) => channel.subscribe(listener),
    subscribeClose: (listener) => channel.subscribeClose(listener),
    close: async () => {},
  };
}

function toEvent(params: unknown): HermesDashboardEvent | undefined {
  if (typeof params !== "object" || params === null || Array.isArray(params)) return undefined;
  const record = params as Record<string, unknown>;
  if (typeof record.type !== "string" || record.type.trim().length === 0) return undefined;
  if (!Object.prototype.hasOwnProperty.call(record, "payload")) return undefined;
  return { type: record.type, payload: record.payload };
}

export function createHermesDashboardJsonRpcClient(
  options: HermesDashboardJsonRpcOptions,
): HermesDashboardJsonRpcClient {
  const maxPendingRequests = validateMaxPendingRequests(options.maxPendingRequests);
  const rpc = createJsonRpcTransport({
    channel: options.ownsChannel === true ? options.channel : borrowedChannel(options.channel),
  });
  const listeners = new Set<(event: HermesDashboardEvent) => void>();
  let pendingRequests = 0;
  let disposed = false;
  let disposePromise: Promise<void> | undefined;

  rpc.onNotification((method, params) => {
    if (method !== "event") return;
    const event = toEvent(params);
    if (!event) return;
    for (const listener of [...listeners]) {
      try { listener(event); } catch { /* Subscribers are isolated. */ }
    }
  });

  return {
    async request<T>(method: string, params?: unknown, requestOptions?: RequestOptions): Promise<T> {
      if (disposed) return rpc.request<T>(method, params, requestOptions);
      if (pendingRequests >= maxPendingRequests) throw requestLimitError();
      pendingRequests += 1;
      try {
        return await rpc.request<T>(method, params, requestOptions);
      } finally {
        pendingRequests -= 1;
      }
    },
    subscribe(listener) {
      if (!disposed) listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposePromise) return disposePromise;
      disposed = true;
      listeners.clear();
      disposePromise = rpc.close();
      return disposePromise;
    },
  };
}

export type {
  HermesDashboardEvent,
  HermesDashboardJsonRpcClient,
  HermesDashboardJsonRpcOptions,
  RequestOptions,
} from "./types.js";

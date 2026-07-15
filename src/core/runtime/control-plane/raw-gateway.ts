import {
  defineRuntimeControlExtension,
  type RuntimeControlExtensionDescriptor,
} from "./extensions.js";
import { abortableSleep, computeBackoffDelay, validateTransportRetryPolicy } from "../../transport/backoff.js";
import { getTransportErrorMetadata } from "../../transport/error.js";
import type { TransportDependencies, TransportRetryPolicy } from "../../transport/types.js";

export type RawGatewayEvent = Readonly<{
  event: string;
  payload: unknown;
}>;

export type RawGatewayConnectionState =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

export type RawGatewayRequestOptions = Readonly<{
  signal?: AbortSignal;
}>;

export interface RawGatewayChannel {
  request<TResult = unknown>(
    operationId: string,
    payload?: Readonly<Record<string, unknown>>,
    options?: RawGatewayRequestOptions,
  ): Promise<TResult>;
  subscribe(listener: (event: RawGatewayEvent) => void): () => void;
  getConnectionState(): RawGatewayConnectionState;
  onConnectionState(listener: (state: RawGatewayConnectionState) => void): () => void;
  connect(): Promise<void>;
  dispose(): Promise<void>;
}

export type RawGatewayConnectionLifecycle = Readonly<{
  connect: () => Promise<void>;
  getConnectionState: () => RawGatewayConnectionState;
  onConnectionState: (
    listener: (state: RawGatewayConnectionState, error?: unknown) => void,
  ) => () => void;
  dispose?: () => void | Promise<void>;
}>;

type RawGatewayReconnectOptions = Readonly<{
  policy?: TransportRetryPolicy;
  dependencies?: Partial<TransportDependencies>;
}>;

/** @internal */
export function createRawGatewayConnectionLifecycle(
  delegate: RawGatewayConnectionLifecycle,
  options: RawGatewayReconnectOptions = {},
): RawGatewayConnectionLifecycle {
  if (options.policy) validateTransportRetryPolicy(options.policy);
  const dependencies: TransportDependencies = {
    now: options.dependencies?.now ?? (() => Date.now()),
    random: options.dependencies?.random ?? (() => Math.random()),
    sleep: options.dependencies?.sleep ?? abortableSleep,
  };
  const listeners = new Set<(state: RawGatewayConnectionState, error?: unknown) => void>();
  const controller = new AbortController();
  let state = delegate.getConnectionState();
  let connectPromise: Promise<void> | undefined;
  let reconnectTask: Promise<void> | undefined;
  let manualConnectGeneration = 0;
  let lastManualOutcome: Readonly<{ generation: number; error?: unknown }> | undefined;
  let disposed = false;

  const publish = (next: RawGatewayConnectionState, error?: unknown): void => {
    state = next;
    for (const listener of listeners) {
      try { listener(next, error); } catch { /* Observer failures are isolated. */ }
    }
  };
  const startConnect = (): Promise<void> => {
    if (disposed) return Promise.reject(new Error("Raw gateway lifecycle is disposed"));
    if (connectPromise) return connectPromise;
    const pending = Promise.resolve().then(delegate.connect).then(() => {
      const next = delegate.getConnectionState();
      if (state !== next) publish(next);
    });
    connectPromise = pending.finally(() => {
      if (connectPromise === wrapped) connectPromise = undefined;
    });
    const wrapped = connectPromise;
    return wrapped;
  };
  const connect = (): Promise<void> => {
    if (connectPromise) return connectPromise;
    const generation = ++manualConnectGeneration;
    const pending = startConnect();
    void pending.then(
      () => { lastManualOutcome = { generation }; },
      (error) => { lastManualOutcome = { generation, error }; },
    );
    return pending;
  };
  const reconnect = async (initialError: unknown): Promise<void> => {
    const policy = options.policy;
    if (!policy || !getTransportErrorMetadata(initialError)?.retryable) return;
    const startedAt = dependencies.now();
    let observedManualGeneration = manualConnectGeneration;
    let error = initialError;
    for (let attempt = 1; attempt < policy.maxAttempts && !disposed; attempt += 1) {
      const metadata = getTransportErrorMetadata(error);
      if (!metadata?.retryable) {
        if (state !== "error") publish("error", error);
        return;
      }
      const delayMs = computeBackoffDelay(policy, attempt, dependencies.random(), metadata.retryAfterMs);
      if (policy.deadlineMs !== undefined && dependencies.now() - startedAt + delayMs > policy.deadlineMs) {
        if (!disposed && state !== "error") publish("error", error);
        return;
      }
      publish("reconnecting", error);
      try {
        await dependencies.sleep(delayMs, controller.signal);
        if (disposed) return;
        if (manualConnectGeneration !== observedManualGeneration) {
          observedManualGeneration = manualConnectGeneration;
          const pendingManualConnect = connectPromise;
          if (pendingManualConnect) {
            try {
              await pendingManualConnect;
              if (state === "connected") return;
            } catch (manualError) {
              error = manualError;
            }
          } else if (lastManualOutcome?.generation === observedManualGeneration) {
            if (lastManualOutcome.error === undefined && state === "connected") return;
            if (lastManualOutcome.error !== undefined) error = lastManualOutcome.error;
          }
        }
        if (!getTransportErrorMetadata(error)?.retryable) {
          if (state !== "error") publish("error", error);
          return;
        }
        await startConnect();
        const connectedState = delegate.getConnectionState();
        if (state !== connectedState) publish(connectedState);
        return;
      } catch (nextError) {
        error = nextError;
      }
    }
    if (!disposed && state !== "error") publish("error", error);
  };
  const unsubscribe = delegate.onConnectionState((next, error) => {
    publish(next, error);
    if (next === "error" && options.policy && reconnectTask === undefined) {
      reconnectTask = reconnect(error).finally(() => { reconnectTask = undefined; });
      void reconnectTask.catch(() => undefined);
    }
  });
  const dispose = createRawGatewayDisposer(async () => {
    disposed = true;
    controller.abort(new Error("Raw gateway lifecycle disposed"));
    unsubscribe();
    listeners.clear();
    try { await reconnectTask; } catch { /* Cancellation is expected during disposal. */ }
    await delegate.dispose?.();
  });

  return {
    connect,
    getConnectionState: () => state,
    onConnectionState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose,
  };
}

export const GATEWAY_RAW_EXTENSION: RuntimeControlExtensionDescriptor<RawGatewayChannel> =
  defineRuntimeControlExtension<RawGatewayChannel>("gateway.raw");

type NormalizedRawGatewayRequest = Readonly<{
  operationId: string;
  payload: Readonly<Record<string, unknown>>;
  options?: RawGatewayRequestOptions;
}>;

const EMPTY_RAW_GATEWAY_PAYLOAD = Object.freeze({});

/** @internal */
export function normalizeRawGatewayRequest(
  operationId: string,
  payload?: Readonly<Record<string, unknown>>,
  options?: RawGatewayRequestOptions,
): NormalizedRawGatewayRequest {
  if (typeof operationId !== "string") {
    throw new TypeError("Raw gateway operation ID must be a string");
  }
  const normalizedOperationId = operationId.trim();
  if (normalizedOperationId.length === 0) {
    throw new Error("Raw gateway operation ID must not be blank");
  }
  if (payload !== undefined && (
    payload === null || typeof payload !== "object" || Array.isArray(payload)
  )) {
    throw new TypeError("Raw gateway request payload must be an object");
  }
  if (options?.signal?.aborted) {
    throw options.signal.reason;
  }
  return Object.freeze({
    operationId: normalizedOperationId,
    payload: payload ?? EMPTY_RAW_GATEWAY_PAYLOAD,
    ...(options === undefined ? {} : { options }),
  });
}

/** @internal */
export function createRawGatewayEvent(event: string, payload: unknown): RawGatewayEvent {
  return Object.freeze({ event, payload });
}

/** @internal */
export function dispatchRawGatewayListeners<T>(
  listeners: Iterable<(value: T) => void>,
  value: T,
): void {
  for (const listener of listeners) {
    try {
      listener(value);
    } catch {
      // Subscriber failures must not interrupt delivery to other listeners.
    }
  }
}

/** @internal */
export function createRawGatewayDisposer(
  dispose: () => void | Promise<void>,
): () => Promise<void> {
  let disposal: Promise<void> | undefined;
  return () => {
    if (disposal === undefined) {
      try {
        disposal = Promise.resolve(dispose());
      } catch (error) {
        disposal = Promise.reject(error);
      }
    }
    return disposal;
  };
}

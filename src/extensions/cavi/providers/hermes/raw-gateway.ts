import {
  createRawGatewayDisposer,
  createRawGatewayEvent,
  dispatchRawGatewayListeners,
  normalizeRawGatewayRequest,
  type RawGatewayChannel,
  type RawGatewayConnectionState,
  type RawGatewayEvent,
  type RawGatewayRequestOptions,
} from "../../../../core/runtime/control-plane/raw-gateway.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { getTransportErrorMetadata } from "../../../../core/transport/error.js";
import type {
  HermesDashboardEvent,
  HermesDashboardJsonRpcClient,
  HermesRawGatewayLifecycle,
} from "./types.js";

function isUnsupportedOperation(error: unknown): boolean {
  const metadata = getTransportErrorMetadata(error);
  return metadata?.kind === "json-rpc" && metadata.phase === "request" && metadata.code === -32601;
}

function nativeConnectionState(event: HermesDashboardEvent): RawGatewayConnectionState | undefined {
  if (event.type === "gateway.ready") return "connected";
  if (event.type === "gateway.closed" || event.type === "gateway.close" || event.type === "disconnect") {
    return "reconnecting";
  }
  return undefined;
}

export function createHermesRawGatewayChannel(
  rpc: HermesDashboardJsonRpcClient,
  lifecycle: HermesRawGatewayLifecycle,
): RawGatewayChannel {
  const eventListeners = new Set<(event: RawGatewayEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  let connectionState = lifecycle.getConnectionState();
  let unsubscribeEvents: (() => void) | undefined;
  let unsubscribeState: (() => void) | undefined;
  let connectPromise: Promise<void> | undefined;

  const updateConnectionState = (state: RawGatewayConnectionState): void => {
    connectionState = state;
    dispatchRawGatewayListeners(stateListeners, state);
  };
  const ensureEventSubscription = (): void => {
    unsubscribeEvents ??= rpc.subscribe((native) => {
      const state = nativeConnectionState(native);
      if (state !== undefined) updateConnectionState(state);
      dispatchRawGatewayListeners(
        eventListeners,
        createRawGatewayEvent(native.type, native.payload),
      );
    });
  };
  const releaseEventSubscription = (): void => {
    if (eventListeners.size !== 0 || stateListeners.size !== 0) return;
    unsubscribeEvents?.();
    unsubscribeEvents = undefined;
  };

  const dispose = createRawGatewayDisposer(async () => {
    unsubscribeEvents?.();
    unsubscribeEvents = undefined;
    unsubscribeState?.();
    unsubscribeState = undefined;
    eventListeners.clear();
    stateListeners.clear();
    await lifecycle.dispose?.();
  });

  return {
    async request<TResult = unknown>(
      operationId: string,
      payload?: Readonly<Record<string, unknown>>,
      options?: RawGatewayRequestOptions,
    ): Promise<TResult> {
      const request = normalizeRawGatewayRequest(operationId, payload, options);
      try {
        return await rpc.request<TResult>(
          request.operationId,
          request.payload,
          request.options,
        );
      } catch (error) {
        if (isUnsupportedOperation(error)) {
          throw new CapabilityUnavailable("hermes", request.operationId);
        }
        throw error;
      }
    },
    subscribe(listener): () => void {
      eventListeners.add(listener);
      ensureEventSubscription();
      return () => {
        eventListeners.delete(listener);
        releaseEventSubscription();
      };
    },
    getConnectionState(): RawGatewayConnectionState {
      return connectionState;
    },
    onConnectionState(listener): () => void {
      stateListeners.add(listener);
      ensureEventSubscription();
      unsubscribeState ??= lifecycle.onConnectionState(updateConnectionState);
      return () => {
        stateListeners.delete(listener);
        if (stateListeners.size === 0) {
          unsubscribeState?.();
          unsubscribeState = undefined;
        }
        releaseEventSubscription();
      };
    },
    connect(): Promise<void> {
      if (connectPromise === undefined) {
        const pending = Promise.resolve().then(lifecycle.connect);
        connectPromise = pending.finally(() => {
          if (connectPromise === wrapped) connectPromise = undefined;
        });
        const wrapped = connectPromise;
      }
      return connectPromise;
    },
    dispose,
  };
}

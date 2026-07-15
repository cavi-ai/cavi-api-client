import { GatewayRpcError } from "../../../core/gateway/rpc/error.js";
import {
  createRawGatewayDisposer,
  createRawGatewayConnectionLifecycle,
  dispatchRawGatewayListeners,
  normalizeRawGatewayRequest,
  type RawGatewayChannel,
  type RawGatewayConnectionState,
  type RawGatewayEvent,
  type RawGatewayRequestOptions,
} from "../../../core/runtime/control-plane/raw-gateway.js";
import type { TransportRetryPolicy } from "../../../core/transport/types.js";
import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import type { OpenClawRpc } from "./rpc.js";

export type OpenClawRawGatewayLifecycle = Readonly<{
  connect: () => Promise<void>;
  getConnectionState: () => RawGatewayConnectionState;
  onConnectionState: (listener: (state: RawGatewayConnectionState, error?: unknown) => void) => () => void;
  dispose?: () => void | Promise<void>;
}>;

function isUnsupportedOperation(error: unknown): boolean {
  return error instanceof GatewayRpcError && /^unknown method\b/iu.test(error.message.trim());
}

export function createOpenClawRawGatewayChannel(
  rpc: OpenClawRpc,
  lifecycle: OpenClawRawGatewayLifecycle,
  reconnectPolicy?: TransportRetryPolicy,
): RawGatewayChannel {
  const managedLifecycle = reconnectPolicy === undefined
    ? lifecycle
    : createRawGatewayConnectionLifecycle(lifecycle, { policy: reconnectPolicy });
  const eventListeners = new Set<(event: RawGatewayEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  let unsubscribeEvents: (() => void) | undefined;
  let unsubscribeState: (() => void) | undefined;
  let connectPromise: Promise<void> | undefined;

  const dispose = createRawGatewayDisposer(async () => {
    unsubscribeEvents?.();
    unsubscribeEvents = undefined;
    unsubscribeState?.();
    unsubscribeState = undefined;
    eventListeners.clear();
    stateListeners.clear();
    await managedLifecycle.dispose?.();
  });

  return {
    async request<TResult = unknown>(
      operationId: string,
      payload?: Readonly<Record<string, unknown>>,
      options?: RawGatewayRequestOptions,
    ): Promise<TResult> {
      const request = normalizeRawGatewayRequest(operationId, payload, options);
      try {
        return await rpc.request(
          request.operationId,
          request.payload,
          request.options,
        ) as TResult;
      } catch (error) {
        if (isUnsupportedOperation(error)) {
          throw new CapabilityUnavailable("openclaw", request.operationId);
        }
        throw error;
      }
    },
    subscribe(listener): () => void {
      eventListeners.add(listener);
      unsubscribeEvents ??= rpc.subscribe((event) => {
        dispatchRawGatewayListeners(eventListeners, event);
      });
      return () => {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) {
          unsubscribeEvents?.();
          unsubscribeEvents = undefined;
        }
      };
    },
    getConnectionState: managedLifecycle.getConnectionState,
    onConnectionState(listener): () => void {
      stateListeners.add(listener);
      unsubscribeState ??= managedLifecycle.onConnectionState((state) => {
        dispatchRawGatewayListeners(stateListeners, state);
      });
      return () => {
        stateListeners.delete(listener);
        if (stateListeners.size === 0) {
          unsubscribeState?.();
          unsubscribeState = undefined;
        }
      };
    },
    connect(): Promise<void> {
      if (connectPromise === undefined) {
        const pending = Promise.resolve().then(managedLifecycle.connect);
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

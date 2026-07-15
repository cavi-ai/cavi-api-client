import type { RawGatewayConnectionState } from "../../../core/runtime/control-plane/raw-gateway.js";

export interface OpenClawRpcEvent {
  readonly event: string;
  readonly payload: unknown;
}

export interface OpenClawRpc {
  request(
    method: string,
    params: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  subscribe(listener: (event: OpenClawRpcEvent) => void): () => void;
  connect?(): Promise<void>;
  getConnectionState?(): RawGatewayConnectionState;
  onConnectionState?(listener: (state: RawGatewayConnectionState, error?: unknown) => void): () => void;
  dispose(): Promise<void>;
}

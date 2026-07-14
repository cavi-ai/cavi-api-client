import type { TransportMessageChannel } from "../../../../core/transport/channel.js";
import type { TransportError } from "../../../../core/transport/error.js";

export type RequestOptions = Readonly<{ signal?: AbortSignal }>;

export type HermesDashboardEvent = Readonly<{
  type: string;
  payload: unknown;
}>;

export type HermesDashboardJsonRpcOptions = Readonly<{
  channel: TransportMessageChannel<unknown>;
  ownsChannel?: boolean;
  maxPendingRequests?: number;
  onProtocolError?: (error: TransportError) => void;
}>;

export interface HermesDashboardJsonRpcClient {
  request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
  subscribe(listener: (event: HermesDashboardEvent) => void): () => void;
  dispose(): Promise<void>;
}

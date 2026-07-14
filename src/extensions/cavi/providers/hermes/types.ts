import type { TransportMessageChannel } from "../../../../core/transport/channel.js";

export type RequestOptions = Readonly<{ signal?: AbortSignal }>;

export type HermesDashboardEvent = Readonly<{
  type: string;
  payload: unknown;
}>;

export type HermesDashboardJsonRpcOptions = Readonly<{
  channel: TransportMessageChannel<unknown>;
  ownsChannel?: boolean;
  maxPendingRequests?: number;
}>;

export interface HermesDashboardJsonRpcClient {
  request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
  subscribe(listener: (event: HermesDashboardEvent) => void): () => void;
  dispose(): Promise<void>;
}

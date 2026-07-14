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
  dispose(): Promise<void>;
}

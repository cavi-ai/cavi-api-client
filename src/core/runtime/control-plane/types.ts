export type RuntimeProviderStability = "stable" | "experimental";
export type RuntimeControlPlaneSource = {
  transport: "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix-socket";
  method: string;
};
export type RuntimeControlPlaneMetadata = {
  provider: string;
  stability: RuntimeProviderStability;
  source: RuntimeControlPlaneSource;
  providerData?: unknown;
};
export type RuntimePage<T> = { data: readonly T[]; nextCursor?: string };

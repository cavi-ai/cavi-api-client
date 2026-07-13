export type TransportKind = "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix";

export type TransportPhase = "configure" | "authenticate" | "connect" | "request" | "decode" | "close";

export type TransportOperationSafety = "read" | "idempotent" | "connection" | "mutation";

export type TransportAuth = Readonly<{ headers?: Readonly<Record<string, string>> }>;

export type TransportAuthResolver = () => TransportAuth | Promise<TransportAuth>;

export type TransportRetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
  deadlineMs?: number;
}>;

export type TransportReconnectPolicy = TransportRetryPolicy & Readonly<{ dedupeCapacity?: number }>;

export type TransportDependencies = Readonly<{
  now: () => number;
  random: () => number;
  sleep: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}>;

export type TransportLifecycleEvent = Readonly<{
  state: "connecting" | "connected" | "retrying" | "reconnected" | "closed";
  kind: TransportKind;
  operation: string;
  attempt: number;
  delayMs?: number;
}>;

export type TransportLifecycle = Readonly<{
  emit: (event: TransportLifecycleEvent) => void;
  subscribe: (listener: (event: TransportLifecycleEvent) => void) => () => void;
}>;

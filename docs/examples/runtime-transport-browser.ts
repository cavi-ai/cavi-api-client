import {
  createHttpTransport,
  createJsonRpcTransport,
  createSseTransport,
  createWebSocketTransport,
} from "@cavi-ai/api-client/core/transport";

const retry = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 1_000,
} as const;

const http = createHttpTransport({ baseUrl: "https://runtime.example" });
await http.request({ method: "GET", path: "/health", retry });

// Mutations are retried only when the caller supplies an explicit idempotency key.
await http.request({
  method: "POST",
  path: "/runs",
  body: JSON.stringify({ input: "Summarize the workspace" }),
  idempotencyKey: crypto.randomUUID(),
  retry,
});

const events = createSseTransport({ baseUrl: "https://runtime.example" });
const subscription = events.subscribe({
  path: "/events",
  cursor: "event-42",
  reconnect: { ...retry, dedupeCapacity: 1_024 },
  onMessage: (message) => console.log(message),
});

const sockets = createWebSocketTransport();
const channel = sockets.connect({ url: "wss://runtime.example/rpc", reconnect: retry });
await channel.ready;
const rpc = createJsonRpcTransport({ channel });
await rpc.request("runtime.status");

subscription.close();
await rpc.close();

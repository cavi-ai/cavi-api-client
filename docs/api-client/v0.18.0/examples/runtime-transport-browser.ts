import { createHttpTransport } from "@cavi-ai/api-client/core/transport";

// Adapter infrastructure: callers own the route and validate the decoded payload.
export function readServiceJson(baseUrl: string, path: string, signal: AbortSignal) {
  const transport = createHttpTransport({ baseUrl });
  return transport.request({ method: "GET", path, response: "json", signal });
}

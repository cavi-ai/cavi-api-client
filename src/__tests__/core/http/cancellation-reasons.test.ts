import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { RawHttpApiClient } from "../../../core/http/raw-client.js";

describe("caller cancellation reasons through native fetch", () => {
  it.each([
    { adapter: "core", reason: "stop" },
    { adapter: "core", reason: 42 },
    { adapter: "core", reason: true },
    { adapter: "core", reason: null },
    { adapter: "gateway", reason: "stop" },
    { adapter: "gateway", reason: 42 },
    { adapter: "gateway", reason: true },
    { adapter: "gateway", reason: null },
  ])("preserves $reason through $adapter", async ({ adapter, reason }) => {
    let ready!: () => void;
    const started = new Promise<void>((resolve) => { ready = resolve; });
    const server = createServer(() => ready());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const controller = new AbortController();
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const request = adapter === "core"
        ? new RawHttpApiClient("test", { baseUrl }).raw("/cancel", { signal: controller.signal })
        : requestGatewayRaw("/cancel", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API",
          signal: controller.signal,
        });
      await Promise.race([started, request]);
      const assertion = expect(request).rejects.toBe(reason);
      controller.abort(reason);
      await assertion;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

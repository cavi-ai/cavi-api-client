import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { fetchGatewayJson, requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { HttpApiError } from "../../../core/http/errors.js";
import { JsonHttpApiClient } from "../../../core/http/json-client.js";

describe("typed caller cancellation through native fetch", () => {
  it.each([
    { adapter: "json-client", preAborted: true },
    { adapter: "json-client", preAborted: false },
    { adapter: "gateway-raw", preAborted: true },
    { adapter: "gateway-raw", preAborted: false },
    { adapter: "gateway-json", preAborted: true },
    { adapter: "gateway-json", preAborted: false },
  ])("preserves HttpApiError through $adapter (preAborted=$preAborted)", async ({ adapter, preAborted }) => {
    let ready!: () => void;
    const started = new Promise<void>((resolve) => { ready = resolve; });
    const server = createServer(() => ready());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const reason = new HttpApiError({
      message: "Previous request failed", method: "GET", path: "/previous",
      url: "https://example.test/previous", status: 503, body: "previous failure",
    });
    const controller = new AbortController();
    if (preAborted) controller.abort(reason);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const options = {
        httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API",
        signal: controller.signal,
      };
      const request = adapter === "json-client"
        ? new JsonHttpApiClient("test", { baseUrl }).request("/cancel", { signal: controller.signal })
        : adapter === "gateway-raw"
          ? requestGatewayRaw("/cancel", options)
          : fetchGatewayJson("/cancel", options);
      if (!preAborted) {
        await Promise.race([started, request]);
        controller.abort(reason);
      }
      await expect(request).rejects.toBe(reason);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { RawHttpApiClient, toHttpRequestInit } from "../../../core/http/raw-client.js";

describe("Fetch HTTP method conversion through native HTTP", () => {
  it.each([
    { client: "core", method: " head ", expected: "HEAD" },
    { client: "core", method: " options ", expected: "OPTIONS" },
    { client: "gateway", method: "head", expected: "HEAD" },
    { client: "gateway", method: "options", expected: "OPTIONS" },
  ])("preserves $expected through the $client adapter", async ({ client, method, expected }) => {
    let receivedMethod: string | undefined;
    const server = createServer((request, response) => {
      receivedMethod = request.method;
      response.writeHead(204).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const response = client === "core"
        ? await new RawHttpApiClient("gateway", { baseUrl }).raw("/method", toHttpRequestInit({ method }))
        : await requestGatewayRaw("/method", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API", method,
        });
      expect(response.status).toBe(204);
      expect(receivedMethod).toBe(expected);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

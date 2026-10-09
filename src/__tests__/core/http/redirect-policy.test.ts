import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { RawHttpApiClient, toHttpRequestInit } from "../../../core/http/raw-client.js";

describe("HTTP redirect policies through native fetch", () => {
  it.each([
    { client: "core", redirect: "manual" as const, status: 302 },
    { client: "core", redirect: "error" as const, status: 0 },
    { client: "gateway", redirect: "manual" as const, status: 302 },
    { client: "gateway", redirect: "error" as const, status: 0 },
    { client: "core", redirect: undefined, status: undefined },
    { client: "gateway", redirect: undefined, status: undefined },
  ])("honors $redirect through the $client adapter", async ({ client, redirect, status }) => {
    let destinationRequests = 0;
    const server = createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { Location: "/destination" }).end();
      } else {
        destinationRequests += 1;
        response.writeHead(204).end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const request = client === "core"
        ? new RawHttpApiClient("gateway", { baseUrl }).raw("/redirect", toHttpRequestInit({ redirect }))
        : requestGatewayRaw("/redirect", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API", redirect,
        });
      if (redirect === undefined) {
        expect((await request).status).toBe(204);
        expect(destinationRequests).toBe(1);
      } else {
        await expect(request).rejects.toMatchObject({ status });
        expect(destinationRequests).toBe(0);
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

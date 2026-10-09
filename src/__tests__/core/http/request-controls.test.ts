import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { RawHttpApiClient, toHttpRequestInit } from "../../../core/http/raw-client.js";

const trustedBody = "trusted response";
const integrity = `sha256-${createHash("sha256").update(trustedBody).digest("base64")}`;

describe("Fetch request controls", () => {
  it.each(["core", "gateway"])("forwards request controls through the %s adapter", async (adapter) => {
    const controls = {
      integrity, keepalive: false, mode: "same-origin", priority: "low",
      referrer: "", referrerPolicy: "no-referrer",
    } satisfies RequestInit;
    let receivedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      receivedInit = init;
      return new Response(null, { status: 204 });
    };
    if (adapter === "core") {
      await new RawHttpApiClient("test", { baseUrl: "https://example.test", fetchImpl })
        .raw("/controls", toHttpRequestInit(controls));
    } else {
      await requestGatewayRaw("/controls", {
        httpBaseUrl: "https://example.test", clientId: "test-client", authToken: null,
        apiLabel: "Gateway API", fetchImpl, ...controls,
      });
    }
    expect(receivedInit).toMatchObject(controls);
  });

  it.each([
    { adapter: "core", body: trustedBody, matches: true },
    { adapter: "core", body: "tampered response", matches: false },
    { adapter: "gateway", body: trustedBody, matches: true },
    { adapter: "gateway", body: "tampered response", matches: false },
  ])("enforces response integrity through $adapter (matches=$matches)", async ({ adapter, body, matches }) => {
    const server = createServer((_request, response) => response.end(body));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const request = adapter === "core"
        ? new RawHttpApiClient("test", { baseUrl }).raw("/integrity", toHttpRequestInit({ integrity }))
        : requestGatewayRaw("/integrity", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API", integrity,
        });
      if (matches) {
        expect(await (await request).text()).toBe(trustedBody);
      } else {
        await expect(request).rejects.toMatchObject({ name: "HttpApiError", status: 0 });
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JsonHttpApiClient } from "../../../core/http/json-client.js";

const server = createServer((request, response) => {
  request.resume();
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(request.headers));
});
let baseUrl: string;

beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("HTTP header precedence through native fetch", () => {
  it("respects a lower-case content type without appending the JSON default", async () => {
    const client = new JsonHttpApiClient("test", { baseUrl });
    const headers = await client.request<IncomingHttpHeaders>("/headers", {
      method: "POST", body: { input: "hello" },
      headers: { "content-type": "application/vnd.api+json" },
    });
    expect(headers["content-type"]).toBe("application/vnd.api+json");
  });

  it("lets request headers replace defaults with different casing", async () => {
    const client = new JsonHttpApiClient("test", {
      baseUrl, defaultHeaders: { "X-Tenant-Id": "default-tenant", accept: "text/plain" },
    });
    const headers = await client.request<IncomingHttpHeaders>("/headers", {
      headers: { "x-tenant-id": "request-tenant", ACCEPT: "application/json" },
    });
    expect(headers["x-tenant-id"]).toBe("request-tenant");
    expect(headers.accept).toBe("application/json");
  });

  it("keeps configured bearer authentication authoritative over caller casing", async () => {
    const client = new JsonHttpApiClient("test", {
      baseUrl, auth: { bearerToken: "provider-token" },
      defaultHeaders: { authorization: "Bearer default-token" },
    });
    const headers = await client.request<IncomingHttpHeaders>("/headers", {
      headers: { AUTHORIZATION: "Bearer request-token" },
    });
    expect(headers.authorization).toBe("Bearer provider-token");
  });

  it("lets credential resolvers replace default auth headers with different casing", async () => {
    const client = new JsonHttpApiClient("test", {
      baseUrl, defaultHeaders: { "X-Api-Key": "default-key" },
      auth: { resolveHeaders: () => ({ "x-api-key": "provider-key" }) },
    });
    const headers = await client.request<IncomingHttpHeaders>("/headers");
    expect(headers["x-api-key"]).toBe("provider-key");
  });

  it("uses the explicit idempotency key once even when defaults use lower case", async () => {
    const client = new JsonHttpApiClient("test", {
      baseUrl, defaultHeaders: { "idempotency-key": "default-key" },
    });
    const headers = await client.request<IncomingHttpHeaders>("/headers", { idempotencyKey: "request-key" });
    expect(headers["idempotency-key"]).toBe("request-key");
  });
});

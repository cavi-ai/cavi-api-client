import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { RawHttpApiClient, toHttpRequestInit } from "../../../core/http/raw-client.js";

describe("Fetch request header conversion through native HTTP", () => {
  it.each(["record", "tuples", "Headers", "override", "empty override"])("preserves %s headers on the wire", async (kind) => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(request.headers));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const client = new RawHttpApiClient("gateway", {
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
      const values = { "X-Tenant-Id": "tenant-a", "Accept": "text/plain" };
      const headers: HeadersInit = kind === "Headers" ? new Headers(values)
        : kind === "tuples" ? Object.entries(values) : values;
      const response = await client.raw("/headers", toHttpRequestInit(
        { headers },
        kind === "override" ? { "X-Tenant-Id": "tenant-b" }
          : kind === "empty override" ? {} : undefined,
      ));
      const received = await response.json() as Record<string, string>;
      expect(received["x-tenant-id"]).toBe(kind === "override" ? "tenant-b"
        : kind === "empty override" ? undefined : "tenant-a");
      expect(received.accept).toBe(kind.endsWith("override") ? "application/json" : "text/plain");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

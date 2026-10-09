import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { BaseHttpApiClient } from "../../../core/http/client.js";
import { HttpApiError } from "../../../core/http/errors.js";
import { JsonHttpApiClient } from "../../../core/http/json-client.js";

describe("invalid JSON diagnostics through native fetch", () => {
  it.each([
    { kind: "base", body: "Bearer sk-parser-secret" },
    { kind: "gateway", body: "Bearer sk-parser-secret" },
    { kind: "base", body: "token=sk-parser-secret" },
    { kind: "gateway", body: "token=sk-parser-secret" },
  ])("redacts credential fragments for $kind: $body", async ({ kind, body }) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(body);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const options = { baseUrl: `http://127.0.0.1:${address.port}` };
      const gateway = new JsonHttpApiClient("gateway", options);
      const request = kind === "base"
        ? new BaseHttpApiClient("gateway", options).createTransport()
        : (path: string) => gateway.request(path);
      const error = await request("/diagnostic").catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(HttpApiError);
      expect(error).toMatchObject({ status: 200, body });
      const message = (error as HttpApiError).message;
      expect(message).toContain("returned invalid JSON");
      expect(message).toContain("content-type=text/plain");
      expect(message).toContain("[REDACTED]");
      expect(message).not.toContain("sk-");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

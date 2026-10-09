import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { requestGatewayRaw } from "../../../core/gateway/client/fetch.js";
import { RawHttpApiClient, toHttpRequestInit } from "../../../core/http/raw-client.js";

describe("streamed HTTP uploads through native fetch", () => {
  it.each(["core-raw", "core-converted", "gateway"])("sends a ReadableStream through %s", async (adapter) => {
    let receivedBody = "";
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      receivedBody = Buffer.concat(chunks).toString("utf8");
      response.writeHead(204).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first\n"));
        controller.enqueue(new TextEncoder().encode("second\n"));
        controller.close();
      },
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const response = adapter === "gateway"
        ? await requestGatewayRaw("/upload", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API",
          method: "POST", body,
        })
        : await new RawHttpApiClient("test", { baseUrl }).raw("/upload",
          adapter === "core-raw" ? { method: "POST", rawBody: body } : toHttpRequestInit({ method: "POST", body }));
      expect(response.status).toBe(204);
      expect(receivedBody).toBe("first\nsecond\n");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

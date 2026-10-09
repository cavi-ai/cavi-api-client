import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { fetchGatewayExpectOk } from "../../../core/gateway/client/fetch.js";
import {
  resolveGatewayChatRunApproval, resolveHermesChatRunApproval,
} from "../../../providers/hermes/chat-run.js";

describe("acknowledgement response cleanup through native fetch", () => {
  it.each(["gateway", "hermes-approval", "gateway-approval"])("releases an unread %s response body", async (kind) => {
    let disconnected!: () => void;
    const responseClosed = new Promise<string>((resolve) => { disconnected = () => resolve("closed"); });
    const server = createServer((request, response) => {
      request.resume();
      response.once("close", disconnected);
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("accepted");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    let timer!: ReturnType<typeof setTimeout>;
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const approval = kind === "hermes-approval" ? resolveHermesChatRunApproval : resolveGatewayChatRunApproval;
      const request = kind === "gateway"
        ? fetchGatewayExpectOk("/acknowledgement", {
          httpBaseUrl: baseUrl, clientId: "test-client", authToken: null, apiLabel: "Gateway API",
        })
        : approval({ httpBase: baseUrl, clientId: "test-client", authToken: "test-token", runId: "run-1", choice: "session" });
      await expect(request).resolves.toBeUndefined();
      expect(await Promise.race([
        responseClosed,
        new Promise<string>((resolve) => { timer = setTimeout(() => resolve("body still open"), 500); }),
      ])).toBe("closed");
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("acknowledgement cleanup failures", () => {
  it.each(["gateway", "hermes-approval"])("preserves successful %s acknowledgements when disposal rejects", async (kind) => {
    const fetchImpl: typeof fetch = async () => new Response(new ReadableStream({
      cancel() { throw new Error("Body disposal failed"); },
    }), { status: 200 });
    const request = kind === "gateway"
      ? fetchGatewayExpectOk("/acknowledgement", {
        httpBaseUrl: "https://gateway.example", clientId: "test-client",
        authToken: null, apiLabel: "Gateway API", fetchImpl,
      })
      : resolveHermesChatRunApproval({
        httpBase: "https://gateway.example", clientId: "test-client", authToken: "test-token",
        runId: "run-1", choice: "session", fetchImpl,
      });
    await expect(request).resolves.toBeUndefined();
  });
});

import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  fetchGatewayBlob, fetchGatewayFormDataJson, fetchGatewayJson, requestGatewayRaw,
} from "../../../core/gateway/client/fetch.js";

async function stalledResponse() {
  let reading!: () => void;
  const bodyReading = new Promise<void>((resolve) => { reading = resolve; });
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { "content-type": "application/json" });
    response.write("{");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return {
    options: {
      httpBaseUrl: `http://127.0.0.1:${address.port}`,
      clientId: "test-client", authToken: null, apiLabel: "Gateway API",
      fetchImpl: (async (input, init) => {
        const response = await fetch(input, init);
        const text = response.text.bind(response);
        const blob = response.blob.bind(response);
        response.text = () => { reading(); return text(); };
        response.blob = () => { reading(); return blob(); };
        return response;
      }) satisfies typeof fetch,
    },
    bodyReading,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("gateway body lifetimes through native fetch", () => {
  it.each(["json", "blob", "form-data"])("preserves caller cancellation during %s body consumption", async (kind) => {
    const fixture = await stalledResponse();
    const controller = new AbortController();
    const reason = new Error("Caller stopped waiting");
    let timer!: ReturnType<typeof setTimeout>;
    try {
      const options = { ...fixture.options, signal: controller.signal };
      const request = kind === "json" ? fetchGatewayJson("/body", options)
        : kind === "blob" ? fetchGatewayBlob("/body", options)
          : fetchGatewayFormDataJson("/body", { ...options, body: new FormData() });
      const outcome = request.then(() => "unexpected success", (error: unknown) => error);
      await fixture.bodyReading;
      controller.abort(reason);
      expect(await Promise.race([
        outcome,
        new Promise<string>((resolve) => { timer = setTimeout(() => resolve("body read still pending"), 500); }),
      ])).toBe(reason);
    } finally {
      clearTimeout(timer);
      await fixture.close();
    }
  });

  it("retains caller-owned raw stream lifetimes", async () => {
    const fixture = await stalledResponse();
    const controller = new AbortController();
    try {
      const response = await requestGatewayRaw("/body", { ...fixture.options, signal: controller.signal });
      controller.abort();
      const reader = response.body!.getReader();
      try {
        expect((await reader.read()).value).toEqual(new TextEncoder().encode("{"));
        await reader.cancel();
      } finally { reader.releaseLock(); }
    } finally { await fixture.close(); }
  });
});

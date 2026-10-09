import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { BaseHttpApiClient } from "../../../core/http/client.js";
import { JsonHttpApiClient } from "../../../core/http/json-client.js";
import type { HttpApiRequestInit } from "../../../core/http/types.js";

class BodyClient extends BaseHttpApiClient {
  json(init?: HttpApiRequestInit) { return this.requestJson("/body", init); }
  blob(init?: HttpApiRequestInit) { return this.requestBlob("/body", init); }
  raw() { return this.requestRaw("/body"); }
}

async function stalledBody() {
  let ready!: () => void;
  const reading = new Promise<void>((resolve) => { ready = resolve; });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write("{");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`, reading,
    fetchImpl: (async (input, init) => {
      const response = await fetch(input, init);
      const text = response.text.bind(response);
      const blob = response.blob.bind(response);
      response.text = () => { ready(); return text(); };
      response.blob = () => { ready(); return blob(); };
      return response;
    }) satisfies typeof fetch,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function observe(request: Promise<unknown>): Promise<unknown> {
  let timer!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request.then(() => "unexpected success", (error: unknown) => error),
      new Promise<string>((resolve) => { timer = setTimeout(() => resolve("body read still pending"), 500); }),
    ]);
  } finally { clearTimeout(timer); }
}

describe("HTTP body lifecycle through native fetch", () => {
  it.each(["base-json", "gateway-json", "blob"])("bounds a stalled %s body by the request timeout", async (kind) => {
    const fixture = await stalledBody();
    try {
      const options = { baseUrl: fixture.baseUrl, defaultTimeoutMs: 100 };
      const request = kind === "base-json"
        ? new BodyClient("gateway", options).json()
        : kind === "gateway-json"
          ? new JsonHttpApiClient("gateway", options).request("/body")
          : new BodyClient("gateway", options).blob();
      expect(await observe(request)).toMatchObject({ name: "HttpApiError", status: 0 });
    } finally { await fixture.close(); }
  });

  it.each(["json", "gateway-json", "blob"])("preserves caller cancellation during a %s body read", async (kind) => {
    const fixture = await stalledBody();
    const controller = new AbortController();
    const reason = new Error("Caller stopped waiting");
    try {
      const options = { baseUrl: fixture.baseUrl, defaultTimeoutMs: 10_000, fetchImpl: fixture.fetchImpl };
      const client = new BodyClient("gateway", options);
      const request = kind === "gateway-json"
        ? new JsonHttpApiClient("gateway", options).request("/body", { signal: controller.signal })
        : kind === "json" ? client.json({ signal: controller.signal }) : client.blob({ signal: controller.signal });
      const observed = observe(request);
      await fixture.reading;
      controller.abort(reason);
      expect(await observed).toBe(reason);
    } finally { await fixture.close(); }
  });

  it("hands raw streams to their caller without a body deadline", async () => {
    const fixture = await stalledBody();
    try {
      const client = new BodyClient("gateway", { baseUrl: fixture.baseUrl, defaultTimeoutMs: 100 });
      const response = await client.raw();
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(response.bodyUsed).toBe(false);
      const reader = response.body!.getReader();
      expect((await reader.read()).value).toEqual(new TextEncoder().encode("{"));
      await reader.cancel();
      reader.releaseLock();
    } finally { await fixture.close(); }
  });
});

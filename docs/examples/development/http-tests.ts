import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test, type TestContext } from "node:test";
import {
  HttpApiError,
  RawHttpApiClient,
  isGatewayHttpError,
  isHttpApiError,
  toHttpRequestInit,
  withQuery,
} from "@cavi-ai/api-client/core/http";
import { createHttpReader, httpFailure } from "./http-workflow.js";

async function fixture(t: TestContext, handle: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

test("reads JSON with configured credentials and request headers through native Fetch", async (t) => {
  const baseUrl = await fixture(t, (req, res) => {
    res.setHeader("Content-Type", "Application/JSON; charset=utf-8");
    res.end(JSON.stringify({ auth: req.headers.authorization, tenant: req.headers["x-tenant"], url: req.url }));
  });
  const app = createHttpReader({ baseUrl, auth: { bearerToken: "fixture-key" }, defaultTimeoutMs: 1_000,
    includePortalClientIdHeader: false, defaultHeaders: { "X-Tenant": "example" },
  });
  assert.deepEqual(await app.json(withQuery("/items?mode=fast#details", { limit: 2 }), new AbortController().signal), {
    auth: "Bearer fixture-key", tenant: "example", url: "/items?mode=fast&limit=2",
  });
});

test("classifies server failures by type and preserves the backend code without retrying", async (t) => {
  let calls = 0;
  const baseUrl = await fixture(t, (_req, res) => {
    calls += 1;
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Unavailable", code: "busy" } }));
  });
  const app = createHttpReader({ baseUrl });
  const signal = new AbortController().signal;
  await assert.rejects(app.json("/returned invalid JSON", signal), (error) => {
    assert.ok(isGatewayHttpError(error));
    assert.deepEqual(httpFailure(error, signal), { kind: "server", status: 503, code: "busy" });
    return true;
  });
  assert.equal(calls, 1);
});

test("retains malformed successful JSON as HttpApiError with inspectable body", async (t) => {
  const baseUrl = await fixture(t, (_req, res) => res.end("not-json"));
  const app = createHttpReader({ baseUrl });
  const signal = new AbortController().signal;
  await assert.rejects(app.json("/items", signal), (error) => {
    assert.ok(isHttpApiError(error));
    assert.equal(error.body, "not-json");
    assert.deepEqual(httpFailure(error, signal), { kind: "http", status: 200, code: "http_request_failed" });
    return true;
  });
});

test("bounds both JSON and finite raw body reads after headers arrive", async (t) => {
  let headers = 0;
  const baseUrl = await fixture(t, (_req, res) => {
    headers += 1;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.flushHeaders();
    res.write("{");
    // Deliberately leave the body open; the client's deadline must end the read.
  });
  const app = createHttpReader({ baseUrl, defaultTimeoutMs: 250 });
  for (const read of [app.json, app.text]) {
    await assert.rejects(read("/slow", new AbortController().signal), (error) => {
      assert.ok(isHttpApiError(error));
      assert.equal(error.status, 0);
      return true;
    });
  }
  assert.equal(headers, 2);
});

test("caller cancellation keeps a custom error's identity during an owned body read", async (t) => {
  const baseUrl = await fixture(t, (_req, res) => {
    res.writeHead(200);
    res.flushHeaders();
    res.write("partial");
  });
  const client = new RawHttpApiClient("application", { baseUrl, defaultTimeoutMs: 1_000 });
  const controller = new AbortController();
  const reason = new HttpApiError({ message: "Caller stopped reading", path: "/owned", url: baseUrl,
    method: "GET", status: 409, body: "application-owned reason",
  });
  await assert.rejects(client.consumeResponse("/owned", { signal: controller.signal }, async (response) => {
    controller.abort(reason);
    return response.text();
  }), (error) => {
    assert.equal(error, reason);
    assert.deepEqual(httpFailure(error, controller.signal), { kind: "cancelled" });
    return true;
  });
});

test("forwards HEAD and streamed uploads without application buffering", async (t) => {
  const baseUrl = await fixture(t, (req, res) => {
    if (req.method === "HEAD") { res.end(); return; }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => res.end(body));
  });
  const client = new RawHttpApiClient("application", { baseUrl });
  const head = await client.raw("/items", toHttpRequestInit({ method: " head ", redirect: "error" }));
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("payload")); controller.close(); },
  });
  assert.equal(await client.consumeResponse("/upload", toHttpRequestInit({ method: "POST", body }),
    (response) => response.text()), "payload");
});

import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLibraryApiJson } from "../../../../extensions/cavi/library/api.js";

afterEach(() => { vi.unstubAllGlobals(); });

async function libraryResponse(body?: string) {
  let reading!: () => void;
  const bodyReading = new Promise<void>((resolve) => { reading = resolve; });
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { "content-type": "application/json" });
    if (body === undefined) response.write("{");
    else response.end(body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const nativeFetch = globalThis.fetch;
  // Resolve browser-relative library URLs while retaining native HTTP and body reads.
  vi.stubGlobal("fetch", (async (input, init) => {
    const response = await nativeFetch(new URL(String(input), baseUrl), init);
    const text = response.text.bind(response);
    response.text = () => { reading(); return text(); };
    return response;
  }) satisfies typeof fetch);
  return {
    bodyReading,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("library JSON body lifetimes through native fetch", () => {
  it("preserves caller cancellation during a stalled response body read", async () => {
    const fixture = await libraryResponse();
    const controller = new AbortController();
    const reason = new Error("Caller stopped waiting");
    let timer!: ReturnType<typeof setTimeout>;
    try {
      const outcome = fetchLibraryApiJson("/status", "test-client", null, {
        signal: controller.signal,
      }).then(() => "unexpected success", (error: unknown) => error);
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

  it("returns the parsed payload from a completed response", async () => {
    const fixture = await libraryResponse('{"ok":true}');
    try {
      await expect(fetchLibraryApiJson("/status", "test-client", null)).resolves.toEqual({ ok: true });
    } finally { await fixture.close(); }
  });
});

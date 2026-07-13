import { describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors.js";
import { createHttpTransport } from "../../../core/transport/index.js";

const retryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 0,
  maxDelayMs: 0,
} as const;

describe("HTTP transport", () => {
  it("normalizes the base URL and gives fresh auth headers precedence", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test/api",
      defaultHeaders: { "x-default": "yes", Authorization: "default" },
      auth: async () => ({ headers: { AUTHORIZATION: "Bearer fresh" } }),
      fetchImpl,
    });

    await transport.request({
      method: "GET",
      path: "models",
      headers: { "x-request": "yes", authorization: "request" },
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.test/api/models", expect.objectContaining({
      headers: expect.objectContaining({
        "x-default": "yes",
        "x-request": "yes",
        AUTHORIZATION: "Bearer fresh",
      }),
    }));
  });

  it("does not retry a mutation without explicit idempotency", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 503 }));
    const transport = createHttpTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await expect(transport.request({ method: "POST", path: "/tasks", retry: retryPolicy })).rejects.toMatchObject({
      transport: { retryable: false, status: 503, attempt: 1 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes auth and retries an idempotent request", async () => {
    const auth = vi.fn()
      .mockResolvedValueOnce({ headers: { authorization: "Bearer first" } })
      .mockResolvedValueOnce({ headers: { authorization: "Bearer second" } });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const transport = createHttpTransport({ baseUrl: "https://runtime.test", auth, fetchImpl });
    await expect(transport.request({ method: "GET", path: "/models", response: "json", retry: retryPolicy })).resolves.toEqual({ ok: true });
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("requires an idempotency key before retrying mutations", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep, random: () => 0.5, now: () => 0 },
    });

    await expect(transport.request({
      method: "POST",
      path: "/tasks",
      idempotencyKey: "request-1",
      response: "text",
      retry: { ...retryPolicy, maxDelayMs: 3_000 },
    })).resolves.toBe("ok");
    expect(sleep).toHaveBeenCalledWith(2_000, undefined);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "request-1" }),
    }));
  });

  it("parses Retry-After HTTP dates using the injected clock", async () => {
    const now = Date.parse("2026-07-13T12:00:00Z");
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 408,
        headers: { "Retry-After": "Mon, 13 Jul 2026 12:00:03 GMT" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleep = vi.fn(async () => undefined);
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep, random: () => 0.5, now: () => now },
    });

    await transport.request({ method: "GET", path: "/models", retry: { ...retryPolicy, maxDelayMs: 5_000 } });
    expect(sleep).toHaveBeenCalledWith(3_000, undefined);
  });

  it.each([
    ["json", new Response('{"ok":true}'), { ok: true }],
    ["text", new Response("hello"), "hello"],
    ["bytes", new Response(new Uint8Array([1, 2, 3])), new Uint8Array([1, 2, 3])],
  ] as const)("decodes %s responses", async (mode, response, expected) => {
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => response),
    });
    await expect(transport.request({ method: "GET", path: "/value", response: mode })).resolves.toEqual(expected);
  });

  it("returns the raw response by default", async () => {
    const response = new Response("raw");
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => response),
    });
    await expect(transport.request({ method: "GET", path: "/value" })).resolves.toBe(response);
  });

  it("returns undefined for a 204 decoded response", async () => {
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => new Response(null, { status: 204 })),
    });
    await expect(transport.request({ method: "GET", path: "/value", response: "json" })).resolves.toBeUndefined();
  });

  it("normalizes malformed JSON without exposing response bodies", async () => {
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => new Response("secret-body", { status: 200 })),
    });
    const promise = transport.request({ method: "GET", path: "/value", response: "json" });
    await expect(promise).rejects.toMatchObject({
      message: "HTTP response decoding failed",
      transport: { phase: "decode", retryable: false, status: 200, attempt: 1 },
    });
    await expect(promise).rejects.not.toThrow("secret-body");
  });

  it("normalizes status errors without exposing response bodies or headers", async () => {
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => new Response("secret-body", {
        status: 401,
        headers: { authorization: "Bearer secret-token" },
      })),
    });
    const promise = transport.request({ method: "GET", path: "/value" });
    await expect(promise).rejects.toMatchObject({
      message: "HTTP request failed with status 401",
      transport: { phase: "request", retryable: false, status: 401, attempt: 1 },
    });
    const error = await promise.catch((value: unknown) => value);
    expect(JSON.stringify(error)).not.toContain("secret-body");
    expect(JSON.stringify(error)).not.toContain("secret-token");
  });

  it("normalizes fetch failures without exposing their message", async () => {
    const cause = new Error("authorization: Bearer secret-token");
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => { throw cause; }),
    });
    const promise = transport.request({ method: "GET", path: "/value" });
    await expect(promise).rejects.toMatchObject({
      message: "HTTP request failed",
      transport: { phase: "request", retryable: true, attempt: 1 },
    });
    await expect(promise).rejects.not.toThrow("secret-token");
  });

  it("preserves abort classification and does not retry", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    const transport = createHttpTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await expect(transport.request({
      method: "GET",
      path: "/value",
      signal: controller.signal,
      retry: retryPolicy,
    })).rejects.toMatchObject({ type: ApiClientErrorType.Abort, code: ApiClientErrorCode.Aborted });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("stops before a retry whose delay would exceed the deadline", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep, random: () => 0.5, now: () => 0 },
    });
    await expect(transport.request({
      method: "GET",
      path: "/value",
      retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 10, deadlineMs: 9 },
    })).rejects.toMatchObject({ transport: { attempt: 1, retryable: true } });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("reports retry exhaustion using the final attempt metadata", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const transport = createHttpTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep: async () => undefined, random: () => 0.5, now: () => 0 },
    });
    await expect(transport.request({ method: "GET", path: "/value", retry: retryPolicy })).rejects.toMatchObject({
      transport: { status: 503, retryable: true, attempt: 2 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

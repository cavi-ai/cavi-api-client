import { describe, expect, it, vi } from "vitest";
import { createSseTransport } from "../../../core/transport/index.js";

function sseResponse(body: string, contentType = "text/event-stream"): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": contentType } });
}

function sequenceFetch(responses: readonly Response[]): ReturnType<typeof vi.fn> {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? responses.at(-1)!);
}

const reconnect = {
  maxAttempts: 2,
  baseDelayMs: 0,
  maxDelayMs: 0,
  dedupeCapacity: 16,
} as const;

describe("SSE transport", () => {
  it("resumes with Last-Event-ID and deduplicates replayed ids", async () => {
    const fetchImpl = sequenceFetch([
      sseResponse("id: 1\ndata: first\n\n"),
      sseResponse("id: 1\ndata: first\n\nid: 2\ndata: second\n\n"),
    ]);
    const messages: string[] = [];
    const transport = createSseTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await transport.subscribe({
      path: "/events",
      reconnect,
      onMessage: (message) => messages.push(message.data),
    }).done;

    expect(messages).toEqual(["first", "second"]);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ "Last-Event-ID": "1" });
  });

  it("uses an explicit cursor on the first request and preserves header precedence", async () => {
    const fetchImpl = vi.fn(async () => sseResponse("data: ready\n\n"));
    const transport = createSseTransport({
      baseUrl: "https://runtime.test/api",
      defaultHeaders: { Authorization: "default", "Last-Event-ID": "default-cursor" },
      auth: async () => ({ headers: { AUTHORIZATION: "Bearer fresh" } }),
      fetchImpl,
    });
    await transport.subscribe({
      path: "events",
      cursor: "cursor-1",
      headers: { authorization: "request" },
      onMessage: () => undefined,
    }).done;

    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.test/api/events", expect.objectContaining({
      headers: expect.objectContaining({ AUTHORIZATION: "Bearer fresh", "Last-Event-ID": "cursor-1" }),
    }));
  });

  it("honors server retry hints for the next bounded reconnect", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = sequenceFetch([
      sseResponse("retry: 25\ndata: first\n\n"),
      sseResponse("data: second\n\n"),
    ]);
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep, random: () => 0.5, now: () => 0 },
    });
    await transport.subscribe({
      path: "/events",
      reconnect: { ...reconnect, maxDelayMs: 50 },
      onMessage: () => undefined,
    }).done;

    expect(sleep).toHaveBeenCalledWith(25, expect.any(AbortSignal));
  });

  it("evicts the oldest id when dedupe capacity is reached", async () => {
    const messages: string[] = [];
    const fetchImpl = sequenceFetch([
      sseResponse("id: 1\ndata: first\n\nid: 2\ndata: second\n\n"),
      sseResponse("id: 1\ndata: replay-after-eviction\n\n"),
    ]);
    const transport = createSseTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await transport.subscribe({
      path: "/events",
      reconnect: { ...reconnect, dedupeCapacity: 1 },
      onMessage: (message) => messages.push(message.data),
    }).done;
    expect(messages).toEqual(["first", "second", "replay-after-eviction"]);
  });

  it("does not replace the resume cursor with an empty event id", async () => {
    const fetchImpl = sequenceFetch([
      sseResponse("id: 1\ndata: first\n\nid:\ndata: empty\n\n"),
      sseResponse("data: final\n\n"),
    ]);
    const transport = createSseTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await transport.subscribe({ path: "/events", reconnect, onMessage: () => undefined }).done;
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ "Last-Event-ID": "1" });
  });

  it("rejects malformed content types without leaking response data", async () => {
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: vi.fn(async () => new Response("secret-body", {
        status: 200,
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret-token" },
      })),
    });
    const promise = transport.subscribe({ path: "/events", onMessage: () => undefined }).done;
    await expect(promise).rejects.toMatchObject({
      message: "SSE response has an invalid content type",
      transport: { kind: "sse", phase: "decode", retryable: false, attempt: 1, status: 200 },
    });
    expect(JSON.stringify(await promise.catch((error: unknown) => error))).not.toContain("secret");
  });

  it("normalizes fetch failures and reports the final reconnect attempt", async () => {
    const cause = new Error("authorization: Bearer secret-token");
    const fetchImpl = vi.fn(async () => { throw cause; });
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep: async () => undefined, random: () => 0.5, now: () => 0 },
    });
    const promise = transport.subscribe({
      path: "/events",
      reconnect,
      onMessage: () => undefined,
    }).done;
    await expect(promise).rejects.toMatchObject({
      message: "SSE connection failed",
      transport: { kind: "sse", phase: "connect", retryable: true, attempt: 2 },
    });
    await expect(promise).rejects.not.toThrow("secret-token");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not expose authentication resolver failures through cause", async () => {
    const resolverError = new Error("authorization: Bearer resolver-secret");
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      auth: async () => { throw resolverError; },
      fetchImpl: vi.fn(async () => sseResponse("data: unreachable\n\n")),
    });
    const error = await transport.subscribe({
      path: "/events",
      onMessage: () => undefined,
    }).done.catch((value: unknown) => value);

    expect(error).toMatchObject({
      message: "Transport authentication failed",
      transport: { phase: "authenticate", retryable: false, attempt: 1 },
    });
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain("resolver-secret");
  });

  it("does not reconnect or replay when an id-less message handler throws", async () => {
    const fetchImpl = vi.fn(async () => sseResponse("data: once\n\n"));
    const onMessage = vi.fn(() => { throw new Error("consumer failed"); });
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      dependencies: { sleep: async () => undefined, random: () => 0.5, now: () => 0 },
    });

    await expect(transport.subscribe({
      path: "/events",
      reconnect: { ...reconnect, maxAttempts: 3 },
      onMessage,
    }).done).rejects.toMatchObject({
      message: "SSE message handler failed",
      transport: { phase: "decode", retryable: false, attempt: 1 },
    });
    expect(onMessage).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not regress the cursor when an older id is replayed", async () => {
    const fetchImpl = sequenceFetch([
      sseResponse("id: 1\ndata: first\n\nid: 2\ndata: second\n\n"),
      sseResponse("id: 1\ndata: duplicate\n\n"),
      sseResponse("data: final\n\n"),
    ]);
    const transport = createSseTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await transport.subscribe({
      path: "/events",
      reconnect: { ...reconnect, maxAttempts: 3 },
      onMessage: () => undefined,
    }).done;

    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ "Last-Event-ID": "2" });
    expect(fetchImpl.mock.calls[2]?.[1]?.headers).toMatchObject({ "Last-Event-ID": "2" });
  });

  it("does not reconnect by default", async () => {
    const fetchImpl = vi.fn(async () => sseResponse("data: complete\n\n"));
    const transport = createSseTransport({ baseUrl: "https://runtime.test", fetchImpl });
    await transport.subscribe({ path: "/events", onMessage: () => undefined }).done;
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("close and external abort settle once and emit closed once", async () => {
    const external = new AbortController();
    const events: unknown[] = [];
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl,
      onLifecycleEvent: (event) => events.push(event),
    });
    const subscription = transport.subscribe({
      path: "/events",
      signal: external.signal,
      onMessage: () => undefined,
    });
    external.abort();
    subscription.close();
    subscription.close();
    await expect(subscription.done).resolves.toBeUndefined();
    expect(events).toEqual([expect.objectContaining({ state: "connecting", attempt: 1 }), expect.objectContaining({ state: "closed" })]);
  });

  it("emits safe reconnect lifecycle events", async () => {
    const events: unknown[] = [];
    const transport = createSseTransport({
      baseUrl: "https://runtime.test",
      fetchImpl: sequenceFetch([sseResponse("data: one\n\n"), sseResponse("data: two\n\n")]),
      dependencies: { sleep: async () => undefined, random: () => 0.5, now: () => 0 },
      onLifecycleEvent: (event) => events.push(event),
    });
    await transport.subscribe({ path: "/events?token=secret", reconnect, onMessage: () => undefined }).done;
    expect(events).toMatchObject([
      { state: "connecting", kind: "sse", attempt: 1 },
      { state: "connected", kind: "sse", attempt: 1 },
      { state: "retrying", kind: "sse", attempt: 1 },
      { state: "connecting", kind: "sse", attempt: 2 },
      { state: "reconnected", kind: "sse", attempt: 2 },
      { state: "closed", kind: "sse", attempt: 2 },
    ]);
    expect(JSON.stringify(events)).not.toContain("secret");
  });
});

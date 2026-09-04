import { describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
} from "../../../core/errors";
import { HttpApiError } from "../../../core/http/errors";
import { isNonTerminalStreamError, RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";
import { OpenCodeApiClient } from "../../../providers/opencode/client";

type FetchCall = { url: string; init?: RequestInit };
type Reply = { status?: number; value?: unknown } | Error;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function settlesWithin(promise: Promise<unknown>, timeoutMs = 100): Promise<boolean> {
  return Promise.race([
    promise.then(() => true, () => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

function mockFetch(...replies: Reply[]): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const reply = replies.shift() ?? { value: {} };
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    return new Response(JSON.stringify(reply.value), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch & { calls: FetchCall[] };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function client(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof OpenCodeApiClient>[0]> = {}) {
  return new OpenCodeApiClient({
    baseUrl: "https://opencode.example/api",
    scope: { directory: "/workspace/project", workspace: "team-a" },
    fetchImpl,
    ...extra,
  });
}

const health = { healthy: true, version: "1.18.27" };
const session = { id: "ses_123", directory: "/workspace/project", version: "1.18.27" };
const assistant = {
  info: {
    id: "msg_1",
    sessionID: "ses_123",
    role: "assistant",
    providerID: "openai",
    modelID: "gpt-5",
    time: { created: 1, completed: 2 },
  },
  parts: [{ type: "text", text: "done" }],
};

describe("OpenCodeApiClient", () => {
  it("streams in health, session, event, prompt order and completes after a terminal event", async () => {
    let eventController!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/global/health")) {
        return new Response(JSON.stringify(health), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/session?") && !url.includes("/event")) {
        return new Response(JSON.stringify(session), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/event?")) {
        const body = new ReadableStream<Uint8Array>({ start(controller) { eventController = controller; } });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      if (url.includes("/prompt_async?")) {
        setTimeout(() => {
          eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message.part.delta", properties: {
            sessionID: "ses_123", messageID: "msg_1", partID: "part_1", field: "text", delta: "hello",
          } })}\n\n`));
          eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: "ses_123" } })}\n\n`));
          eventController.close();
        }, 0);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    const events: unknown[] = [];
    const errors: unknown[] = [];
    let completions = 0;

    const instance = client(fetchImpl, { password: "stream-secret", cache: "reload", credentials: "include" });
    await instance.streamRun(
      { input: "hello" },
      { onEvent: (event) => events.push(event), onError: (error) => { errors.push(error); }, onComplete: () => { completions += 1; } },
    );

    expect(calls.map((call) => [call.init?.method, call.url])).toEqual([
      ["GET", "https://opencode.example/api/global/health"],
      ["POST", "https://opencode.example/api/session?directory=%2Fworkspace%2Fproject&workspace=team-a"],
      ["GET", "https://opencode.example/api/event?directory=%2Fworkspace%2Fproject&workspace=team-a"],
      ["POST", "https://opencode.example/api/session/ses_123/prompt_async?directory=%2Fworkspace%2Fproject&workspace=team-a"],
    ]);
    expect(calls.every((call) => (call.init?.headers as Record<string, string>).Authorization === "Basic b3BlbmNvZGU6c3RyZWFtLXNlY3JldA==")).toBe(true);
    expect(calls[0]!.init?.cache).toBe("reload");
    expect(calls[0]!.init?.credentials).toBe("include");
    expect((calls[2]!.init?.headers as Record<string, string>).Accept).toBe("text/event-stream");
    expect(calls.every((call) => !(call.init?.headers as Record<string, string>)["Last-Event-ID"])).toBe(true);
    expect(events).toEqual([
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "ses_123", delta: "hello" },
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "ses_123" },
    ]);
    expect(completions).toBe(1);
    expect(errors).toEqual([]);
  });

  it("ignores the initial idle event until the prompt is accepted", async () => {
    let eventController!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    let promptRequested = false;
    const events: unknown[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) {
        const body = new ReadableStream<Uint8Array>({ start(controller) {
          eventController = controller;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: "ses_123" } })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message.part.delta", properties: {
            sessionID: "ses_123", messageID: "msg_1", partID: "part_1", field: "text", delta: "before-idle",
          } })}\n\n`));
        } });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      if (url.includes("/prompt_async?")) {
        promptRequested = true;
        setTimeout(() => {
          eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: "ses_123" } })}\n\n`));
          eventController.close();
        }, 0);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;

    await client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push({ ...event, promptRequested }),
    });
    expect(events).toEqual([
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "ses_123", delta: "before-idle", promptRequested: true },
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "ses_123", promptRequested: true },
    ]);
  });

  it("marks malformed frames non-terminal and continues with ordered deltas and one terminal", async () => {
    let eventController!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const errors: unknown[] = [];
    const events: unknown[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) {
        const body = new ReadableStream<Uint8Array>({ start(controller) { eventController = controller; } });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      if (url.includes("/prompt_async?")) {
        setTimeout(() => {
          eventController.enqueue(encoder.encode("data: not-json\n\n"));
          for (const delta of ["a", "b"]) {
            eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message.part.delta", properties: {
              sessionID: "ses_123", messageID: "msg_1", partID: "part_1", field: "text", delta,
            } })}\n\n`));
          }
          eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: "ses_123" } })}\n\n`));
          eventController.close();
        }, 0);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;

    await client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
    });
    expect(events).toEqual([
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "ses_123", delta: "a" },
      { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: "ses_123", delta: "b" },
      { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: "ses_123" },
    ]);
    expect(errors).toHaveLength(1);
    expect(isNonTerminalStreamError(errors[0])).toBe(true);
  });

  it("redacts secrets in one deduplicated failed terminal event", async () => {
    let eventController!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const secret = "stream-password";
    const events: unknown[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) {
        const body = new ReadableStream<Uint8Array>({ start(controller) { eventController = controller; } });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      if (url.includes("/prompt_async?")) {
        setTimeout(() => {
          for (let i = 0; i < 2; i += 1) {
            eventController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session.error", properties: {
              sessionID: "ses_123", error: `failed ${secret}`,
            } })}\n\n`));
          }
          eventController.close();
        }, 0);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;

    let completions = 0;
    await client(fetchImpl, { username: "user", password: secret }).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onComplete: () => { completions += 1; },
    });
    expect(events).toEqual([{
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId: "ses_123",
      error: "failed [REDACTED]",
    }]);
    expect(completions).toBe(1);
  });

  it("reports missing bodies and wrong content types without sending the prompt", async () => {
    for (const eventResponse of [
      new Response(null, { headers: { "content-type": "text/event-stream" } }),
      new Response(null, { headers: { "content-type": "application/json" } }),
    ]) {
      const fetchImpl = mockFetch({ value: health }, { value: session }, eventResponse);
      const errors: unknown[] = [];
      let completions = 0;
      await client(fetchImpl).streamRun({ input: "hello" }, {
        onEvent: () => undefined,
        onError: (error) => errors.push(error),
        onComplete: () => { completions += 1; },
      });
      expect(fetchImpl.calls).toHaveLength(3);
      expect(errors).toHaveLength(1);
      expect(completions).toBe(0);
    }
  });

  it("cancels a wrong-content-type event response body", async () => {
    let bodyCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() { bodyCancelled = true; },
    });
    const fetchImpl = mockFetch(
      { value: health },
      { value: session },
      new Response(body, { headers: { "content-type": "application/json" } }),
    );

    await client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: () => undefined,
    });

    expect(bodyCancelled).toBe(true);
  });

  it("cancels an unexpected successful prompt response body", async () => {
    let promptBodyCancelled = false;
    const eventBody = new ReadableStream<Uint8Array>();
    const promptBody = new ReadableStream<Uint8Array>({
      cancel() { promptBodyCancelled = true; },
    });
    const fetchImpl = mockFetch(
      { value: health },
      { value: session },
      new Response(eventBody, { headers: { "content-type": "text/event-stream" } }),
      new Response(promptBody, { status: 200 }),
    );

    await client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: () => undefined,
    });

    expect(promptBodyCancelled).toBe(true);
  });

  it("reports prompt status, fetch, read, and EOF failures as terminal errors", async () => {
    const promptFailure = mockFetch(
      { value: health },
      { value: session },
      new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } }),
      new Response(null, { status: 200 }),
    );
    const promptErrors: unknown[] = [];
    await client(promptFailure).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: (error) => promptErrors.push(error),
    });
    expect(promptErrors).toHaveLength(1);

    const fetchFailure = mockFetch({ value: health }, { value: session }, new Error("event fetch failed"));
    const fetchErrors: unknown[] = [];
    await client(fetchFailure).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: (error) => fetchErrors.push(error),
    });
    expect(fetchErrors).toHaveLength(1);

    const readFailure = mockFetch(
      { value: health },
      { value: session },
      new Response(new ReadableStream<Uint8Array>({ pull() { throw new Error("event read failed"); } }), {
        headers: { "content-type": "text/event-stream" },
      }),
      new Response(null, { status: 204 }),
    );
    const readErrors: unknown[] = [];
    await client(readFailure).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: (error) => readErrors.push(error),
    });
    expect(readErrors).toHaveLength(1);

    const eof = mockFetch(
      { value: health },
      { value: session },
      new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }), {
        headers: { "content-type": "text/event-stream" },
      }),
      new Response(null, { status: 204 }),
    );
    const eofErrors: unknown[] = [];
    await client(eof).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: (error) => eofErrors.push(error),
    });
    expect(eofErrors[0]).toMatchObject({
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.TransportProtocolError,
    });
  });

  it("propagates event handler failures and never completes", async () => {
    const handlerError = new Error("event handler failed");
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        setTimeout(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message.part.delta", properties: {
            sessionID: "ses_123", messageID: "msg_1", partID: "part_1", field: "text", delta: "x",
          } })}\n\n`));
        }, 0);
      } }), { headers: { "content-type": "text/event-stream" } });
      if (url.includes("/prompt_async?")) return new Response(null, { status: 204 });
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    let completions = 0;
    await expect(client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: () => { throw handlerError; },
      onComplete: () => { completions += 1; },
    })).rejects.toBe(handlerError);
    expect(completions).toBe(0);
  });

  it("does not complete when the terminal event handler throws", async () => {
    const handlerError = new Error("terminal handler failed");
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        setTimeout(() => controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "session.idle", properties: { sessionID: "ses_123" },
        })}\n\n`)), 0);
      } }), { headers: { "content-type": "text/event-stream" } });
      if (url.includes("/prompt_async?")) return new Response(null, { status: 204 });
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    let completions = 0;
    await expect(client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: () => { throw handlerError; },
      onComplete: () => { completions += 1; },
    })).rejects.toBe(handlerError);
    expect(completions).toBe(0);
  });

  it("keeps dry runs and already-aborted calls offline", async () => {
    const fetchImpl = mockFetch();
    const events: unknown[] = [];
    let completions = 0;
    await client(fetchImpl).streamRun({ input: "hello", dryRun: true }, {
      onEvent: (event) => events.push(event),
      onComplete: () => { completions += 1; },
    });
    expect(fetchImpl.calls).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, status: "dry_run" });
    expect(completions).toBe(1);

    const aborted = new AbortController();
    aborted.abort();
    const abortedEvents: unknown[] = [];
    await client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => abortedEvents.push(event),
      onComplete: () => { completions += 1; },
    }, { signal: aborted.signal });
    expect(fetchImpl.calls).toHaveLength(0);
    expect(abortedEvents).toEqual([]);
  });

  it("cleans up exactly once after caller abort once a session exists", async () => {
    const caller = new AbortController();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) return new Response(new ReadableStream<Uint8Array>(), {
        headers: { "content-type": "text/event-stream" },
      });
      if (url.includes("/prompt_async?")) return new Response(null, { status: 204 });
      if (url.includes("/abort?")) return new Response(JSON.stringify(true));
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch & { calls: FetchCall[] };
    const calls: FetchCall[] = [];
    (fetchImpl as typeof fetch & { calls: FetchCall[] }).calls = calls;
    const original = fetchImpl;
    const tracked = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return original(input, init);
    }) as unknown as typeof fetch;
    const pending = client(tracked).streamRun({ input: "hello" }, {
      onEvent: () => undefined,
      onError: () => undefined,
    }, { signal: caller.signal });
    for (let attempts = 0; attempts < 100 && calls.length < 4; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(calls.length).toBeGreaterThanOrEqual(4);
    caller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.filter((call) => call.url.includes("/abort?")).map((call) => call.init?.method)).toEqual(["POST"]);
    expect(calls.filter((call) => call.url.includes("/abort?"))).toHaveLength(1);
    expect(calls.at(-1)!.init?.signal).not.toBe(caller.signal);
  });

  it("settles promptly when health ignores caller abort and swallows its late failure", async () => {
    const caller = new AbortController();
    const healthResponse = deferred<Response>();
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return healthResponse.promise;
    }) as unknown as typeof fetch;
    const events: unknown[] = [];
    const errors: unknown[] = [];
    let completions = 0;
    const pending = client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
      onComplete: () => { completions += 1; },
    }, { signal: caller.signal });
    for (let attempts = 0; attempts < 100 && calls.length < 1; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    caller.abort();
    expect(await settlesWithin(pending)).toBe(true);
    healthResponse.reject(new Error("late health failure"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    expect(completions).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("settles promptly on pending session abort and cleans up after a late session response", async () => {
    const caller = new AbortController();
    const sessionResponse = deferred<Response>();
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?")) return sessionResponse.promise;
      if (url.includes("/abort?")) return new Response(JSON.stringify(true));
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    const events: unknown[] = [];
    const errors: unknown[] = [];
    let completions = 0;
    const pending = client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
      onComplete: () => { completions += 1; },
    }, { signal: caller.signal });
    for (let attempts = 0; attempts < 100 && calls.length < 2; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    caller.abort();
    expect(await settlesWithin(pending)).toBe(true);
    sessionResponse.resolve(new Response(JSON.stringify(session)));
    for (let attempts = 0; attempts < 100 && !calls.some((call) => call.url.includes("/abort?")); attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(calls.filter((call) => call.url.includes("/abort?"))).toHaveLength(1);
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    expect(completions).toBe(0);
  });

  it("settles promptly when an event response arrives after abort and cancels its body without consuming it", async () => {
    const caller = new AbortController();
    const eventResponse = deferred<Response>();
    let bodyCancelled = false;
    let getReaderCalls = 0;
    const body = new ReadableStream<Uint8Array>({ cancel() { bodyCancelled = true; } });
    const originalGetReader = body.getReader.bind(body);
    (body as unknown as { getReader: typeof body.getReader }).getReader = ((...args: Parameters<typeof body.getReader>) => {
      getReaderCalls += 1;
      return originalGetReader(...args);
    }) as typeof body.getReader;
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) return eventResponse.promise;
      if (url.includes("/abort?")) return new Response(JSON.stringify(true));
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    const events: unknown[] = [];
    const errors: unknown[] = [];
    let completions = 0;
    const pending = client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
      onComplete: () => { completions += 1; },
    }, { signal: caller.signal });
    for (let attempts = 0; attempts < 100 && calls.length < 3; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    caller.abort();
    expect(await settlesWithin(pending)).toBe(true);
    eventResponse.resolve(new Response(body, { headers: { "content-type": "text/event-stream" } }));
    for (let attempts = 0; attempts < 100 && !bodyCancelled; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(bodyCancelled).toBe(true);
    expect(getReaderCalls).toBe(0);
    expect(calls.some((call) => call.url.includes("/prompt_async?"))).toBe(false);
    expect(calls.filter((call) => call.url.includes("/abort?"))).toHaveLength(1);
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    expect(completions).toBe(0);
  });

  it("settles promptly when prompt_async ignores caller abort", async () => {
    const caller = new AbortController();
    const promptResponse = deferred<Response>();
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/global/health")) return new Response(JSON.stringify(health));
      if (url.includes("/session?") && !url.includes("/event")) return new Response(JSON.stringify(session));
      if (url.includes("/event?")) return new Response(new ReadableStream<Uint8Array>(), {
        headers: { "content-type": "text/event-stream" },
      });
      if (url.includes("/prompt_async?")) return promptResponse.promise;
      if (url.includes("/abort?")) return new Response(JSON.stringify(true));
      throw new Error(`unexpected request ${url}`);
    }) as unknown as typeof fetch;
    const events: unknown[] = [];
    const errors: unknown[] = [];
    let completions = 0;
    const pending = client(fetchImpl).streamRun({ input: "hello" }, {
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
      onComplete: () => { completions += 1; },
    }, { signal: caller.signal });
    for (let attempts = 0; attempts < 100 && calls.length < 4; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    caller.abort();
    expect(await settlesWithin(pending)).toBe(true);
    promptResponse.resolve(new Response(null, { status: 204 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.filter((call) => call.url.includes("/abort?")).length).toBe(1);
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    expect(completions).toBe(0);
  });

  it("rejects non-absolute http(s) URLs, URL credentials, and query/hash components with typed configuration errors", () => {
    for (const baseUrl of [
      undefined,
      "",
      "   ",
      "/relative",
      "ftp://opencode.example",
      "https://user:pass@opencode.example",
      "https://opencode.example/api?tenant=one",
      "https://opencode.example/api#fragment",
    ]) {
      expect(() => new OpenCodeApiClient({ baseUrl: baseUrl as never, scope: { directory: "/workspace/project" } }))
        .toThrowError(expect.objectContaining({
          type: ApiClientErrorType.Configuration,
          code: ApiClientErrorCode.InvalidConfig,
        }));
    }
  });

  it("validates scope and preserves valid scope strings", () => {
    expect(() => new OpenCodeApiClient({ baseUrl: "https://opencode.example", scope: { directory: "relative" } }))
      .toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }));
    const instance = new OpenCodeApiClient({
      baseUrl: "https://opencode.example",
      scope: { directory: " /workspace/project ", workspace: " team-a " },
    });
    expect(instance.scope).toEqual({ directory: " /workspace/project ", workspace: " team-a " });
  });

  it("uses UTF-8 Basic auth only when password is nonblank, and never sends the portal header", async () => {
    const defaultAuth = mockFetch({ value: health });
    await client(defaultAuth, { username: "", password: "päss" }).probeHealth();
    expect((defaultAuth.calls[0]!.init?.headers as Record<string, string>).Authorization)
      .toBe("Basic b3BlbmNvZGU6cMOkc3M=");
    expect((defaultAuth.calls[0]!.init?.headers as Record<string, string>)["X-Portal-Client-Id"]).toBeUndefined();

    const customAuth = mockFetch({ value: health });
    await client(customAuth, { username: "用户", password: "密碼" }).probeHealth();
    expect((customAuth.calls[0]!.init?.headers as Record<string, string>).Authorization)
      .toBe("Basic 55So5oi3OuWvhueivA==");

    for (const options of [{ username: "only-user" }, { username: "user", password: "" }]) {
      const noAuth = mockFetch({ value: health });
      await client(noAuth, options).probeHealth();
      const headers = noAuth.calls[0]!.init?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
      expect(headers["X-Portal-Client-Id"]).toBeUndefined();
    }

    const whitespacePassword = mockFetch({ value: health });
    await client(whitespacePassword, { username: "user", password: "   " }).probeHealth();
    expect((whitespacePassword.calls[0]!.init?.headers as Record<string, string>).Authorization)
      .toBe("Basic dXNlcjogICA=");
  });

  it("propagates request policy and traces while keeping credentials out of failures", async () => {
    const traces: unknown[] = [];
    const fetchImpl = mockFetch(new Error("request failed with password=秘密"));
    const instance = client(fetchImpl, {
      username: "trace-user",
      password: "秘密",
      cache: "reload",
      credentials: "include",
      defaultTimeoutMs: 37,
      onTrace: (trace) => traces.push(trace),
    });
    let observed: unknown;
    try {
      await instance.probeHealth();
    } catch (error) {
      observed = error;
    }
    expect(observed).toMatchObject({
      message: "GET /global/health failed: request failed with password=[REDACTED]",
    });
    expect((observed as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(fetchImpl.calls[0]!.init?.cache).toBe("reload");
    expect(fetchImpl.calls[0]!.init?.credentials).toBe("include");
    expect(fetchImpl.calls[0]!.init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(traces)).not.toContain("秘密");
  });

  it("drops secret-bearing nested causes even when the outer message is clean", async () => {
    const secret = "nested-secret";
    const fetchImpl: typeof fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => {
        throw new Error("request failed", { cause: new Error(`credential=${secret}`) });
      },
    }) as Response;

    let observed: unknown;
    try {
      await client(fetchImpl, { password: secret }).probeHealth();
    } catch (error) {
      observed = error;
    }

    expect(observed).toMatchObject({
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.RequestFailed,
      message: "request failed",
    });
    expect((observed as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it("declares exactly the OpenCode runtime surfaces", async () => {
    const caps = await client(mockFetch()).getRuntimeCapabilities();
    expect(caps).toEqual({
      providerKind: "opencode",
      protocolVersion: "1.18.27",
      auth: { type: "basic", required: false },
      supports: { runs: true, streaming: true },
    });
    const authenticated = await client(mockFetch(), { password: "secret" }).getRuntimeCapabilities();
    expect(authenticated.auth).toEqual({ type: "basic", required: true });
  });

  it("health-checks lazily once, shares concurrent callers, and retries after failure", async () => {
    let resolveHealth!: (response: Response) => void;
    const pendingHealth = new Promise<Response>((resolve) => { resolveHealth = resolve; });
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (calls.length === 1) return pendingHealth;
      const url = String(input);
      const value = url.includes("/session/status") ? {} : url.includes("/message") ? [] : session;
      return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const instance = client(fetchImpl);
    const one = instance.getRun("ses_123");
    const two = instance.getRun("ses_123");
    resolveHealth(new Response(JSON.stringify(health), { status: 200, headers: { "content-type": "application/json" } }));
    await Promise.all([one, two]);
    expect(calls.filter((call) => call.url.endsWith("/global/health"))).toHaveLength(1);

    const retryFetch = mockFetch({ status: 503, value: { error: "down" } }, { value: health }, { status: 404, value: {} });
    const retryClient = client(retryFetch);
    await expect(retryClient.getRun("ses_missing")).rejects.toThrow();
    await expect(retryClient.getRun("ses_missing")).resolves.toMatchObject({ status: "unknown" });
    expect(retryFetch.calls.filter((call) => call.url.endsWith("/global/health"))).toHaveLength(2);
  });

  it("maps before network and keeps dry runs completely offline", async () => {
    const fetchImpl = mockFetch({ value: health });
    const instance = client(fetchImpl, { defaultModel: "openai/gpt-5" });
    await expect(instance.startRun({ input: "hello", tools: [{ name: "unsupported" }], dryRun: true }))
      .rejects.toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }));
    expect(fetchImpl.calls).toHaveLength(0);
    const status = await instance.startRun({ input: "hello", dryRun: true });
    expect(status).toMatchObject({ status: "dry_run", model: "openai/gpt-5" });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("starts a session and synchronous message in exact order, then remembers the terminal status", async () => {
    const fetchImpl = mockFetch({ value: health }, { value: session }, { value: assistant });
    const status = await client(fetchImpl).startRun({ input: "hello", instructions: "system", model: "openai/gpt-5" });
    expect(fetchImpl.calls.map((call) => [call.init?.method, call.url])).toEqual([
      ["GET", "https://opencode.example/api/global/health"],
      ["POST", "https://opencode.example/api/session?directory=%2Fworkspace%2Fproject&workspace=team-a"],
      ["POST", "https://opencode.example/api/session/ses_123/message?directory=%2Fworkspace%2Fproject&workspace=team-a"],
    ]);
    expect(JSON.parse(String(fetchImpl.calls[1]!.init?.body))).toEqual({});
    expect(JSON.parse(String(fetchImpl.calls[2]!.init?.body))).toEqual({
      parts: [{ type: "text", text: "hello" }],
      model: { providerID: "openai", modelID: "gpt-5" },
      system: "system",
    });
    expect(status).toMatchObject({ run_id: "ses_123", status: "completed", output: "done" });
  });

  it("returns a remembered run without network and maps failed starts with redacted errors", async () => {
    const secret = "prompt-secret";
    const encodedCredential = "cHJvbXB0LXVzZXI6cHJvbXB0LXNlY3JldA==";
    const fetchImpl = mockFetch(
      { value: health },
      { value: session },
      {
        value: {
          ...assistant,
          info: {
            ...assistant.info,
            error: { message: `failed prompt-user ${secret} ${encodedCredential}` },
          },
        },
      },
    );
    const instance = client(fetchImpl, { username: "prompt-user", password: secret });
    const started = await instance.startRun({ input: "hello" });
    const before = fetchImpl.calls.length;
    await expect(instance.getRun("ses_123")).resolves.toEqual(started);
    expect(fetchImpl.calls).toHaveLength(before);
    expect(started).toMatchObject({
      status: "failed",
      error: "failed [REDACTED] [REDACTED] [REDACTED]",
    });
    expect(started.error).not.toContain(secret);
    expect(started.error).not.toContain("prompt-user");
    expect(started.error).not.toContain(encodedCredential);
  });

  it("returns an honest unknown for session 404 and propagates other HTTP errors", async () => {
    const notFound = mockFetch({ value: health }, { status: 404, value: { error: "missing" } });
    await expect(client(notFound).getRun("ses_missing")).resolves.toEqual({
      run_id: "ses_missing",
      status: "unknown",
      error: "opencode: session not found",
    });
    const secret = "body-secret";
    const unavailable = mockFetch(
      { value: health },
      { status: 503, value: { error: `down ${secret}` } },
    );
    const rejected = client(unavailable, { password: secret }).getRun("ses_missing");
    await expect(rejected).rejects.toBeInstanceOf(HttpApiError);
    try {
      await rejected;
    } catch (error) {
      expect(error).toBeInstanceOf(HttpApiError);
      const httpError = error as HttpApiError;
      expect(httpError.status).toBe(503);
      expect(httpError.path).toBe("/session/ses_missing?directory=%2Fworkspace%2Fproject&workspace=team-a");
      expect(httpError.body).toContain("[REDACTED]");
      expect(httpError.body).not.toContain(secret);
    }
  });

  it("maps busy/retry to running and reconciles idle/absent through history", async () => {
    const busy = mockFetch({ value: health }, { value: session }, { value: { ses_123: { type: "busy" } } });
    await expect(client(busy).getRun("ses_123")).resolves.toEqual({ run_id: "ses_123", status: "running" });
    expect(busy.calls).toHaveLength(3);

    const idle = mockFetch({ value: health }, { value: session }, { value: { ses_123: { type: "idle" } } }, { value: [assistant] });
    await expect(client(idle).getRun("ses_123")).resolves.toMatchObject({ status: "completed", output: "done" });
    expect(idle.calls).toHaveLength(4);

    const absent = mockFetch({ value: health }, { value: session }, { value: {} }, { value: [] });
    await expect(client(absent).getRun("ses_123")).resolves.toEqual({
      run_id: "ses_123", status: "unknown", error: "opencode: no terminal assistant message",
    });

    const secret = "history-secret";
    const history = mockFetch(
      { value: health },
      { value: session },
      { value: { ses_123: { type: "idle" } } },
      { value: [{
        info: { ...assistant.info, error: { message: `history failed ${secret}` } },
        parts: assistant.parts,
      }] },
    );
    const historyInstance = client(history, { username: "history-user", password: secret });
    const historyStatus = await historyInstance.getRun("ses_123");
    expect(historyStatus).toMatchObject({ status: "failed", error: "history failed [REDACTED]" });
    expect(historyStatus.error).not.toContain(secret);
    await expect(historyInstance.getRun("ses_123")).resolves.toEqual(historyStatus);
    expect(history.calls).toHaveLength(4);
  });

  it("aborts runs with strict boolean parsing and cached false outcomes", async () => {
    const successful = mockFetch({ value: health }, { value: true });
    await expect(client(successful).cancelRun("ses_123")).resolves.toEqual({ status: "cancelled" });
    const falseResult = mockFetch({ value: health }, { value: false });
    await expect(client(falseResult).cancelRun("ses_123")).resolves.toEqual({ status: "unknown" });
    const malformed = mockFetch({ value: health }, { value: { aborted: true } });
    await expect(client(malformed).cancelRun("ses_123")).rejects.toThrowError(expect.objectContaining({
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.ProtocolMismatch,
    }));
  });

  it("rejects malformed run IDs before making any request", async () => {
    const fetchImpl = mockFetch({ value: health });
    const instance = client(fetchImpl);
    for (const runId of ["", "run_1", " ses_1", " "]) {
      await expect(instance.getRun(runId)).rejects.toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }));
      await expect(instance.cancelRun(runId)).rejects.toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }));
    }
    expect(fetchImpl.calls).toHaveLength(0);
  });
});

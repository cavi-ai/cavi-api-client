import { describe, expect, it, vi } from "vitest";
import { GatewaySseRunEventProvider } from "../../../../core/gateway/run/sse-run-event-provider";
import { RUN_STREAM_EVENT_NAMES, type RunStreamEvent } from "../../../../core/runtime/run-stream";

describe("GatewaySseRunEventProvider — usage normalization (F6)", () => {
  it("populates normalized tokens on a live SSE run.completed event", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        `data: ${JSON.stringify({
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          run_id: "run_1",
          output: "done",
          usage: { input_tokens: 70, output_tokens: 30 },
        })}\n\n`,
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const events: RunStreamEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      void provider.subscribe(
        { runId: "run_1" },
        { onEvent: (e) => events.push(e), onError: reject, onComplete: resolve },
      );
    });

    expect(events).toEqual([
      {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId: "run_1",
        output: "done",
        usage: { inputTokens: 70, outputTokens: 30, totalTokens: 100, raw: { input_tokens: 70, output_tokens: 30 } },
        at: undefined,
      },
    ]);
  });

  it("populates normalized tokens on the poll-fallback run.completed event", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/events")) return new Response("not found", { status: 404 });
      return new Response(
        JSON.stringify({ run_id: "run_2", status: "completed", output: "done", usage: { input_tokens: 5, output_tokens: 7 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const events: RunStreamEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      void provider.subscribe(
        { runId: "run_2" },
        { onEvent: (e) => events.push(e), onError: reject, onComplete: resolve },
      );
    });

    expect(events).toEqual([
      {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId: "run_2",
        output: "done",
        usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12, raw: { input_tokens: 5, output_tokens: 7 } },
        at: undefined,
      },
    ]);
  });
});

describe("GatewaySseRunEventProvider — HTTP failure carries status (F4)", () => {
  it("attaches the numeric HTTP status to a failed SSE-request error", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
      fallbackToPoll: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await new Promise<unknown>((resolve) => {
      void provider.subscribe(
        { runId: "run_1" },
        { onEvent: () => undefined, onError: resolve },
      );
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as { status?: number }).status).toBe(503);
  });

  it("attaches the numeric HTTP status to a poll-fallback failure error", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/events")) return new Response("gone", { status: 404 });
      return new Response("boom", { status: 500 });
    });
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await new Promise<unknown>((resolve) => {
      void provider.subscribe(
        { runId: "run_2" },
        { onEvent: () => undefined, onError: resolve },
      );
    });
    expect((error as { status?: number }).status).toBe(500);
  });

  it("preserves a 401 status so the facade classifier can rethrow it as auth (F4)", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    const provider = new GatewaySseRunEventProvider({
      httpBase: "https://gateway.example",
      authToken: "token",
      clientId: "client-1",
      fallbackToPoll: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await new Promise<unknown>((resolve) => {
      void provider.subscribe(
        { runId: "run_3" },
        { onEvent: () => undefined, onError: resolve },
      );
    });
    expect((error as { status?: number }).status).toBe(401);
  });
});

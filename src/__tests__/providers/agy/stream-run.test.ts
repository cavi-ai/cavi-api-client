import { describe, expect, it, vi } from "vitest";
import { AgyApiClient } from "../../../providers/agy/client.js";
import {
  isNonTerminalStreamError,
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../../core/runtime/run-stream.js";

function sseFrame(value: string): Uint8Array {
  return new TextEncoder().encode(`data: ${value}\n\n`);
}

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(sseFrame(frame));
      controller.close();
    },
  });
}

function streamFetch(body: ReadableStream<Uint8Array>): typeof fetch {
  return vi.fn(async () => new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  })) as unknown as typeof fetch;
}

function client(fetchImpl: typeof fetch): AgyApiClient {
  return new AgyApiClient({
    baseUrl: "https://api.antigravity.google",
    apiKey: "sk-test",
    fetchImpl,
  });
}

describe("AgyApiClient.streamRun", () => {
  it("emits ordered deltas and one completed event", async () => {
    const fetchImpl = streamFetch(sseStream([
      JSON.stringify({ status: "running", result: { output: "first" } }),
      JSON.stringify({ status: "running", result: { output: "second" } }),
      JSON.stringify({ run_id: "agy-stream-1", status: "completed" }),
      JSON.stringify({ run_id: "agy-stream-1", status: "completed" }),
    ]));
    const agyClient = client(fetchImpl);
    const events: RunStreamEvent[] = [];
    let completeCalls = 0;

    await agyClient.streamRun(
      { input: "hi", model: "agy-agent-1" },
      { onEvent: (event) => events.push(event), onComplete: () => { completeCalls += 1; } },
    );

    expect(events.map((event) => event.event)).toEqual([
      RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
    ]);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA)
      .map((event) => event.delta)).toEqual(["first", "second"]);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED)).toHaveLength(1);
    expect(completeCalls).toBe(1);
    await expect(agyClient.getRun("agy-stream-1")).resolves.toMatchObject({ status: "completed" });
  });

  it("maps failed status to run.failed without run.completed", async () => {
    const fetchImpl = streamFetch(sseStream([
      JSON.stringify({ run_id: "agy-stream-failed", status: "failed" }),
      JSON.stringify({ run_id: "agy-stream-failed", status: "failed" }),
    ]));
    const agyClient = client(fetchImpl);
    const events: RunStreamEvent[] = [];
    let completeCalls = 0;

    await agyClient.streamRun(
      { input: "hi", model: "agy-agent-1" },
      { onEvent: (event) => events.push(event), onComplete: () => { completeCalls += 1; } },
    );

    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED)).toHaveLength(1);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED)).toHaveLength(0);
    expect(events.at(-1)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId: "agy-stream-failed",
      error: "agy: upstream run failed",
    });
    expect(completeCalls).toBe(1);
    await expect(agyClient.getRun("agy-stream-failed")).resolves.toMatchObject({ status: "failed" });
  });

  it("reports a malformed frame as non-terminal and continues", async () => {
    const fetchImpl = streamFetch(sseStream([
      "not-json",
      JSON.stringify({ run_id: "agy-stream-valid", status: "completed" }),
    ]));
    const events: RunStreamEvent[] = [];
    const errors: unknown[] = [];
    let completeCalls = 0;

    await client(fetchImpl).streamRun(
      { input: "hi", model: "agy-agent-1" },
      {
        onEvent: (event) => events.push(event),
        onError: (error) => errors.push(error),
        onComplete: () => { completeCalls += 1; },
      },
    );

    expect(errors).toHaveLength(1);
    expect(isNonTerminalStreamError(errors[0])).toBe(true);
    expect(events.at(-1)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: "agy-stream-valid",
    });
    expect(completeCalls).toBe(1);
  });

  it("reports a missing response body as terminal without completion", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const errors: unknown[] = [];
    const events: RunStreamEvent[] = [];
    let completeCalls = 0;

    await client(fetchImpl).streamRun(
      { input: "hi", model: "agy-agent-1" },
      {
        onEvent: (event) => events.push(event),
        onError: (error) => errors.push(error),
        onComplete: () => { completeCalls += 1; },
      },
    );

    expect(errors).toHaveLength(1);
    expect(events).toHaveLength(0);
    expect(completeCalls).toBe(0);
  });

  it("reports a transport rejection as terminal without lifecycle completion", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection lost");
    }) as unknown as typeof fetch;
    const errors: unknown[] = [];
    const events: RunStreamEvent[] = [];
    let completeCalls = 0;

    await client(fetchImpl).streamRun(
      { input: "hi", model: "agy-agent-1" },
      {
        onEvent: (event) => events.push(event),
        onError: (error) => errors.push(error),
        onComplete: () => { completeCalls += 1; },
      },
    );

    expect(errors).toHaveLength(1);
    expect(isNonTerminalStreamError(errors[0])).toBe(false);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED)).toHaveLength(0);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED)).toHaveLength(0);
    expect(completeCalls).toBe(0);
  });

  it("surfaces onEvent handler errors through terminal onError", async () => {
    const fetchImpl = streamFetch(sseStream([
      JSON.stringify({ status: "running", result: { output: "first" } }),
    ]));
    const handlerError = new Error("consumer failed");
    const errors: unknown[] = [];
    let completeCalls = 0;

    await client(fetchImpl).streamRun(
      { input: "hi", model: "agy-agent-1" },
      {
        onEvent: () => { throw handlerError; },
        onError: (error) => errors.push(error),
        onComplete: () => { completeCalls += 1; },
      },
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(handlerError);
    expect(isNonTerminalStreamError(errors[0])).toBe(false);
    expect(completeCalls).toBe(0);
  });

  it("does not synthesize completion after caller abort", async () => {
    const abortController = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseFrame(JSON.stringify({ status: "running", result: { output: "first" } })));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = streamFetch(body);
    const events: RunStreamEvent[] = [];
    let completeCalls = 0;

    await client(fetchImpl).streamRun(
      { input: "hi", model: "agy-agent-1" },
      {
        onEvent: (event) => {
          events.push(event);
          abortController.abort();
        },
        onComplete: () => { completeCalls += 1; },
      },
      { signal: abortController.signal },
    );

    expect(cancelled).toBe(true);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED)).toHaveLength(0);
    expect(events.filter((event) => event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED)).toHaveLength(0);
    expect(completeCalls).toBe(0);
  });
});

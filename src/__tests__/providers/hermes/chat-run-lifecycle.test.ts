import { getEventListeners, once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { startHermesChatRun, streamHermesChatRun } from "../../../providers/hermes/chat-run.js";

const chat = {
  httpBase: "https://hermes.example", authToken: "test-token",
  clientId: "chat-client", input: "hello", sessionId: "session-1",
};

const fetchStream: typeof fetch = async (input) => String(input).endsWith("/events")
  ? new Response('data: {"event":"run.completed","output":"answer"}\n\n', {
    headers: { "content-type": "text/event-stream" },
  })
  : Response.json({ run_id: "run-1" });

describe("Hermes chat lifecycle", () => {
  it("preserves caller cancellation while native run-start response text is pending", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(202, { "content-type": "application/json" });
      response.write('{"run_id":');
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");
    let startedReading!: () => void;
    const reading = new Promise<void>((resolve) => { startedReading = resolve; });
    const controller = new AbortController();
    const reason = new Error("Chat view closed");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = startHermesChatRun({
        ...chat, httpBase: `http://127.0.0.1:${address.port}`, signal: controller.signal,
        fetchImpl: async (input, init) => {
          const response = await fetch(input, init);
          const text = response.text.bind(response);
          response.text = () => { startedReading(); return text(); };
          return response;
        },
      });
      const observed = request.then(() => "unexpected success", (error: unknown) => error);
      await reading;
      controller.abort(reason);
      expect(await Promise.race([
        observed,
        new Promise((resolve) => { timer = setTimeout(() => resolve("body read still pending"), 500); }),
      ])).toBe(reason);
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("does not accumulate caller abort listeners after completed chat streams", async () => {
    const controller = new AbortController();
    for (let index = 0; index < 3; index++) {
      await expect(streamHermesChatRun({
        ...chat, signal: controller.signal, fetchImpl: fetchStream, onEvent: () => undefined,
      })).resolves.toEqual({ sawAssistantResponseEvent: true });
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    }
  });

  it("detaches its abort listener when the consumer's event handler fails", async () => {
    const controller = new AbortController();
    const reason = new Error("Chat rendering failed");
    await expect(streamHermesChatRun({
      ...chat, signal: controller.signal, fetchImpl: fetchStream,
      onEvent: () => { throw reason; },
    })).rejects.toBe(reason);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("cancels an open event body when the consumer's event handler fails", async () => {
    const reason = new Error("Chat rendering failed");
    let bodyCancelled!: () => void;
    const cancelled = new Promise<string>((resolve) => { bodyCancelled = () => resolve("cancelled"); });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller;
        controller.enqueue(new TextEncoder().encode('data: {"event":"message.delta","text":"hello"}\n\n'));
      },
      cancel: bodyCancelled,
    });
    try {
      await expect(streamHermesChatRun({
        ...chat,
        fetchImpl: async (input) => String(input).endsWith("/events")
          ? new Response(body, { headers: { "content-type": "text/event-stream" } })
          : Response.json({ run_id: "run-1" }),
        onEvent: () => { throw reason; },
      })).rejects.toBe(reason);
      expect(await Promise.race([
        cancelled,
        new Promise((resolve) => { timer = setTimeout(() => resolve("event body still open"), 500); }),
      ])).toBe("cancelled");
    } finally {
      clearTimeout(timer);
      bodyController.error(reason);
    }
  });
});

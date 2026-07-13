import { describe, expect, it, vi } from "vitest";
import {
  createWebSocketTransport,
  type WebSocketLike,
} from "../../../core/transport/index.js";

class FakeSocket implements WebSocketLike {
  readyState = 0;
  readonly listeners = new Map<string, Set<EventListener>>();
  readonly send = vi.fn<(data: string | ArrayBufferLike | Blob | ArrayBufferView) => void>();
  readonly close = vi.fn<(code?: number, reason?: string) => void>(() => {
    this.readyState = 3;
    this.emit("close", { code: 1000, wasClean: true });
  });
  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string, init: Record<string, unknown> = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ type, ...init } as unknown as Event);
    }
  }
}

function createFakeWebSocketFactory() {
  const sockets: FakeSocket[] = [];
  const calls: Array<{ url: string; protocols?: readonly string[] }> = [];
  return {
    sockets,
    calls,
    factory(url: string, protocols?: readonly string[]) {
      calls.push({ url, protocols });
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    open(index: number) {
      sockets[index]!.readyState = 1;
      sockets[index]!.emit("open");
    },
    message(index: number, data: unknown) { sockets[index]!.emit("message", { data }); },
    close(index: number, code = 1006, wasClean = false) {
      sockets[index]!.readyState = 3;
      sockets[index]!.emit("close", { code, wasClean });
    },
  };
}

const reconnect = { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 } as const;

describe("WebSocket transport", () => {
  it("opens, decodes messages, encodes sends, and closes once", async () => {
    const fake = createFakeWebSocketFactory();
    const channel = createWebSocketTransport({ webSocketFactory: fake.factory }).connect({
      url: "wss://runtime.test/rpc",
    });
    const received: unknown[] = [];
    channel.subscribe((message) => received.push(message));
    fake.open(0);
    await channel.ready;
    fake.message(0, '{"event":"ready"}');
    await channel.send({ method: "ping" });
    await channel.close("finished");
    await channel.close("ignored");
    expect(received).toEqual([{ event: "ready" }]);
    expect(fake.sockets[0]!.send).toHaveBeenCalledWith('{"method":"ping"}');
    expect(fake.sockets[0]!.close).toHaveBeenCalledOnce();
  });

  it("rejects sends before open and after close", async () => {
    const fake = createFakeWebSocketFactory();
    const channel = createWebSocketTransport({ webSocketFactory: fake.factory }).connect({ url: "wss://runtime.test" });
    await expect(channel.send("early")).rejects.toMatchObject({ transport: { phase: "request", retryable: false } });
    fake.open(0);
    await channel.ready;
    fake.close(0, 1000, true);
    await expect(channel.send("late")).rejects.toMatchObject({ transport: { phase: "request", retryable: false } });
  });

  it("reconnects without replay and refreshes URL and protocols", async () => {
    const fake = createFakeWebSocketFactory();
    const url = vi.fn().mockResolvedValueOnce("wss://runtime.test/one?token=secret").mockResolvedValueOnce("wss://runtime.test/two?token=fresh");
    const protocols = vi.fn().mockResolvedValueOnce(["first"]).mockResolvedValueOnce(["second"]);
    const channel = createWebSocketTransport({
      webSocketFactory: fake.factory,
      dependencies: { sleep: async () => undefined, now: () => 0, random: () => 0.5 },
    }).connect({ url, protocols, reconnect });
    await vi.waitFor(() => expect(fake.sockets).toHaveLength(1));
    fake.open(0);
    await channel.ready;
    await channel.send("once");
    fake.close(0, 1012);
    await vi.waitFor(() => expect(fake.sockets).toHaveLength(2));
    fake.open(1);
    fake.message(1, '{"event":"ready"}');
    await channel.ready;
    expect(fake.calls).toEqual([
      { url: "wss://runtime.test/one?token=secret", protocols: ["first"] },
      { url: "wss://runtime.test/two?token=fresh", protocols: ["second"] },
    ]);
    expect(fake.sockets[0]!.send).toHaveBeenCalledOnce();
    expect(fake.sockets[1]!.send).not.toHaveBeenCalled();
  });

  it("bounds reconnects, emits safe lifecycle data, and reports safe close metadata", async () => {
    const fake = createFakeWebSocketFactory();
    const events: unknown[] = [];
    const channel = createWebSocketTransport({
      webSocketFactory: fake.factory,
      dependencies: { sleep: async () => undefined, now: () => 0, random: () => 0.5 },
      onLifecycleEvent: (event) => events.push(event),
    }).connect({ url: "wss://runtime.test/?token=secret", reconnect });
    const closed = new Promise<unknown>((resolve) => channel.subscribeClose(resolve));
    fake.close(0, 1012);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    fake.close(1, 1006);
    const error = await closed;
    expect(fake.sockets).toHaveLength(2);
    expect(error).toMatchObject({ transport: { kind: "websocket", phase: "close", attempt: 2, status: 1006 } });
    expect(JSON.stringify({ events, error })).not.toContain("secret");
  });

  it("aborts, cleans listeners, and notifies close subscribers exactly once", async () => {
    const fake = createFakeWebSocketFactory();
    const controller = new AbortController();
    const channel = createWebSocketTransport({ webSocketFactory: fake.factory }).connect({
      url: "wss://runtime.test",
      signal: controller.signal,
    });
    const first = vi.fn();
    const second = vi.fn(() => { throw new Error("observer"); });
    channel.subscribeClose(second);
    channel.subscribeClose(first);
    controller.abort();
    controller.abort();
    await expect(channel.ready).rejects.toMatchObject({ transport: { phase: "close" } });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect([...fake.sockets[0]!.listeners.values()].every((set) => set.size === 0)).toBe(true);
  });

  it("decodes ArrayBuffer JSON and normalizes decoder failures", async () => {
    const fake = createFakeWebSocketFactory();
    const channel = createWebSocketTransport({ webSocketFactory: fake.factory }).connect({ url: "wss://runtime.test" });
    const received: unknown[] = [];
    channel.subscribe((message) => received.push(message));
    const closed = new Promise<unknown>((resolve) => channel.subscribeClose(resolve));
    fake.open(0);
    await channel.ready;
    fake.message(0, new TextEncoder().encode('{"ok":true}').buffer);
    await Promise.resolve();
    expect(received).toEqual([{ ok: true }]);
    fake.message(0, "secret-not-json");
    const error = await closed;
    expect(error).toMatchObject({ message: "WebSocket message decoding failed", transport: { phase: "decode" } });
    expect(JSON.stringify(error)).not.toContain("secret-not-json");
  });
});

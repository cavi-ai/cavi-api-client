import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { TransportMessageChannel } from "../../../../../core/transport/index.js";
import { createHermesDashboardJsonRpcClient } from "../../../../../extensions/cavi/providers/hermes/dashboard-json-rpc.js";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(
    new URL(`../../../../fixtures/hermes/dashboard/json-rpc/${name}.json`, import.meta.url),
  ), "utf8")) as unknown;
}

function createChannel(): TransportMessageChannel<unknown> & {
  sent: unknown[];
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly closeListenerCount: number;
  receive(message: unknown): void;
  remoteClose(error?: unknown): void;
} {
  const listeners = new Set<(message: unknown) => void>();
  const closeListeners = new Set<(error?: unknown) => void>();
  const close = vi.fn(async () => {
    for (const listener of [...closeListeners]) listener();
  });
  return {
    sent: [],
    get closeListenerCount() { return closeListeners.size; },
    send(message) { this.sent.push(message); return Promise.resolve(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeClose(listener) { closeListeners.add(listener); return () => closeListeners.delete(listener); },
    close,
    receive(message) { for (const listener of [...listeners]) listener(message); },
    remoteClose(error) { for (const listener of [...closeListeners]) listener(error); },
  };
}

function createAlreadyClosedChannel(): TransportMessageChannel<unknown> & {
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
  closeCleanups: Array<ReturnType<typeof vi.fn<() => void>>>;
  receive(message: unknown): void;
} {
  const listeners = new Set<(message: unknown) => void>();
  const close = vi.fn(async () => {});
  const closeCleanups: Array<ReturnType<typeof vi.fn<() => void>>> = [];
  return {
    close,
    closeCleanups,
    async send() { throw new Error("already closed"); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeClose(listener) {
      const cleanup = vi.fn();
      closeCleanups.push(cleanup);
      listener(new Error("already-closed-secret"));
      return cleanup;
    },
    receive(message) { for (const listener of [...listeners]) listener(message); },
  };
}

describe("Hermes dashboard JSON-RPC client", () => {
  it("correlates fixture results and out-of-order responses", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel });
    const first = client.request("session.list", { limit: 20 });
    const second = client.request("session.usage");
    const firstFrame = channel.sent[0] as { id: string | number };
    const secondFrame = channel.sent[1] as { id: string | number };
    const usage = fixture("session-usage-result") as Record<string, unknown>;
    const list = fixture("session-list-result") as Record<string, unknown>;
    channel.receive({ ...usage, id: secondFrame.id });
    channel.receive({ ...list, id: firstFrame.id });
    await expect(Promise.all([first, second])).resolves.toEqual([list.result, usage.result]);
  });

  it("rejects standard errors without exposing remote messages", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel });
    const pending = client.request("session.unknown", { token: "client-secret" });
    const id = (channel.sent[0] as { id: string | number }).id;
    const response = fixture("error-response") as Record<string, unknown>;
    channel.receive({ ...response, id });
    const error = await pending.catch((reason: unknown) => reason);
    expect(error).toMatchObject({ transport: { kind: "json-rpc", code: -32601 } });
    expect(String(error)).not.toContain("unknown method");
    expect(String(error)).not.toContain("client-secret");
  });

  it("validates event notifications, fans out, and isolates subscribers", () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel });
    const first = vi.fn(() => { throw new Error("subscriber-secret"); });
    const second = vi.fn();
    client.subscribe(first);
    client.subscribe(second);
    const event = fixture("event-notification") as { params: unknown };
    channel.receive({ jsonrpc: "2.0", method: "other", params: event.params });
    channel.receive({ jsonrpc: "2.0", method: "event", params: null });
    channel.receive({ jsonrpc: "2.0", method: "event", params: { type: "", payload: {} } });
    channel.receive({ jsonrpc: "2.0", method: "event", params: event.params });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(event.params);
  });

  it("forwards abort and releases bounded pending capacity", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel, maxPendingRequests: 1 });
    const controller = new AbortController();
    const first = client.request("session.list", undefined, { signal: controller.signal });
    await expect(client.request("session.usage")).rejects.toThrow(/pending request limit/i);
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    const next = client.request("session.usage");
    const id = (channel.sent.at(-1) as { id: string | number }).id;
    channel.receive({ jsonrpc: "2.0", id, result: { total: 0 } });
    await expect(next).resolves.toEqual({ total: 0 });
  });

  it("forwards redacted protocol errors and releases malformed-response capacity", async () => {
    const channel = createChannel();
    const onProtocolError = vi.fn();
    const client = createHermesDashboardJsonRpcClient({
      channel,
      maxPendingRequests: 1,
      onProtocolError,
    });
    const first = client.request("session.list", { token: "request-secret" });
    const id = (channel.sent[0] as { id: string | number }).id;
    channel.receive({
      jsonrpc: "2.0",
      id,
      result: { leaked: "result-secret" },
      error: { code: -32000, message: "remote-secret" },
    });
    const error = await first.catch((reason: unknown) => reason);
    expect(error).toBe(onProtocolError.mock.calls[0]?.[0]);
    expect(String(error)).not.toMatch(/request-secret|result-secret|remote-secret/u);
    expect(onProtocolError).toHaveBeenCalledTimes(1);

    const next = client.request("session.usage");
    const nextId = (channel.sent.at(-1) as { id: string | number }).id;
    channel.receive({ jsonrpc: "2.0", id: nextId, result: { total: 0 } });
    await expect(next).resolves.toEqual({ total: 0 });
  });

  it("releases pending capacity after a send rejection", async () => {
    const channel = createChannel();
    const normalSend = channel.send.bind(channel);
    channel.send = vi.fn()
      .mockRejectedValueOnce(new Error("send-secret"))
      .mockImplementation(normalSend);
    const client = createHermesDashboardJsonRpcClient({ channel, maxPendingRequests: 1 });
    const error = await client.request("session.list").catch((reason: unknown) => reason);
    expect(error).toMatchObject({ transport: { kind: "json-rpc", phase: "request" } });
    expect(String(error)).not.toContain("send-secret");

    const next = client.request("session.usage");
    const id = (channel.sent.at(-1) as { id: string | number }).id;
    channel.receive({ jsonrpc: "2.0", id, result: { total: 0 } });
    await expect(next).resolves.toEqual({ total: 0 });
  });

  it("synchronizes facade state when a borrowed channel closes remotely", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel, ownsChannel: false });
    const listener = vi.fn();
    client.subscribe(listener);
    const pending = client.request("session.list");
    const rejected = expect(pending).rejects.toThrow(/closed/i);
    channel.remoteClose(new Error("remote-close-secret"));
    await rejected;
    expect(channel.closeListenerCount).toBe(0);

    const afterClose = vi.fn();
    client.subscribe(afterClose);
    channel.receive({
      jsonrpc: "2.0",
      method: "event",
      params: { type: "gateway.ready", payload: true },
    });
    expect(listener).not.toHaveBeenCalled();
    expect(afterClose).not.toHaveBeenCalled();
    expect(channel.close).not.toHaveBeenCalled();
    await client.dispose();
    await client.dispose();
    expect(channel.close).not.toHaveBeenCalled();
  });

  it("cleans up synchronous already-closed subscriptions immediately", async () => {
    const channel = createAlreadyClosedChannel();
    const client = createHermesDashboardJsonRpcClient({ channel, ownsChannel: false });
    expect(channel.closeCleanups).toHaveLength(2);
    expect(channel.closeCleanups[0]).toHaveBeenCalledTimes(1);
    expect(channel.closeCleanups[1]).toHaveBeenCalledTimes(1);

    const listener = vi.fn();
    client.subscribe(listener);
    channel.receive({
      jsonrpc: "2.0",
      method: "event",
      params: { type: "gateway.ready", payload: true },
    });
    expect(listener).not.toHaveBeenCalled();
    await expect(client.request("session.list")).rejects.toThrow(/closed/i);
    await client.dispose();
    await client.dispose();
    expect(channel.close).not.toHaveBeenCalled();
    expect(channel.closeCleanups.every((cleanup) => cleanup.mock.calls.length === 1)).toBe(true);
  });

  it("does not close a borrowed channel and disposal is idempotent", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({
      channel,
      ownsChannel: false,
      maxPendingRequests: 1,
    });
    const pending = client.request("session.list");
    const pendingRejected = expect(pending).rejects.toThrow(/closed/i);
    const disposing = client.dispose();
    await expect(client.request("later")).rejects.toThrow(/closed/i);
    await disposing;
    await client.dispose();
    await pendingRejected;
    expect(channel.close).not.toHaveBeenCalled();
  });

  it("closes an owned channel exactly once", async () => {
    const channel = createChannel();
    const client = createHermesDashboardJsonRpcClient({ channel, ownsChannel: true });
    await client.dispose();
    await client.dispose();
    expect(channel.close).toHaveBeenCalledTimes(1);
  });
});

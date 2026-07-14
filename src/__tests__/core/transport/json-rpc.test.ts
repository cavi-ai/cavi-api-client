import { describe, expect, it, vi } from "vitest";
import {
  TransportError,
  createJsonRpcTransport,
  type TransportMessageChannel,
} from "../../../core/transport/index.js";

function createFakeMessageChannel(): TransportMessageChannel<unknown> & {
  sent: unknown[];
  receive(message: unknown): void;
  remoteClose(error?: unknown): void;
  closed: boolean;
} {
  const listeners = new Set<(message: unknown) => void>();
  const closeListeners = new Set<(error?: unknown) => void>();
  let closeError: unknown;
  return {
    sent: [],
    closed: false,
    async send(message) { this.sent.push(message); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeClose(listener) {
      if (this.closed) { listener(closeError); return () => {}; }
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    async close() {
      if (this.closed) return;
      this.closed = true;
      for (const listener of closeListeners) listener();
    },
    receive(message) { for (const listener of listeners) listener(message); },
    remoteClose(error) {
      if (this.closed) return;
      this.closed = true;
      closeError = error;
      for (const listener of closeListeners) listener(error);
    },
  };
}

describe("JSON-RPC transport", () => {
  it("correlates out-of-order JSON-RPC responses", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({ channel, id: (() => { let id = 0; return () => ++id; })() });
    const first = rpc.request("models/list", { cursor: null });
    const second = rpc.request("tasks/list", { cursor: null });
    channel.receive({ jsonrpc: "2.0", id: 2, result: ["task"] });
    channel.receive({ jsonrpc: "2.0", id: 1, result: ["model"] });
    await expect(Promise.all([first, second])).resolves.toEqual([["model"], ["task"]]);
  });

  it("sends notifications without ids and delivers incoming notifications", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({ channel });
    const listener = vi.fn();
    rpc.onNotification(listener);
    await rpc.notify("ready", { ok: true });
    expect(channel.sent).toEqual([{ jsonrpc: "2.0", method: "ready", params: { ok: true } }]);
    channel.receive({ jsonrpc: "2.0", method: "progress", params: { value: 2 } });
    expect(listener).toHaveBeenCalledWith("progress", { value: 2 });
  });

  it("rejects JSON-RPC errors without exposing remote data in the message", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({ channel, id: () => "request-1" });
    const pending = rpc.request("secret/method");
    channel.receive({ jsonrpc: "2.0", id: "request-1", error: { code: -32000, message: "token-value" } });
    await expect(pending).rejects.toMatchObject({
      name: "TransportError",
      transport: { kind: "json-rpc", phase: "request", code: -32000 },
    });
    await expect(pending).rejects.not.toHaveProperty("message", expect.stringContaining("token-value"));
  });

  it("reports malformed messages and unknown response ids as protocol errors", async () => {
    const channel = createFakeMessageChannel();
    const onProtocolError = vi.fn();
    const rpc = createJsonRpcTransport({ channel, onProtocolError });
    channel.receive({ jsonrpc: "1.0", id: 1, result: true });
    channel.receive({ jsonrpc: "2.0", id: 999, result: true });
    expect(onProtocolError).toHaveBeenCalledTimes(2);
    expect(onProtocolError.mock.calls.every(([error]) => error instanceof TransportError)).toBe(true);
    await rpc.close();
  });

  it.each([
    ["both result and error", { result: true, error: { code: -32000, message: "remote-secret" } }],
    ["neither result nor error", {}],
    ["a malformed error object", { error: { code: "bad", message: "remote-secret" } }],
  ])("rejects a matching request for a malformed response with %s", async (_label, body) => {
    const channel = createFakeMessageChannel();
    const onProtocolError = vi.fn();
    const rpc = createJsonRpcTransport({ channel, id: () => 4, onProtocolError });
    const pending = rpc.request("models/list");
    channel.receive({ jsonrpc: "2.0", id: 4, ...body });
    const error = await pending.catch((reason: unknown) => reason);
    expect(error).toBe(onProtocolError.mock.calls[0]?.[0]);
    expect(error).toMatchObject({ transport: { kind: "json-rpc", phase: "decode" } });
    expect(String(error)).not.toContain("remote-secret");
    expect(onProtocolError).toHaveBeenCalledTimes(1);

    const next = rpc.request("models/list");
    channel.receive({ jsonrpc: "2.0", id: 4, result: ["model"] });
    await expect(next).resolves.toEqual(["model"]);
  });

  it("reports an unknown response id without settling another pending request", async () => {
    const channel = createFakeMessageChannel();
    const onProtocolError = vi.fn();
    const rpc = createJsonRpcTransport({ channel, id: () => 4, onProtocolError });
    const pending = rpc.request("models/list");
    channel.receive({ jsonrpc: "2.0", id: 999, result: ["wrong"] });
    expect(onProtocolError).toHaveBeenCalledTimes(1);
    channel.receive({ jsonrpc: "2.0", id: 4, result: ["model"] });
    await expect(pending).resolves.toEqual(["model"]);
  });

  it("settles malformed matching responses when the protocol observer throws", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({
      channel,
      id: () => 4,
      onProtocolError: () => { throw new Error("observer-secret"); },
    });
    const pending = rpc.request("models/list");
    channel.receive({ jsonrpc: "2.0", id: 4 });
    await expect(pending).rejects.toMatchObject({ transport: { phase: "decode" } });
  });

  it("removes aborted requests and ignores their later responses without replay", async () => {
    const channel = createFakeMessageChannel();
    const onProtocolError = vi.fn();
    const rpc = createJsonRpcTransport({ channel, id: () => 7, onProtocolError });
    const controller = new AbortController();
    const pending = rpc.request("models/list", undefined, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    channel.receive({ jsonrpc: "2.0", id: 7, result: [] });
    expect(channel.sent).toHaveLength(1);
    expect(onProtocolError).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate pending ids", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({ channel, id: () => 1 });
    const first = rpc.request("first");
    await expect(rpc.request("second")).rejects.toThrow(/duplicate/i);
    channel.receive({ jsonrpc: "2.0", id: 1, result: true });
    await expect(first).resolves.toBe(true);
  });

  it("cleans up a request when channel send throws synchronously", async () => {
    const channel = createFakeMessageChannel();
    const normalSend = channel.send.bind(channel);
    let shouldThrow = true;
    channel.send = (message, signal) => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error("send-secret");
      }
      return normalSend(message, signal);
    };
    const rpc = createJsonRpcTransport({ channel, id: () => 8 });
    const sendError = await rpc.request("first").catch((error: unknown) => error);
    expect(sendError).toMatchObject({ transport: { kind: "json-rpc", phase: "request" } });
    expect(sendError).not.toHaveProperty("cause");
    const reused = rpc.request("second");
    channel.receive({ jsonrpc: "2.0", id: 8, result: true });
    await expect(reused).resolves.toBe(true);
  });

  it("rejects pending requests exactly once when the channel closes remotely", async () => {
    const channel = createFakeMessageChannel();
    const rpc = createJsonRpcTransport({ channel, id: () => 9 });
    const pending = rpc.request("models/list");
    const rejected = vi.fn();
    void pending.catch(rejected);
    channel.remoteClose(new Error("remote-secret"));
    channel.remoteClose(new Error("duplicate"));
    const closeError = await pending.catch((error: unknown) => error);
    expect(closeError).toMatchObject({ transport: { phase: "close" } });
    expect(closeError).not.toHaveProperty("cause");
    await Promise.resolve();
    expect(rejected).toHaveBeenCalledTimes(1);
    await rpc.close();
    await expect(rpc.request("later")).rejects.toThrow(/closed/i);
  });

  it("rejects every pending request exactly once when closed", async () => {
    const channel = createFakeMessageChannel();
    let id = 0;
    const rpc = createJsonRpcTransport({ channel, id: () => ++id });
    const first = rpc.request("first");
    const second = rpc.request("second");
    await rpc.close();
    await rpc.close();
    await expect(first).rejects.toMatchObject({ transport: { phase: "close" } });
    await expect(second).rejects.toMatchObject({ transport: { phase: "close" } });
    expect(channel.closed).toBe(true);
    await expect(rpc.request("later")).rejects.toThrow(/closed/i);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createUnixSocketTransport,
  type UnixSocketLike,
} from "../../../../core/transport/node/index.js";
import { getTransportErrorMetadata } from "../../../../core/transport/error.js";

function socketFactory() {
  const sockets: Array<ReturnType<typeof socket>> = [];
  const connect = vi.fn(() => {
    const next = socket();
    sockets.push(next);
    return next.value;
  });
  return { connect, sockets };
}

function socket() {
  const events = new Map<string, Array<(...args: never[]) => void>>();
  const write = vi.fn(() => true);
  const end = vi.fn();
  const destroy = vi.fn();
  const value: UnixSocketLike = {
    write, end, destroy,
    on: (event: string, listener: (...args: never[]) => void) => {
      events.set(event, [...(events.get(event) ?? []), listener]);
    },
  } as UnixSocketLike;
  return {
    value, write, end, destroy,
    emit: (event: string, ...args: unknown[]) => events.get(event)?.forEach((fn) => fn(...args as never[])),
  };
}

const reconnect = { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 } as const;

describe("Node Unix-socket transport", () => {
  it("requires an explicit non-empty socket path before connecting", () => {
    const connectImpl = vi.fn();
    expect(() => createUnixSocketTransport({ path: " ", connectImpl })).toThrow(/path/u);
    expect(connectImpl).not.toHaveBeenCalled();
  });

  it("delivers partial data chunks and honors write backpressure", async () => {
    const factory = socketFactory();
    const channel = createUnixSocketTransport({ path: "/tmp/runtime.sock", connectImpl: factory.connect });
    const received: Uint8Array[] = [];
    channel.subscribe((chunk) => received.push(chunk));
    factory.sockets[0]!.emit("connect");
    await channel.ready;
    factory.sockets[0]!.emit("data", Uint8Array.of(1));
    factory.sockets[0]!.emit("data", Uint8Array.of(2, 3));
    factory.sockets[0]!.write.mockReturnValueOnce(false);
    let settled = false;
    const writing = channel.write(Uint8Array.of(4)).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    factory.sockets[0]!.emit("drain");
    await writing;
    expect(received).toEqual([Uint8Array.of(1), Uint8Array.of(2, 3)]);
  });

  it("reconnects without replaying writes and rejects while disconnected", async () => {
    const factory = socketFactory();
    const channel = createUnixSocketTransport({ path: "/tmp/runtime.sock", connectImpl: factory.connect, reconnect });
    factory.sockets[0]!.emit("connect");
    await channel.ready;
    await channel.write(Uint8Array.of(1));
    factory.sockets[0]!.emit("close");
    await expect(channel.write(Uint8Array.of(2))).rejects.toThrow(/not connected/iu);
    await vi.waitFor(() => expect(factory.connect).toHaveBeenCalledTimes(2));
    factory.sockets[1]!.emit("connect");
    expect(factory.sockets[0]!.write).toHaveBeenCalledTimes(1);
    expect(factory.sockets[1]!.write).not.toHaveBeenCalled();
  });

  it("rejects a backpressured write when its socket disconnects", async () => {
    const factory = socketFactory();
    const channel = createUnixSocketTransport({ path: "/tmp/runtime.sock", connectImpl: factory.connect });
    factory.sockets[0]!.emit("connect");
    await channel.ready;
    factory.sockets[0]!.write.mockReturnValueOnce(false);
    const writing = channel.write(Uint8Array.of(1));
    factory.sockets[0]!.emit("close");
    await expect(writing).rejects.toThrow(/not connected/iu);
  });

  it("bounds reconnect attempts and reports a safe terminal error", async () => {
    const factory = socketFactory();
    const channel = createUnixSocketTransport({ path: "/tmp/secret-token.sock", connectImpl: factory.connect, reconnect });
    factory.sockets[0]!.emit("error", new Error("connect /tmp/secret-token.sock token=hidden"));
    factory.sockets[0]!.emit("close");
    await vi.waitFor(() => expect(factory.connect).toHaveBeenCalledTimes(2));
    factory.sockets[1]!.emit("error", new Error("token=hidden"));
    factory.sockets[1]!.emit("close");
    const error = await channel.closed.catch((value) => value);
    expect(String(error)).not.toContain("hidden");
    expect(String(error)).not.toContain("secret-token");
    expect(getTransportErrorMetadata(error)).toMatchObject({ kind: "unix", phase: "close", attempt: 2 });
  });

  it("destroys each owned socket once across abort and close races", async () => {
    const factory = socketFactory();
    const controller = new AbortController();
    const channel = createUnixSocketTransport({
      path: "/tmp/runtime.sock", connectImpl: factory.connect, reconnect, signal: controller.signal,
    });
    factory.sockets[0]!.emit("connect");
    await channel.ready;
    factory.sockets[0]!.write.mockReturnValueOnce(false);
    const writing = channel.write(Uint8Array.of(1));
    controller.abort();
    await channel.closed;
    await expect(writing).rejects.toThrow(/closed|not connected/iu);
    await channel.close();
    factory.sockets[0]!.emit("close");
    expect(factory.sockets[0]!.end).toHaveBeenCalledTimes(1);
    expect(factory.sockets[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(factory.connect).toHaveBeenCalledTimes(1);
  });
});

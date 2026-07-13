import { describe, expect, it, vi } from "vitest";
import {
  TransportError,
  contentLengthCodec,
  createFramedMessageChannel,
  jsonLinesCodec,
  jsonTextCodec,
  type TransportByteChannel,
} from "../../../core/transport/index.js";

const encoder = new TextEncoder();
const bytes = (value: string): Uint8Array => encoder.encode(value);
const text = (value: Uint8Array): string => new TextDecoder().decode(value);

function createFakeByteChannel(): TransportByteChannel & {
  chunks: Uint8Array[];
  receive(chunk: Uint8Array): void;
  remoteClose(error?: unknown): void;
  closed: boolean;
} {
  const listeners = new Set<(chunk: Uint8Array) => void>();
  const closeListeners = new Set<(error?: unknown) => void>();
  let closeError: unknown;
  return {
    chunks: [],
    closed: false,
    async write(chunk) { this.chunks.push(chunk); },
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
    receive(chunk) { for (const listener of listeners) listener(chunk); },
    remoteClose(error) {
      if (this.closed) return;
      this.closed = true;
      closeError = error;
      for (const listener of closeListeners) listener(error);
    },
  };
}

describe("transport framing", () => {
  it("encodes and decodes one JSON value per text chunk", () => {
    const codec = jsonTextCodec<{ ok: boolean }>();
    expect(text(codec.encode({ ok: true }))).toBe('{"ok":true}');
    expect(codec.createDecoder().push(bytes('{"ok":true}'))).toEqual([{ ok: true }]);
  });

  it("incrementally decodes JSON Lines across chunks and multiple frames", () => {
    const decoder = jsonLinesCodec().createDecoder();
    expect(decoder.push(bytes('{"a":1}\n{"b"'))).toEqual([{ a: 1 }]);
    expect(decoder.push(bytes(':2}\n\n{"c":3}\r\n'))).toEqual([{ b: 2 }, { c: 3 }]);
    expect(decoder.finish()).toEqual([]);
  });

  it("decodes Content-Length frames split across arbitrary chunks", () => {
    const decoder = contentLengthCodec().createDecoder();
    expect(decoder.push(bytes("Content-Length: 7\r\n\r\n{\"a\":"))).toEqual([]);
    expect(decoder.push(bytes("1}"))).toEqual([{ a: 1 }]);
  });

  it("decodes multiple Content-Length frames and measures Unicode in bytes", () => {
    const codec = contentLengthCodec();
    const first = codec.encode({ text: "☃" });
    const second = codec.encode({ ok: true });
    expect(text(first).startsWith("Content-Length: 14\r\n\r\n")).toBe(true);
    const decoder = codec.createDecoder();
    expect(decoder.push(new Uint8Array([...first, ...second]))).toEqual([{ text: "☃" }, { ok: true }]);
  });

  it("rejects malformed, oversized, invalid UTF-8, and incomplete frames safely", () => {
    const malformed = contentLengthCodec().createDecoder();
    expect(() => malformed.push(bytes("Content-Length: nope\r\n\r\n"))).toThrow(TransportError);
    expect(() => contentLengthCodec({ maxBodyBytes: 3 }).createDecoder()
      .push(bytes("Content-Length: 4\r\n\r\nnull"))).toThrow(/body exceeds/i);
    expect(() => contentLengthCodec({ maxHeaderBytes: 8 }).createDecoder()
      .push(bytes("Content-Length: 1"))).toThrow(/header exceeds/i);
    expect(() => jsonTextCodec().createDecoder().push(new Uint8Array([0xff]))).toThrow(/UTF-8/i);
    expect(() => jsonLinesCodec().createDecoder().push(bytes("{bad}\n"))).toThrow(/JSON/i);
    expect(() => jsonLinesCodec({ maxFrameBytes: 3 }).createDecoder().push(bytes("null\n")))
      .toThrow(/size limit/i);
    expect(() => jsonLinesCodec().createDecoder().push(bytes("{\"secret\":\"token-value\"}\n")))
      .not.toThrow();
    const incomplete = contentLengthCodec().createDecoder();
    incomplete.push(bytes("Content-Length: 4\r\n\r\nnu"));
    expect(() => incomplete.finish()).toThrow(/incomplete/i);
  });

  it("does not retain parser or serializer exceptions as public causes", () => {
    const inspectCause = (operation: () => unknown): unknown => {
      try { operation(); } catch (error) { return (error as { cause?: unknown }).cause; }
      throw new Error("Expected operation to fail");
    };
    expect(inspectCause(() => jsonTextCodec().createDecoder().push(bytes("{bad}"))))
      .toBeUndefined();
    expect(inspectCause(() => jsonTextCodec().encode({
      toJSON() { throw new Error("serializer-secret"); },
    }))).toBeUndefined();
  });

  it("composes a byte channel with a frame codec", async () => {
    const byteChannel = createFakeByteChannel();
    const channel = createFramedMessageChannel(byteChannel, jsonLinesCodec<{ value: number }>());
    const received: unknown[] = [];
    const unsubscribe = channel.subscribe((message) => received.push(message));
    await channel.send({ value: 1 });
    expect(text(byteChannel.chunks[0]!)).toBe('{"value":1}\n');
    byteChannel.receive(bytes('{"value":2}\n'));
    expect(received).toEqual([{ value: 2 }]);
    unsubscribe();
    await channel.close();
    expect(byteChannel.closed).toBe(true);
  });

  it("forwards remote byte-channel closure to message-channel subscribers", () => {
    const byteChannel = createFakeByteChannel();
    const channel = createFramedMessageChannel(byteChannel, jsonLinesCodec());
    const closed: unknown[] = [];
    channel.subscribeClose((error) => closed.push(error));
    const failure = new Error("remote closed");
    byteChannel.remoteClose(failure);
    byteChannel.remoteClose(new Error("duplicate"));
    expect(closed).toEqual([failure]);
    const late = vi.fn();
    channel.subscribeClose(late);
    expect(late).toHaveBeenCalledWith(failure);
  });
});

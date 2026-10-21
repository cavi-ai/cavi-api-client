import { TransportError } from "./error.js";
import type { TransportFrameCodec, TransportFrameDecoder } from "./channel.js";

const DEFAULT_MAX_FRAME_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_HEADER_BYTES = 8 * 1024;
const encoder = new TextEncoder();

export type JsonFrameCodecOptions = Readonly<{ maxFrameBytes?: number }>;
export type ContentLengthCodecOptions = Readonly<{ maxHeaderBytes?: number; maxBodyBytes?: number }>;

function decodeError(message: string): TransportError {
  return new TransportError(message, {
    metadata: { kind: "stdio", phase: "decode", operation: "frame.decode", retryable: false, attempt: 1 },
  });
}

function encodeError(message: string): TransportError {
  return new TransportError(message, {
    metadata: { kind: "stdio", phase: "request", operation: "frame.encode", retryable: false, attempt: 1 },
  });
}

function parseJson<T>(value: Uint8Array): T {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw decodeError("Frame contains invalid UTF-8");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw decodeError("Frame contains invalid JSON");
  }
}

function encodeJson(value: unknown): Uint8Array {
  try {
    const text = JSON.stringify(value);
    if (text === undefined) throw new TypeError("Value is not JSON serializable");
    return encoder.encode(text);
  } catch {
    throw encodeError("Value could not be encoded as JSON");
  }
}

function append(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.byteLength + right.byteLength);
  result.set(left);
  result.set(right, left.byteLength);
  return result;
}

/** Reuse storage and grow geometrically so fragmented input is copied linearly. */
class FrameBuffer {
  private storage: Uint8Array = new Uint8Array();
  length = 0;

  append(chunk: Uint8Array, limit: number, message: string): void {
    if (chunk.byteLength > limit - this.length) throw decodeError(message);
    const needed = this.length + chunk.byteLength;
    if (needed > this.storage.byteLength) {
      const capacity = Math.min(limit, Math.max(needed, 256, this.storage.byteLength * 2));
      const next = new Uint8Array(capacity);
      next.set(this.storage.subarray(0, this.length));
      this.storage = next;
    }
    this.storage.set(chunk, this.length);
    this.length = needed;
  }

  bytes(): Uint8Array { return this.storage.subarray(0, this.length); }
  clear(): void { this.length = 0; }
}

function validateLimit(value: number | undefined, fallback: number, name: string): number {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError(`${name} must be a positive safe integer`);
  return limit;
}

export function jsonTextCodec<T = unknown>(options: JsonFrameCodecOptions = {}): TransportFrameCodec<T> {
  const maxFrameBytes = validateLimit(options.maxFrameBytes, DEFAULT_MAX_FRAME_BYTES, "maxFrameBytes");
  return {
    encode(value) {
      const result = encodeJson(value);
      if (result.byteLength > maxFrameBytes) throw encodeError("Encoded frame exceeds the configured size limit");
      return result;
    },
    createDecoder() {
      return {
        push(chunk) {
          if (chunk.byteLength > maxFrameBytes) throw decodeError("Frame exceeds the configured size limit");
          return [parseJson<T>(chunk)];
        },
        finish: () => [],
      };
    },
  };
}

export function jsonLinesCodec<T = unknown>(options: JsonFrameCodecOptions = {}): TransportFrameCodec<T> {
  const maxFrameBytes = validateLimit(options.maxFrameBytes, DEFAULT_MAX_FRAME_BYTES, "maxFrameBytes");
  return {
    encode(value) {
      const body = encodeJson(value);
      if (body.byteLength > maxFrameBytes) throw encodeError("Encoded frame exceeds the configured size limit");
      return append(body, encoder.encode("\n"));
    },
    createDecoder() {
      const buffered = new FrameBuffer();
      const oversized = "JSON Lines frame exceeds the configured size limit";
      return {
        push(chunk) {
          const values: T[] = [];
          let start = 0;
          while (start < chunk.byteLength) {
            const newline = chunk.indexOf(0x0a, start);
            const end = newline < 0 ? chunk.byteLength : newline;
            buffered.append(chunk.subarray(start, end), maxFrameBytes + 1, oversized);
            let frame = buffered.bytes();
            if (frame[frame.byteLength - 1] === 0x0d) frame = frame.subarray(0, frame.byteLength - 1);
            if (frame.byteLength > maxFrameBytes) throw decodeError(oversized);
            if (newline < 0) break;
            if (frame.byteLength > 0) values.push(parseJson<T>(frame));
            buffered.clear();
            start = newline + 1;
          }
          return values;
        },
        finish() {
          if (buffered.length > 0) throw decodeError("JSON Lines stream ended with an incomplete frame");
          return [];
        },
      };
    },
  };
}

export function contentLengthCodec<T = unknown>(
  options: ContentLengthCodecOptions = {},
): TransportFrameCodec<T> {
  const maxHeaderBytes = validateLimit(options.maxHeaderBytes, DEFAULT_MAX_HEADER_BYTES, "maxHeaderBytes");
  const maxBodyBytes = validateLimit(options.maxBodyBytes, DEFAULT_MAX_FRAME_BYTES, "maxBodyBytes");
  return {
    encode(value) {
      const body = encodeJson(value);
      if (body.byteLength > maxBodyBytes) throw encodeError("Encoded body exceeds the configured size limit");
      return append(encoder.encode(`Content-Length: ${body.byteLength}\r\n\r\n`), body);
    },
    createDecoder(): TransportFrameDecoder<T> {
      const buffered = new FrameBuffer();
      let expectedBodyBytes: number | undefined;
      let boundary = 0;
      return {
        push(chunk) {
          const values: T[] = [];
          let offset = 0;
          while (offset < chunk.byteLength) {
            if (expectedBodyBytes === undefined) {
              const byte = chunk[offset]!;
              buffered.append(chunk.subarray(offset, offset + 1), maxHeaderBytes + 4,
                "Content-Length header exceeds the configured size limit");
              offset += 1;
              boundary = ((boundary << 8) | byte) >>> 0;
              if (boundary !== 0x0d0a0d0a) {
                if (buffered.length > maxHeaderBytes + 3) throw decodeError("Content-Length header exceeds the configured size limit");
                continue;
              }
              let header: string;
              try {
                header = new TextDecoder("ascii", { fatal: true }).decode(buffered.bytes().subarray(0, buffered.length - 4));
              } catch {
                throw decodeError("Content-Length header is invalid");
              }
              const lines = header.split("\r\n");
              const lengths = lines.filter((line) => /^content-length\s*:/iu.test(line));
              if (lengths.length !== 1) throw decodeError("Content-Length header is missing or duplicated");
              const match = /^content-length\s*:\s*(\d+)\s*$/iu.exec(lengths[0]!);
              if (!match) throw decodeError("Content-Length header has an invalid length");
              const length = Number(match[1]);
              if (!Number.isSafeInteger(length)) throw decodeError("Content-Length header has an invalid length");
              if (length > maxBodyBytes) throw decodeError("Content-Length body exceeds the configured size limit");
              expectedBodyBytes = length;
              buffered.clear();
              boundary = 0;
            }
            const size = Math.min(expectedBodyBytes - buffered.length, chunk.byteLength - offset);
            buffered.append(chunk.subarray(offset, offset + size), maxBodyBytes,
              "Content-Length body exceeds the configured size limit");
            offset += size;
            if (buffered.length === expectedBodyBytes) {
              values.push(parseJson<T>(buffered.bytes()));
              buffered.clear();
              expectedBodyBytes = undefined;
            }
          }
          return values;
        },
        finish() {
          if (expectedBodyBytes !== undefined || buffered.length > 0) {
            throw decodeError("Content-Length stream ended with an incomplete frame");
          }
          return [];
        },
      };
    },
  };
}

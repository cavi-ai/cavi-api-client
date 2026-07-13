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
      let buffered: Uint8Array = new Uint8Array();
      const take = (finished: boolean): readonly T[] => {
        const values: T[] = [];
        let start = 0;
        for (let index = 0; index < buffered.byteLength; index += 1) {
          if (buffered[index] !== 0x0a) continue;
          let end = index;
          if (end > start && buffered[end - 1] === 0x0d) end -= 1;
          if (end - start > maxFrameBytes) throw decodeError("JSON Lines frame exceeds the configured size limit");
          if (end > start) values.push(parseJson<T>(buffered.subarray(start, end)));
          start = index + 1;
        }
        if (start > 0) buffered = buffered.slice(start);
        if (buffered.byteLength > maxFrameBytes) throw decodeError("JSON Lines frame exceeds the configured size limit");
        if (finished && buffered.byteLength > 0) throw decodeError("JSON Lines stream ended with an incomplete frame");
        return values;
      };
      return {
        push(chunk) { buffered = append(buffered, chunk); return take(false); },
        finish() { return take(true); },
      };
    },
  };
}

function headerEnd(buffer: Uint8Array): number {
  for (let index = 0; index <= buffer.byteLength - 4; index += 1) {
    if (buffer[index] === 0x0d && buffer[index + 1] === 0x0a &&
      buffer[index + 2] === 0x0d && buffer[index + 3] === 0x0a) return index;
  }
  return -1;
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
      let buffered: Uint8Array = new Uint8Array();
      let expectedBodyBytes: number | undefined;
      const read = (): readonly T[] => {
        const values: T[] = [];
        while (true) {
          if (expectedBodyBytes === undefined) {
            const end = headerEnd(buffered);
            if (end < 0) {
              if (buffered.byteLength > maxHeaderBytes) throw decodeError("Content-Length header exceeds the configured size limit");
              break;
            }
            if (end > maxHeaderBytes) throw decodeError("Content-Length header exceeds the configured size limit");
            let header: string;
            try {
              header = new TextDecoder("ascii", { fatal: true }).decode(buffered.subarray(0, end));
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
            buffered = buffered.slice(end + 4);
          }
          if (buffered.byteLength < expectedBodyBytes) break;
          values.push(parseJson<T>(buffered.subarray(0, expectedBodyBytes)));
          buffered = buffered.slice(expectedBodyBytes);
          expectedBodyBytes = undefined;
        }
        return values;
      };
      return {
        push(chunk) { buffered = append(buffered, chunk); return read(); },
        finish() {
          const values = read();
          if (expectedBodyBytes !== undefined || buffered.byteLength > 0) {
            throw decodeError("Content-Length stream ended with an incomplete frame");
          }
          return values;
        },
      };
    },
  };
}

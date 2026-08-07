export type SseMessage = {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
};

export type SseMessageHandler = (message: SseMessage) => void;

export type SseStreamOptions = Readonly<{
  /** Maximum incomplete event buffer in UTF-8 bytes. Defaults to 16 MiB. */
  maxBufferBytes?: number;
}>;

const DEFAULT_MAX_SSE_BUFFER_BYTES = 16 * 1024 * 1024;
const MAX_DECODE_CHUNK_BYTES = 64 * 1024;

class SseBufferLimitError extends RangeError {
  readonly code = "sse-buffer-limit";
}

function resolveMaxBufferBytes(value: number | undefined): number {
  const limit = value ?? DEFAULT_MAX_SSE_BUFFER_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError("maxBufferBytes must be a positive safe integer");
  }
  return limit;
}

export function isSseContentType(contentType: string | null | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("text/event-stream");
}

export function parseSseBlock(block: string): SseMessage | null {
  const lines = block.split(/\r?\n/u);
  const dataLines: string[] = [];
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const rawValue = separator >= 0 ? line.slice(separator + 1) : "";
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "data") {
      dataLines.push(value);
    } else if (field === "event") {
      event = value;
    } else if (field === "id") {
      id = value;
    } else if (field === "retry") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) retry = parsed;
    }
  }

  if (dataLines.length === 0) return null;
  return {
    data: dataLines.join("\n"),
    ...(event !== undefined ? { event } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(retry !== undefined ? { retry } : {}),
  };
}

export function takeNextSseBlock(buffer: string): { block: string; rest: string } | null {
  const lfBoundary = buffer.indexOf("\n\n");
  const crlfBoundary = buffer.indexOf("\r\n\r\n");
  if (lfBoundary < 0 && crlfBoundary < 0) return null;
  if (crlfBoundary >= 0 && (lfBoundary < 0 || crlfBoundary < lfBoundary)) {
    return { block: buffer.slice(0, crlfBoundary), rest: buffer.slice(crlfBoundary + 4) };
  }
  return { block: buffer.slice(0, lfBoundary), rest: buffer.slice(lfBoundary + 2) };
}

export function drainSseMessages(
  buffer: string,
  onMessage: SseMessageHandler,
): string {
  let current = buffer;
  let next = takeNextSseBlock(current);
  while (next) {
    current = next.rest;
    const message = parseSseBlock(next.block);
    if (message) onMessage(message);
    next = takeNextSseBlock(current);
  }
  return current;
}

export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onMessage: SseMessageHandler,
  options: SseStreamOptions = {},
): Promise<void> {
  const maxBufferBytes = resolveMaxBufferBytes(options.maxBufferBytes);
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();
  const decodeChunkBytes = Math.min(maxBufferBytes, MAX_DECODE_CHUNK_BYTES);
  let buffer = "";
  let bufferedBytes = 0;
  const appendDecoded = (decoded: string): void => {
    if (decoded.length === 0) return;
    buffer += decoded;
    bufferedBytes += encoder.encode(decoded).byteLength;

    let next = takeNextSseBlock(buffer);
    while (next) {
      const blockBytes = encoder.encode(next.block).byteLength;
      if (blockBytes > maxBufferBytes) {
        throw new SseBufferLimitError("SSE buffer exceeds the configured size limit");
      }
      const separatorBytes = buffer.length - next.block.length - next.rest.length;
      bufferedBytes -= blockBytes + separatorBytes;
      buffer = next.rest;
      const message = parseSseBlock(next.block);
      if (message) onMessage(message);
      next = takeNextSseBlock(buffer);
    }

    if (bufferedBytes > maxBufferBytes) {
      throw new SseBufferLimitError("SSE buffer exceeds the configured size limit");
    }
  };
  const onAbort = (): void => {
    try {
      void reader.cancel();
    } catch {
      // best effort
    }
  };
  signal.addEventListener("abort", onAbort);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        appendDecoded(decoder.decode());
        break;
      }
      for (let offset = 0; offset < value.byteLength; offset += decodeChunkBytes) {
        appendDecoded(decoder.decode(
          value.subarray(offset, Math.min(value.byteLength, offset + decodeChunkBytes)),
          { stream: true },
        ));
      }
    }
    const trailing = parseSseBlock(buffer);
    if (trailing) onMessage(trailing);
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // Preserve the decode/handler failure that terminated the stream.
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

export function combineAbortSignals(a: AbortSignal, b: AbortSignal | undefined): AbortSignal {
  if (!b) return a;
  const controller = new AbortController();
  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }
  a.addEventListener("abort", () => controller.abort(), { once: true });
  b.addEventListener("abort", () => controller.abort(), { once: true });
  return controller.signal;
}

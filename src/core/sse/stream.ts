export type SseMessage = {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
};

export type SseMessageHandler = (message: SseMessage) => void;

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
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
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
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = drainSseMessages(buffer, onMessage);
    }
    buffer = drainSseMessages(buffer, onMessage);
    const trailing = parseSseBlock(buffer);
    if (trailing) onMessage(trailing);
  } finally {
    signal.removeEventListener("abort", onAbort);
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

import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamApprovalChoice,
  type RunStreamEvent,
  type RunStreamToolCall,
  type RunStreamToolEvent,
  type RunStreamToolStatus,
} from "./domain/runs.js";
import { HERMES_API_ENDPOINTS } from "./paths.js";
import type {
  RunEventStreamHandlers,
  RunEventStreamProvider,
  RunEventStreamSubscribeParams,
  RunEventStreamSubscription,
} from "./run-event-stream.js";

export type HermesSseRunEventProviderOptions = {
  httpBase: string;
  authToken: string;
  clientId: string;
  /** Required for `X-Hermes-Session-Key` on both the SSE request and the poll fallback. */
  sessionKey: string;
  /**
   * When true (default), falls back to polling `/v1/runs/{run_id}` on terminal SSE failure modes
   * (404/405/406/501, "stream disabled" 400, non-SSE content-type, missing readable body).
   */
  fallbackToPoll?: boolean;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 1_250;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

const APPROVAL_CHOICES: ReadonlySet<RunStreamApprovalChoice> = new Set([
  "once",
  "session",
  "always",
  "deny",
]);

/**
 * Subscribes to the Hermes `/v1/runs/{run_id}/events` SSE stream and emits
 * canonical {@link RunStreamEvent}s. Falls back to status polling
 * (`/v1/runs/{run_id}`) when SSE is unsupported by the server.
 *
 * The caller is responsible for starting the run (POST `/v1/runs`) and
 * supplying the resulting `run_id` to {@link subscribe}.
 *
 * Tool events are emitted when the underlying Hermes payload contains
 * tool-shaped fields (`tool_name`, `function_name`, etc.). When the Hermes API
 * does not natively emit tool events, compose this provider with
 * {@link RunPreviewPollProvider} via `createRunStreamWithToolFallback`.
 */
export class HermesSseRunEventProvider implements RunEventStreamProvider {
  private readonly options: Required<HermesSseRunEventProviderOptions>;

  constructor(options: HermesSseRunEventProviderOptions) {
    this.options = {
      httpBase: options.httpBase,
      authToken: options.authToken,
      clientId: options.clientId,
      sessionKey: options.sessionKey,
      fallbackToPoll: options.fallbackToPoll ?? true,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      pollTimeoutMs: options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
    };
  }

  async subscribe(
    params: RunEventStreamSubscribeParams,
    handlers: RunEventStreamHandlers,
  ): Promise<RunEventStreamSubscription> {
    const localController = new AbortController();
    const signal = combineSignals(localController.signal, params.signal);
    let disposed = false;

    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      localController.abort();
    };

    void (async () => {
      try {
        await this.streamEvents(params.runId, signal, handlers);
        if (!disposed) handlers.onComplete?.();
      } catch (error) {
        if (!disposed) handlers.onError?.(error);
      } finally {
        disposed = true;
      }
    })();

    return { dispose };
  }

  private async streamEvents(
    runId: string,
    signal: AbortSignal,
    handlers: RunEventStreamHandlers,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "X-Portal-Client-Id": this.options.clientId,
      "X-Hermes-Session-Key": this.options.sessionKey,
    };
    if (this.options.authToken.trim()) {
      headers.Authorization = `Bearer ${this.options.authToken.trim()}`;
    }

    const response = await fetch(
      `${this.options.httpBase}${HERMES_API_ENDPOINTS.runEvents(runId)}`,
      { method: "GET", headers, cache: "no-store", signal },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (this.options.fallbackToPoll && shouldFallbackToPoll(response.status, body)) {
        return this.pollUntilTerminal(runId, signal, handlers);
      }
      throw new Error(formatHttpError("run events failed", response.status, body));
    }

    const contentType = response.headers?.get?.("Content-Type") ?? "";
    if (
      this.options.fallbackToPoll &&
      contentType &&
      !contentType.toLowerCase().includes("text/event-stream")
    ) {
      return this.pollUntilTerminal(runId, signal, handlers);
    }

    if (!response.body || typeof response.body.getReader !== "function") {
      if (this.options.fallbackToPoll) {
        return this.pollUntilTerminal(runId, signal, handlers);
      }
      throw new Error("run events response missing readable body");
    }

    await this.consumeSseStream(runId, response.body, signal, handlers);
  }

  private async consumeSseStream(
    runId: string,
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    handlers: RunEventStreamHandlers,
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
        buffer = drainBlocks(buffer, runId, handlers);
      }
      buffer = drainBlocks(buffer, runId, handlers);
      const trailing = parseSseBlock(buffer);
      if (trailing) {
        const raw = parseRawEvent(trailing);
        if (raw) emitFromRaw(raw, runId, handlers);
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  private async pollUntilTerminal(
    runId: string,
    signal: AbortSignal,
    handlers: RunEventStreamHandlers,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Portal-Client-Id": this.options.clientId,
      "X-Hermes-Session-Key": this.options.sessionKey,
    };
    if (this.options.authToken.trim()) {
      headers.Authorization = `Bearer ${this.options.authToken.trim()}`;
    }
    const startedAt = Date.now();
    while (true) {
      if (signal.aborted) throw new Error("run polling aborted");
      const response = await fetch(
        `${this.options.httpBase}${HERMES_API_ENDPOINTS.run(runId)}`,
        { method: "GET", headers, cache: "no-store", signal },
      );
      const text = await response.text();
      if (!response.ok) {
        throw new Error(formatHttpError("run status polling failed", response.status, text));
      }
      let payload: { run_id?: string; status?: string; output?: string; error?: string; timestamp?: string };
      try {
        payload = text.trim() ? (JSON.parse(text) as typeof payload) : {};
      } catch {
        throw new Error(`run status polling returned invalid JSON: ${text.slice(0, 240)}`);
      }
      const status = typeof payload.status === "string" ? payload.status : "";
      const resolvedRunId = typeof payload.run_id === "string" && payload.run_id.trim()
        ? payload.run_id
        : runId;
      const at = parseTimestamp(payload.timestamp);
      if (status === "completed") {
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          runId: resolvedRunId,
          output: typeof payload.output === "string" ? payload.output : undefined,
          at,
        });
        return;
      }
      if (status === "failed") {
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
          runId: resolvedRunId,
          error: typeof payload.error === "string" ? payload.error : "run failed",
          at,
        });
        return;
      }
      if (status === "cancelled") {
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
          runId: resolvedRunId,
          reason: typeof payload.error === "string" ? payload.error : undefined,
          at,
        });
        return;
      }
      if (Date.now() - startedAt > this.options.pollTimeoutMs) {
        throw new Error(`run polling timed out after ${this.options.pollTimeoutMs}ms`);
      }
      await wait(this.options.pollIntervalMs, signal);
    }
  }
}

// ---------------------------------------------------------------------------
// Translation: raw Hermes event → canonical RunStreamEvent
// ---------------------------------------------------------------------------

type RawHermesEvent = {
  event?: string;
  run_id?: string;
  delta?: string;
  output?: string;
  error?: string;
  timestamp?: string;
  choices?: unknown;
  [key: string]: unknown;
};

function emitFromRaw(
  raw: RawHermesEvent,
  defaultRunId: string,
  handlers: RunEventStreamHandlers,
): void {
  const eventName = typeof raw.event === "string" ? raw.event : "";
  const runId = typeof raw.run_id === "string" && raw.run_id.trim()
    ? raw.run_id
    : defaultRunId;
  const at = parseTimestamp(raw.timestamp);

  if (eventName === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA) {
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      runId,
      delta: typeof raw.delta === "string" ? raw.delta : "",
      at,
    });
    return;
  }
  if (eventName === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED) {
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId,
      output: typeof raw.output === "string" ? raw.output : undefined,
      at,
    });
    return;
  }
  if (eventName === RUN_STREAM_EVENT_NAMES.RUN_FAILED) {
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
      runId,
      error: typeof raw.error === "string" ? raw.error : "run failed",
      at,
    });
    return;
  }
  if (eventName === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED) {
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
      runId,
      reason: typeof raw.error === "string" ? raw.error : undefined,
      at,
    });
    return;
  }
  if (eventName === RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST) {
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST,
      runId,
      choices: normalizeApprovalChoices(raw.choices),
      at,
    });
    return;
  }

  const toolEvent = parseToolEvent(raw, runId, at);
  if (toolEvent) handlers.onEvent(toolEvent);
}

function parseToolEvent(
  raw: RawHermesEvent,
  runId: string,
  at: number | undefined,
): RunStreamToolEvent | null {
  const eventName = typeof raw.event === "string" ? raw.event : "";
  const lowerEvent = eventName.toLowerCase();
  const explicitName = readString(raw, "tool_name", "toolName", "function_name", "functionName");
  const toolFieldName = readString(raw, "tool");
  const genericName = lowerEvent.includes("tool") ? readString(raw, "name") : null;
  const explicit = explicitName ?? toolFieldName ?? genericName;
  if (!lowerEvent.includes("tool") && !explicitName && !toolFieldName) return null;

  const status = normalizeToolStatus(
    readString(raw, "status", "state", "phase"),
    lowerEvent,
  );
  const eventVariant: RunStreamToolEvent["event"] =
    status === "failed"
      ? RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED
      : status === "completed"
        ? RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED
        : RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED;

  const fallbackName = `tool ${eventName
    .replace(/^run[.:_-]|^tool[.:_-]/i, "")
    .replace(/[.:_-]+/g, " ")
    .trim() || "call"}`;

  const toolCall: RunStreamToolCall = {
    id: `${runId}:${explicit ?? fallbackName}:${at ?? Date.now()}`,
    name: explicit ?? fallbackName,
    status,
    event: eventName || undefined,
    input: stringifyPayload(raw.input ?? raw.args ?? raw.arguments ?? raw.params ?? raw.request),
    output: stringifyPayload(raw.output ?? raw.result ?? raw.response),
    error: readString(raw, "error", "errorMessage", "message") ?? undefined,
    durationMs: readNumber(raw, "duration_ms", "durationMs", "elapsed_ms", "elapsedMs"),
    at,
  };

  return { event: eventVariant, runId, toolCall, at };
}

function normalizeToolStatus(value: string | null, eventName: string): RunStreamToolStatus {
  const lower = (value || eventName).toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) return "failed";
  if (lower.includes("complete") || lower.includes("success") || lower.includes("done")) {
    return "completed";
  }
  if (lower.includes("start") || lower.includes("run") || lower.includes("delta")) return "running";
  return "pending";
}

function normalizeApprovalChoices(value: unknown): RunStreamApprovalChoice[] {
  if (!Array.isArray(value)) return ["once", "session", "always", "deny"];
  const out: RunStreamApprovalChoice[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (APPROVAL_CHOICES.has(item as RunStreamApprovalChoice)) {
      out.push(item as RunStreamApprovalChoice);
    }
  }
  return out.length > 0 ? out : ["once", "session", "always", "deny"];
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function stringifyPayload(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 900) : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const json = JSON.stringify(value, null, 2);
    return json.length > 900 ? `${json.slice(0, 900)}…` : json;
  } catch {
    return undefined;
  }
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseSseBlock(block: string): string | null {
  const lines = block.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

function takeNextSseBlock(buffer: string): { block: string; rest: string } | null {
  const lfBoundary = buffer.indexOf("\n\n");
  const crlfBoundary = buffer.indexOf("\r\n\r\n");
  if (lfBoundary < 0 && crlfBoundary < 0) return null;
  if (crlfBoundary >= 0 && (lfBoundary < 0 || crlfBoundary < lfBoundary)) {
    return { block: buffer.slice(0, crlfBoundary), rest: buffer.slice(crlfBoundary + 4) };
  }
  return { block: buffer.slice(0, lfBoundary), rest: buffer.slice(lfBoundary + 2) };
}

function drainBlocks(
  buffer: string,
  runId: string,
  handlers: RunEventStreamHandlers,
): string {
  let cur = buffer;
  let next = takeNextSseBlock(cur);
  while (next) {
    cur = next.rest;
    const data = parseSseBlock(next.block);
    if (data) {
      const raw = parseRawEvent(data);
      if (raw) emitFromRaw(raw, runId, handlers);
    }
    next = takeNextSseBlock(cur);
  }
  return cur;
}

function parseRawEvent(data: string): RawHermesEvent | null {
  try {
    return JSON.parse(data) as RawHermesEvent;
  } catch {
    return null;
  }
}

function shouldFallbackToPoll(status: number, body: string): boolean {
  if (status === 404 || status === 405 || status === 406 || status === 501) return true;
  const lower = body.toLowerCase();
  return status === 400 && lower.includes("stream") && lower.includes("enabled");
}

function formatHttpError(prefix: string, status: number, body: string): string {
  const trimmed = body.trim();
  return `${prefix} with HTTP ${status}${trimmed ? `: ${trimmed.slice(0, 240)}` : ""}`;
}

function combineSignals(a: AbortSignal, b: AbortSignal | undefined): AbortSignal {
  if (!b) return a;
  const ac = new AbortController();
  if (a.aborted || b.aborted) {
    ac.abort();
    return ac.signal;
  }
  a.addEventListener("abort", () => ac.abort(), { once: true });
  b.addEventListener("abort", () => ac.abort(), { once: true });
  return ac.signal;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

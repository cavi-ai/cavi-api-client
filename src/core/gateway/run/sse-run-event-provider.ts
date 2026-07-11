import { GATEWAY_API_ENDPOINTS } from "../../../contracts/paths.js";
import {
  combineAbortSignals,
  consumeSseStream,
  isSseContentType,
  type SseMessage,
} from "../../sse/index.js";
import { PORTAL_CLIENT_ID_HEADER } from "../../http/types.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamApprovalChoice,
  type RunStreamToolCall,
  type RunStreamToolEvent,
  type RunStreamToolStatus,
} from "./contracts.js";
import type {
  RunEventStreamHandlers,
  RunEventStreamProvider,
  RunEventStreamSubscribeParams,
  RunEventStreamSubscription,
} from "./event-stream.js";
import { normalizeRuntimeUsage, type RuntimeUsage } from "../../runtime/usage.js";

export type GatewaySseRunEventEndpointMap = {
  run: (runId: string) => string;
  runEvents: (runId: string) => string;
};

export type GatewaySseRunEventPhase = "events" | "poll";

export type GatewaySseRunEventHeaderResolver = (params: {
  runId: string;
  phase: GatewaySseRunEventPhase;
}) => Record<string, string | null | undefined>;

export type GatewaySseRunEventProviderOptions = {
  httpBase: string;
  authToken: string | null;
  clientId: string;
  endpoints?: GatewaySseRunEventEndpointMap;
  /**
   * Static provider headers. Provider adapters use this for gateway-specific
   * routing/session headers while the base class owns SSE parsing and polling.
   */
  headers?: Record<string, string | null | undefined>;
  /** Dynamic provider headers, resolved separately for the SSE request and poll fallback. */
  resolveHeaders?: GatewaySseRunEventHeaderResolver;
  /**
   * When true (default), falls back to polling the configured run status endpoint on terminal SSE failure modes
   * (404/405/406/501, "stream disabled" 400, non-SSE content-type, missing readable body).
   */
  fallbackToPoll?: boolean;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_POLL_INTERVAL_MS = 1_250;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

const APPROVAL_CHOICES: ReadonlySet<RunStreamApprovalChoice> = new Set([
  "once",
  "session",
  "always",
  "deny",
]);

function normalizeHttpBase(httpBase: string): string {
  const normalized = httpBase.trim().replace(/\/+$/u, "");
  if (!normalized) {
    throw new Error("GatewaySseRunEventProvider requires httpBase");
  }
  return normalized;
}

function normalizeClientId(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("GatewaySseRunEventProvider requires clientId");
  }
  return normalized;
}

/**
 * Provider-neutral run-event SSE reader. Generic stream mechanics live in
 * core/sse; this class owns gateway request headers, canonical run-event
 * translation, and status polling fallback. Provider adapters should only
 * supply endpoint maps and any gateway-specific session/routing headers.
 */
export class GatewaySseRunEventProvider implements RunEventStreamProvider {
  private readonly httpBase: string;
  private readonly authToken: string;
  private readonly clientId: string;
  private readonly endpoints: GatewaySseRunEventEndpointMap;
  private readonly headers: Record<string, string | null | undefined>;
  private readonly resolveHeaders?: GatewaySseRunEventHeaderResolver;
  private readonly fallbackToPoll: boolean;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GatewaySseRunEventProviderOptions) {
    this.httpBase = normalizeHttpBase(options.httpBase);
    this.authToken = options.authToken?.trim() ?? "";
    this.clientId = normalizeClientId(options.clientId);
    this.endpoints = options.endpoints ?? GATEWAY_API_ENDPOINTS;
    this.headers = options.headers ?? {};
    this.resolveHeaders = options.resolveHeaders;
    this.fallbackToPoll = options.fallbackToPoll ?? true;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async subscribe(
    params: RunEventStreamSubscribeParams,
    handlers: RunEventStreamHandlers,
  ): Promise<RunEventStreamSubscription> {
    const localController = new AbortController();
    const signal = combineAbortSignals(localController.signal, params.signal);
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

  private buildHeaders(
    runId: string,
    phase: GatewaySseRunEventPhase,
    accept: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      [PORTAL_CLIENT_ID_HEADER]: this.clientId,
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    mergeHeaders(headers, this.headers);
    if (this.resolveHeaders) {
      mergeHeaders(headers, this.resolveHeaders({ runId, phase }));
    }
    return headers;
  }

  private async streamEvents(
    runId: string,
    signal: AbortSignal,
    handlers: RunEventStreamHandlers,
  ): Promise<void> {
    const response = await this.fetchImpl(
      `${this.httpBase}${this.endpoints.runEvents(runId)}`,
      {
        method: "GET",
        headers: this.buildHeaders(runId, "events", "text/event-stream"),
        cache: "no-store",
        signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (this.fallbackToPoll && shouldFallbackToPoll(response.status, body)) {
        return this.pollUntilTerminal(runId, signal, handlers);
      }
      throw new Error(formatHttpError("run events failed", response.status, body));
    }

    const contentType = response.headers?.get?.("Content-Type") ?? "";
    if (
      this.fallbackToPoll &&
      contentType &&
      !isSseContentType(contentType)
    ) {
      return this.pollUntilTerminal(runId, signal, handlers);
    }

    if (!response.body || typeof response.body.getReader !== "function") {
      if (this.fallbackToPoll) {
        return this.pollUntilTerminal(runId, signal, handlers);
      }
      throw new Error("run events response missing readable body");
    }

    await consumeSseStream(response.body, signal, (message) => {
      emitFromSseMessage(message, runId, handlers);
    });
  }

  private async pollUntilTerminal(
    runId: string,
    signal: AbortSignal,
    handlers: RunEventStreamHandlers,
  ): Promise<void> {
    const startedAt = Date.now();
    while (true) {
      if (signal.aborted) throw new Error("run polling aborted");
      const response = await this.fetchImpl(
        `${this.httpBase}${this.endpoints.run(runId)}`,
        {
          method: "GET",
          headers: this.buildHeaders(runId, "poll", "application/json"),
          cache: "no-store",
          signal,
        },
      );
      const text = await response.text();
      if (!response.ok) {
        throw new Error(formatHttpError("run status polling failed", response.status, text));
      }
      let payload: {
        run_id?: string;
        status?: string;
        output?: string;
        error?: string;
        timestamp?: string;
        usage?: Record<string, number>;
      };
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
        const tokens = payload.usage ? normalizeRuntimeUsage(payload.usage, "gateway") : undefined;
        handlers.onEvent({
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          runId: resolvedRunId,
          output: typeof payload.output === "string" ? payload.output : undefined,
          ...(tokens ? { usage: tokens } : {}),
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
      if (Date.now() - startedAt > this.pollTimeoutMs) {
        throw new Error(`run polling timed out after ${this.pollTimeoutMs}ms`);
      }
      await wait(this.pollIntervalMs, signal);
    }
  }
}

type RawGatewaySseEvent = {
  event?: string;
  run_id?: string;
  delta?: string;
  output?: string;
  error?: string;
  timestamp?: string;
  choices?: unknown;
  usage?: Record<string, number>;
  [key: string]: unknown;
};

function emitFromRaw(
  raw: RawGatewaySseEvent,
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
    const tokens = readGatewaySseUsage(raw);
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId,
      output: typeof raw.output === "string" ? raw.output : undefined,
      ...(tokens ? { usage: tokens } : {}),
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

function emitFromSseMessage(
  message: SseMessage,
  runId: string,
  handlers: RunEventStreamHandlers,
): void {
  const raw = parseRawEvent(message.data);
  if (raw) emitFromRaw(raw, runId, handlers);
}

function parseToolEvent(
  raw: RawGatewaySseEvent,
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

function mergeHeaders(
  target: Record<string, string>,
  source: Record<string, string | null | undefined>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue;
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    target[trimmedKey] = value;
  }
}

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
    return json.length > 900 ? `${json.slice(0, 900)}...` : json;
  } catch {
    return undefined;
  }
}

function readGatewaySseUsage(raw: RawGatewaySseEvent): RuntimeUsage | undefined {
  const usage = raw.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  return normalizeRuntimeUsage(usage as Record<string, number>, "gateway");
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseRawEvent(data: string): RawGatewaySseEvent | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as RawGatewaySseEvent;
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

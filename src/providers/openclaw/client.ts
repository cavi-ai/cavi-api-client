import {
  GatewayApiClient,
  type GatewayRunStartBody,
} from "../../core/gateway/client/client.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { getErrorMessage } from "../../core/errors.js";
import { resolveHttpWebSocketTargets } from "../../core/ws/index.js";
import {
  OPENCLAW_DEFAULT_CAPABILITIES,
  OPENCLAW_RPC_METHODS,
  type OpenClawCapabilities,
  type OpenClawRunStatus,
} from "./manifest.derive.js";
import {
  OpenClawWebSocketClient,
  type OpenClawWebSocketClientOptions,
} from "./websocket.js";

export {
  OPENCLAW_DEFAULT_CAPABILITIES,
  type OpenClawCapabilities,
  type OpenClawRunStatus,
} from "./manifest.derive.js";

export type OpenClawRpcTransport = {
  request<TPayload>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<TPayload>;
};

export type OpenClawApiClientOptions = HttpApiClientOptions & {
  wsUrl?: string;
  rpcClient?: OpenClawRpcTransport | null;
  rpcClientOptions?: OpenClawWebSocketClientOptions;
};

let generatedRunCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function readBoolean(
  value: Record<string, unknown> | null | undefined,
  ...keys: string[]
): boolean | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === "boolean") return raw;
  }
  return undefined;
}

function readNonNegativeInteger(
  value: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      return Math.floor(raw);
    }
  }
  return undefined;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function normalizeRunInput(input: GatewayRunStartBody["input"]): string {
  if (typeof input === "string") {
    return input;
  }
  return input
    .map((message) => {
      const role = message.role?.trim();
      const prefix = role ? `${role}: ` : "";
      return `${prefix}${
        typeof message.content === "string"
          ? message.content
          : safeStringify(message.content)
      }`;
    })
    .join("\n");
}

function nextRunIdempotencyKey(): string {
  generatedRunCounter += 1;
  return `cavi-run-${Date.now()}-${generatedRunCounter}`;
}

function resolveRunIdempotencyKey(body: GatewayRunStartBody): string {
  const metadata = isRecord(body.metadata) ? body.metadata : null;
  const source = isRecord(body.source) ? body.source : null;
  return (
    readString(metadata, "idempotencyKey", "idempotency_key", "messageId", "mobileMessageId") ??
    readString(source, "idempotencyKey", "idempotency_key", "messageId") ??
    nextRunIdempotencyKey()
  );
}

function buildChatSendParams(body: GatewayRunStartBody): Record<string, unknown> {
  const metadata = isRecord(body.metadata) ? body.metadata : null;
  const source = isRecord(body.source) ? body.source : null;
  const sessionKey =
    body.sessionKey?.trim() ||
    body.session_key?.trim() ||
    body.session_id?.trim() ||
    "main";
  const params: Record<string, unknown> = {
    sessionKey,
    message: normalizeRunInput(body.input),
    idempotencyKey: resolveRunIdempotencyKey(body),
  };
  const sessionId = body.session_id?.trim();
  if (sessionId) params.sessionId = sessionId;
  const thinking = readString(metadata, "thinking", "thinkingLevel", "reasoning");
  if (thinking) params.thinking = thinking;
  const fastMode = readBoolean(metadata, "fastMode", "fast_mode");
  if (fastMode !== undefined) params.fastMode = fastMode;
  const deliver = readBoolean(metadata, "deliver");
  if (deliver !== undefined) params.deliver = deliver;
  const timeoutMs = readNonNegativeInteger(metadata, "timeoutMs", "timeout_ms");
  if (timeoutMs !== undefined) params.timeoutMs = timeoutMs;
  const originatingChannel = readString(source, "originatingChannel");
  if (originatingChannel) params.originatingChannel = originatingChannel;
  const originatingTo = readString(source, "originatingTo");
  if (originatingTo) params.originatingTo = originatingTo;
  const originatingAccountId = readString(source, "originatingAccountId");
  if (originatingAccountId) params.originatingAccountId = originatingAccountId;
  const originatingThreadId = readString(source, "originatingThreadId");
  if (originatingThreadId) params.originatingThreadId = originatingThreadId;
  if (body.attachments && body.attachments.length > 0) {
    params.attachments = body.attachments;
  }
  return params;
}

function normalizeNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeEventRecords(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const events = value.filter(isRecord);
  return events.length > 0 ? events : undefined;
}

function normalizeOpenClawRunStatus(
  payload: unknown,
  fallback: {
    runId: string;
    status: string;
    sessionId?: string;
  },
): OpenClawRunStatus {
  const record = isRecord(payload) ? payload : {};
  const runId = readString(record, "run_id", "runId", "id") ?? fallback.runId;
  const status = readString(record, "status", "state", "phase") ?? fallback.status;
  const result: OpenClawRunStatus = {
    object: readString(record, "object") ?? "openclaw.run",
    run_id: runId,
    status,
  };
  const sessionId =
    readString(record, "session_id", "sessionId", "sessionKey", "key") ??
    fallback.sessionId;
  if (sessionId) result.session_id = sessionId;
  const output = readString(record, "output", "text");
  if (output) result.output = output;
  const response = readString(record, "response", "message");
  if (response) result.response = response;
  const error = readString(record, "error", "errorMessage");
  if (error) result.error = error;
  const usage = normalizeNumberRecord(record.usage);
  if (usage) {
    result.usage = usage;
    const tokens = normalizeRuntimeUsage(usage, "openclaw");
    if (tokens) result.tokens = tokens;
  }
  const events = normalizeEventRecords(record.events);
  if (events) result.events = events;
  const toolCallCount = readNonNegativeInteger(record, "tool_call_count", "toolCallCount");
  if (toolCallCount !== undefined) result.tool_call_count = toolCallCount;
  return result;
}

export class OpenClawApiClient extends GatewayApiClient {
  private readonly wsUrl?: string;
  private readonly rpcClientOverride: OpenClawRpcTransport | null;
  private readonly rpcClientOptions?: OpenClawWebSocketClientOptions;
  private rpcClient: OpenClawRpcTransport | null = null;

  constructor(options: OpenClawApiClientOptions) {
    super(options, "openclaw-api");
    this.wsUrl = options.wsUrl;
    this.rpcClientOverride = options.rpcClient ?? null;
    this.rpcClientOptions = options.rpcClientOptions;
  }

  override getCapabilities(): Promise<OpenClawCapabilities> {
    return Promise.resolve({
      ...OPENCLAW_DEFAULT_CAPABILITIES,
      features: { ...OPENCLAW_DEFAULT_CAPABILITIES.features },
      endpoints: { ...OPENCLAW_DEFAULT_CAPABILITIES.endpoints },
      runtime: { ...OPENCLAW_DEFAULT_CAPABILITIES.runtime },
      rpcMethods: [...(OPENCLAW_DEFAULT_CAPABILITIES.rpcMethods ?? [])],
    });
  }

  override async startRun(body: GatewayRunStartBody): Promise<OpenClawRunStatus> {
    const params = buildChatSendParams(body);
    const payload = await this.getRpcClient().request<unknown>(
      OPENCLAW_RPC_METHODS.chatSend,
      params,
    );
    return normalizeOpenClawRunStatus(payload, {
      runId: readString(params, "idempotencyKey") ?? nextRunIdempotencyKey(),
      status: "started",
      sessionId: readString(params, "sessionId", "sessionKey"),
    });
  }

  override async getRun(runId: string): Promise<OpenClawRunStatus> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      throw new Error("OpenClawApiClient.getRun: missing runId");
    }
    const payload = await this.getRpcClient().request<unknown>(
      OPENCLAW_RPC_METHODS.agentWait,
      {
        runId: normalizedRunId,
        timeoutMs: 0,
      },
    );
    return normalizeOpenClawRunStatus(payload, {
      runId: normalizedRunId,
      status: "unknown",
    });
  }

  override async stopRun(runId: string): Promise<{ status: string }> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      throw new Error("OpenClawApiClient.stopRun: missing runId");
    }
    const payload = await this.getRpcClient().request<unknown>(
      OPENCLAW_RPC_METHODS.sessionsAbort,
      { runId: normalizedRunId },
    );
    const record = isRecord(payload) ? payload : {};
    return {
      status:
        readString(record, "status") ??
        (record.aborted === true ? "aborted" : "unknown"),
    };
  }

  override async resolveRunApproval<T = unknown>(): Promise<T> {
    throw new Error(
      "OpenClawApiClient.resolveRunApproval: OpenClaw does not expose the Hermes REST run approval endpoint; use plugin-specific approval RPC methods when available.",
    );
  }

  private getRpcClient(): OpenClawRpcTransport {
    if (this.rpcClientOverride) {
      return this.rpcClientOverride;
    }
    if (this.rpcClient) {
      return this.rpcClient;
    }
    let wsUrl = this.wsUrl;
    if (!wsUrl) {
      try {
        wsUrl = resolveHttpWebSocketTargets(this.baseUrl).wsUrl;
      } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(
          `OpenClawApiClient requires an absolute baseUrl or explicit wsUrl for WebSocket RPC: ${message}`,
        );
      }
    }
    this.rpcClient = new OpenClawWebSocketClient(wsUrl, this.authToken || null, {
      ...this.rpcClientOptions,
      clientId: this.rpcClientOptions?.clientId ?? this.clientId,
    });
    return this.rpcClient;
  }
}

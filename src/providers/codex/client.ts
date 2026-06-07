import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import { bearerCredentials } from "../../core/http/credentials.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import {
  CODEX_API_BASE_URL,
  CODEX_API_ENDPOINTS,
  CODEX_DEFAULT_MODEL,
  codexResponseCancelPath,
  codexResponsePath,
} from "./paths.js";
import {
  mapOpenAIResponseStreamEvent,
  readOpenAIResponseRunId,
} from "./stream.js";

export { CODEX_API_BASE_URL, CODEX_API_ENDPOINTS, CODEX_DEFAULT_MODEL } from "./paths.js";

export type CodexApiClientOptions = {
  /** OpenAI API key. Keep this backend-owned; do not expose it to browsers/mobile clients. */
  apiKey: string;
  /** Default model when a run does not specify one. */
  defaultModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
  defaultTimeoutMs?: number;
};

type OpenAIResponse = {
  id: string;
  status?: string;
  model?: string;
  output_text?: string;
  error?: unknown;
  incomplete_details?: unknown;
  usage?: Record<string, number>;
};

function mapResponseStatus(status: string | undefined): RuntimeRunStatus["status"] {
  switch (status) {
    case "queued":
      return "started";
    case "in_progress":
      return "running";
    case "completed":
      return "completed";
    case "failed":
    case "incomplete":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return status || "running";
  }
}

function errorMessageOf(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.reason === "string" && record.reason) return record.reason;
  }
  return undefined;
}

function usageOf(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number") out[key] = raw;
  }
  return Object.keys(out).length ? out : undefined;
}

export class CodexApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel: string;

  constructor(options: CodexApiClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new ApiClientError("codex-responses: an api key is required", {
        code: ApiClientErrorCode.ValidationFailed,
      });
    }
    super("codex-responses", {
      baseUrl: options.baseUrl?.trim() || CODEX_API_BASE_URL,
      includePortalClientIdHeader: false,
      auth: { resolveHeaders: bearerCredentials(apiKey) },
      defaultTimeoutMs: options.defaultTimeoutMs,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.defaultModel = options.defaultModel?.trim() || CODEX_DEFAULT_MODEL;
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "codex-responses",
      protocolVersion: "responses-v1",
      auth: { type: "bearer", required: true },
      supports: { runs: true, streaming: true },
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const response = await this.request<OpenAIResponse>(CODEX_API_ENDPOINTS.responses, {
      method: "POST",
      body: this.buildResponseBody(body, { stream: false }),
    });
    return this.toRuntimeRunStatus(response);
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    const response = await this.request<OpenAIResponse>(codexResponsePath(runId), {
      method: "GET",
    });
    return this.toRuntimeRunStatus(response);
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    const response = await this.request<OpenAIResponse>(codexResponseCancelPath(runId), {
      method: "POST",
    });
    return { status: mapResponseStatus(response.status) };
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const controller = new AbortController();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const response = await this.requestRaw(CODEX_API_ENDPOINTS.responses, {
        method: "POST",
        body: this.buildResponseBody(body, { stream: true }),
        signal: controller.signal,
      });
      if (!response.body) {
        throw new ApiClientError("codex-responses: streaming response had no body", {
          code: ApiClientErrorCode.RequestFailed,
        });
      }

      let runId = "";
      await consumeSseStream(response.body, controller.signal, (sse) => {
        const startId = readOpenAIResponseRunId(sse);
        if (startId) runId = startId;
        const event = mapOpenAIResponseStreamEvent(sse, runId);
        if (!event) return;
        handlers.onEvent(event);
        if (
          event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED ||
          event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED ||
          event.event === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED
        ) {
          controller.abort();
        }
      });
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(error);
      else throw error;
    }
  }

  private buildResponseBody(
    body: RuntimeRunStartBody,
    options: { stream: boolean },
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: body.model ?? this.defaultModel,
      input: body.input,
      background: true,
      store: true,
    };
    if (options.stream) payload.stream = true;
    if (body.instructions) payload.instructions = body.instructions;
    if (body.tools?.length) payload.tools = body.tools;
    if (body.metadata) payload.metadata = body.metadata;
    return payload;
  }

  private toRuntimeRunStatus(response: OpenAIResponse): RuntimeRunStatus {
    const status = mapResponseStatus(response.status);
    const usage = usageOf(response.usage);
    return {
      run_id: response.id,
      status,
      ...(response.model ? { model: response.model } : {}),
      ...(response.output_text ? { output: response.output_text } : {}),
      ...(status === "failed"
        ? { error: errorMessageOf(response.error ?? response.incomplete_details) ?? "codex response failed" }
        : {}),
      ...(usage ? { usage } : {}),
    };
  }
}

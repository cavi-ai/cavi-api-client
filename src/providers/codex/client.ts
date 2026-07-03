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
  buildCodexResponseBody,
  mapOpenAIResponseToRunStatus,
  mapResponseStatus,
  type OpenAIResponse,
} from "./response.js";
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
      body: buildCodexResponseBody(body, this.defaultModel, { background: true, store: true }),
    });
    return mapOpenAIResponseToRunStatus(response);
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    const response = await this.request<OpenAIResponse>(codexResponsePath(runId), { method: "GET" });
    return mapOpenAIResponseToRunStatus(response);
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    const response = await this.request<OpenAIResponse>(codexResponseCancelPath(runId), { method: "POST" });
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
        body: buildCodexResponseBody(body, this.defaultModel, { background: true, store: true, stream: true }),
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

}

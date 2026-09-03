import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import { bearerCredentials } from "../../core/http/credentials.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import { CODEX_RUNTIME_SUPPORT } from "./capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../core/runtime/dry-run.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import {
  CODEX_API_BASE_URL,
  CODEX_API_ENDPOINTS,
  CODEX_DEFAULT_MODEL,
  codexBatchCancelPath,
  codexBatchPath,
  codexResponseCancelPath,
  codexResponsePath,
} from "./paths.js";
import {
  buildCodexResponseBody,
  mapOpenAIResponseToRunStatus,
  mapResponseStatus,
  type OpenAIResponse,
} from "./response.js";
import type {
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
} from "../../core/runtime/batch.js";
import { CodexFilesClient } from "./files.js";
import { buildBatchInputJsonl, mapOpenAIBatch, parseOpenAIBatchOutput } from "./batch.js";
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
  cache?: RequestCache;
  credentials?: RequestCredentials;
};


export class CodexApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel: string;
  private readonly files: CodexFilesClient;

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
      cache: options.cache,
      credentials: options.credentials,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.defaultModel = options.defaultModel?.trim() || CODEX_DEFAULT_MODEL;
    this.files = new CodexFilesClient(options);
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "codex-responses",
      protocolVersion: "responses-v1",
      auth: { type: "bearer", required: true },
      supports: CODEX_RUNTIME_SUPPORT,
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const payload = buildCodexResponseBody(body, this.defaultModel, { background: true, store: true });
    if (body.dryRun) {
      return buildDryRunStatus(payload.model as string);
    }
    const response = await this.request<OpenAIResponse>(CODEX_API_ENDPOINTS.responses, {
      method: "POST",
      body: payload,
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

  async submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus> {
    const jsonl = buildBatchInputJsonl(requests, (body) =>
      buildCodexResponseBody(body, this.defaultModel, {}),
    );
    const inputFile = await this.files.uploadFile(jsonl, "batch");
    const raw = await this.request<Record<string, unknown>>(CODEX_API_ENDPOINTS.batches, {
      method: "POST",
      body: {
        input_file_id: inputFile.id,
        endpoint: CODEX_API_ENDPOINTS.responses,
        completion_window: "24h",
      },
    });
    return mapOpenAIBatch(raw);
  }

  async getBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(codexBatchPath(batchId));
    return mapOpenAIBatch(raw);
  }

  async cancelBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(codexBatchCancelPath(batchId), { method: "POST" });
    return mapOpenAIBatch(raw);
  }

  async getBatchResults(batchId: string): Promise<RuntimeBatchResult[]> {
    const raw = await this.request<Record<string, unknown>>(codexBatchPath(batchId));
    const outputFileId = typeof raw.output_file_id === "string" ? raw.output_file_id : undefined;
    const errorFileId = typeof raw.error_file_id === "string" ? raw.error_file_id : undefined;
    if (!outputFileId && !errorFileId) {
      throw new ApiClientError(
        `codex-responses: batch ${batchId} results are not available yet — poll getBatch until resultsAvailable is true`,
        { code: ApiClientErrorCode.EndpointNotFound },
      );
    }
    const results: RuntimeBatchResult[] = [];
    if (outputFileId) {
      results.push(
        ...parseOpenAIBatchOutput(
          await this.files.downloadFileContent(outputFileId),
          mapOpenAIResponseToRunStatus,
          { malformedLine: "throw" },
        ),
      );
    }
    if (errorFileId) {
      results.push(
        ...parseOpenAIBatchOutput(
          await this.files.downloadFileContent(errorFileId),
          mapOpenAIResponseToRunStatus,
          { malformedLine: "throw" },
        ),
      );
    }
    return results;
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const payload = buildCodexResponseBody(body, this.defaultModel, {
      background: true,
      store: true,
      stream: true,
    });
    if (body.dryRun) {
      handlers.onEvent(buildDryRunStreamEvent(payload.model as string));
      handlers.onComplete?.();
      return;
    }

    const controller = new AbortController();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const response = await this.requestRaw(CODEX_API_ENDPOINTS.responses, {
        method: "POST",
        body: payload,
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

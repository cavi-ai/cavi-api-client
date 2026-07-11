import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../core/runtime/dry-run.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type {
  RuntimeBatchRequest,
  RuntimeBatchResult,
  RuntimeBatchStatus,
} from "../../core/runtime/batch.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import {
  GEMINI_API_BASE_URL,
  geminiBatchCancelPath,
  geminiBatchGenerateContentPath,
  geminiBatchPath,
  geminiGenerateContentPath,
  geminiStreamGenerateContentPath,
} from "./paths.js";
import { mapGeminiStreamChunk, readGeminiFinishReason, readGeminiStreamUsage } from "./stream.js";
import { buildGeminiRequestBody } from "./request.js";
import { mapGeminiGenerateContentToRunStatus, type GeminiGenerateContentResponse } from "./response.js";
import { GeminiFilesClient } from "./files.js";
import {
  buildGeminiBatchInlineEntries,
  buildGeminiBatchInputJsonl,
  estimateGeminiBatchInlineBytes,
  GEMINI_BATCH_INLINE_MAX_BYTES,
  mapGeminiBatch,
  normalizeGeminiBatchName,
  parseGeminiBatchOutputJsonl,
  parseGeminiInlineBatchResults,
  readGeminiBatchResponsesFile,
} from "./batch.js";

export { buildGeminiRequestBody } from "./request.js";

export type GeminiApiClientOptions = {
  /** Gemini Developer API (AI Studio) key. Keep backend-owned; do not embed in browsers/mobile. */
  apiKey: string;
  /** Default model when a run does not specify one. No id ships by default. */
  defaultModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
};

function newGeminiRunId(): string {
  return `gemini-${globalThis.crypto.randomUUID()}`;
}

export class GeminiApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel?: string;
  private readonly files: GeminiFilesClient;

  constructor(options: GeminiApiClientOptions) {
    super("gemini", {
      baseUrl: options.baseUrl?.trim() || GEMINI_API_BASE_URL,
      includePortalClientIdHeader: false,
      auth: { resolveHeaders: apiKeyCredentials(options.apiKey, { header: "x-goog-api-key" }) },
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.defaultModel = options.defaultModel;
    this.files = new GeminiFilesClient(options);
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "gemini",
      auth: { type: "api-key", required: true },
      supports: { runs: true, streaming: true, batch: true },
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const { model, payload } = buildGeminiRequestBody(body, this.defaultModel);
    if (body.dryRun) {
      return buildDryRunStatus(model);
    }
    const response = await this.request<GeminiGenerateContentResponse>(geminiGenerateContentPath(model), {
      method: "POST",
      body: payload,
    });
    return mapGeminiGenerateContentToRunStatus(model, response);
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const { model, payload } = buildGeminiRequestBody(body, this.defaultModel);
    if (body.dryRun) {
      handlers.onEvent(buildDryRunStreamEvent(model));
      handlers.onComplete?.();
      return;
    }
    const runId = newGeminiRunId();

    const controller = new AbortController();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const emitCompleted = (usage: Record<string, number> | undefined): void => {
      const tokens = usage ? normalizeRuntimeUsage(usage, "gemini") : undefined;
      handlers.onEvent(
        tokens
          ? { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId, usage: tokens }
          : { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId },
      );
    };

    try {
      const response = await this.requestRaw(geminiStreamGenerateContentPath(model), {
        method: "POST",
        body: payload,
        signal: controller.signal,
      });
      if (!response.body) {
        throw new ApiClientError("gemini: streaming response had no body", {
          code: ApiClientErrorCode.RequestFailed,
        });
      }

      let latestUsage: Record<string, number> | undefined;
      let completed = false;
      await consumeSseStream(response.body, controller.signal, (sse) => {
        if (completed) return;
        const usage = readGeminiStreamUsage(sse);
        if (usage) latestUsage = usage;
        const delta = mapGeminiStreamChunk(sse, runId);
        if (delta) handlers.onEvent(delta);
        if (readGeminiFinishReason(sse)) {
          completed = true;
          emitCompleted(latestUsage);
        }
      });
      if (!completed) emitCompleted(latestUsage);
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(error);
      else throw error;
    }
  }

  async getRun(_runId: string): Promise<RuntimeRunStatus> {
    throw this.stateless("getRun");
  }

  async cancelRun(_runId: string): Promise<{ status: string }> {
    throw this.stateless("cancelRun");
  }

  async submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus> {
    const { model, entries } = buildGeminiBatchInlineEntries(requests, this.defaultModel);
    let body: Record<string, unknown>;
    if (estimateGeminiBatchInlineBytes(entries) <= GEMINI_BATCH_INLINE_MAX_BYTES) {
      body = {
        batch: {
          input_config: {
            requests: {
              requests: entries.map((entry) => ({
                request: entry.request,
                metadata: entry.metadata,
              })),
            },
          },
        },
      };
    } else {
      const { jsonl } = buildGeminiBatchInputJsonl(requests, this.defaultModel);
      const inputFile = await this.files.uploadFile(jsonl, { mimeType: "application/jsonl" });
      body = {
        batch: {
          input_config: {
            file_name: inputFile.name,
          },
        },
      };
    }
    const raw = await this.request<Record<string, unknown>>(geminiBatchGenerateContentPath(model), {
      method: "POST",
      body,
    });
    return mapGeminiBatch(raw);
  }

  async getBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(geminiBatchPath(batchId));
    return mapGeminiBatch(raw);
  }

  async cancelBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(geminiBatchCancelPath(batchId), {
      method: "POST",
    });
    return mapGeminiBatch(raw);
  }

  async getBatchResults(batchId: string): Promise<RuntimeBatchResult[]> {
    const raw = await this.request<Record<string, unknown>>(geminiBatchPath(batchId));
    const status = mapGeminiBatch(raw);
    if (!status.resultsAvailable) {
      throw new ApiClientError(
        `gemini: batch ${normalizeGeminiBatchName(batchId)} results are not available yet — poll getBatch until resultsAvailable is true`,
        { code: ApiClientErrorCode.EndpointNotFound },
      );
    }

    const model = this.readBatchModel(raw) ?? this.defaultModel ?? "gemini";
    const mapResponse = (response: Parameters<typeof mapGeminiGenerateContentToRunStatus>[1]) =>
      mapGeminiGenerateContentToRunStatus(model, response);

    const responsesFile = readGeminiBatchResponsesFile(raw);
    if (responsesFile) {
      return parseGeminiBatchOutputJsonl(await this.files.downloadFile(responsesFile), model, mapResponse, {
        malformedLine: "throw",
      });
    }

    const inline = parseGeminiInlineBatchResults(raw, model, mapResponse);
    if (inline.length) return inline;

    throw new ApiClientError(
      `gemini: batch ${normalizeGeminiBatchName(batchId)} has no inline or file results`,
      { code: ApiClientErrorCode.EndpointNotFound },
    );
  }

  private readBatchModel(raw: Record<string, unknown>): string | undefined {
    const metadata = raw.metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const model = (metadata as { model?: unknown }).model;
      if (typeof model === "string" && model.length > 0) return model;
    }
    if (typeof raw.model === "string" && raw.model.length > 0) return raw.model;
    return undefined;
  }

  private stateless(method: string): ApiClientError {
    return new ApiClientError(
      `gemini: ${method} is unsupported — generateContent is synchronous request/response`,
      { code: ApiClientErrorCode.EndpointNotFound },
    );
  }
}

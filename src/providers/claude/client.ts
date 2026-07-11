import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import { HttpApiError } from "../../core/http/errors.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import { CLAUDE_RUNTIME_SUPPORT } from "./capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../core/runtime/dry-run.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type {
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
} from "../../core/runtime/batch.js";
import {
  CLAUDE_API_BASE_URL,
  CLAUDE_API_ENDPOINTS,
  CLAUDE_DEFAULT_ANTHROPIC_VERSION,
  claudeMessageBatchPath,
  claudeMessageBatchCancelPath,
  claudeMessageBatchResultsPath,
} from "./paths.js";
import { mapMessageBatch, parseMessageBatchResults } from "./batch.js";
import { consumeSseStream } from "../../core/sse/index.js";
import { RUN_STREAM_EVENT_NAMES, type RunEventStreamHandlers } from "../../core/runtime/run-stream.js";
import { mapAnthropicStreamEvent, readAnthropicRunId, readAnthropicStreamUsage } from "./stream.js";
import {
  buildAnthropicMessageParams,
  mapAnthropicMessageToRunStatus,
  type AnthropicMessage,
} from "./message.js";

const DEFAULT_MAX_TOKENS = 4096;

export type ClaudeApiClientOptions = {
  apiKey: string;
  /** Default model when a run does not specify one. */
  defaultModel?: string;
  /** Default max_tokens when a run does not specify one (Anthropic requires it). */
  defaultMaxTokens?: number;
  anthropicVersion?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
};

export class ClaudeApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel?: string;
  private readonly defaultMaxTokens: number;

  constructor(options: ClaudeApiClientOptions) {
    const version = options.anthropicVersion?.trim() || CLAUDE_DEFAULT_ANTHROPIC_VERSION;
    super("claude-sdk", {
      baseUrl: options.baseUrl?.trim() || CLAUDE_API_BASE_URL,
      defaultHeaders: { "anthropic-version": version },
      includePortalClientIdHeader: false,
      auth: { resolveHeaders: apiKeyCredentials(options.apiKey, { header: "x-api-key" }) },
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.defaultModel = options.defaultModel;
    this.defaultMaxTokens = options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "claude-sdk",
      protocolVersion: this.defaultHeaders["anthropic-version"] ?? null,
      auth: { type: "api-key", required: true },
      supports: CLAUDE_RUNTIME_SUPPORT,
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const params = buildAnthropicMessageParams(body, {
      defaultModel: this.defaultModel,
      defaultMaxTokens: this.defaultMaxTokens,
    });
    if (body.dryRun) {
      return buildDryRunStatus(params.model as string);
    }
    const message = await this.request<AnthropicMessage>(CLAUDE_API_ENDPOINTS.messages, {
      method: "POST",
      body: params,
    });
    return mapAnthropicMessageToRunStatus(message);
  }

  /**
   * Start a run and stream it as canonical RunStreamEvents. Anthropic starts
   * and streams in one POST (stream:true), so there is no prior runId — it is
   * captured from the message_start event. (Finding F4: this is why Claude uses
   * streamRun rather than RunEventStreamProvider.subscribe(runId).)
   */
  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      ...buildAnthropicMessageParams(body, {
        defaultModel: this.defaultModel,
        defaultMaxTokens: this.defaultMaxTokens,
      }),
      stream: true,
    };
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
      const response = await this.requestRaw(CLAUDE_API_ENDPOINTS.messages, {
        method: "POST",
        body: payload,
        signal: controller.signal,
      });
      if (!response.body) {
        throw new ApiClientError("claude-sdk: streaming response had no body", {
          code: ApiClientErrorCode.RequestFailed,
        });
      }

      let runId = "";
      let usageAcc: Record<string, number> = {};
      await consumeSseStream(response.body, controller.signal, (sse) => {
        const startId = readAnthropicRunId(sse);
        if (startId) runId = startId;
        const usageDelta = readAnthropicStreamUsage(sse);
        if (usageDelta) usageAcc = { ...usageAcc, ...usageDelta };
        const event = mapAnthropicStreamEvent(sse, runId);
        if (!event) return;
        if (event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED) {
          const tokens = normalizeRuntimeUsage(usageAcc, "claude-sdk");
          handlers.onEvent(tokens ? { ...event, usage: tokens } : event);
          return;
        }
        handlers.onEvent(event);
      });
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(error);
      else throw error;
    }
  }

  // F1: Anthropic /v1/messages is synchronous; there is no run retrieval/cancel.
  async getRun(_runId: string): Promise<RuntimeRunStatus> {
    throw this.stateless("getRun");
  }

  async cancelRun(_runId: string): Promise<{ status: string }> {
    throw this.stateless("cancelRun");
  }

  async submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus> {
    const body = {
      requests: requests.map((request) => ({
        custom_id: request.customId,
        params: buildAnthropicMessageParams(request.body, {
          defaultModel: this.defaultModel,
          defaultMaxTokens: this.defaultMaxTokens,
        }),
      })),
    };
    const raw = await this.request<Record<string, unknown>>(CLAUDE_API_ENDPOINTS.messageBatches, {
      method: "POST",
      body,
    });
    return mapMessageBatch(raw);
  }

  async getBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(claudeMessageBatchPath(batchId));
    return mapMessageBatch(raw);
  }

  async cancelBatch(batchId: string): Promise<RuntimeBatchStatus> {
    const raw = await this.request<Record<string, unknown>>(claudeMessageBatchCancelPath(batchId), {
      method: "POST",
    });
    return mapMessageBatch(raw);
  }

  async getBatchResults(batchId: string): Promise<RuntimeBatchResult[]> {
    let response: Response;
    try {
      response = await this.requestRaw(claudeMessageBatchResultsPath(batchId), { method: "GET" });
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 404) {
        throw new ApiClientError(
          `claude-sdk: batch ${batchId} results are not available yet — poll getBatch until resultsAvailable is true`,
          { code: ApiClientErrorCode.EndpointNotFound },
        );
      }
      throw error;
    }
    const text = await response.text();
    return parseMessageBatchResults(text, mapAnthropicMessageToRunStatus);
  }

  private stateless(method: string): ApiClientError {
    return new ApiClientError(
      `claude-sdk: ${method} is unsupported — runs are synchronous request/response`,
      { code: ApiClientErrorCode.EndpointNotFound },
    );
  }

}

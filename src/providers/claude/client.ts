import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import {
  CLAUDE_API_BASE_URL,
  CLAUDE_API_ENDPOINTS,
  CLAUDE_DEFAULT_ANTHROPIC_VERSION,
} from "./paths.js";
import { consumeSseStream } from "../../core/sse/index.js";
import type { RunEventStreamHandlers } from "../../core/gateway/run/event-stream.js";
import { mapAnthropicStreamEvent, readAnthropicRunId } from "./stream.js";

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

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicMessage = {
  id: string;
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: Record<string, number>;
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
      supports: { runs: true, streaming: true },
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const model = body.model ?? this.defaultModel;
    if (!model) {
      throw new ApiClientError(
        "claude-sdk: a model is required (pass body.model or defaultModel)",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
    const messages = Array.isArray(body.input)
      ? body.input
      : [{ role: "user", content: body.input }];
    const maxTokens =
      typeof body.metadata?.max_tokens === "number"
        ? (body.metadata.max_tokens as number)
        : this.defaultMaxTokens;

    const payload: Record<string, unknown> = { model, max_tokens: maxTokens, messages };
    if (body.instructions) payload.system = body.instructions;
    if (body.tools?.length) payload.tools = body.tools;

    const message = await this.request<AnthropicMessage>(CLAUDE_API_ENDPOINTS.messages, {
      method: "POST",
      body: payload,
    });
    return this.toRuntimeRunStatus(message);
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
    const model = body.model ?? this.defaultModel;
    if (!model) {
      throw new ApiClientError(
        "claude-sdk: a model is required (pass body.model or defaultModel)",
        { code: ApiClientErrorCode.ValidationFailed },
      );
    }
    const messages = Array.isArray(body.input)
      ? body.input
      : [{ role: "user", content: body.input }];
    const maxTokens =
      typeof body.metadata?.max_tokens === "number"
        ? (body.metadata.max_tokens as number)
        : this.defaultMaxTokens;

    const payload: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
      stream: true,
    };
    if (body.instructions) payload.system = body.instructions;
    if (body.tools?.length) payload.tools = body.tools;

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
      await consumeSseStream(response.body, controller.signal, (sse) => {
        const startId = readAnthropicRunId(sse);
        if (startId) runId = startId;
        const event = mapAnthropicStreamEvent(sse, runId);
        if (event) handlers.onEvent(event);
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

  private stateless(method: string): ApiClientError {
    return new ApiClientError(
      `claude-sdk: ${method} is unsupported — runs are synchronous request/response`,
      { code: ApiClientErrorCode.EndpointNotFound },
    );
  }

  private toRuntimeRunStatus(message: AnthropicMessage): RuntimeRunStatus {
    const output = (message.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");
    return {
      run_id: message.id,
      status: message.stop_reason ? "completed" : "running",
      ...(message.model ? { model: message.model } : {}),
      ...(output ? { output } : {}),
      ...(message.usage ? { usage: message.usage } : {}),
    };
  }
}

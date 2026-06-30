import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import { GEMINI_API_BASE_URL, geminiGenerateContentPath, geminiStreamGenerateContentPath } from "./paths.js";
import { flattenGeminiUsageMetadata } from "./usage.js";
import { mapGeminiStreamChunk, readGeminiFinishReason, readGeminiStreamUsage } from "./stream.js";

export type GeminiApiClientOptions = {
  /** Gemini Developer API (AI Studio) key. Keep backend-owned; do not embed in browsers/mobile. */
  apiKey: string;
  /** Default model when a run does not specify one. No id ships by default. */
  defaultModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
};

type GeminiPart = { text?: string };
type GeminiCandidate = {
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string;
};
type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: Record<string, unknown>;
  modelVersion?: string;
};

function toParts(content: unknown): unknown[] {
  if (typeof content === "string") return [{ text: content }];
  if (Array.isArray(content)) return content;
  return [];
}

function textOfParts(parts: unknown[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      out.push((part as { text: string }).text);
    }
  }
  return out;
}

/**
 * Build the Gemini request body from the universal run-start body. Full role
 * fidelity: `system`-role array messages and `instructions` both feed
 * `systemInstruction`; `assistant`->`model`, everything else->`user`. Throws
 * ValidationFailed if no model is resolvable.
 */
export function buildGeminiRequestBody(
  body: RuntimeRunStartBody,
  defaultModel?: string,
): { model: string; payload: Record<string, unknown> } {
  const model = body.model ?? defaultModel;
  if (!model) {
    throw new ApiClientError("gemini: a model is required (pass body.model or defaultModel)", {
      code: ApiClientErrorCode.ValidationFailed,
    });
  }

  const systemParts: { text: string }[] = [];
  if (body.instructions) systemParts.push({ text: body.instructions });

  const contents: { role: string; parts: unknown[] }[] = [];
  if (typeof body.input === "string") {
    contents.push({ role: "user", parts: [{ text: body.input }] });
  } else {
    for (const message of body.input) {
      const parts = toParts(message.content);
      if (message.role === "system") {
        for (const text of textOfParts(parts)) systemParts.push({ text });
        continue;
      }
      const role = message.role === "assistant" || message.role === "model" ? "model" : "user";
      contents.push({ role, parts });
    }
  }

  const payload: Record<string, unknown> = { contents };
  if (systemParts.length) payload.systemInstruction = { parts: systemParts };
  if (body.tools?.length) payload.tools = body.tools;
  const generationConfig = (body.metadata as Record<string, unknown> | undefined)?.generationConfig;
  if (generationConfig && typeof generationConfig === "object") payload.generationConfig = generationConfig;

  return { model, payload };
}

function newGeminiRunId(): string {
  return `gemini-${globalThis.crypto.randomUUID()}`;
}

export class GeminiApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel?: string;

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
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "gemini",
      auth: { type: "api-key", required: true },
      supports: { runs: true, streaming: true },
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const { model, payload } = buildGeminiRequestBody(body, this.defaultModel);
    const response = await this.request<GeminiGenerateContentResponse>(geminiGenerateContentPath(model), {
      method: "POST",
      body: payload,
    });
    return this.toRuntimeRunStatus(model, response);
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const { model, payload } = buildGeminiRequestBody(body, this.defaultModel);
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

  private stateless(method: string): ApiClientError {
    return new ApiClientError(
      `gemini: ${method} is unsupported — generateContent is synchronous request/response`,
      { code: ApiClientErrorCode.EndpointNotFound },
    );
  }

  private toRuntimeRunStatus(
    model: string,
    response: GeminiGenerateContentResponse,
  ): RuntimeRunStatus {
    const candidate = response.candidates?.[0];
    const output = (candidate?.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");
    const blockReason = response.promptFeedback?.blockReason;
    const finishReason = candidate?.finishReason;
    const failed =
      Boolean(blockReason) ||
      !candidate ||
      (finishReason != null && finishReason !== "STOP" && finishReason !== "MAX_TOKENS");
    const usage = flattenGeminiUsageMetadata(response.usageMetadata);
    const tokens = normalizeRuntimeUsage(usage, "gemini");

    const status: RuntimeRunStatus = {
      run_id: newGeminiRunId(),
      status: failed ? "failed" : "completed",
      model: response.modelVersion ?? model,
    };
    if (output) status.output = output;
    if (failed) status.error = blockReason ?? finishReason ?? "gemini generation failed";
    if (usage) status.usage = usage;
    if (tokens) status.tokens = tokens;
    return status;
  }
}

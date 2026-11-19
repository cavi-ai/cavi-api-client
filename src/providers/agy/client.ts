import { combineAbortSignalsWithCleanup } from "../../core/sse/abort-signals.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import { apiKeyCredentials } from "../../core/http/credentials.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import { AGY_RUNTIME_SUPPORT } from "./capabilities.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../core/runtime/dry-run.js";
import { SynchronousRunStore, unknownSynchronousRun } from "../../core/runtime/synchronous-run-store.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import {
  markNonTerminalStreamError,
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import { ApiClientError, ApiClientErrorCode, toError } from "../../core/errors.js";
import { buildAgyRequestBody } from "./request.js";
import { mapAgyResponseToRunStatus, type AgyGenerateResponse } from "./response.js";
import { agyRunPath, agyStreamPath } from "./paths.js";

export type AgyApiClientOptions = {
  /** Antigravity Orchestration API key. */
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
  defaultTimeoutMs?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
};

function newAgyRunId(): string {
  return `agy-${globalThis.crypto.randomUUID()}`;
}

export class AgyApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  private readonly defaultModel?: string;
  private readonly runStore = new SynchronousRunStore();

  constructor(options: AgyApiClientOptions) {
    if (!options.baseUrl || !options.baseUrl.trim()) {
      throw new ApiClientError("agy: baseUrl is required", { code: ApiClientErrorCode.InvalidConfig });
    }
    super("agy", {
      baseUrl: options.baseUrl.trim(),
      includePortalClientIdHeader: false,
      ...(options.apiKey ? { auth: { resolveHeaders: apiKeyCredentials(options.apiKey, { header: "x-agy-api-key" }) } } : {}),
      defaultTimeoutMs: options.defaultTimeoutMs,
      cache: options.cache,
      credentials: options.credentials,
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    const trimmedDefaultModel = options.defaultModel?.trim();
    this.defaultModel = trimmedDefaultModel || undefined;
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "agy",
      auth: { type: "api-key", required: true },
      supports: AGY_RUNTIME_SUPPORT,
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const { agentId, payload } = buildAgyRequestBody(body, this.defaultModel, false);
    if (body.dryRun) {
      return buildDryRunStatus(agentId);
    }
    
    const response = await this.request<AgyGenerateResponse>(agyRunPath(), { method: "POST", body: payload });
    
    const runId = newAgyRunId();
    const status = mapAgyResponseToRunStatus(agentId, response, runId);
    this.runStore.remember(status);
    return status;
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const { agentId, payload } = buildAgyRequestBody(body, this.defaultModel, true);
    if (body.dryRun) {
      handlers.onEvent(buildDryRunStreamEvent(agentId));
      handlers.onComplete?.();
      return;
    }
    
    const controller = new AbortController();
    const { signal, dispose } = combineAbortSignalsWithCleanup(controller.signal, options.signal);

    const runId = newAgyRunId();
    
    try {
      const response = await this.requestRaw(agyStreamPath(), {
        method: "POST",
        body: payload,
        signal,
      });
      
      if (!response.body) {
        throw new ApiClientError("agy: streaming response had no body", {
          code: ApiClientErrorCode.RequestFailed,
        });
      }

      let completed = false;
      await consumeSseStream(response.body, signal, (sse) => {
        if (completed) return;
        let rawParsed: unknown;
        try {
          rawParsed = JSON.parse(sse.data);
        } catch (error) {
          const normalizedError = toError(error);
          handlers.onError?.(markNonTerminalStreamError(normalizedError));
          return;
        }
        if (!rawParsed || typeof rawParsed !== "object" || Array.isArray(rawParsed)) {
          handlers.onError?.(
            markNonTerminalStreamError(
              new ApiClientError("agy: SSE frame payload must be a JSON object", {
                code: ApiClientErrorCode.TransportProtocolError,
              }),
            ),
          );
          return;
        }
        const parsed = rawParsed as AgyGenerateResponse;
        const status = mapAgyResponseToRunStatus(agentId, parsed, runId);
        const isCancelled =
          status.status === "cancelled" ||
          parsed.status === "canceled" ||
          parsed.status === "cancelled";
        const isTerminal =
          status.status === "completed" ||
          status.status === "failed" ||
          isCancelled;
        if (!isTerminal && typeof parsed.result?.output === "string" && parsed.result.output.length > 0) {
          handlers.onEvent({
            event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
            runId: status.run_id,
            delta: parsed.result.output,
          });
        }
        if (isTerminal) {
          completed = true;
          this.runStore.remember(status);
          if (status.status === "failed") {
            handlers.onEvent({
              event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
              runId: status.run_id,
              error: status.error ?? "agy: upstream run failed",
              ...(status.errorDetails ? { errorDetails: status.errorDetails } : {}),
            });
          } else if (isCancelled) {
            handlers.onEvent({
              event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
              runId: status.run_id,
              ...(status.error !== undefined ? { reason: status.error } : {}),
            });
          } else {
            handlers.onEvent({
              event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
              runId: status.run_id,
              ...(status.output !== undefined ? { output: status.output } : {}),
            });
          }
          controller.abort();
        }
      });
      if (options.signal?.aborted) return;
      if (!completed) {
        throw new ApiClientError("agy: stream ended before a terminal event", {
          code: ApiClientErrorCode.TransportProtocolError,
        });
      }
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(toError(error));
      else throw error;
    } finally {
      dispose();
    }
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    return this.runStore.get(runId) ?? unknownSynchronousRun("agy", runId);
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    return { status: this.runStore.get(runId)?.status ?? "unknown" };
  }
}

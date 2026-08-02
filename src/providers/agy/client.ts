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
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../../core/runtime/run-stream.js";
import { consumeSseStream } from "../../core/sse/index.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
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
      fetchImpl: options.fetchImpl,
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.defaultModel = options.defaultModel;
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
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const runId = newAgyRunId();
    
    try {
      const response = await this.requestRaw(agyStreamPath(), {
        method: "POST",
        body: payload,
        signal: controller.signal,
      });
      
      if (!response.body) {
        throw new ApiClientError("agy: streaming response had no body", {
          code: ApiClientErrorCode.RequestFailed,
        });
      }

      let completed = false;
      await consumeSseStream(response.body, controller.signal, (sse) => {
        if (completed) return;
        try {
          const parsed = JSON.parse(sse.data) as AgyGenerateResponse;
          if (parsed.result?.output) {
            handlers.onEvent({
              event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
              runId: parsed.run_id || runId,
              delta: parsed.result.output,
            });
          }
          if (parsed.status === "completed" || parsed.status === "failed") {
            completed = true;
            const status = mapAgyResponseToRunStatus(agentId, parsed, runId);
            this.runStore.remember(status);
            handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: status.run_id });
          }
        } catch (e) {
          // ignore malformed chunks
        }
      });
      if (!completed) handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId });
      handlers.onComplete?.();
    } catch (error) {
      if (handlers.onError) handlers.onError(error instanceof Error ? error : new Error(String(error)));
      else throw error;
    }
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    return this.runStore.get(runId) ?? unknownSynchronousRun("agy", runId);
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    return { status: this.runStore.get(runId)?.status ?? "completed" };
  }
}

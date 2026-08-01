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
import { buildAgyRequestBody } from "./request.js";
import { mapAgyResponseToRunStatus, type AgyGenerateResponse } from "./response.js";
import { AGY_API_BASE_URL, agyRunPath, agyStreamPath } from "./paths.js";

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
    super("agy", {
      baseUrl: options.baseUrl?.trim() || AGY_API_BASE_URL,
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
      auth: { type: "api-key", required: false },
      supports: AGY_RUNTIME_SUPPORT,
    };
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const { agentId, payload } = buildAgyRequestBody(body, this.defaultModel, false);
    if (body.dryRun) {
      return buildDryRunStatus(agentId);
    }
    
    // In a fully wired implementation, this would POST to agyRunPath()
    // const response = await this.request<AgyGenerateResponse>(agyRunPath(), { method: "POST", body: payload });
    
    const runId = newAgyRunId();
    // Simulate a response for now
    const response: AgyGenerateResponse = {
      run_id: runId,
      status: "completed",
      result: { output: "Antigravity orchestration executed successfully." }
    };
    
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
    
    // In a fully wired implementation, this would consume an SSE stream from agyStreamPath()
    
    const runId = newAgyRunId();
    handlers.onEvent({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      runId,
      delta: "Antigravity orchestration streaming...",
    });
    handlers.onEvent({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId });
    handlers.onComplete?.();
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    return this.runStore.get(runId) ?? unknownSynchronousRun("agy", runId);
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    return { status: this.runStore.get(runId)?.status ?? "completed" };
  }
}

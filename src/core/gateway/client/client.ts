import { GATEWAY_API_ENDPOINTS } from "../../../contracts/paths.js";
import { BaseHttpApiClient } from "../../http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../http/types.js";
import type { GatewayCommandCapabilities } from "../agent/commands.js";
import {
  normalizeGatewayFeatureCapabilities,
  type NormalizeGatewayFeatureCapabilitiesOptions,
  type NormalizedGatewayFeatureCapabilities,
} from "./capabilities.js";
import type { RuntimeClient } from "../../runtime/client.js";
import type {
  RuntimeRunStartBody,
  RuntimeRunStatus,
  RuntimeRunMessage,
} from "../../runtime/run.js";
import type { RuntimeCapabilities } from "../../runtime/capabilities.js";

export type GatewayCapabilities = GatewayCommandCapabilities & {
  object?: string;
  platform?: string;
  model?: string;
  auth?: { type?: string; required?: boolean };
  features: Record<string, unknown>;
  endpoints?: Record<string, { method: string; path: string }>;
  runtime?: Record<string, unknown>;
};

export type GatewayRunStatus = RuntimeRunStatus & {
  object?: string;
  session_id?: string;
  targetProfile?: string;
  task_id?: string;
  routing?: {
    kind?: string;
    targetProfile?: string | null;
    taskId?: string | null;
    workerEventStream?: boolean;
    decision?: Record<string, unknown>;
  };
  events?: Record<string, unknown>[];
  tool_call_count?: number;
};

export type GatewayRunMessage = RuntimeRunMessage;

export type GatewayRunAttachment = {
  name: string;
  mimeType?: string;
  mime_type?: string;
  size?: number;
  dataBase64?: string;
  data_base64?: string;
  [key: string]: unknown;
};

export type GatewayRunStartBody = RuntimeRunStartBody & {
  session_id?: string;
  sessionKey?: string;
  session_key?: string;
  previous_response_id?: string;
  conversation_history?: GatewayRunMessage[];
  targetProfile?: string;
  target_profile?: string;
  targetAgent?: string;
  target_agent?: string;
  agentId?: string;
  agent_id?: string;
  action?: string;
  source?: Record<string, unknown>;
  attachments?: GatewayRunAttachment[];
  dry_run?: boolean;
};

export class GatewayApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly endpoints = GATEWAY_API_ENDPOINTS;
  readonly request: HttpApiTransport;

  constructor(options: HttpApiClientOptions, surface = "gateway-api") {
    super(surface, options);
    this.request = this.createTransport();
  }

  getCapabilities(): Promise<GatewayCapabilities> {
    return this.request<GatewayCapabilities>(this.endpoints.capabilities);
  }

  async getFeatureCapabilities(
    options: Omit<NormalizeGatewayFeatureCapabilitiesOptions, "capabilities"> = {},
  ): Promise<NormalizedGatewayFeatureCapabilities> {
    return normalizeGatewayFeatureCapabilities({
      ...options,
      capabilities: await this.getCapabilities(),
    });
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    const raw = await this.getCapabilities();
    const supports: RuntimeCapabilities["supports"] = {
      runs: true,
      streaming: true,
      teams: true,
      kanban: true,
      workspace: true,
      operator: true,
      discourse: true,
      media: true,
      wiki: true,
      agentConfig: true,
    };
    return {
      providerKind: raw.platform ?? "gateway",
      protocolVersion: null,
      ...(raw.auth ? { auth: raw.auth } : {}),
      supports,
    };
  }

  cancelRun(runId: string): Promise<{ status: string }> {
    return this.stopRun(runId);
  }

  startRun(body: GatewayRunStartBody): Promise<GatewayRunStatus> {
    return this.request<GatewayRunStatus>(this.endpoints.runs, {
      method: "POST",
      body,
    });
  }

  getRun(runId: string): Promise<GatewayRunStatus> {
    return this.request<GatewayRunStatus>(this.endpoints.run(runId));
  }

  stopRun(runId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(this.endpoints.runStop(runId), {
      method: "POST",
    });
  }

  resolveRunApproval<T = unknown>(
    runId: string,
    body: { approved: boolean; reason?: string },
    idempotencyKey?: string,
  ): Promise<T> {
    return this.request<T>(this.endpoints.runApproval(runId), {
      method: "POST",
      body,
      idempotencyKey,
    });
  }
}

import { BaseHttpApiClient } from "./base-client.js";
import { GATEWAY_API_ENDPOINTS } from "./paths.js";
import type { HttpApiClientOptions, HttpApiTransport } from "./types.js";

export type HermesCapabilities = {
  object: "hermes.api_server.capabilities";
  platform: "hermes-agent";
  model: string;
  auth: { type: "bearer"; required: boolean };
  features: Record<string, unknown>;
  endpoints?: Record<string, { method: string; path: string }>;
  runtime?: Record<string, unknown>;
};

export type HermesRunStatus = {
  object?: "hermes.run";
  run_id: string;
  status:
    | "started"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "stopping"
    | string;
  session_id?: string;
  model?: string;
  output?: string;
  error?: string;
  usage?: Record<string, number>;
};

export type GatewayCapabilities = HermesCapabilities;
export type GatewayRunStatus = HermesRunStatus;

export class GatewayApiClient extends BaseHttpApiClient {
  readonly endpoints = GATEWAY_API_ENDPOINTS;
  readonly request: HttpApiTransport;

  constructor(options: HttpApiClientOptions, surface = "gateway-api") {
    super(surface, options);
    this.request = this.createTransport();
  }

  getCapabilities(): Promise<HermesCapabilities> {
    return this.request<HermesCapabilities>(this.endpoints.capabilities);
  }

  startRun(body: {
    input: string;
    session_id?: string;
    instructions?: string;
    previous_response_id?: string;
  }): Promise<HermesRunStatus> {
    return this.request<HermesRunStatus>(this.endpoints.runs, {
      method: "POST",
      body,
    });
  }

  getRun(runId: string): Promise<HermesRunStatus> {
    return this.request<HermesRunStatus>(this.endpoints.run(runId));
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

export class HermesApiClient extends GatewayApiClient {
  constructor(options: HttpApiClientOptions) {
    super(options, "hermes-api-server");
  }
}

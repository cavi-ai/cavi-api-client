import { BaseHttpApiClient } from "../http/client.js";
import { GATEWAY_API_ENDPOINTS } from "../../contracts/paths.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../http/types.js";

export type GatewayCapabilities = {
  object?: string;
  platform?: string;
  model?: string;
  auth?: { type?: string; required?: boolean };
  features: Record<string, unknown>;
  endpoints?: Record<string, { method: string; path: string }>;
  runtime?: Record<string, unknown>;
};

export type GatewayRunStatus = {
  object?: string;
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

export class GatewayApiClient extends BaseHttpApiClient {
  readonly endpoints = GATEWAY_API_ENDPOINTS;
  readonly request: HttpApiTransport;

  constructor(options: HttpApiClientOptions, surface = "gateway-api") {
    super(surface, options);
    this.request = this.createTransport();
  }

  getCapabilities(): Promise<GatewayCapabilities> {
    return this.request<GatewayCapabilities>(this.endpoints.capabilities);
  }

  startRun(body: {
    input: string;
    session_id?: string;
    instructions?: string;
    previous_response_id?: string;
  }): Promise<GatewayRunStatus> {
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

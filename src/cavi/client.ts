import { BaseHttpApiClient } from "../core/http/client.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "./paths.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../core/http/types.js";

export class CaviControlApiClient extends BaseHttpApiClient {
  readonly endpoints = CAVI_CONTROL_API_ENDPOINTS;
  readonly request: HttpApiTransport;

  constructor(options: HttpApiClientOptions) {
    super("cavi-control-api", options);
    this.request = this.createTransport();
  }

  getOperatorSnapshot<T = unknown>(): Promise<T> {
    return this.request<T>(this.endpoints.operator.snapshot);
  }

  getPortalDashboard<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  postJson<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: "POST", body, idempotencyKey });
  }
}

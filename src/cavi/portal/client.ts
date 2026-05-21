import { BaseHttpApiClient } from "../../core/http/client.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "../paths.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";

export type PortalApiClientOptions = HttpApiClientOptions & {
  portalId: string;
};

function normalizePortalId(portalId: string): string {
  const trimmed = portalId.trim();
  if (!trimmed) {
    throw new Error("PortalApiClient requires a non-empty portalId");
  }
  return trimmed;
}

export class PortalApiClient extends BaseHttpApiClient {
  readonly portalId: string;
  readonly request: HttpApiTransport;

  constructor(options: PortalApiClientOptions) {
    super("portal-api", options);
    this.portalId = normalizePortalId(options.portalId);
    this.request = this.createTransport();
  }

  protected portalPath(path: string): string {
    return `/${this.portalId}/api/${path.replace(/^\/+/, "")}`;
  }

  getDashboard<T = unknown>(): Promise<T> {
    return this.request<T>(this.portalPath("dashboard"));
  }

  getFromPortal<T = unknown>(relativePath: string): Promise<T> {
    return this.request<T>(this.portalPath(relativePath));
  }

  postToPortal<T = unknown>(
    relativePath: string,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    return this.request<T>(this.portalPath(relativePath), {
      method: "POST",
      body,
      idempotencyKey,
    });
  }

  getPortalMemorySnapshot<T = unknown>(
    teamSlug: string,
    memberId: string,
    memoryKey: string,
  ): Promise<T> {
    return this.request<T>(
      CAVI_CONTROL_API_ENDPOINTS.portalMemorySnapshot(teamSlug, memberId, memoryKey),
    );
  }
}

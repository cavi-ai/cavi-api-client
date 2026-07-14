import type { RuntimeControlPlaneMetadata, RuntimePage } from "./types.js";

export type RuntimeSessionState = "pending" | "active" | "completed" | "cancelled" | "failed" | "unknown";

export interface RuntimeSessionSummary {
  id: string;
  providerId: string;
  title?: string;
  state: RuntimeSessionState;
  createdAt?: string;
  updatedAt?: string;
  providerKind: string;
  model?: string;
  workspaceId?: string;
  metadata: RuntimeControlPlaneMetadata;
}

export type SessionRequestOptions = { signal?: AbortSignal };
export type ListSessionsOptions = SessionRequestOptions & { cursor?: string; limit?: number };

export interface SessionClient {
  listSessions(query?: ListSessionsOptions): Promise<RuntimePage<RuntimeSessionSummary>>;
  getSession(id: string, options?: SessionRequestOptions): Promise<RuntimeSessionSummary>;
  cancelSession?(id: string, options?: SessionRequestOptions): Promise<RuntimeSessionSummary>;
}

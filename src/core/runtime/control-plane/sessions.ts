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

export interface SessionClient {
  listSessions(query?: { cursor?: string; limit?: number }): Promise<RuntimePage<RuntimeSessionSummary>>;
  getSession(id: string): Promise<RuntimeSessionSummary>;
  cancelSession?(id: string): Promise<RuntimeSessionSummary>;
}

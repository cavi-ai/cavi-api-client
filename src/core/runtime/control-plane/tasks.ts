import type { RuntimeControlPlaneMetadata, RuntimePage } from "./types.js";

export type RuntimeTaskState = "pending" | "running" | "completed" | "cancelled" | "failed" | "unknown";

export interface RuntimeTaskSummary {
  id: string;
  state: RuntimeTaskState;
  createdAt?: string;
  updatedAt?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  cancellable?: boolean;
  metadata: RuntimeControlPlaneMetadata;
}

export interface TaskClient {
  listTasks(query?: { cursor?: string; limit?: number }): Promise<RuntimePage<RuntimeTaskSummary>>;
  getTask(id: string): Promise<RuntimeTaskSummary>;
  cancelTask?(id: string): Promise<RuntimeTaskSummary>;
}

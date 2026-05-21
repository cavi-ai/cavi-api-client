import type { OperatorTaskState } from "./operator.js";
import type { AgentRun, AgentRunStatus } from "./runs.js";

export type RunTaskLinkCandidate = {
  runKey: string;
  taskId: string | null;
};

export type EnrichedAgentRun = AgentRun & {
  taskId: string | null;
  taskState: OperatorTaskState | null;
  taskObjective: string | null;
  taskOwner: string | null;
  teamId: string | null;
  verification: string | null;
  discourseTaskId: string | null;
};

export type TaskObservabilitySummary = {
  taskId: string;
  taskState: OperatorTaskState | null;
  taskObjective: string | null;
  taskOwner: string | null;
  teamId: string | null;
  verification: string | null;
  primaryRunKey: string | null;
  runStatus: AgentRunStatus | null;
  runUpdatedAt: number | null;
  totalTokens: number | null;
  totalCostUsd: number | null;
  errorCount: number;
  model: string | null;
  provider: string | null;
  degraded: boolean;
  discourseTaskId: string;
};

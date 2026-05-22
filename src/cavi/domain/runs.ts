// Universal agent-run and run-stream contracts are owned by core. Cavi only adds
// its domain-specific aggregate shapes on top of them.
export * from "../../core/gateway/run/contracts.js";

import type { AgentRun } from "../../core/gateway/run/contracts.js";

export type AgentRunsSnapshot = {
  live: AgentRun[];
  history: AgentRun[];
  summary: {
    active: number;
    idle: number;
    stalled: number;
    error: number;
  };
};

export type AgentRunsFilters = {
  search: string;
  activeMinutes: number;
  limit: number;
};

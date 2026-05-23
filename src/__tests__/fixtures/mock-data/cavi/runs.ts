import type { AgentRun } from "../../../../core/gateway/run/contracts.js";
import type {
  GatewaySessionRunDetailSnapshot,
  GatewaySessionRunsSnapshot,
} from "../../../../core/gateway/snapshots/contracts.js";
import { mockNow as now } from "./shared.js";

const mockRuns: AgentRun[] = [
  {
    key: "agent:tony:main",
    title: "Tony Main Orchestrator",
    agentId: "tony",
    channel: "discord",
    updatedAt: now - 2 * 60_000,
    status: "active",
    totalTokens: 138_203,
    errors: 0,
    model: "anthropic/claude-sonnet-4",
    totalCostUsd: 1.24,
  },
  {
    key: "agent:inspectah:subagent:20260309-1",
    title: "Inspectah CI Recovery",
    agentId: "inspectah-deck",
    channel: "discord",
    updatedAt: now - 31 * 60_000,
    status: "stalled",
    totalTokens: 42_918,
    errors: 3,
    model: "openai/gpt-4o",
    totalCostUsd: 0.89,
  },
  {
    key: "agent:method-man:subagent:20260309-7",
    title: "Cavi Control UI MVP",
    agentId: "method-man-frontend",
    channel: "webchat",
    updatedAt: now - 11 * 60_000,
    status: "idle",
    totalTokens: 56_477,
    errors: 0,
    model: "anthropic/claude-sonnet-4",
    totalCostUsd: 0.72,
  },
  {
    key: "agent:raekwon:backend:20260310-1",
    title: "Backend validation",
    agentId: "raekwon",
    channel: "discord",
    updatedAt: now - 25 * 60_000,
    status: "idle",
    totalTokens: 22_100,
    errors: 0,
    model: "openai/gpt-4o-mini",
    totalCostUsd: 0.31,
  },
  {
    key: "agent:ghostface:infra:20260310-2",
    title: "AKS reconcile",
    agentId: "ghostface",
    channel: "discord",
    updatedAt: now - 55 * 60_000,
    status: "stalled",
    totalTokens: 18_400,
    errors: 2,
    model: "anthropic/claude-sonnet-4",
    totalCostUsd: 0.28,
  },
];
export const mockAgentRuns: GatewaySessionRunsSnapshot = {
  live: mockRuns.filter((run) => run.status === "active" || run.status === "idle"),
  history: mockRuns,
  summary: {
    active: mockRuns.filter((run) => run.status === "active").length,
    idle: mockRuns.filter((run) => run.status === "idle").length,
    stalled: mockRuns.filter((run) => run.status === "stalled").length,
    error: mockRuns.filter((run) => run.status === "error").length,
  },
};

export function mockRunDetailForKey(key: string): GatewaySessionRunDetailSnapshot {
  const run = mockRuns.find((entry) => entry.key === key) ?? mockRuns[0] ?? null;

  return {
    run,
    preview: {
      status: run ? "ok" : "missing",
      items: run
        ? [
            {
              role: "system",
              text: "Session booted and routing context attached.",
              at: now - 18 * 60_000,
              eventType: "system",
            },
            {
              role: "user",
              text: "Please harden Cavi Control run detail and health UX.",
              at: now - 15 * 60_000,
              eventType: "user",
            },
            {
              role: "assistant",
              text: "Acknowledged. I will scan cavi-control scope and execute a focused patch.",
              at: now - 14 * 60_000,
              eventType: "assistant",
            },
            {
              role: "tool",
              text: "read: cavi-control-ui/src/pages/AgentRunDetailPage.tsx",
              at: now - 13 * 60_000,
              eventType: "tool",
              toolName: "read",
              durationMs: 620,
            },
            {
              role: "tool",
              text: "edit: cavi-control-ui/src/pages/OverviewPage.tsx",
              at: now - 8 * 60_000,
              eventType: "tool",
              toolName: "edit",
              durationMs: 1_120,
            },
            {
              role: "assistant",
              text: "Build succeeded. Final validation checklist updated.",
              at: now - 5 * 60_000,
              eventType: "assistant",
            },
          ]
        : [],
    },
    usage: {
      totalTokens: run?.totalTokens ?? 0,
      totalCostUsd: run ? 1.74 : 0,
      messages: run ? 36 : 0,
      toolCalls: run ? 14 : 0,
      errors: run?.errors ?? 0,
    },
  };
}

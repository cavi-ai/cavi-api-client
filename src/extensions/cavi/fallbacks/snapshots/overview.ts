import type { OverviewSnapshot } from "../../../../core/gateway/snapshots/contracts.js";
import { GATEWAY_PROBE_ENDPOINTS } from "../../../../contracts/paths.js";
import { fallbackSnapshotNow as now } from "./shared.js";

export const fallbackOverview: OverviewSnapshot = {
  health: {
    live: true,
    ready: true,
    checkedAt: now,
    probes: {
      healthz: {
        path: GATEWAY_PROBE_ENDPOINTS.healthz,
        ok: true,
        statusCode: 200,
      },
      readyz: {
        path: GATEWAY_PROBE_ENDPOINTS.readyz,
        ok: true,
        statusCode: 200,
        failing: [],
        uptimeMs: 900_000,
      },
    },
  },
  kpis: {
    activeSessions: 7,
    totalSessions: 44,
    totalMessages: 5_812,
    totalToolCalls: 1_129,
    totalErrors: 16,
    estimatedCostUsd: 13.41,
  },
  providerBreakdown: [
    { provider: "openai", tokens: 482_331, cost: 10.84 },
    { provider: "anthropic", tokens: 114_220, cost: 2.57 },
  ],
  topAgents: [
    { agentId: "primary-operator", messages: 1_028, cost: 4.12 },
    { agentId: "qa-operator", messages: 807, cost: 2.73 },
    { agentId: "ui-operator", messages: 739, cost: 2.06 },
  ],
};

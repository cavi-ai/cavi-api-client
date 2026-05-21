import { GATEWAY_PROBE_ENDPOINTS } from "../../contracts/paths.js";

export type HealthSnapshot = {
  live: boolean;
  ready: boolean;
  checkedAt: number;
  probes: {
    healthz: {
      path: typeof GATEWAY_PROBE_ENDPOINTS.healthz;
      ok: boolean;
      statusCode: 200;
    };
    readyz: {
      path: typeof GATEWAY_PROBE_ENDPOINTS.readyz;
      ok: boolean;
      statusCode: 200 | 503;
      failing: string[];
      uptimeMs: number | null;
    };
  };
};

export type OverviewKpis = {
  activeSessions: number;
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  totalErrors: number;
  estimatedCostUsd: number;
};

export type OverviewSnapshot = {
  health: HealthSnapshot;
  kpis: OverviewKpis;
  providerBreakdown: Array<{ provider: string; tokens: number; cost: number }>;
  topAgents: Array<{ agentId: string; messages: number; cost: number }>;
};

import { GATEWAY_PROBE_ENDPOINTS } from "../../../contracts/paths.js";
import type { GatewayResolvedRouteBinding } from "../../../contracts/team-manifest.js";

export type GatewayHealthSnapshot = {
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

export type GatewayOverviewKpis = {
  activeSessions: number;
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  totalErrors: number;
  estimatedCostUsd: number;
};

export type GatewayOverviewSnapshot = {
  health: GatewayHealthSnapshot;
  kpis: GatewayOverviewKpis;
  providerBreakdown: Array<{ provider: string; tokens: number; cost: number }>;
  topAgents: Array<{ agentId: string; messages: number; cost: number }>;
};

export type BuildOverviewSnapshotOptions = {
  totalSessions?: number;
};

export type GatewaySessionRunStatus = "active" | "idle" | "stalled" | "error";

export type GatewaySessionRun = {
  key: string;
  title: string;
  agentId: string;
  channel: string;
  updatedAt: number | null;
  status: GatewaySessionRunStatus;
  totalTokens: number;
  errors: number;
  model?: string;
  totalCostUsd?: number;
  binding?: GatewayResolvedRouteBinding | null;
};

export type GatewaySessionRunsSnapshot = {
  live: GatewaySessionRun[];
  history: GatewaySessionRun[];
  summary: {
    active: number;
    idle: number;
    stalled: number;
    error: number;
  };
};

export type GatewaySessionRunDetailSnapshot = {
  run: GatewaySessionRun | null;
  preview: {
    status: string;
    items: Array<{
      role: string;
      text: string;
      at: number | null;
      eventType?: string;
      toolName?: string;
      durationMs?: number | null;
      error?: string | null;
    }>;
  };
  usage: {
    totalTokens: number;
    totalCostUsd: number;
    messages: number;
    toolCalls: number;
    errors: number;
  };
};

export type GatewayRoutingMatrixSnapshot = {
  rows: Array<{
    channel: string;
    handler: string;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    successRate: number;
    messages: number;
    binding?: GatewayResolvedRouteBinding | null;
  }>;
  totals: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  };
};

export type GatewayIncidentSeverity = "critical" | "high" | "medium" | "low";

export type GatewayIncidentStatus =
  | "open"
  | "investigating"
  | "blocked"
  | "resolved";

export type GatewayIncidentRecord = {
  id: string;
  title: string;
  summary: string;
  severity: GatewayIncidentSeverity;
  status: GatewayIncidentStatus;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  owner: string;
  repeatedAcrossAgents?: boolean;
  flaggedForImmediateFix?: boolean;
  planningRelated?: boolean;
  workTaskAssigned?: string;
  scope?: string;
  agentIds?: string[];
};

export type GatewayIncidentsSnapshot = {
  incidents: GatewayIncidentRecord[];
  blockers: GatewayIncidentRecord[];
};

export type GatewayCostHistoryRange = "1h" | "6h" | "24h" | "7d";

export type GatewayCostBucket = {
  timestamp: number;
  activeSessions: number;
  totalTokens: number;
  estimatedCostUsd: number;
  totalErrors: number;
  providerBreakdown: Array<{ provider: string; tokens: number; cost: number }>;
};

export type GatewayCostHistorySnapshot = {
  range: GatewayCostHistoryRange;
  resolution: string;
  generatedAt: number;
  buckets: GatewayCostBucket[];
  totals: {
    totalTokens: number;
    estimatedCostUsd: number;
    totalErrors: number;
  };
};

export type GatewayCostHistoryFilters = {
  range: GatewayCostHistoryRange;
};

export type GatewayActivityEvent = {
  id: string;
  receivedAt: number;
  type: string;
  agentId: string | null;
  sessionKey: string | null;
  summary: string;
  raw: unknown;
};

export type GatewayActivityFilters = {
  search: string;
  eventTypes: string[];
};

export type AgentRunsFilters = {
  search: string;
  activeMinutes: number;
  limit: number;
};

export type RawSessionRow = {
  key?: string;
  label?: string;
  derivedTitle?: string;
  agentId?: string;
  channel?: string;
  updatedAt?: number | null;
  abortedLastRun?: boolean;
  totalTokens?: number;
  origin?: {
    provider?: string;
    surface?: string;
  };
};

export type RawUsageSession = {
  key?: string;
  agentId?: string;
  channel?: string;
  modelProvider?: string;
  model?: string;
  modelOverride?: string;
  providerOverride?: string;
  origin?: {
    provider?: string;
    surface?: string;
  };
  usage?: {
    totalTokens?: number;
    totalCost?: number;
    messageCounts?: {
      total?: number;
      toolCalls?: number;
      errors?: number;
    };
  } | null;
};

export type SessionsListPayload = {
  sessions?: RawSessionRow[];
  count?: number;
};

export type SessionsUsagePayload = {
  sessions?: RawUsageSession[];
  aggregates?: {
    byProvider?: Array<{
      provider?: string;
      totals?: { totalTokens?: number; totalCost?: number };
    }>;
    byAgent?: Array<{
      agentId?: string;
      totals?: { totalCost?: number };
      messages?: number;
    }>;
    messages?: {
      total?: number;
      toolCalls?: number;
      errors?: number;
    };
  };
  totals?: {
    totalCost?: number;
  };
};

export type SessionsPreviewPayload = {
  previews?: Array<{
    key?: string;
    status?: string;
    items?: Array<{
      role?: string;
      text?: string;
      at?: number;
    }>;
  }>;
};

export type LogsTailPayload = {
  lines?: string[];
};

export type ReadinessInput = {
  ready: boolean;
  failing: string[];
  uptimeMs: number | null;
  statusCode: 200 | 503;
};

export type OverviewSnapshot = GatewayOverviewSnapshot;
export type HealthSnapshot = GatewayHealthSnapshot;
export type OverviewKpis = GatewayOverviewKpis;
export type RoutingMatrixSnapshot = GatewayRoutingMatrixSnapshot;
export type IncidentSeverity = GatewayIncidentSeverity;
export type IncidentStatus = GatewayIncidentStatus;
export type IncidentRecord = GatewayIncidentRecord;
export type IncidentsSnapshot = GatewayIncidentsSnapshot;
export type CostHistoryRange = GatewayCostHistoryRange;
export type CostBucket = GatewayCostBucket;
export type CostHistorySnapshot = GatewayCostHistorySnapshot;
export type CostHistoryFilters = GatewayCostHistoryFilters;
export type ActivityEvent = GatewayActivityEvent;
export type ActivityFilters = GatewayActivityFilters;

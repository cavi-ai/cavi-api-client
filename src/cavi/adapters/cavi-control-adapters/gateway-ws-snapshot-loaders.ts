import type { SessionLoaders } from "../../../core/gateway/session-loaders.js";
import {
  createEmptyGatewaySnapshotFallbacks,
  createGatewaySnapshotLoaders,
  type GatewaySnapshotBindingResolver,
  type GatewaySnapshotFallbacks,
} from "../../../core/gateway/snapshot-loaders.js";
import { type DataEnvelope, withFallback } from "../../../core/gateway/envelope.js";
import {
  type JsonHttpRequest,
  withQuery,
} from "../../../core/http/json-client.js";
import { describeHttpContract } from "../../../core/http/contracts.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "../../../contracts/paths.js";
import type {
  AgentRunDetailSnapshot,
  AgentRunsFilters,
  AgentRunsSnapshot,
  CostHistoryRange,
  CostHistorySnapshot,
  IncidentsSnapshot,
  OverviewSnapshot,
  RoutingMatrixSnapshot,
} from "../../domain/index.js";
import {
  fallbackAgentRuns,
  fallbackCostHistory,
  fallbackIncidents,
  fallbackOverview,
  fallbackRoutingMatrix,
  fallbackRunDetailForKey,
} from "../../fallbacks/snapshots/index.js";
import type { GatewaySystemLoaders } from "../../../core/gateway/system-loaders.js";

export type CaviSnapshotFallbackMode = "compat" | "empty" | "none";

export type GatewayWsSnapshotLoaders = {
  loadOverview: () => Promise<DataEnvelope<OverviewSnapshot>>;
  loadAgentRuns: (
    filters: AgentRunsFilters,
  ) => Promise<DataEnvelope<AgentRunsSnapshot>>;
  loadRunDetail: (
    key: string,
  ) => Promise<DataEnvelope<AgentRunDetailSnapshot>>;
  loadRoutingMatrix: (
    windowDays: number,
  ) => Promise<DataEnvelope<RoutingMatrixSnapshot>>;
  loadIncidents: () => Promise<DataEnvelope<IncidentsSnapshot>>;
  loadCostHistory: (
    range: CostHistoryRange,
  ) => Promise<DataEnvelope<CostHistorySnapshot>>;
};

export type CreateGatewayWsSnapshotLoadersOptions = {
  fallbackMode?: CaviSnapshotFallbackMode;
  snapshotFallbacks?: Partial<GatewaySnapshotFallbacks>;
  resolveBinding?: GatewaySnapshotBindingResolver | null;
};

function createCompatSnapshotFallbacks(): GatewaySnapshotFallbacks {
  return {
    overview: fallbackOverview,
    agentRuns: fallbackAgentRuns,
    runDetail: fallbackRunDetailForKey,
    routingMatrix: fallbackRoutingMatrix,
    incidents: fallbackIncidents,
  };
}

function resolveSnapshotFallbacks(
  options: CreateGatewayWsSnapshotLoadersOptions = {},
): GatewaySnapshotFallbacks | null {
  const mode = options.fallbackMode ?? "compat";
  const base =
    mode === "none"
      ? null
      : mode === "empty"
        ? createEmptyGatewaySnapshotFallbacks()
        : createCompatSnapshotFallbacks();
  if (!options.snapshotFallbacks) {
    return base;
  }
  return {
    ...(base ?? createEmptyGatewaySnapshotFallbacks()),
    ...options.snapshotFallbacks,
  };
}

function gatewayEnvelope<TData>(data: TData): DataEnvelope<TData> {
  return {
    data,
    source: "gateway",
    fetchedAt: Date.now(),
    contractGaps: [],
  };
}

function createEmptyCostHistory(range: CostHistoryRange): CostHistorySnapshot {
  return {
    range,
    resolution: "none",
    generatedAt: Date.now(),
    buckets: [],
    totals: {
      totalTokens: 0,
      estimatedCostUsd: 0,
      totalErrors: 0,
    },
  };
}

export function createGatewayWsSnapshotLoaders(deps: {
  sessionLoaders: SessionLoaders;
  systemLoaders: GatewaySystemLoaders;
  requestJson: JsonHttpRequest;
  options?: CreateGatewayWsSnapshotLoadersOptions;
}): GatewayWsSnapshotLoaders {
  const { requestJson } = deps;
  const fallbacks = resolveSnapshotFallbacks(deps.options);
  const coreLoaders = createGatewaySnapshotLoaders({
    sessionLoaders: deps.sessionLoaders,
    systemLoaders: deps.systemLoaders,
    options: {
      fallbacks,
      resolveBinding: deps.options?.resolveBinding ?? null,
    },
  });

  return {
    loadOverview: coreLoaders.loadOverview,
    loadAgentRuns: async (filters: AgentRunsFilters) =>
      await coreLoaders.loadAgentRuns(filters) as DataEnvelope<AgentRunsSnapshot>,
    loadRunDetail: async (key: string) =>
      await coreLoaders.loadRunDetail(key) as DataEnvelope<AgentRunDetailSnapshot>,
    loadRoutingMatrix: async (windowDays: number) =>
      await coreLoaders.loadRoutingMatrix(windowDays) as DataEnvelope<RoutingMatrixSnapshot>,
    loadIncidents: coreLoaders.loadIncidents,

    loadCostHistory: async (
      range: CostHistoryRange,
    ): Promise<DataEnvelope<CostHistorySnapshot>> =>
      deps.options?.fallbackMode === "none"
        ? gatewayEnvelope(
            await requestJson<CostHistorySnapshot>(
              withQuery(CAVI_CONTROL_API_ENDPOINTS.costHistory, { range }),
            ),
          )
        : await withFallback({
            area: "cost-history",
            expectedContract: describeHttpContract(
              "GET",
              CAVI_CONTROL_API_ENDPOINTS.costHistory,
            ),
            note: "Cost history endpoint unavailable",
            fallback: deps.options?.fallbackMode === "empty"
              ? createEmptyCostHistory(range)
              : fallbackCostHistory(range),
            run: async () => await requestJson<CostHistorySnapshot>(
              withQuery(CAVI_CONTROL_API_ENDPOINTS.costHistory, { range }),
            ),
          }),
  };
}

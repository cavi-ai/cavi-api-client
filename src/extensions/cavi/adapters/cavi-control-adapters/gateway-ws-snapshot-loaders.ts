import type { SessionLoaders } from "../../../../core/gateway/snapshots/session-loaders.js";
import {
  createGatewaySnapshotLoaders,
  resolveGatewaySnapshotFallbacks,
  type GatewaySnapshotBindingResolver,
  type GatewaySnapshotFallbackMode,
  type GatewaySnapshotFallbacks,
  type GatewaySnapshotFallbackOverrides,
  type GatewaySnapshotFallbackProvider,
  type GatewayCostHistoryFallback,
} from "../../../../core/gateway/snapshots/loaders.js";
import { type DataEnvelope, withFallback } from "../../../../core/gateway/envelope/index.js";
import {
  type JsonHttpRequest,
  withQuery,
} from "../../../../core/http/json-client.js";
import { describeHttpContract } from "../../../../core/http/contracts.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "../../contracts/paths.js";
import { createCaviSnapshotFallbackProvider } from "../../fallbacks/provider.js";
import type {
  GatewaySessionRunDetailSnapshot,
  AgentRunsFilters,
  GatewaySessionRunsSnapshot,
  CostHistoryRange,
  CostHistorySnapshot,
  IncidentsSnapshot,
  OverviewSnapshot,
  RoutingMatrixSnapshot,
} from "../../../../core/gateway/snapshots/contracts.js";
import type { GatewaySystemLoaders } from "../../../../core/gateway/snapshots/system-loaders.js";

export type CaviSnapshotFallbackMode = GatewaySnapshotFallbackMode | "compat";

export type GatewayWsSnapshotLoaders = {
  loadOverview: () => Promise<DataEnvelope<OverviewSnapshot>>;
  loadAgentRuns: (
    filters: AgentRunsFilters,
  ) => Promise<DataEnvelope<GatewaySessionRunsSnapshot>>;
  loadRunDetail: (
    key: string,
  ) => Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>>;
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
  fallbackProvider?: GatewaySnapshotFallbackProvider | null;
  snapshotFallbacks?: Partial<GatewaySnapshotFallbacks>;
  costHistoryFallback?: GatewayCostHistoryFallback | null;
  resolveBinding?: GatewaySnapshotBindingResolver | null;
};

export function resolveCaviSnapshotFallbacks(
  options: CreateGatewayWsSnapshotLoadersOptions = {},
): ReturnType<typeof resolveGatewaySnapshotFallbacks> {
  const mode = options.fallbackMode ?? "empty";
  const overrides: GatewaySnapshotFallbackOverrides = {
    ...(options.snapshotFallbacks ?? {}),
  };
  if ("costHistoryFallback" in options) {
    overrides.costHistory = options.costHistoryFallback ?? null;
  }
  const resolved = resolveGatewaySnapshotFallbacks({
    mode: mode === "compat" ? "empty" : mode,
    provider: options.fallbackProvider ??
      (mode === "compat" ? createCaviSnapshotFallbackProvider() : null),
    overrides,
  });
  return resolved;
}

function gatewayEnvelope<TData>(data: TData): DataEnvelope<TData> {
  return {
    data,
    source: "gateway",
    fetchedAt: Date.now(),
    contractGaps: [],
  };
}

export function createGatewayWsSnapshotLoaders(deps: {
  sessionLoaders: SessionLoaders;
  systemLoaders: GatewaySystemLoaders;
  requestJson: JsonHttpRequest;
  options?: CreateGatewayWsSnapshotLoadersOptions;
}): GatewayWsSnapshotLoaders {
  const { requestJson } = deps;
  const fallbacks = resolveCaviSnapshotFallbacks(deps.options);
  const coreLoaders = createGatewaySnapshotLoaders({
    sessionLoaders: deps.sessionLoaders,
    systemLoaders: deps.systemLoaders,
    options: {
      fallbacks: fallbacks.snapshots,
      resolveBinding: deps.options?.resolveBinding ?? null,
    },
  });

  return {
    loadOverview: coreLoaders.loadOverview,
    loadAgentRuns: coreLoaders.loadAgentRuns,
    loadRunDetail: coreLoaders.loadRunDetail,
    loadRoutingMatrix: coreLoaders.loadRoutingMatrix,
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
            fallback: fallbacks.costHistory
              ? (
                  typeof fallbacks.costHistory === "function"
                    ? fallbacks.costHistory(range)
                    : fallbacks.costHistory
                )
              : {
                  range,
                  resolution: "none",
                  generatedAt: Date.now(),
                  buckets: [],
                  totals: {
                    totalTokens: 0,
                    estimatedCostUsd: 0,
                    totalErrors: 0,
                  },
                },
            run: async () => await requestJson<CostHistorySnapshot>(
              withQuery(CAVI_CONTROL_API_ENDPOINTS.costHistory, { range }),
            ),
          }),
  };
}

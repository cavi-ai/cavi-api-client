import {
  BASELINE_SESSIONS_LIST_PARAMS,
  EMPTY_SESSIONS_USAGE,
  type SessionLoaders,
} from "../../../core/gateway/session-loaders.js";
import {
  buildIncidentsSnapshot,
  buildOverviewSnapshot,
  buildRunDetailSnapshot,
  buildRunsSnapshot,
  buildRoutingMatrix,
  normalizeRun,
  utcDateYmd,
} from "../../../core/gateway/transforms.js";
import type { SessionsUsagePayload } from "../../../core/gateway/transforms.js";
import {
  classifyFallbackError,
  type DataEnvelope,
  withFallback,
} from "../../../core/gateway/envelope.js";
import { asString } from "../../../core/data/guards.js";
import {
  type JsonHttpRequest,
  withQuery,
} from "../../../core/http/json-client.js";
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
import {
  API_COST_HISTORY,
  describeHttpContract,
} from "../../data/cavi-control/api-paths.js";
import type { GatewayWsSystemLoaders } from "./gateway-ws-system-loaders.js";

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

export function createGatewayWsSnapshotLoaders(deps: {
  sessionLoaders: SessionLoaders;
  systemLoaders: GatewayWsSystemLoaders;
  requestJson: JsonHttpRequest;
}): GatewayWsSnapshotLoaders {
  const {
    loadSessionsListRaw,
    loadSessionsUsageRaw,
    loadSessionsPreviewRaw,
    peekSessionsListCache,
  } = deps.sessionLoaders;
  const { loadHealthSnapshotRaw, loadLogsTailRaw } = deps.systemLoaders;
  const { requestJson } = deps;

  const loadSessionsUsageBestEffort = async (
    params: Record<string, unknown>,
  ): Promise<SessionsUsagePayload> => {
    try {
      return await loadSessionsUsageRaw(params);
    } catch (error) {
      const classified = classifyFallbackError(error);
      if (
        classified.reason === "backend-unavailable" ||
        classified.reason === "transport-disconnected"
      ) {
        return EMPTY_SESSIONS_USAGE;
      }
      throw error;
    }
  };

  return {
    loadOverview: async (): Promise<DataEnvelope<OverviewSnapshot>> =>
      withFallback({
        area: "overview",
        expectedContract: "WS sessions.list + sessions.usage + health.snapshot",
        note: "Cavi Control overview via WebSocket unavailable",
        fallback: fallbackOverview,
        run: async () => {
          const [listRes, usageRes, healthRes] = await Promise.all([
            loadSessionsListRaw({
              ...BASELINE_SESSIONS_LIST_PARAMS,
            }),
            loadSessionsUsageRaw({
              limit: 300,
              includeContextWeight: false,
            }),
            loadHealthSnapshotRaw(),
          ]);
          const sessions = Array.isArray(listRes.sessions)
            ? listRes.sessions
            : [];
          const readiness = {
            ready: healthRes.ready,
            failing: Array.isArray(healthRes.failing)
              ? healthRes.failing
                  .map((entry) =>
                    typeof entry === "string" ? entry : String(entry),
                  )
                  .filter((entry) => entry.trim().length > 0)
              : [],
            uptimeMs: healthRes.uptimeMs ?? null,
            statusCode: healthRes.ready ? (200 as const) : (503 as const),
          };
          return buildOverviewSnapshot(sessions, usageRes, readiness, {
            totalSessions: listRes.count,
          });
        },
      }),

    loadAgentRuns: async (
      filters: AgentRunsFilters,
    ): Promise<DataEnvelope<AgentRunsSnapshot>> =>
      withFallback({
        area: "agent-runs",
        expectedContract: "WS sessions.list + sessions.usage",
        note: "Cavi Control runs via WebSocket unavailable",
        fallback: fallbackAgentRuns,
        run: async () => {
          const [listRes, usageRes] = await Promise.all([
            loadSessionsListRaw({
              limit: filters.limit,
              activeMinutes: filters.activeMinutes,
              includeGlobal: true,
              includeUnknown: true,
              search: filters.search,
              includeDerivedTitles: true,
            }),
            loadSessionsUsageBestEffort({
              limit: filters.limit,
              includeContextWeight: false,
            }),
          ]);
          const rows = Array.isArray(listRes.sessions) ? listRes.sessions : [];
          return buildRunsSnapshot(rows, usageRes);
        },
      }),

    loadRunDetail: async (
      key: string,
    ): Promise<DataEnvelope<AgentRunDetailSnapshot>> =>
      withFallback({
        area: "run-detail",
        expectedContract:
          "WS sessions.usage + sessions.list + sessions.preview",
        note: "Cavi Control run detail via WebSocket unavailable",
        fallback: fallbackRunDetailForKey(key),
        run: async () => {
          const [usageRes, previewRes] = await Promise.all([
            loadSessionsUsageRaw({
              key,
              limit: 1,
              includeContextWeight: false,
            }),
            loadSessionsPreviewRaw({
              keys: [key],
              limit: 24,
              maxChars: 240,
            }),
          ]);

          const baselineRows = peekSessionsListCache(
            BASELINE_SESSIONS_LIST_PARAMS,
          )?.sessions;
          const baselineMatch = Array.isArray(baselineRows)
            ? (baselineRows.find((row) => asString(row.key) === key) ?? null)
            : null;

          let matchedRow = baselineMatch;
          if (!matchedRow) {
            const listRes = await loadSessionsListRaw({
              ...BASELINE_SESSIONS_LIST_PARAMS,
              search: key,
            });
            const rows = Array.isArray(listRes.sessions)
              ? listRes.sessions
              : [];
            matchedRow = rows.find((row) => asString(row.key) === key) ?? null;
          }

          const usageSession =
            Array.isArray(usageRes.sessions) && usageRes.sessions.length > 0
              ? (usageRes.sessions[0] ?? null)
              : null;
          const run = matchedRow ? normalizeRun(matchedRow, 0) : null;
          const preview = Array.isArray(previewRes.previews)
            ? previewRes.previews[0]
            : null;
          return buildRunDetailSnapshot(run, usageSession, preview);
        },
      }),

    loadRoutingMatrix: async (
      windowDays: number,
    ): Promise<DataEnvelope<RoutingMatrixSnapshot>> =>
      withFallback({
        area: "routing-matrix",
        expectedContract: "WS sessions.usage",
        note: "Cavi Control routing via WebSocket unavailable",
        fallback: fallbackRoutingMatrix,
        run: async () => {
          const end = new Date();
          const start = new Date(Date.now() - windowDays * 86_400_000);
          const usageRes = await loadSessionsUsageBestEffort({
            limit: 400,
            startDate: utcDateYmd(start),
            endDate: utcDateYmd(end),
            includeContextWeight: false,
          });
          return buildRoutingMatrix(usageRes);
        },
      }),

    loadIncidents: async (): Promise<DataEnvelope<IncidentsSnapshot>> =>
      withFallback({
        area: "incidents",
        expectedContract: "WS logs.tail + sessions.list",
        note: "Cavi Control incidents via WebSocket unavailable",
        fallback: fallbackIncidents,
        run: async () => {
          const [logsRes, listRes] = await Promise.all([
            loadLogsTailRaw({
              limit: 300,
              maxBytes: 512_000,
            }),
            loadSessionsListRaw({
              ...BASELINE_SESSIONS_LIST_PARAMS,
            }),
          ]);
          const sessions = Array.isArray(listRes.sessions)
            ? listRes.sessions
            : [];
          return buildIncidentsSnapshot(logsRes, sessions);
        },
      }),

    loadCostHistory: async (
      range: CostHistoryRange,
    ): Promise<DataEnvelope<CostHistorySnapshot>> =>
      withFallback({
        area: "cost-history",
        expectedContract: describeHttpContract("GET", API_COST_HISTORY),
        note: "Cost history endpoint unavailable",
        fallback: fallbackCostHistory(range),
        run: async () => {
          return await requestJson<CostHistorySnapshot>(
            withQuery(API_COST_HISTORY, { range }),
          );
        },
      }),
  };
}

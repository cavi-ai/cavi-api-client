import type { GatewayRpcClient } from "../../../core/gateway/rpc.js";
import {
  buildIncidentsSnapshot,
  buildOverviewSnapshot,
  buildRunDetailSnapshot,
  buildRunsSnapshot,
  buildRoutingMatrix,
  normalizeRun,
  utcDateYmd,
} from "../../../core/gateway/transforms.js";
import type {
  LogsTailPayload,
  SessionsListPayload,
  SessionsPreviewPayload,
  SessionsUsagePayload,
} from "../../../core/gateway/transforms.js";
import type {
  AgentRunDetailSnapshot,
  AgentRunsFilters,
  AgentRunsSnapshot,
  CostHistoryRange,
  CostHistorySnapshot,
  DataEnvelope,
  IncidentsSnapshot,
  OverviewSnapshot,
  RoutingMatrixSnapshot,
} from "../../domain/index.js";
import {
  mockAgentRuns,
  mockIncidents,
  mockOverview,
  mockRoutingMatrix,
  mockRunDetailForKey,
  mockCostHistory,
} from "../../../test-support/mock-data/cavi/index.js";
import {
  API_COST_HISTORY,
  describeHttpContract,
} from "../../data/cavi-control/api-paths.js";
import { withFallback } from "../../data/cavi-control/envelope.js";
import { classifyFallbackError } from "../../data/cavi-control/envelope.js";
import { asString } from "../../data/cavi-control/guards.js";
import {
  withQuery,
  type CaviControlRequestJson,
} from "../../data/cavi-control/http-client.js";

type SessionsListRequestParams = {
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  limit?: number;
  activeMinutes?: number;
  search?: string;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  lastHash?: string;
};

type SessionsListPayloadWithCache = SessionsListPayload & {
  hash?: string;
  count?: number;
  ts?: number;
  path?: string;
};

type SessionsListUnchangedPayload = {
  unchanged: true;
  hash: string;
  count?: number;
  ts?: number;
  path?: string;
};

type SessionsListRpcPayload =
  | SessionsListPayloadWithCache
  | SessionsListUnchangedPayload;

type HealthSnapshotPayload = {
  ready: boolean;
  failing?: unknown[];
  uptimeMs?: number | null;
};

type SessionsListCacheEntry = {
  lastHash: string | null;
  payload: SessionsListPayloadWithCache | null;
  inFlight: Promise<SessionsListPayloadWithCache> | null;
};

type TtlCacheEntry<TPayload> = {
  payload: TPayload | null;
  expiresAt: number;
  inFlight: Promise<TPayload> | null;
};

type SessionDetailPayload = {
  key?: string;
  row?: unknown | null;
  usageSession?: unknown | null;
  preview?: unknown | null;
  errors?: {
    usage?: string | null;
  };
};

/** Align with loader `staleTime` (~10–15s) so SSE/stream invalidations coalesce without hammering the gateway. */
const SESSIONS_DETAIL_CACHE_TTL_MS = 12_000;
const HEALTH_SNAPSHOT_CACHE_TTL_MS = 5_000;
const LOGS_TAIL_CACHE_TTL_MS = 12_000;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeInt(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(min, Math.floor(value));
}

function canonicalizeSessionsListParams(
  params: SessionsListRequestParams,
): string {
  return JSON.stringify({
    includeGlobal: normalizeBoolean(params.includeGlobal),
    includeUnknown: normalizeBoolean(params.includeUnknown),
    includeDerivedTitles: normalizeBoolean(params.includeDerivedTitles),
    limit: normalizeInt(params.limit, 0),
    activeMinutes: normalizeInt(params.activeMinutes, 0),
    search: normalizeString(params.search).toLowerCase(),
    label: normalizeString(params.label),
    spawnedBy: normalizeString(params.spawnedBy),
    agentId: normalizeString(params.agentId),
  });
}

function canonicalizeSessionsUsageParams(
  params: Record<string, unknown>,
): string {
  return JSON.stringify({
    key: normalizeString(params.key),
    limit: normalizeInt(params.limit, 0),
    includeContextWeight: normalizeBoolean(params.includeContextWeight),
    startDate: normalizeString(params.startDate),
    endDate: normalizeString(params.endDate),
  });
}

function canonicalizeSessionsPreviewParams(params: {
  keys?: unknown;
  limit?: unknown;
  maxChars?: unknown;
}): string {
  const keys = Array.isArray(params.keys)
    ? params.keys
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
        .sort()
    : [];
  return JSON.stringify({
    keys,
    limit: normalizeInt(params.limit, 0),
    maxChars: normalizeInt(params.maxChars, 0),
  });
}

function canonicalizeSessionDetailParams(params: {
  key?: unknown;
  previewLimit?: unknown;
  maxChars?: unknown;
}): string {
  return JSON.stringify({
    key: normalizeString(params.key),
    previewLimit: normalizeInt(params.previewLimit, 0),
    maxChars: normalizeInt(params.maxChars, 0),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUnchangedSessionsListPayload(
  payload: unknown,
): payload is SessionsListUnchangedPayload {
  if (!isRecord(payload)) {
    return false;
  }
  return (
    payload.unchanged === true &&
    typeof payload.hash === "string" &&
    payload.hash.trim().length > 0
  );
}

function normalizeSessionsListPayload(
  payload: SessionsListRpcPayload,
): SessionsListPayloadWithCache {
  if (isUnchangedSessionsListPayload(payload)) {
    return {
      sessions: [],
      hash: payload.hash,
      count: payload.count,
      ts: payload.ts,
      path: payload.path,
    };
  }
  return {
    ...payload,
    sessions: Array.isArray(payload.sessions) ? payload.sessions : [],
  };
}

const BASELINE_SESSIONS_LIST_PARAMS: SessionsListRequestParams = {
  limit: 300,
  includeGlobal: true,
  includeUnknown: true,
  includeDerivedTitles: true,
};
const BASELINE_SESSIONS_LIST_CACHE_KEY = canonicalizeSessionsListParams(
  BASELINE_SESSIONS_LIST_PARAMS,
);
const EMPTY_SESSIONS_USAGE: SessionsUsagePayload = {
  sessions: [],
  aggregates: {
    byProvider: [],
    byAgent: [],
    messages: {
      total: 0,
      toolCalls: 0,
      errors: 0,
    },
  },
  totals: {
    totalCost: 0,
  },
};

function getOrCreateTtlCacheEntry<TPayload>(
  cache: Map<string, TtlCacheEntry<TPayload>>,
  cacheKey: string,
): TtlCacheEntry<TPayload> {
  const existing = cache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const entry: TtlCacheEntry<TPayload> = {
    payload: null,
    expiresAt: 0,
    inFlight: null,
  };
  cache.set(cacheKey, entry);
  return entry;
}

export function createGatewayWsLoaders(deps: {
  client: GatewayRpcClient | null | undefined;
  requestJson: CaviControlRequestJson;
}) {
  const { client, requestJson } = deps;
  const sessionsListCache = new Map<string, SessionsListCacheEntry>();
  const sessionsUsageCache = new Map<
    string,
    TtlCacheEntry<SessionsUsagePayload>
  >();
  const sessionsPreviewCache = new Map<
    string,
    TtlCacheEntry<SessionsPreviewPayload>
  >();
  const sessionDetailCache = new Map<
    string,
    TtlCacheEntry<SessionDetailPayload>
  >();
  const healthSnapshotCache = new Map<
    string,
    TtlCacheEntry<HealthSnapshotPayload>
  >();
  const logsTailCache = new Map<string, TtlCacheEntry<LogsTailPayload>>();

  const loadSessionsListRaw = async (
    params: SessionsListRequestParams,
  ): Promise<SessionsListPayloadWithCache> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }

    const cacheKey = canonicalizeSessionsListParams(params);
    const cacheEntry =
      sessionsListCache.get(cacheKey) ??
      ({
        lastHash: null,
        payload: null,
        inFlight: null,
      } satisfies SessionsListCacheEntry);
    sessionsListCache.set(cacheKey, cacheEntry);

    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = (async () => {
      const requestParams: SessionsListRequestParams = { ...params };
      if (cacheEntry.lastHash) {
        requestParams.lastHash = cacheEntry.lastHash;
      }

      let response = await c.request<SessionsListRpcPayload>(
        "sessions.list",
        requestParams,
      );

      if (isUnchangedSessionsListPayload(response)) {
        if (cacheEntry.payload) {
          const merged = {
            ...cacheEntry.payload,
            hash: response.hash,
            count:
              typeof response.count === "number"
                ? response.count
                : cacheEntry.payload.count,
            ts: response.ts ?? cacheEntry.payload.ts,
            path: response.path ?? cacheEntry.payload.path,
          } satisfies SessionsListPayloadWithCache;
          cacheEntry.payload = merged;
          cacheEntry.lastHash = response.hash;
          return merged;
        }

        response = await c.request<SessionsListRpcPayload>("sessions.list", {
          ...params,
        });
      }

      const normalized = normalizeSessionsListPayload(response);
      cacheEntry.payload = normalized;
      cacheEntry.lastHash =
        typeof normalized.hash === "string" && normalized.hash.length > 0
          ? normalized.hash
          : null;
      return normalized;
    })().finally(() => {
      cacheEntry.inFlight = null;
    });

    return await cacheEntry.inFlight;
  };

  const loadSessionsUsageRaw = async (
    params: Record<string, unknown>,
  ): Promise<SessionsUsagePayload> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }

    const cacheKey = canonicalizeSessionsUsageParams(params);
    const cacheEntry = getOrCreateTtlCacheEntry(sessionsUsageCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = c
      .request<SessionsUsagePayload>("sessions.usage", params)
      .then((payload) => {
        cacheEntry.payload = payload;
        cacheEntry.expiresAt = Date.now() + SESSIONS_DETAIL_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        cacheEntry.inFlight = null;
      });
    return await cacheEntry.inFlight;
  };

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

  const loadSessionsPreviewRaw = async (params: {
    keys: string[];
    limit?: number;
    maxChars?: number;
  }): Promise<SessionsPreviewPayload> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }

    const cacheKey = canonicalizeSessionsPreviewParams(params);
    const cacheEntry = getOrCreateTtlCacheEntry(sessionsPreviewCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = c
      .request<SessionsPreviewPayload>("sessions.preview", params)
      .then((payload) => {
        cacheEntry.payload = payload;
        cacheEntry.expiresAt = Date.now() + SESSIONS_DETAIL_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        cacheEntry.inFlight = null;
      });
    return await cacheEntry.inFlight;
  };

  const loadSessionDetailRaw = async (params: {
    key: string;
    previewLimit?: number;
    maxChars?: number;
  }): Promise<SessionDetailPayload> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }

    const cacheKey = canonicalizeSessionDetailParams(params);
    const cacheEntry = getOrCreateTtlCacheEntry(sessionDetailCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = c
      .request<SessionDetailPayload>("sessions.detail", params)
      .then((payload) => {
        cacheEntry.payload = payload;
        cacheEntry.expiresAt = Date.now() + SESSIONS_DETAIL_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        cacheEntry.inFlight = null;
      });
    return await cacheEntry.inFlight;
  };

  const loadHealthSnapshotRaw = async (): Promise<HealthSnapshotPayload> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }
    const cacheKey = "health.snapshot";
    const cacheEntry = getOrCreateTtlCacheEntry(healthSnapshotCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }
    cacheEntry.inFlight = c
      .request<HealthSnapshotPayload>("health.snapshot", {})
      .then((payload) => {
        cacheEntry.payload = payload;
        cacheEntry.expiresAt = Date.now() + HEALTH_SNAPSHOT_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        cacheEntry.inFlight = null;
      });
    return await cacheEntry.inFlight;
  };

  const loadLogsTailRaw = async (params: {
    limit: number;
    maxBytes: number;
  }): Promise<LogsTailPayload> => {
    const c = client;
    if (!c) {
      throw new Error("Gateway client not connected");
    }
    const cacheKey = JSON.stringify(params);
    const cacheEntry = getOrCreateTtlCacheEntry(logsTailCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }
    cacheEntry.inFlight = c
      .request<LogsTailPayload>("logs.tail", params)
      .then((payload) => {
        cacheEntry.payload = payload;
        cacheEntry.expiresAt = Date.now() + LOGS_TAIL_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        cacheEntry.inFlight = null;
      });
    return await cacheEntry.inFlight;
  };

  return {
    loadSessionsListRaw,
    loadSessionsUsageRaw,
    loadSessionsPreviewRaw,
    loadSessionDetailRaw,

    loadOverview: async (): Promise<DataEnvelope<OverviewSnapshot>> =>
      withFallback({
        area: "overview",
        expectedContract: "WS sessions.list + sessions.usage + health.snapshot",
        note: "Cavi Control overview via WebSocket unavailable",
        fallback: mockOverview,
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
        fallback: mockAgentRuns,
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
        fallback: mockRunDetailForKey(key),
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

          const baselineRows = sessionsListCache.get(
            BASELINE_SESSIONS_LIST_CACHE_KEY,
          )?.payload?.sessions;
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
        fallback: mockRoutingMatrix,
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
        fallback: mockIncidents,
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
        fallback: mockCostHistory(range),
        run: async () => {
          return await requestJson<CostHistorySnapshot>(
            withQuery(API_COST_HISTORY, { range }),
          );
        },
      }),
  };
}

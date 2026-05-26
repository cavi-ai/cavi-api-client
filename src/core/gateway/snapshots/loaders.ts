import { GATEWAY_PROBE_ENDPOINTS } from "../../../contracts/paths.js";
import type { GatewayResolvedRouteBinding } from "../../../contracts/team-manifest.js";
import { asString } from "../../data/guards.js";
import {
  classifyFallbackError,
  type DataEnvelope,
  withFallback,
} from "../envelope/index.js";
import {
  BASELINE_SESSIONS_LIST_PARAMS,
  EMPTY_SESSIONS_USAGE,
  type SessionLoaders,
} from "./session-loaders.js";
import type { GatewaySystemLoaders } from "./system-loaders.js";
import {
  buildIncidentsSnapshot,
  buildOverviewSnapshot,
  buildRunDetailSnapshot,
  buildRoutingMatrix,
  buildRunsSnapshot,
  normalizeRun,
  utcDateYmd,
  type GatewayIncidentsSnapshot,
  type GatewayCostHistoryRange,
  type GatewayCostHistorySnapshot,
  type GatewayOverviewSnapshot,
  type GatewayRoutingMatrixSnapshot,
  type GatewaySessionRun,
  type GatewaySessionRunDetailSnapshot,
  type GatewaySessionRunsSnapshot,
  type SessionsUsagePayload,
} from "./transforms.js";

export type GatewaySnapshotRunFilters = {
  search: string;
  activeMinutes: number;
  limit: number;
};

export type GatewaySnapshotBindingInput = {
  key?: string | null;
  sessionKey?: string | null;
  source?: string | null;
  channel?: string | null;
  agentId?: string | null;
  actionId?: string | null;
};

export type GatewaySnapshotBindingResolver = (
  input: GatewaySnapshotBindingInput,
) => GatewayResolvedRouteBinding | null;

export type GatewaySnapshotFallbacks = {
  overview: GatewayOverviewSnapshot | (() => GatewayOverviewSnapshot);
  agentRuns: GatewaySessionRunsSnapshot | (() => GatewaySessionRunsSnapshot);
  runDetail:
    | GatewaySessionRunDetailSnapshot
    | ((key: string) => GatewaySessionRunDetailSnapshot);
  routingMatrix:
    | GatewayRoutingMatrixSnapshot
    | ((windowDays: number) => GatewayRoutingMatrixSnapshot);
  incidents: GatewayIncidentsSnapshot | (() => GatewayIncidentsSnapshot);
};

export type GatewayCostHistoryFallback =
  | GatewayCostHistorySnapshot
  | ((range: GatewayCostHistoryRange) => GatewayCostHistorySnapshot);

export type GatewaySnapshotFallbackProvider = {
  snapshots?: GatewaySnapshotFallbacks | (() => GatewaySnapshotFallbacks);
  costHistory?: GatewayCostHistoryFallback;
};

export type GatewaySnapshotFallbackMode = "none" | "empty" | "demo";

export type GatewaySnapshotFallbackOverrides = Partial<GatewaySnapshotFallbacks> & {
  costHistory?: GatewayCostHistoryFallback | null;
};

export type ResolvedGatewaySnapshotFallbacks = {
  snapshots: GatewaySnapshotFallbacks | null;
  costHistory: GatewayCostHistoryFallback | null;
};

export type ResolveGatewaySnapshotFallbacksOptions = {
  mode?: GatewaySnapshotFallbackMode;
  provider?: GatewaySnapshotFallbackProvider | null;
  overrides?: GatewaySnapshotFallbackOverrides | null;
  now?: number;
};

export type CreateGatewaySnapshotLoadersOptions = {
  fallbacks?: GatewaySnapshotFallbacks | null;
  fallbackProvider?: GatewaySnapshotFallbackProvider | null;
  resolveBinding?: GatewaySnapshotBindingResolver | null;
};

export type GatewaySnapshotLoaders = {
  loadOverview: () => Promise<DataEnvelope<GatewayOverviewSnapshot>>;
  loadAgentRuns: (
    filters: GatewaySnapshotRunFilters,
  ) => Promise<DataEnvelope<GatewaySessionRunsSnapshot>>;
  loadRunDetail: (
    key: string,
  ) => Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>>;
  loadRoutingMatrix: (
    windowDays: number,
  ) => Promise<DataEnvelope<GatewayRoutingMatrixSnapshot>>;
  loadIncidents: () => Promise<DataEnvelope<GatewayIncidentsSnapshot>>;
};

function gatewayEnvelope<TData>(data: TData): DataEnvelope<TData> {
  return {
    data,
    source: "gateway",
    fetchedAt: Date.now(),
    contractGaps: [],
  };
}

function resolveValue<TData, TArg>(
  value: TData | ((arg: TArg) => TData),
  arg: TArg,
): TData {
  return typeof value === "function"
    ? (value as (arg: TArg) => TData)(arg)
    : value;
}

function resolveUnitValue<TData>(
  value: TData | (() => TData),
): TData {
  return typeof value === "function" ? (value as () => TData)() : value;
}

async function withOptionalSnapshotFallback<TData>(params: {
  run: () => Promise<TData>;
  fallback: TData | null;
  area: string;
  expectedContract: string;
  note: string;
}): Promise<DataEnvelope<TData>> {
  if (!params.fallback) {
    return gatewayEnvelope(await params.run());
  }
  return await withFallback({
    run: params.run,
    fallback: params.fallback,
    area: params.area,
    expectedContract: params.expectedContract,
    note: params.note,
  });
}

function maybeBindRun(
  run: GatewaySessionRun,
  resolveBinding: GatewaySnapshotBindingResolver | null,
): GatewaySessionRun {
  const binding = resolveBinding?.({
    key: run.key,
    sessionKey: run.key,
    source: run.channel,
    channel: run.channel,
    agentId: run.agentId,
  }) ?? null;
  return binding ? { ...run, binding } : run;
}

function bindRunsSnapshot(
  snapshot: GatewaySessionRunsSnapshot,
  resolveBinding: GatewaySnapshotBindingResolver | null,
): GatewaySessionRunsSnapshot {
  if (!resolveBinding) {
    return snapshot;
  }
  return {
    ...snapshot,
    live: snapshot.live.map((run) => maybeBindRun(run, resolveBinding)),
    history: snapshot.history.map((run) => maybeBindRun(run, resolveBinding)),
  };
}

function bindRunDetailSnapshot(
  snapshot: GatewaySessionRunDetailSnapshot,
  resolveBinding: GatewaySnapshotBindingResolver | null,
): GatewaySessionRunDetailSnapshot {
  if (!resolveBinding || !snapshot.run) {
    return snapshot;
  }
  return {
    ...snapshot,
    run: maybeBindRun(snapshot.run, resolveBinding),
  };
}

function bindRoutingMatrixSnapshot(
  snapshot: GatewayRoutingMatrixSnapshot,
  resolveBinding: GatewaySnapshotBindingResolver | null,
): GatewayRoutingMatrixSnapshot {
  if (!resolveBinding) {
    return snapshot;
  }
  return {
    ...snapshot,
    rows: snapshot.rows.map((row) => {
      const binding = resolveBinding({
        source: row.channel,
        channel: row.channel,
        agentId: row.handler,
      });
      return binding ? { ...row, binding } : row;
    }),
  };
}

export function createEmptyGatewayOverviewSnapshot(
  now = Date.now(),
): GatewayOverviewSnapshot {
  return {
    health: {
      live: false,
      ready: false,
      checkedAt: now,
      probes: {
        healthz: {
          path: GATEWAY_PROBE_ENDPOINTS.healthz,
          ok: false,
          statusCode: 200,
        },
        readyz: {
          path: GATEWAY_PROBE_ENDPOINTS.readyz,
          ok: false,
          statusCode: 503,
          failing: [],
          uptimeMs: null,
        },
      },
    },
    kpis: {
      activeSessions: 0,
      totalSessions: 0,
      totalMessages: 0,
      totalToolCalls: 0,
      totalErrors: 0,
      estimatedCostUsd: 0,
    },
    providerBreakdown: [],
    topAgents: [],
  };
}

export function createEmptyGatewayRunsSnapshot(): GatewaySessionRunsSnapshot {
  return {
    live: [],
    history: [],
    summary: {
      active: 0,
      idle: 0,
      stalled: 0,
      error: 0,
    },
  };
}

export function createEmptyGatewayRunDetailSnapshot(
  key: string,
): GatewaySessionRunDetailSnapshot {
  void key;
  return {
    run: null,
    preview: {
      status: "missing",
      items: [],
    },
    usage: {
      totalTokens: 0,
      totalCostUsd: 0,
      messages: 0,
      toolCalls: 0,
      errors: 0,
    },
  };
}

export function createEmptyGatewayRoutingMatrixSnapshot(): GatewayRoutingMatrixSnapshot {
  return {
    rows: [],
    totals: {
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
    },
  };
}

export function createEmptyGatewayIncidentsSnapshot(): GatewayIncidentsSnapshot {
  return {
    incidents: [],
    blockers: [],
  };
}

export function createEmptyGatewayCostHistorySnapshot(
  range: GatewayCostHistoryRange,
): GatewayCostHistorySnapshot {
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

export function createEmptyGatewaySnapshotFallbacks(): GatewaySnapshotFallbacks {
  return {
    overview: createEmptyGatewayOverviewSnapshot,
    agentRuns: createEmptyGatewayRunsSnapshot,
    runDetail: createEmptyGatewayRunDetailSnapshot,
    routingMatrix: createEmptyGatewayRoutingMatrixSnapshot,
    incidents: createEmptyGatewayIncidentsSnapshot,
  };
}

export function createEmptyGatewaySnapshotFallbackProvider(): GatewaySnapshotFallbackProvider {
  return {
    snapshots: createEmptyGatewaySnapshotFallbacks,
    costHistory: createEmptyGatewayCostHistorySnapshot,
  };
}

export function createDemoGatewaySnapshotFallbacks(
  now = Date.now(),
): GatewaySnapshotFallbacks {
  const run: GatewaySessionRun = {
    key: "demo:agent-alpha:main",
    title: "Demo agent session",
    agentId: "agent-alpha",
    channel: "web",
    updatedAt: now - 60_000,
    status: "active",
    totalTokens: 1200,
    errors: 0,
    model: "demo-model",
    totalCostUsd: 0,
  };
  return {
    overview: {
      ...createEmptyGatewayOverviewSnapshot(now),
      health: {
        ...createEmptyGatewayOverviewSnapshot(now).health,
        live: true,
        ready: true,
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
            uptimeMs: 60_000,
          },
        },
      },
      kpis: {
        activeSessions: 1,
        totalSessions: 1,
        totalMessages: 4,
        totalToolCalls: 1,
        totalErrors: 0,
        estimatedCostUsd: 0,
      },
      providerBreakdown: [{ provider: "demo", tokens: 1200, cost: 0 }],
      topAgents: [{ agentId: "agent-alpha", messages: 4, cost: 0 }],
    },
    agentRuns: {
      live: [run],
      history: [run],
      summary: {
        active: 1,
        idle: 0,
        stalled: 0,
        error: 0,
      },
    },
    runDetail: (key: string) => ({
      run: key === run.key ? run : null,
      preview: {
        status: key === run.key ? "ok" : "missing",
        items: key === run.key
          ? [
              {
                role: "user",
                text: "Start a demo workflow.",
                at: now - 90_000,
              },
              {
                role: "assistant",
                text: "Demo workflow is running.",
                at: now - 60_000,
              },
            ]
          : [],
      },
      usage: {
        totalTokens: key === run.key ? run.totalTokens : 0,
        totalCostUsd: 0,
        messages: key === run.key ? 4 : 0,
        toolCalls: key === run.key ? 1 : 0,
        errors: 0,
      },
    }),
    routingMatrix: {
      rows: [
        {
          channel: "web",
          handler: "agent-alpha",
          totalRuns: 1,
          successRuns: 1,
          failedRuns: 0,
          successRate: 1,
          messages: 4,
        },
      ],
      totals: {
        totalRuns: 1,
        successRuns: 1,
        failedRuns: 0,
      },
    },
    incidents: createEmptyGatewayIncidentsSnapshot,
  };
}

export function createDemoGatewayCostHistorySnapshot(
  range: GatewayCostHistoryRange,
  now = Date.now(),
): GatewayCostHistorySnapshot {
  const bucket = {
    timestamp: now,
    activeSessions: 1,
    totalTokens: 1200,
    estimatedCostUsd: 0,
    totalErrors: 0,
    providerBreakdown: [{ provider: "demo", tokens: 1200, cost: 0 }],
  };
  return {
    range,
    resolution: "demo",
    generatedAt: now,
    buckets: [bucket],
    totals: {
      totalTokens: bucket.totalTokens,
      estimatedCostUsd: bucket.estimatedCostUsd,
      totalErrors: bucket.totalErrors,
    },
  };
}

export function createDemoGatewaySnapshotFallbackProvider(
  now = Date.now(),
): GatewaySnapshotFallbackProvider {
  return {
    snapshots: () => createDemoGatewaySnapshotFallbacks(now),
    costHistory: (range) => createDemoGatewayCostHistorySnapshot(range, now),
  };
}

function resolveFallbackProviderSnapshots(
  provider: GatewaySnapshotFallbackProvider | null,
): GatewaySnapshotFallbacks | null {
  if (!provider?.snapshots) {
    return null;
  }
  return typeof provider.snapshots === "function"
    ? provider.snapshots()
    : provider.snapshots;
}

export function mergeGatewaySnapshotFallbacks(
  base: GatewaySnapshotFallbacks,
  overrides?: Partial<GatewaySnapshotFallbacks> | null,
): GatewaySnapshotFallbacks {
  return {
    ...base,
    ...(overrides ?? {}),
  };
}

export function resolveGatewaySnapshotFallbacks(
  options: ResolveGatewaySnapshotFallbacksOptions = {},
): ResolvedGatewaySnapshotFallbacks {
  const mode = options.mode ?? "empty";
  if (mode === "none") {
    return { snapshots: null, costHistory: null };
  }
  const defaultProvider =
    mode === "demo"
      ? createDemoGatewaySnapshotFallbackProvider(options.now)
      : createEmptyGatewaySnapshotFallbackProvider();
  const provider = options.provider ?? defaultProvider;
  const baseSnapshots =
    resolveFallbackProviderSnapshots(provider) ??
    resolveFallbackProviderSnapshots(defaultProvider) ??
    createEmptyGatewaySnapshotFallbacks();
  const hasCostHistoryOverride =
    !!options.overrides && "costHistory" in options.overrides;
  return {
    snapshots: mergeGatewaySnapshotFallbacks(baseSnapshots, options.overrides),
    costHistory:
      hasCostHistoryOverride
        ? options.overrides?.costHistory ?? null
        : provider.costHistory ?? defaultProvider.costHistory ?? null,
  };
}

export function createGatewaySnapshotLoaders(deps: {
  sessionLoaders: SessionLoaders;
  systemLoaders: GatewaySystemLoaders;
  options?: CreateGatewaySnapshotLoadersOptions;
}): GatewaySnapshotLoaders {
  const {
    loadSessionsListRaw,
    loadSessionsUsageRaw,
    loadSessionsPreviewRaw,
    peekSessionsListCache,
  } = deps.sessionLoaders;
  const { loadHealthSnapshotRaw, loadLogsTailRaw } = deps.systemLoaders;
  const fallbacks =
    deps.options?.fallbacks ??
    resolveFallbackProviderSnapshots(deps.options?.fallbackProvider ?? null);
  const resolveBinding = deps.options?.resolveBinding ?? null;

  const loadSessionsUsageMaybeBestEffort = async (
    params: Record<string, unknown>,
  ): Promise<SessionsUsagePayload> => {
    if (!fallbacks) {
      return await loadSessionsUsageRaw(params);
    }
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
    loadOverview: async (): Promise<DataEnvelope<GatewayOverviewSnapshot>> =>
      await withOptionalSnapshotFallback({
        area: "overview",
        expectedContract: "WS sessions.list + sessions.usage + health.snapshot",
        note: "Gateway overview snapshot unavailable",
        fallback: fallbacks ? resolveUnitValue(fallbacks.overview) : null,
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
      filters: GatewaySnapshotRunFilters,
    ): Promise<DataEnvelope<GatewaySessionRunsSnapshot>> =>
      await withOptionalSnapshotFallback({
        area: "agent-runs",
        expectedContract: "WS sessions.list + sessions.usage",
        note: "Gateway runs snapshot unavailable",
        fallback: fallbacks ? resolveUnitValue(fallbacks.agentRuns) : null,
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
            loadSessionsUsageMaybeBestEffort({
              limit: filters.limit,
              includeContextWeight: false,
            }),
          ]);
          const rows = Array.isArray(listRes.sessions) ? listRes.sessions : [];
          return bindRunsSnapshot(
            buildRunsSnapshot(rows, usageRes),
            resolveBinding,
          );
        },
      }),

    loadRunDetail: async (
      key: string,
    ): Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>> =>
      await withOptionalSnapshotFallback({
        area: "run-detail",
        expectedContract:
          "WS sessions.usage + sessions.list + sessions.preview",
        note: "Gateway run detail snapshot unavailable",
        fallback: fallbacks ? resolveValue(fallbacks.runDetail, key) : null,
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
          return bindRunDetailSnapshot(
            buildRunDetailSnapshot(run, usageSession, preview),
            resolveBinding,
          );
        },
      }),

    loadRoutingMatrix: async (
      windowDays: number,
    ): Promise<DataEnvelope<GatewayRoutingMatrixSnapshot>> =>
      await withOptionalSnapshotFallback({
        area: "routing-matrix",
        expectedContract: "WS sessions.usage",
        note: "Gateway routing snapshot unavailable",
        fallback: fallbacks
          ? resolveValue(fallbacks.routingMatrix, windowDays)
          : null,
        run: async () => {
          const end = new Date();
          const start = new Date(Date.now() - windowDays * 86_400_000);
          const usageRes = await loadSessionsUsageMaybeBestEffort({
            limit: 400,
            startDate: utcDateYmd(start),
            endDate: utcDateYmd(end),
            includeContextWeight: false,
          });
          return bindRoutingMatrixSnapshot(
            buildRoutingMatrix(usageRes),
            resolveBinding,
          );
        },
      }),

    loadIncidents: async (): Promise<DataEnvelope<GatewayIncidentsSnapshot>> =>
      await withOptionalSnapshotFallback({
        area: "incidents",
        expectedContract: "WS logs.tail + sessions.list",
        note: "Gateway incidents snapshot unavailable",
        fallback: fallbacks ? resolveUnitValue(fallbacks.incidents) : null,
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
  };
}

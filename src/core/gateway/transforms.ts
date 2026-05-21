// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

import { GATEWAY_PROBE_ENDPOINTS } from "../../contracts/paths.js";

/**
 * Pure data transformation functions for Gateway / Cavi Control.
 * Zero dependencies. Takes raw gateway WS response payloads and returns
 * composite snapshots the UI needs.
 */

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

export type GatewayOverviewSnapshot = {
  health: GatewayHealthSnapshot;
  kpis: {
    activeSessions: number;
    totalSessions: number;
    totalMessages: number;
    totalToolCalls: number;
    totalErrors: number;
    estimatedCostUsd: number;
  };
  providerBreakdown: Array<{ provider: string; tokens: number; cost: number }>;
  topAgents: Array<{ agentId: string; messages: number; cost: number }>;
};

/** Optional overrides when assembling an overview from paginated gateway payloads. */
export type BuildOverviewSnapshotOptions = {
  /**
   * Authoritative total from `sessions.list` `count` when the returned `sessions`
   * array is only one page; defaults to `sessions.length` when omitted or invalid.
   */
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
  /** Model identifier (e.g. "anthropic/claude-opus-4-6") when usage data provides it */
  model?: string;
  /** Estimated cost in USD when usage data provides it */
  totalCostUsd?: number;
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
  }>;
  totals: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  };
};

export type GatewayIncidentRecord = {
  id: string;
  title: string;
  summary: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "blocked" | "resolved";
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  owner: string;
};

export type GatewayIncidentsSnapshot = {
  incidents: GatewayIncidentRecord[];
  blockers: GatewayIncidentRecord[];
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
  /** Present when the gateway includes a total session count alongside the page. */
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

const ACTIVE_WINDOW_MS = 5 * 60_000;
const STALLED_WINDOW_MS = 30 * 60_000;

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function toIntInRange(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function deriveRunStatus(
  run: GatewaySessionRun,
): GatewaySessionRunStatus {
  return deriveRunStatusAt(run, Date.now());
}

function deriveRunStatusAt(
  run: Pick<GatewaySessionRun, "errors" | "updatedAt">,
  now: number,
): GatewaySessionRunStatus {
  if (run.errors > 0) {
    return "error";
  }
  if (run.updatedAt === null) {
    return "idle";
  }
  const age = now - run.updatedAt;
  if (age <= ACTIVE_WINDOW_MS) {
    return "active";
  }
  if (age >= STALLED_WINDOW_MS) {
    return "stalled";
  }
  return "idle";
}

export function normalizeRun(
  row: RawSessionRow,
  index: number,
): GatewaySessionRun {
  return normalizeRunAt(row, index, Date.now());
}

function normalizeRunAt(
  row: RawSessionRow,
  index: number,
  now: number,
): GatewaySessionRun {
  const title =
    asString(row.label) ?? asString(row.derivedTitle) ?? `Session ${index + 1}`;
  const channel =
    asString(row.channel) ?? asString(row.origin?.provider) ?? "unknown";
  const base: GatewaySessionRun = {
    key: asString(row.key) ?? `unknown-${index}`,
    title,
    agentId: asString(row.agentId) ?? "unknown",
    channel,
    updatedAt: asNumber(row.updatedAt),
    status: "idle",
    totalTokens: asNumber(row.totalTokens) ?? 0,
    errors: row.abortedLastRun === true ? 1 : 0,
  };
  return {
    ...base,
    status: deriveRunStatusAt(base, now),
  };
}

export function resolveRunModel(
  row: RawUsageSession | null | undefined,
): string | undefined {
  if (!row) {
    return undefined;
  }
  const explicitOverride = asString(row.modelOverride);
  if (explicitOverride) {
    return explicitOverride;
  }
  const providerOverride = asString(row.providerOverride);
  const provider =
    providerOverride ??
    asString(row.modelProvider) ??
    asString(row.origin?.provider);
  const model = asString(row.model);
  if (provider && model) {
    return `${provider}/${model}`;
  }
  return model ?? provider ?? undefined;
}

export function extractLogIncident(line: string): {
  severity: GatewayIncidentRecord["severity"];
  title: string;
} | null {
  const lower = line.toLowerCase();
  if (
    !lower.includes("error") &&
    !lower.includes("warn") &&
    !lower.includes("timeout")
  ) {
    return null;
  }
  const severity: GatewayIncidentRecord["severity"] = lower.includes(
    "fatal",
  )
    ? "critical"
    : lower.includes("error")
      ? "high"
      : lower.includes("warn") || lower.includes("timeout")
        ? "medium"
        : "low";
  const title = line.length > 120 ? `${line.slice(0, 117)}...` : line;
  return { severity, title };
}

export function utcDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildOverviewSnapshot(
  sessions: RawSessionRow[],
  usage: SessionsUsagePayload,
  readiness: ReadinessInput,
  options?: BuildOverviewSnapshotOptions,
): GatewayOverviewSnapshot {
  const checkedAt = Date.now();
  const providerBreakdown = Array.isArray(usage.aggregates?.byProvider)
    ? usage.aggregates.byProvider
        .map((entry) => ({
          provider: asString(entry.provider) ?? "unknown",
          tokens: asNumber(entry.totals?.totalTokens) ?? 0,
          cost: asNumber(entry.totals?.totalCost) ?? 0,
        }))
        .sort((left, right) => right.tokens - left.tokens)
    : [];
  const topAgents = Array.isArray(usage.aggregates?.byAgent)
    ? usage.aggregates.byAgent
        .map((entry) => ({
          agentId: asString(entry.agentId) ?? "unknown",
          messages: asNumber(entry.messages) ?? 0,
          cost: asNumber(entry.totals?.totalCost) ?? 0,
        }))
        .sort((left, right) => right.messages - left.messages)
        .slice(0, 5)
    : [];
  const activeSessions = sessions.filter((row) => {
    const updatedAt = asNumber(row.updatedAt);
    return updatedAt !== null && checkedAt - updatedAt <= ACTIVE_WINDOW_MS;
  }).length;

  const totalFromOptions = options?.totalSessions;
  const totalSessions =
    typeof totalFromOptions === "number" &&
    Number.isFinite(totalFromOptions) &&
    totalFromOptions >= 0
      ? Math.trunc(totalFromOptions)
      : sessions.length;

  return {
    health: {
      live: true,
      ready: readiness.ready,
      checkedAt,
      probes: {
        healthz: {
          path: GATEWAY_PROBE_ENDPOINTS.healthz,
          ok: true,
          statusCode: 200,
        },
        readyz: {
          path: GATEWAY_PROBE_ENDPOINTS.readyz,
          ok: readiness.ready,
          statusCode: readiness.statusCode,
          failing: readiness.failing,
          uptimeMs: readiness.uptimeMs,
        },
      },
    },
    kpis: {
      activeSessions,
      totalSessions,
      totalMessages: asNumber(usage.aggregates?.messages?.total) ?? 0,
      totalToolCalls: asNumber(usage.aggregates?.messages?.toolCalls) ?? 0,
      totalErrors: asNumber(usage.aggregates?.messages?.errors) ?? 0,
      estimatedCostUsd: asNumber(usage.totals?.totalCost) ?? 0,
    },
    providerBreakdown,
    topAgents,
  };
}

export function buildRunsSnapshot(
  rows: RawSessionRow[],
  usage: SessionsUsagePayload,
): GatewaySessionRunsSnapshot {
  const now = Date.now();
  const usageByKey = new Map(
    (Array.isArray(usage.sessions) ? usage.sessions : [])
      .map((entry) => {
        const key = asString(entry.key);
        return key ? ([key, entry] as const) : null;
      })
      .filter((entry): entry is readonly [string, RawUsageSession] =>
        Boolean(entry),
      ),
  );
  const normalized = rows.map((row, index) => {
    const base = normalizeRunAt(row, index, now);
    const usageSession = usageByKey.get(base.key) ?? null;
    const totalTokens =
      asNumber(usageSession?.usage?.totalTokens) ?? base.totalTokens;
    return {
      ...base,
      totalTokens,
      model: resolveRunModel(usageSession),
      totalCostUsd: asNumber(usageSession?.usage?.totalCost) ?? undefined,
    };
  });
  const history = [...normalized].sort(
    (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
  );
  const live = history.filter(
    (run) => run.status === "active" || run.status === "idle",
  );
  return {
    live,
    history,
    summary: {
      active: normalized.filter((run) => run.status === "active").length,
      idle: normalized.filter((run) => run.status === "idle").length,
      stalled: normalized.filter((run) => run.status === "stalled").length,
      error: normalized.filter((run) => run.status === "error").length,
    },
  };
}

export type PreviewItem = {
  key?: string;
  status?: string;
  items?: Array<{ role?: string; sender?: string; text?: string; at?: number }>;
};

export function buildRunDetailSnapshot(
  run: GatewaySessionRun | null,
  usageSession: RawUsageSession | null,
  preview: PreviewItem | null | undefined,
): GatewaySessionRunDetailSnapshot {
  const items = Array.isArray(preview?.items)
    ? preview.items.map((item) => ({
        role:
          asString(item.role) ??
          asString((item as { sender?: unknown }).sender) ??
          "unknown",
        text: asString(item.text) ?? "",
        at: asNumber(item.at),
      }))
    : [];
  return {
    run,
    preview: {
      status: asString(preview?.status) ?? "missing",
      items,
    },
    usage: {
      totalTokens: asNumber(usageSession?.usage?.totalTokens) ?? 0,
      totalCostUsd: asNumber(usageSession?.usage?.totalCost) ?? 0,
      messages: asNumber(usageSession?.usage?.messageCounts?.total) ?? 0,
      toolCalls: asNumber(usageSession?.usage?.messageCounts?.toolCalls) ?? 0,
      errors: asNumber(usageSession?.usage?.messageCounts?.errors) ?? 0,
    },
  };
}

export function buildRoutingMatrix(
  usage: SessionsUsagePayload,
): GatewayRoutingMatrixSnapshot {
  const sessions = Array.isArray(usage.sessions) ? usage.sessions : [];
  const matrix = new Map<
    string,
    GatewayRoutingMatrixSnapshot["rows"][number]
  >();
  for (const session of sessions) {
    const handler = asString(session.agentId) ?? "unknown";
    const channel =
      asString(session.channel) ??
      asString(session.origin?.provider) ??
      "unknown";
    const key = `${channel}::${handler}`;
    const errors = asNumber(session.usage?.messageCounts?.errors) ?? 0;
    const messages = asNumber(session.usage?.messageCounts?.total) ?? 0;
    const row = matrix.get(key) ?? {
      channel,
      handler,
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      successRate: 1,
      messages: 0,
    };
    row.totalRuns += 1;
    row.messages += messages;
    if (errors > 0) {
      row.failedRuns += 1;
    } else {
      row.successRuns += 1;
    }
    row.successRate = row.totalRuns > 0 ? row.successRuns / row.totalRuns : 1;
    matrix.set(key, row);
  }
  const rows = Array.from(matrix.values()).sort(
    (left, right) => right.totalRuns - left.totalRuns,
  );
  const totals = rows.reduce(
    (
      acc: {
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
      },
      row,
    ) => {
      acc.totalRuns += row.totalRuns;
      acc.successRuns += row.successRuns;
      acc.failedRuns += row.failedRuns;
      return acc;
    },
    { totalRuns: 0, successRuns: 0, failedRuns: 0 },
  );
  return { rows, totals };
}

export function buildIncidentsSnapshot(
  logs: LogsTailPayload,
  sessions: RawSessionRow[],
): GatewayIncidentsSnapshot {
  const now = Date.now();
  const lines = Array.isArray(logs.lines) ? logs.lines : [];
  const incidents = new Map<string, GatewayIncidentRecord>();
  for (const line of lines) {
    const extracted = extractLogIncident(line);
    if (!extracted) {
      continue;
    }
    const id = `log-${extracted.title.slice(0, 48)}`;
    const existing = incidents.get(id);
    if (!existing) {
      incidents.set(id, {
        id,
        title: extracted.title,
        summary: "Derived from logs.tail until dedicated incident APIs land.",
        severity: extracted.severity,
        status: extracted.severity === "critical" ? "blocked" : "open",
        firstSeenAt: now,
        lastSeenAt: now,
        count: 1,
        owner: "@tony",
      });
      continue;
    }
    existing.count += 1;
    existing.lastSeenAt = now;
  }
  const rows = Array.from(incidents.values()).sort(
    (
      left: GatewayIncidentRecord,
      right: GatewayIncidentRecord,
    ) => {
      const weight: Record<GatewayIncidentRecord["severity"], number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const severityDelta = weight[right.severity] - weight[left.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return right.count - left.count;
    },
  );
  const blockersFromRuns = sessions
    .filter((row) => row.abortedLastRun === true)
    .slice(0, 8)
    .map((row, index) => ({
      id: `abort-${asString(row.key) ?? index}`,
      title: asString(row.label) ?? asString(row.derivedTitle) ?? "Aborted run",
      summary: "Latest run ended with an abort flag.",
      severity: "high" as const,
      status: "blocked" as const,
      firstSeenAt: asNumber(row.updatedAt) ?? now,
      lastSeenAt: asNumber(row.updatedAt) ?? now,
      count: 1,
      owner: asString(row.agentId) ?? "unknown",
    }));
  const blockers = [
    ...rows.filter(
      (incident: GatewayIncidentRecord) => incident.status === "blocked",
    ),
    ...blockersFromRuns,
  ];
  return { incidents: rows, blockers };
}

export function parseGatewaySessionRunsQuery(searchParams: URLSearchParams): {
  search: string;
  activeMinutes: number;
  limit: number;
} {
  return {
    search: searchParams.get("search")?.trim() ?? "",
    activeMinutes: toIntInRange(
      searchParams.get("activeMinutes"),
      60,
      1,
      60 * 24 * 14,
    ),
    limit: toIntInRange(searchParams.get("limit"), 100, 1, 500),
  };
}

export function parseGatewayRoutingQuery(
  searchParams: URLSearchParams,
): {
  windowDays: number;
} {
  return {
    windowDays: toIntInRange(searchParams.get("windowDays"), 7, 1, 90),
  };
}

export const parseGatewayRunsQuery = parseGatewaySessionRunsQuery;

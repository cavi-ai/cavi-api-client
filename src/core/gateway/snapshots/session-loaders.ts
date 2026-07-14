// CANONICAL — single source of truth for sessions.{list,usage,preview,detail} loaders.
// Shared by CAVI and other gateway clients so frontend surfaces use one cache shape.
// Product adapters still own fallback envelopes and snapshot builders.
//
// Pure transport orchestration: takes a `GatewayRpcClient`, returns typed payload accessors with
// per-instance request coalescing and TTL caches. UI layers wrap these for read-aloud, drawers,
// telemetry strips, etc.

import type {
  SessionsListPayload,
  SessionsPreviewPayload,
  SessionsUsagePayload,
} from "./transforms.js";
import type { GatewayRpcClient } from "../rpc/client.js";
import {
  getOrCreateTtlCacheEntry,
  type TtlCacheEntry,
} from "./cache.js";
import {
  createOpenClawSessionOperations,
  type GatewaySessionOperations,
} from "./session-operations.js";

export type SessionHttpRequestJson = <T>(
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
  },
) => Promise<T>;

export type CreateSessionLoadersOptions = {
  /** REST fallback used when the dashboard JSON-RPC websocket is unavailable. */
  requestJson?: SessionHttpRequestJson | null;
  /** Provider-neutral operation seam. Defaults to the released OpenClaw RPC/REST mapping. */
  operations?: GatewaySessionOperations;
};

/** Filters accepted by the gateway's `sessions.list` RPC. Mirrors the web's contract. */
export type SessionsListRequestParams = {
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

/** sessions.list "happy" payload — the gateway returns this when content actually changed. */
export type SessionsListPayloadWithCache = SessionsListPayload & {
  hash?: string;
  count?: number;
  ts?: number;
  path?: string;
};

/** sessions.list "no-op" payload — gateway sends `{ unchanged: true, hash }` when nothing moved. */
export type SessionsListUnchangedPayload = {
  unchanged: true;
  hash: string;
  count?: number;
  ts?: number;
  path?: string;
};

export type SessionsListRpcPayload =
  | SessionsListPayloadWithCache
  | SessionsListUnchangedPayload;

/** sessions.detail payload — kept loose because the gateway shape is still in flux. */
export type SessionDetailPayload = {
  key?: string;
  row?: unknown | null;
  usageSession?: unknown | null;
  preview?: unknown | null;
  errors?: {
    usage?: string | null;
  };
};

export type SessionsPreviewRequestParams = {
  keys: string[];
  limit?: number;
  maxChars?: number;
};

export type SessionDetailRequestParams = {
  key: string;
  previewLimit?: number;
  maxChars?: number;
};

/**
 * sessions.patch params — operator-tunable session settings.
 *
 * `null` clears the value (back to inherit). `undefined` leaves the field untouched.
 * `fastMode` is a tri-state: `true` = on, `false` = off, `null` = inherit, `undefined` = unchanged.
 */
export type SessionPatchInput = {
  key: string;
  label?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
};

type SessionsListCacheEntry = {
  lastHash: string | null;
  payload: SessionsListPayloadWithCache | null;
  inFlight: Promise<SessionsListPayloadWithCache> | null;
};

/** Align with loader `staleTime` (~10–15s) so SSE/stream invalidations coalesce without hammering the gateway. */
export const SESSIONS_DETAIL_CACHE_TTL_MS = 12_000;

export const BASELINE_SESSIONS_LIST_PARAMS: SessionsListRequestParams = {
  limit: 300,
  includeGlobal: true,
  includeUnknown: true,
  includeDerivedTitles: true,
};

export const EMPTY_SESSIONS_USAGE: SessionsUsagePayload = {
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

export function canonicalizeSessionsListParams(
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

export function canonicalizeSessionsUsageParams(
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

export function canonicalizeSessionsPreviewParams(params: {
  keys?: unknown;
  limit?: unknown;
  maxChars?: unknown;
}): string {
  const keys = Array.isArray(params.keys)
    ? [
        ...params.keys
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0),
      ].sort()
    : [];
  return JSON.stringify({
    keys,
    limit: normalizeInt(params.limit, 0),
    maxChars: normalizeInt(params.maxChars, 0),
  });
}

export function canonicalizeSessionDetailParams(params: {
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

export function isUnchangedSessionsListPayload(
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

export function normalizeSessionsListPayload(
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

export type SessionLoaders = {
  loadSessionsListRaw: (
    params: SessionsListRequestParams,
  ) => Promise<SessionsListPayloadWithCache>;
  loadSessionsUsageRaw: (
    params: Record<string, unknown>,
  ) => Promise<SessionsUsagePayload>;
  loadSessionsPreviewRaw: (
    params: SessionsPreviewRequestParams,
  ) => Promise<SessionsPreviewPayload>;
  loadSessionDetailRaw: (
    params: SessionDetailRequestParams,
  ) => Promise<SessionDetailPayload>;
  /**
   * Synchronous read of the sessions.list cache for the given param shape. Returns the cached
   * payload (or null) without triggering a fetch. Lets callers do a fast-path lookup before
   * deciding to issue a real `loadSessionsListRaw` call (e.g. detail-by-key fallback).
   */
  peekSessionsListCache: (
    params: SessionsListRequestParams,
  ) => SessionsListPayloadWithCache | null;
  /**
   * Mutate per-session settings via `sessions.patch`. Fire-and-forget — caller is expected to
   * invalidate any session detail / list / usage query on resolve. No client-side caching.
   */
  patchSession: (params: SessionPatchInput) => Promise<void>;
};

/**
 * Build the sessions loader bundle. Each call returns a fresh closure with its own caches —
 * intended to be created once per app shell (web adapter, mobile gateway query context) and
 * shared across all queries on that surface.
 */
export function createSessionLoaders(
  client: GatewayRpcClient | null | undefined,
  options: CreateSessionLoadersOptions = {},
): SessionLoaders {
  const requestJson = options.requestJson ?? null;
  const operations =
    options.operations ?? createOpenClawSessionOperations(client, requestJson);
  const preserveReleasedRestBehavior =
    !options.operations && !client && Boolean(requestJson);
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

  const loadSessionsListRaw: SessionLoaders["loadSessionsListRaw"] = async (
    params,
  ) => {
    if (preserveReleasedRestBehavior) {
      return normalizeSessionsListPayload(await operations.list(params));
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

      let response = await operations.list(requestParams);

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

        response = await operations.list({ ...params });
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

  const loadSessionsUsageRaw: SessionLoaders["loadSessionsUsageRaw"] = async (
    params,
  ) => {
    if (preserveReleasedRestBehavior) {
      return await operations.usage(params);
    }

    const cacheKey = canonicalizeSessionsUsageParams(params);
    const cacheEntry = getOrCreateTtlCacheEntry(sessionsUsageCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = operations
      .usage(params)
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

  const loadSessionsPreviewRaw: SessionLoaders["loadSessionsPreviewRaw"] =
    async (params) => {
      if (preserveReleasedRestBehavior) {
        return await operations.preview(params);
      }

      const cacheKey = canonicalizeSessionsPreviewParams(params);
      const cacheEntry = getOrCreateTtlCacheEntry(
        sessionsPreviewCache,
        cacheKey,
      );
      if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
        return cacheEntry.payload;
      }
      if (cacheEntry.inFlight) {
        return await cacheEntry.inFlight;
      }

      cacheEntry.inFlight = operations
        .preview(params)
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

  const loadSessionDetailRaw: SessionLoaders["loadSessionDetailRaw"] = async (
    params,
  ) => {
    if (preserveReleasedRestBehavior) {
      return await operations.detail(params);
    }

    const cacheKey = canonicalizeSessionDetailParams(params);
    const cacheEntry = getOrCreateTtlCacheEntry(sessionDetailCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }

    cacheEntry.inFlight = operations
      .detail(params)
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

  const peekSessionsListCache: SessionLoaders["peekSessionsListCache"] = (
    params,
  ) => {
    const cacheKey = canonicalizeSessionsListParams(params);
    return sessionsListCache.get(cacheKey)?.payload ?? null;
  };

  const patchSession: SessionLoaders["patchSession"] = async (params) => {
    await operations.patch(params);
  };

  return {
    loadSessionsListRaw,
    loadSessionsUsageRaw,
    loadSessionsPreviewRaw,
    loadSessionDetailRaw,
    peekSessionsListCache,
    patchSession,
  };
}

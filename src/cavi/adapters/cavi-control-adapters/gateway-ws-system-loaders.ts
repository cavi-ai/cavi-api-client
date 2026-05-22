import type { GatewayRpcClient } from "../../../core/gateway/rpc.js";
import type { LogsTailPayload } from "../../../core/gateway/transforms.js";

export type HealthSnapshotPayload = {
  ready: boolean;
  failing?: unknown[];
  uptimeMs?: number | null;
};

export type GatewayWsSystemLoaders = {
  loadHealthSnapshotRaw: () => Promise<HealthSnapshotPayload>;
  loadLogsTailRaw: (params: {
    limit: number;
    maxBytes: number;
  }) => Promise<LogsTailPayload>;
};

type TtlCacheEntry<TPayload> = {
  payload: TPayload | null;
  expiresAt: number;
  inFlight: Promise<TPayload> | null;
};

const HEALTH_SNAPSHOT_CACHE_TTL_MS = 5_000;
const LOGS_TAIL_CACHE_TTL_MS = 12_000;

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

export function createGatewayWsSystemLoaders(
  client: GatewayRpcClient | null | undefined,
): GatewayWsSystemLoaders {
  const healthSnapshotCache = new Map<
    string,
    TtlCacheEntry<HealthSnapshotPayload>
  >();
  const logsTailCache = new Map<string, TtlCacheEntry<LogsTailPayload>>();

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
    loadHealthSnapshotRaw,
    loadLogsTailRaw,
  };
}

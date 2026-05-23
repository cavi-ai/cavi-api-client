import {
  getOrCreateTtlCacheEntry,
  type TtlCacheEntry,
} from "../cache.js";
import type { GatewayRpcClient } from "../rpc/client.js";
import type { LogsTailPayload } from "./transforms.js";

export type HealthSnapshotPayload = {
  ready: boolean;
  failing?: unknown[];
  uptimeMs?: number | null;
};

export type GatewaySystemLoaders = {
  loadHealthSnapshotRaw: () => Promise<HealthSnapshotPayload>;
  loadLogsTailRaw: (params: {
    limit: number;
    maxBytes: number;
  }) => Promise<LogsTailPayload>;
};

const HEALTH_SNAPSHOT_CACHE_TTL_MS = 5_000;
const LOGS_TAIL_CACHE_TTL_MS = 12_000;

export function createGatewaySystemLoaders(
  client: GatewayRpcClient | null | undefined,
): GatewaySystemLoaders {
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

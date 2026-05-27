import {
  getOrCreateTtlCacheEntry,
  type TtlCacheEntry,
} from "./cache.js";
import type { GatewayRpcClient } from "../rpc/client.js";
import type { LogsTailPayload } from "./transforms.js";
import { GATEWAY_SYSTEM_RPC_METHODS } from "../../../contracts/paths.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function normalizeHealthSnapshotPayload(payload: unknown): HealthSnapshotPayload {
  if (!isRecord(payload)) {
    return {
      ready: false,
      failing: [{ error: "Health payload was not an object" }],
      uptimeMs: null,
    };
  }

  const plugins = isRecord(payload.plugins) ? payload.plugins : null;
  const pluginErrors = Array.isArray(plugins?.errors) ? plugins.errors : [];
  const failing = Array.isArray(payload.failing) ? payload.failing : pluginErrors;
  const ready =
    typeof payload.ready === "boolean"
      ? payload.ready
      : payload.ok === true && failing.length === 0;
  return {
    ready,
    failing,
    uptimeMs:
      readNumber(payload, "uptimeMs") ??
      readNumber(payload, "uptime_ms") ??
      null,
  };
}

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
    const cacheKey = GATEWAY_SYSTEM_RPC_METHODS.health;
    const cacheEntry = getOrCreateTtlCacheEntry(healthSnapshotCache, cacheKey);
    if (cacheEntry.payload && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.payload;
    }
    if (cacheEntry.inFlight) {
      return await cacheEntry.inFlight;
    }
    cacheEntry.inFlight = c
      .request<unknown>(GATEWAY_SYSTEM_RPC_METHODS.health, {})
      .catch(() => c.request<unknown>(GATEWAY_SYSTEM_RPC_METHODS.healthSnapshot, {}))
      .then((payload) => {
        const normalized = normalizeHealthSnapshotPayload(payload);
        cacheEntry.payload = normalized;
        cacheEntry.expiresAt = Date.now() + HEALTH_SNAPSHOT_CACHE_TTL_MS;
        return normalized;
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
      .request<LogsTailPayload>(GATEWAY_SYSTEM_RPC_METHODS.logsTail, params)
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

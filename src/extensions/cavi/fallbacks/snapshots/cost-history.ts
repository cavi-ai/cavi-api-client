import type {
  CostBucket,
  CostHistoryRange,
  CostHistorySnapshot,
} from "../../../../core/gateway/snapshots/contracts.js";
import { fallbackSnapshotNow as now } from "./shared.js";

const PROVIDERS = ["anthropic", "openai", "google"];

function createBucket(params: {
  timestamp: number;
  index: number;
  range: CostHistoryRange;
}): CostBucket {
  const volatility = params.range === "7d" ? 0.18 : params.range === "24h" ? 0.22 : 0.3;
  const oscillation = 1 + Math.sin(params.index / 4) * volatility;
  const baseTokens = params.range === "7d" ? 72_000 : params.range === "24h" ? 24_000 : 8_400;

  const providerBreakdown = PROVIDERS.map((provider, providerIndex) => {
    const providerWeight = providerIndex === 0 ? 0.52 : providerIndex === 1 ? 0.33 : 0.15;
    const tokens = Math.max(0, Math.round(baseTokens * providerWeight * oscillation));
    const costPerToken = provider === "anthropic" ? 0.0000072 : provider === "openai" ? 0.0000061 : 0.0000048;

    return {
      provider,
      tokens,
      cost: Number((tokens * costPerToken).toFixed(4)),
    };
  });

  const totalTokens = providerBreakdown.reduce((sum, item) => sum + item.tokens, 0);
  const estimatedCostUsd = Number(
    providerBreakdown.reduce((sum, item) => sum + item.cost, 0).toFixed(4),
  );

  return {
    timestamp: params.timestamp,
    activeSessions: Math.max(1, Math.round(6 + Math.cos(params.index / 3) * 2 + (params.range === "7d" ? 3 : 0))),
    totalTokens,
    estimatedCostUsd,
    totalErrors: params.index % (params.range === "1h" ? 13 : 19) === 0 ? 1 : 0,
    providerBreakdown,
  };
}

function buildSnapshot(params: {
  range: CostHistoryRange;
  resolution: "1m" | "5m" | "15m" | "1h";
  bucketCount: number;
  stepMs: number;
}): CostHistorySnapshot {
  const buckets = Array.from({ length: params.bucketCount }, (_, index) => {
    const timestamp = now - (params.bucketCount - 1 - index) * params.stepMs;
    return createBucket({ timestamp, index, range: params.range });
  });

  return {
    range: params.range,
    resolution: params.resolution,
    generatedAt: now,
    buckets,
    totals: {
      totalTokens: buckets.reduce((sum, bucket) => sum + bucket.totalTokens, 0),
      estimatedCostUsd: Number(
        buckets.reduce((sum, bucket) => sum + bucket.estimatedCostUsd, 0).toFixed(2),
      ),
      totalErrors: buckets.reduce((sum, bucket) => sum + bucket.totalErrors, 0),
    },
  };
}

const COST_HISTORY_BY_RANGE: Record<CostHistoryRange, CostHistorySnapshot> = {
  "1h": buildSnapshot({
    range: "1h",
    resolution: "1m",
    bucketCount: 60,
    stepMs: 60_000,
  }),
  "6h": buildSnapshot({
    range: "6h",
    resolution: "5m",
    bucketCount: 72,
    stepMs: 5 * 60_000,
  }),
  "24h": buildSnapshot({
    range: "24h",
    resolution: "15m",
    bucketCount: 96,
    stepMs: 15 * 60_000,
  }),
  "7d": buildSnapshot({
    range: "7d",
    resolution: "1h",
    bucketCount: 7 * 24,
    stepMs: 60 * 60_000,
  }),
};

export function fallbackCostHistory(range: CostHistoryRange): CostHistorySnapshot {
  return structuredClone(COST_HISTORY_BY_RANGE[range]);
}

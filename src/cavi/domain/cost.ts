export type CostHistoryRange = "1h" | "6h" | "24h" | "7d";

export type CostBucket = {
  timestamp: number;
  activeSessions: number;
  totalTokens: number;
  estimatedCostUsd: number;
  totalErrors: number;
  providerBreakdown: Array<{ provider: string; tokens: number; cost: number }>;
};

export type CostHistorySnapshot = {
  range: CostHistoryRange;
  resolution: string;
  generatedAt: number;
  buckets: CostBucket[];
  totals: {
    totalTokens: number;
    estimatedCostUsd: number;
    totalErrors: number;
  };
};

export type CostHistoryFilters = {
  range: CostHistoryRange;
};

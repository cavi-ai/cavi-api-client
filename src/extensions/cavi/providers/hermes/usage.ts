import type { CostHistoryRange, CostHistorySnapshot } from "../../../../core/gateway/snapshots/contracts.js";
import type { UsageClient, RuntimeUsageSummary } from "../../../../core/runtime/control-plane/usage.js";
import type { HermesDashboardRestClient } from "./dashboard-rest.js";

export type HermesCaviCostHistorySource = Readonly<{
  getCostHistory(range: CostHistoryRange): Promise<CostHistorySnapshot>;
  range: CostHistoryRange;
  currency: string;
  accountingAuthority: string;
}>;

export type HermesUsageClientOptions = Readonly<{
  rest: HermesDashboardRestClient;
  caviCostHistory?: HermesCaviCostHistorySource;
}>;

function explicit(value: string): boolean {
  return value.trim().length > 0;
}

function rangeDays(range: CostHistoryRange): number {
  switch (range) {
    case "1h": return 1 / 24;
    case "6h": return 1 / 4;
    case "24h": return 1;
    case "7d": return 7;
  }
}

export function createHermesUsageClient(options: HermesUsageClientOptions): UsageClient {
  return {
    async getUsage(): Promise<RuntimeUsageSummary> {
      const payload = await options.rest.getUsage();
      const totals = payload.totals as Record<string, number | null>;
      const input = totals.total_input ?? undefined;
      const output = totals.total_output ?? undefined;
      const tokens = {
        ...(input === undefined ? {} : { inputTokens: input }),
        ...(output === undefined ? {} : { outputTokens: output }),
        ...(input === undefined || output === undefined ? {} : { totalTokens: input + output }),
        ...(totals.total_cache_read === null ? {} : { cacheReadTokens: totals.total_cache_read }),
        raw: {
          ...(totals.total_reasoning === null ? {} : { reasoningTokens: totals.total_reasoning }),
          ...(totals.total_api_calls === null ? {} : { requests: totals.total_api_calls }),
          sessions: totals.total_sessions ?? 0,
        },
      };
      let cost: RuntimeUsageSummary["cost"] = { availability: "unavailable" };
      const source = options.caviCostHistory;
      if (source
        && source.currency === "USD"
        && explicit(source.accountingAuthority)
        && rangeDays(source.range) === payload.period_days) {
        const snapshot = await source.getCostHistory(source.range);
        const amount = snapshot.totals.estimatedCostUsd;
        if (snapshot.range === source.range && Number.isFinite(amount) && amount >= 0) {
          cost = {
            availability: "estimated",
            amount,
            currency: source.currency,
            calculationSource: source.accountingAuthority,
          };
        }
      }
      return {
        tokens,
        cost,
        aggregation: "dashboard-period",
        metadata: {
          provider: "hermes",
          stability: "experimental",
          source: { transport: "http", method: "analytics-usage" },
          providerData: { periodDays: payload.period_days },
        },
      };
    },
  };
}

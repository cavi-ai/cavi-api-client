import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { CostHistorySnapshot } from "../../../../../core/gateway/snapshots/contracts.js";
import type { HermesDashboardRestClient } from "../../../../../extensions/cavi/providers/hermes/dashboard-rest.js";
import { createHermesUsageClient } from "../../../../../extensions/cavi/providers/hermes/usage.js";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../fixtures/hermes/dashboard/rest/analytics-usage.json", import.meta.url,
)), "utf8")) as unknown;

function rest(): HermesDashboardRestClient {
  return { getUsage: vi.fn(async () => fixture) } as unknown as HermesDashboardRestClient;
}

describe("Hermes usage", () => {
  it("maps token and request totals but leaves ungrounded cost and currency unavailable", async () => {
    await expect(createHermesUsageClient({ rest: rest() }).getUsage()).resolves.toEqual({
      tokens: {
        inputTokens: 120, outputTokens: 30, totalTokens: 150, cacheReadTokens: 0,
        raw: { reasoningTokens: 0, requests: 2, sessions: 1 },
      },
      cost: { availability: "unavailable" },
      aggregation: "dashboard-period",
      metadata: {
        provider: "hermes", stability: "experimental",
        source: { transport: "http", method: "analytics-usage" },
        providerData: { periodDays: 7 },
      },
    });
  });

  it("combines optional CAVI cost only with explicit authority and currency", async () => {
    const snapshot = { totals: { estimatedCostUsd: 4.25 } } as CostHistorySnapshot;
    const getCostHistory = vi.fn(async () => snapshot);
    const grounded = createHermesUsageClient({
      rest: rest(), caviCostHistory: { getCostHistory, range: "7d", currency: "USD", accountingAuthority: "cavi-ledger" },
    });
    await expect(grounded.getUsage()).resolves.toMatchObject({
      cost: { availability: "estimated", amount: 4.25, currency: "USD", calculationSource: "cavi-ledger" },
    });
    const ungrounded = createHermesUsageClient({
      rest: rest(), caviCostHistory: { getCostHistory, range: "7d", currency: "", accountingAuthority: "" },
    });
    await expect(ungrounded.getUsage()).resolves.toMatchObject({ cost: { availability: "unavailable" } });
  });
});

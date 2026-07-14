import { describe, expect, it, vi } from "vitest";

import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";
import { createOpenClawUsageClient } from "../../../../providers/openclaw/control-plane/usage.js";

const status = {
  updatedAt: 1_760_000_000_000,
  providers: [{
    provider: "anthropic",
    displayName: "Anthropic",
    windows: [{ label: "5h", usedPercent: 25, resetAt: 1_760_018_000_000 }],
  }],
};

const cost = {
  updatedAt: 1_760_000_000_000,
  days: 2,
  totals: {
    input: 10,
    output: 5,
    cacheRead: 3,
    cacheWrite: 2,
    totalTokens: 20,
    totalCost: 0.01,
    missingCostEntries: 1,
  },
  daily: [{
    date: "2026-01-02",
    input: 10,
    output: 5,
    cacheRead: 3,
    cacheWrite: 2,
    totalTokens: 20,
    totalCost: 0.01,
    missingCostEntries: 1,
  }],
};

const usageMetricKeys = [
  "input",
  "output",
  "cacheRead",
  "cacheWrite",
  "totalTokens",
  "totalCost",
  "missingCostEntries",
] as const;

function createRpc(responses: Record<string, unknown>): OpenClawRpc {
  return {
    request: vi.fn(async (method: string) => responses[method]),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw usage control plane", () => {
  it("requests status and cost once, translating canonical timestamps to UTC dates", async () => {
    const rpc = createRpc({ "usage.status": status, "usage.cost": cost });
    const signal = new AbortController().signal;

    const result = await createOpenClawUsageClient(rpc).getUsage({
      startTime: "2026-01-02T23:30:00-05:00",
      endTime: "2026-01-04T01:00:00+02:00",
      signal,
    });

    expect(rpc.request).toHaveBeenCalledTimes(2);
    expect(rpc.request).toHaveBeenNthCalledWith(1, "usage.status", {}, { signal });
    expect(rpc.request).toHaveBeenNthCalledWith(2, "usage.cost", {
      startDate: "2026-01-03",
      endDate: "2026-01-03",
    }, { signal });
    expect(result).toEqual({
      tokens: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 20,
        cacheReadTokens: 3,
        cacheWriteTokens: 2,
        raw: { missingCostEntries: 1 },
      },
      cost: { availability: "unavailable" },
      aggregation: "daily",
      metadata: {
        provider: "openclaw",
        stability: "experimental",
        source: { transport: "websocket", method: "usage.cost" },
        providerData: {
          updatedAt: "2025-10-09T08:53:20.000Z",
          days: 2,
          status: {
            updatedAt: "2025-10-09T08:53:20.000Z",
            providers: status.providers,
          },
          daily: cost.daily,
          upstreamCostAmount: 0.01,
        },
      },
    });
    expect(result.cost).not.toHaveProperty("currency");
  });

  it("preserves explicit zero metrics while omitting unavailable canonical fields", async () => {
    const rpc = createRpc({
      "usage.status": { updatedAt: status.updatedAt, providers: [] },
      "usage.cost": {
        ...cost,
        totals: { ...cost.totals, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, totalCost: 0 },
        daily: [],
      },
    });

    const result = await createOpenClawUsageClient(rpc).getUsage();

    expect(result.tokens).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      raw: { missingCostEntries: 1 },
    });
    expect(result.cost).toEqual({ availability: "unavailable" });
    expect(result.cost).not.toHaveProperty("currency");
  });

  it.each(usageMetricKeys)("rejects an omitted required totals metric: %s", async (metric) => {
    const totals = { ...cost.totals };
    delete totals[metric];
    const rpc = createRpc({
      "usage.status": status,
      "usage.cost": { ...cost, totals },
    });

    await expect(createOpenClawUsageClient(rpc).getUsage()).rejects.toMatchObject<ApiClientError>({ code: ApiClientErrorCode.TransportProtocolError });
    expect(rpc.request).toHaveBeenCalledTimes(2);
  });

  it.each(usageMetricKeys)("rejects an omitted required daily metric: %s", async (metric) => {
    const daily = { ...cost.daily[0] };
    delete daily[metric];
    const rpc = createRpc({
      "usage.status": status,
      "usage.cost": { ...cost, daily: [daily] },
    });

    await expect(createOpenClawUsageClient(rpc).getUsage()).rejects.toMatchObject<ApiClientError>({ code: ApiClientErrorCode.TransportProtocolError });
    expect(rpc.request).toHaveBeenCalledTimes(2);
  });

  it.each(usageMetricKeys.flatMap((metric) => [NaN, Infinity, -1].map((value) => [metric, value] as const)))(
    "rejects malformed totals metric %s=%s without retry",
    async (metric, value) => {
      const rpc = createRpc({
        "usage.status": status,
        "usage.cost": { ...cost, totals: { ...cost.totals, [metric]: value } },
      });

      await expect(createOpenClawUsageClient(rpc).getUsage()).rejects.toMatchObject<ApiClientError>({ code: ApiClientErrorCode.TransportProtocolError });
      expect(rpc.request).toHaveBeenCalledTimes(2);
    },
  );

  it.each(usageMetricKeys.flatMap((metric) => [NaN, Infinity, -1].map((value) => [metric, value] as const)))(
    "rejects malformed daily metric %s=%s without retry",
    async (metric, value) => {
      const rpc = createRpc({
        "usage.status": status,
        "usage.cost": { ...cost, daily: [{ ...cost.daily[0], [metric]: value }] },
      });

      await expect(createOpenClawUsageClient(rpc).getUsage()).rejects.toMatchObject<ApiClientError>({ code: ApiClientErrorCode.TransportProtocolError });
      expect(rpc.request).toHaveBeenCalledTimes(2);
    },
  );

  it("propagates abort errors without retry", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const rpc = createRpc({});
    vi.mocked(rpc.request).mockRejectedValue(abort);

    await expect(createOpenClawUsageClient(rpc).getUsage()).rejects.toBe(abort);
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("is wired by the factory", async () => {
    const rpc = createRpc({ "usage.status": status, "usage.cost": cost });
    const plane = await createOpenClawRuntimeControlClient({ rpc });

    await expect(plane.usage.getUsage()).resolves.toMatchObject({ cost: { availability: "unavailable" } });
  });
});

import { toError } from "../../../core/errors.js";
import type { RuntimeUsage } from "../../../core/runtime/usage.js";
import type {
  RuntimeUsageQuery,
  RuntimeUsageSummary,
} from "../../../core/runtime/control-plane/usage.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";

import { normalizeTimestamp } from "./normalize.js";
import type { OpenClawRpc } from "./rpc.js";
import { parseOpenClaw } from "./protocol-error.js";
import { parseUsageCost, parseUsageStatus } from "./wire.js";

type UsageOptions = RuntimeUsageQuery & { signal?: AbortSignal };
type WireUsageMetrics = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  missingCostEntries: number;
};

async function request(
  rpc: OpenClawRpc,
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await rpc.request(method, params, { signal });
  } catch (error) {
    throw toError(error, `OpenClaw ${method} request failed`);
  }
}

function utcDate(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${field} must be a valid timestamp`);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function costParams(query: RuntimeUsageQuery): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (query.startTime !== undefined) params.startDate = utcDate(query.startTime, "startTime");
  if (query.endTime !== undefined) params.endDate = utcDate(query.endTime, "endTime");
  return params;
}

function metadata(
  status: Record<string, unknown>,
  cost: Record<string, unknown>,
): RuntimeControlPlaneMetadata {
  return {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method: "usage.cost" },
    providerData: {
      updatedAt: normalizeTimestamp(cost.updatedAt as number),
      days: cost.days,
      status: {
        updatedAt: normalizeTimestamp(status.updatedAt as number),
        providers: status.providers,
      },
      daily: cost.daily,
      upstreamCostAmount: (cost.totals as WireUsageMetrics).totalCost,
    },
  };
}

function tokens(totals: WireUsageMetrics): RuntimeUsage {
  return {
    inputTokens: totals.input,
    outputTokens: totals.output,
    totalTokens: totals.totalTokens,
    cacheReadTokens: totals.cacheRead,
    cacheWriteTokens: totals.cacheWrite,
    raw: { missingCostEntries: totals.missingCostEntries },
  };
}

export function createOpenClawUsageClient(rpc: OpenClawRpc) {
  return {
    async getUsage(query: UsageOptions = {}): Promise<RuntimeUsageSummary> {
      const params = costParams(query);
      const statusPayload = await request(rpc, "usage.status", {}, query.signal);
      const status = parseOpenClaw("usage.status", () => parseUsageStatus(statusPayload));
      const costPayload = await request(rpc, "usage.cost", params, query.signal);
      const cost = parseOpenClaw("usage.cost", () => parseUsageCost(costPayload));
      const totals = cost.totals as WireUsageMetrics;
      return {
        tokens: tokens(totals),
        cost: { availability: "unavailable" },
        aggregation: "daily",
        metadata: metadata(status, cost),
      };
    },
  };
}

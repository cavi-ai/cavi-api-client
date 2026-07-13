import type { RuntimeUsage } from "../usage.js";
import type { RuntimeControlPlaneMetadata } from "./types.js";

export interface RuntimeUsageQuery {
  startTime?: string;
  endTime?: string;
  providerId?: string;
  model?: string;
  sessionId?: string;
  agentId?: string;
}

export interface RuntimeUsageCost {
  availability: "available" | "estimated" | "unavailable";
  amount?: number;
  currency?: string;
  calculationSource?: string;
}

export interface RuntimeUsageSummary {
  tokens: RuntimeUsage;
  cost: RuntimeUsageCost;
  aggregation?: string;
  metadata: RuntimeControlPlaneMetadata;
}

export interface UsageClient {
  getUsage(query?: RuntimeUsageQuery): Promise<RuntimeUsageSummary>;
}

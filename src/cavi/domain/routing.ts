import type { GatewayResolvedRouteBinding } from "../../contracts/team-manifest.js";

export type RoutingMatrixRow = {
  channel: string;
  handler: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  messages: number;
  binding?: GatewayResolvedRouteBinding | null;
};

export type RoutingMatrixSnapshot = {
  rows: RoutingMatrixRow[];
  totals: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  };
};

export type RoutingMatrixRow = {
  channel: string;
  handler: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  messages: number;
};

export type RoutingMatrixSnapshot = {
  rows: RoutingMatrixRow[];
  totals: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  };
};

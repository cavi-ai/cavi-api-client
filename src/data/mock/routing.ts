import type { RoutingMatrixSnapshot } from "../../domain/index.js";

export const mockRoutingMatrix: RoutingMatrixSnapshot = {
  rows: [
    {
      channel: "discord",
      handler: "tony",
      totalRuns: 42,
      successRuns: 39,
      failedRuns: 3,
      successRate: 39 / 42,
      messages: 544,
    },
    {
      channel: "discord",
      handler: "inspectah-deck",
      totalRuns: 17,
      successRuns: 12,
      failedRuns: 5,
      successRate: 12 / 17,
      messages: 198,
    },
    {
      channel: "webchat",
      handler: "method-man-frontend",
      totalRuns: 11,
      successRuns: 11,
      failedRuns: 0,
      successRate: 1,
      messages: 149,
    },
  ],
  totals: {
    totalRuns: 70,
    successRuns: 62,
    failedRuns: 8,
  },
};

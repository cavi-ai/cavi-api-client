import { describe, expect, it, vi } from "vitest";
import {
  createEmptyGatewaySnapshotFallbacks,
  resolveGatewaySnapshotFallbacks,
  createGatewaySnapshotLoaders,
  type GatewaySnapshotFallbacks,
} from "../../../core/gateway/snapshots/loaders";
import type { SessionLoaders } from "../../../core/gateway/snapshots/session-loaders";
import type { GatewaySystemLoaders } from "../../../core/gateway/snapshots/system-loaders";

function createSessionLoaders(
  overrides: Partial<SessionLoaders> = {},
): SessionLoaders {
  const loadSessionsListRaw = vi.fn(async () => ({
    sessions: [
      {
        key: "agent:alpha:main",
        label: "Alpha session",
        agentId: "alpha",
        channel: "web",
        updatedAt: Date.now(),
      },
    ],
    count: 1,
  }));
  return {
    loadSessionsListRaw,
    loadSessionsUsageRaw: vi.fn(async () => ({
      sessions: [
        {
          key: "agent:alpha:main",
          agentId: "alpha",
          channel: "web",
          usage: {
            totalTokens: 123,
            totalCost: 0.5,
            messageCounts: {
              total: 4,
              toolCalls: 1,
              errors: 0,
            },
          },
        },
      ],
      aggregates: {
        byProvider: [
          {
            provider: "demo",
            totals: { totalTokens: 123, totalCost: 0.5 },
          },
        ],
        byAgent: [
          {
            agentId: "alpha",
            totals: { totalCost: 0.5 },
            messages: 4,
          },
        ],
        messages: { total: 4, toolCalls: 1, errors: 0 },
      },
      totals: { totalCost: 0.5 },
    })),
    loadSessionsPreviewRaw: vi.fn(async () => ({
      previews: [
        {
          key: "agent:alpha:main",
          status: "ok",
          items: [{ role: "assistant", text: "Ready", at: 1 }],
        },
      ],
    })),
    loadSessionDetailRaw: vi.fn(async () => ({})),
    peekSessionsListCache: vi.fn(() => ({
      sessions: [
        {
          key: "agent:alpha:main",
          label: "Alpha session",
          agentId: "alpha",
          channel: "web",
          updatedAt: Date.now(),
        },
      ],
    })),
    patchSession: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createSystemLoaders(
  overrides: Partial<GatewaySystemLoaders> = {},
): GatewaySystemLoaders {
  return {
    loadHealthSnapshotRaw: vi.fn(async () => ({
      ready: true,
      failing: [],
      uptimeMs: 1000,
    })),
    loadLogsTailRaw: vi.fn(async () => ({
      lines: ["warn: transient queue delay"],
    })),
    ...overrides,
  };
}

describe("createGatewaySnapshotLoaders", () => {
  it("builds gateway snapshots from session and system loaders", async () => {
    const loaders = createGatewaySnapshotLoaders({
      sessionLoaders: createSessionLoaders(),
      systemLoaders: createSystemLoaders(),
      options: {
        resolveBinding: (input) =>
          input.channel === "web"
            ? {
                id: "web-alpha",
                teamId: "alpha-team",
                memberId: "alpha",
                source: "web",
                channel: "web",
                actionId: null,
                routeKey: "runs",
                path: "/api/teams/alpha-team/runs",
              }
            : null,
      },
    });

    const overview = await loaders.loadOverview();
    const runs = await loaders.loadAgentRuns({
      search: "",
      activeMinutes: 60,
      limit: 10,
    });
    const detail = await loaders.loadRunDetail("agent:alpha:main");
    const routing = await loaders.loadRoutingMatrix(7);
    const incidents = await loaders.loadIncidents();

    expect(overview.source).toBe("gateway");
    expect(overview.data.kpis.totalSessions).toBe(1);
    expect(runs.data.history[0]?.binding?.path).toBe("/api/teams/alpha-team/runs");
    expect(detail.data.run?.binding?.teamId).toBe("alpha-team");
    expect(routing.data.rows[0]?.binding?.id).toBe("web-alpha");
    expect(incidents.data.incidents[0]?.owner).toBe("gateway");
  });

  it("propagates loader errors when fallbacks are disabled", async () => {
    const loaders = createGatewaySnapshotLoaders({
      sessionLoaders: createSessionLoaders({
        loadSessionsListRaw: vi.fn(async () => {
          throw new Error("fetch failed");
        }),
      }),
      systemLoaders: createSystemLoaders(),
      options: { fallbacks: null },
    });

    await expect(loaders.loadAgentRuns({
      search: "",
      activeMinutes: 60,
      limit: 10,
    })).rejects.toThrow(/fetch failed/u);
  });

  it("uses neutral empty fallbacks when requested", async () => {
    const loaders = createGatewaySnapshotLoaders({
      sessionLoaders: createSessionLoaders({
        loadSessionsListRaw: vi.fn(async () => {
          throw new Error("Gateway client not connected");
        }),
      }),
      systemLoaders: createSystemLoaders(),
      options: { fallbacks: createEmptyGatewaySnapshotFallbacks() },
    });

    const runs = await loaders.loadAgentRuns({
      search: "",
      activeMinutes: 60,
      limit: 10,
    });

    expect(runs.source).toBe("mock");
    expect(runs.data.history).toEqual([]);
    expect(runs.contractGaps[0]?.note).toMatch(/Gateway runs snapshot unavailable/u);
  });

  it("accepts custom injected fallbacks", async () => {
    const customFallbacks: GatewaySnapshotFallbacks = {
      ...createEmptyGatewaySnapshotFallbacks(),
      agentRuns: {
        live: [],
        history: [
          {
            key: "custom:run",
            title: "Custom fallback",
            agentId: "custom-agent",
            channel: "custom",
            updatedAt: null,
            status: "idle",
            totalTokens: 0,
            errors: 0,
          },
        ],
        summary: { active: 0, idle: 1, stalled: 0, error: 0 },
      },
    };
    const loaders = createGatewaySnapshotLoaders({
      sessionLoaders: createSessionLoaders({
        loadSessionsListRaw: vi.fn(async () => {
          throw new Error("Gateway client not connected");
        }),
      }),
      systemLoaders: createSystemLoaders(),
      options: { fallbacks: customFallbacks },
    });

    const runs = await loaders.loadAgentRuns({
      search: "",
      activeMinutes: 60,
      limit: 10,
    });

    expect(runs.source).toBe("mock");
    expect(runs.data.history[0]?.key).toBe("custom:run");
  });

  it("resolves fallback providers with caller overrides", () => {
    const resolved = resolveGatewaySnapshotFallbacks({
      mode: "empty",
      provider: {
        snapshots: () => ({
          ...createEmptyGatewaySnapshotFallbacks(),
          agentRuns: {
            live: [],
            history: [
              {
                key: "provider:run",
                title: "Provider fallback",
                agentId: "provider-agent",
                channel: "provider",
                updatedAt: null,
                status: "idle",
                totalTokens: 0,
                errors: 0,
              },
            ],
            summary: { active: 0, idle: 1, stalled: 0, error: 0 },
          },
        }),
        costHistory: (range) => ({
          range,
          resolution: "provider",
          generatedAt: 1,
          buckets: [],
          totals: {
            totalTokens: 0,
            estimatedCostUsd: 0,
            totalErrors: 0,
          },
        }),
      },
      overrides: {
        incidents: {
          incidents: [],
          blockers: [
            {
              id: "override",
              title: "Override blocker",
              summary: "Caller override wins",
              severity: "low",
              status: "open",
              firstSeenAt: 1,
              lastSeenAt: 1,
              count: 1,
              owner: "test",
            },
          ],
        },
      },
    });

    expect(resolved.snapshots?.agentRuns).toMatchObject({
      history: [{ key: "provider:run" }],
    });
    expect(resolved.snapshots?.incidents).toMatchObject({
      blockers: [{ id: "override" }],
    });
    expect(typeof resolved.costHistory).toBe("function");

    const partialProvider = resolveGatewaySnapshotFallbacks({
      mode: "empty",
      provider: {
        snapshots: createEmptyGatewaySnapshotFallbacks,
      },
    });
    expect(typeof partialProvider.costHistory).toBe("function");

    const disabledCostHistory = resolveGatewaySnapshotFallbacks({
      mode: "empty",
      overrides: { costHistory: null },
    });
    expect(disabledCostHistory.costHistory).toBeNull();
  });
});
